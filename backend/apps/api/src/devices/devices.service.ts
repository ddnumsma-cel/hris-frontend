import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { DeviceCommand, DeviceStatus, DeviceSyncPlan } from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { AuditService } from '../audit/audit.service';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUNCH_PROTOCOL, type PunchProtocolAdapter } from './punch-protocol';

export const MOBILE_DEVICE_SERIAL = 'MOBILE-APP';
const ONLINE_WINDOW_MS = 5 * 60_000;
/** Commands handed to a terminal per check-in. */
const COMMANDS_PER_CHECKIN = 20;
/** A sent command with no reply after this long is sent again. */
const RESEND_AFTER_MS = 5 * 60_000;
/** How often online terminals are checked for missing employees. */
const READD_EVERY_MS = 60 * 60_000;
/** How long to give a terminal to send its user list before re-adding. */
const READD_ANSWER_WAIT_MS = 3 * 60_000;

@Injectable()
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DevicesService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  /**
   * Every hour, online terminals are asked for their user list and any active employee missing from it is added back
   * (same device ID), and separated employees are deleted from it. ZKTeco terminals drop a user whose last face or
   * fingerprint is deleted.
   * Off in tests, or with DEVICE_AUTO_READD=off.
   */
  onModuleInit() {
    if (process.env.VITEST || process.env.DEVICE_AUTO_READD === 'off') return;
    const run = () => void this.checkTerminals().catch((e) => this.logger.error(`Hourly terminal check failed: ${e}`));
    this.timers.push(setTimeout(run, 2 * 60_000), setInterval(run, READD_EVERY_MS));
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }

  /** Ask each online terminal for its users, then re-add whoever is missing once it has answered. */
  async checkTerminals(): Promise<void> {
    const online = await this.prisma.device.findMany({
      where: { serial: { not: MOBILE_DEVICE_SERIAL }, lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    });
    for (const d of online) {
      const asked = new Date();
      await this.refreshUsers(d.serial, null);
      this.timers.push(
        setTimeout(
          () => void this.readdMissing(d.serial, asked).catch((e) => this.logger.error(`${d.serial}: re-add failed: ${e}`)),
          READD_ANSWER_WAIT_MS,
        ),
      );
    }
  }

  /**
   * From a user list the terminal sent after `asked`: remove separated employees, then add back active employees
   * missing from it. Users who aren't on any HRIS record (tests, visitors) are left alone.
   */
  async readdMissing(serial: string, asked: Date): Promise<string[]> {
    const fresh = await this.prisma.deviceUser.count({ where: { deviceSerial: serial, seenAt: { gte: asked } } });
    if (!fresh) {
      this.logger.warn(`${serial}: no user list since ${asked.toISOString()}; nothing re-added this time`);
      return [];
    }
    const { toAdd, toDelete } = await this.syncPlan(serial);
    await this.removeSeparated(serial, toDelete);
    if (!toAdd.length) return [];
    await this.queue(serial, toAdd.map((u) => this.protocol.upsertUserCommand(u.pin, u.name)), null);
    await this.audit.log({
      actorId: null,
      action: 'DEVICE_USERS_READDED',
      entity: 'Device',
      entityId: serial,
      after: { readded: toAdd.map((u) => `${u.pin} ${u.name}`) },
    });
    this.logger.log(`${serial}: re-added ${toAdd.map((u) => u.pin).join(', ')}`);
    return toAdd.map((u) => u.pin);
  }

  /** Delete the terminal's users who are separated employees (this also deletes their face and fingerprints there). */
  private async removeSeparated(serial: string, extras: { pin: string; name: string | null }[]): Promise<string[]> {
    const separated = await this.employees.separatedPins();
    const gone = extras.filter((u) => separated.has(u.pin));
    if (!gone.length) return [];
    await this.queue(serial, gone.map((u) => this.protocol.deleteUserCommand(u.pin)), null);
    await this.prisma.deviceUser.deleteMany({ where: { deviceSerial: serial, pin: { in: gone.map((u) => u.pin) } } });
    await this.audit.log({
      actorId: null,
      action: 'DEVICE_USERS_SEPARATED_REMOVED',
      entity: 'Device',
      entityId: serial,
      after: { removed: gone.map((u) => `${u.pin} ${u.name ?? ''}`.trim()) },
    });
    this.logger.log(`${serial}: removed separated ${gone.map((u) => u.pin).join(', ')}`);
    return gone.map((u) => u.pin);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    @Inject(PUNCH_PROTOCOL) private readonly protocol: PunchProtocolAdapter,
  ) {}

  // ---------- Keeping the terminals' user lists in step with the HRIS ----------

  private async device(serial: string) {
    const d = await this.prisma.device.findUnique({ where: { serial } });
    if (!d) throw new NotFoundException('No terminal with that serial');
    return d;
  }

  private async queue(serial: string, commands: string[], requestedBy: string | null) {
    if (commands.length)
      await this.prisma.deviceCommand.createMany({
        data: commands.map((command) => ({ deviceSerial: serial, command, requestedBy })),
      });
  }

  /** The reply to a terminal's check-in: its waiting commands (marked sent), or "OK" when there are none. */
  async commandsFor(serial: string): Promise<string> {
    const resendBefore = new Date(Date.now() - RESEND_AFTER_MS);
    const due = await this.prisma.deviceCommand.findMany({
      where: {
        deviceSerial: serial,
        OR: [{ status: 'PENDING' }, { status: 'SENT', sentAt: { lt: resendBefore } }],
      },
      orderBy: { id: 'asc' },
      take: COMMANDS_PER_CHECKIN,
    });
    if (!due.length) return 'OK';
    await this.prisma.deviceCommand.updateMany({
      where: { id: { in: due.map((c) => c.id) } },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return this.protocol.formatCommands(due);
  }

  /** The terminal's replies to commands. */
  async commandReplies(serial: string, body: string, ip?: string): Promise<void> {
    await this.touch(serial, ip);
    for (const r of this.protocol.parseCommandReplies(body)) {
      await this.prisma.deviceCommand.updateMany({
        where: { id: r.id, deviceSerial: serial },
        data: { status: r.ok ? 'DONE' : 'FAILED', result: `Return=${r.code}`, doneAt: new Date() },
      });
      if (!r.ok) this.logger.warn(`${serial}: command ${r.id} failed (Return=${r.code})`);
    }
  }

  /** Users a terminal uploaded (its user list, or users added or changed on it). */
  async recordUsers(serial: string, body: string): Promise<number> {
    const users = this.protocol.parseUsers(body);
    for (const u of users)
      await this.prisma.deviceUser.upsert({
        where: { deviceSerial_pin: { deviceSerial: serial, pin: u.pin } },
        create: { deviceSerial: serial, pin: u.pin, name: u.name },
        update: { name: u.name, seenAt: new Date() },
      });
    return users.length;
  }

  /** Ask a terminal for its full user list (the old list is forgotten until it answers). */
  async refreshUsers(serial: string, actorId: string | null): Promise<void> {
    await this.device(serial);
    await this.prisma.deviceUser.deleteMany({ where: { deviceSerial: serial } });
    await this.queue(serial, [this.protocol.queryUsersCommand()], actorId);
  }

  /** Who syncing would add to and delete from a terminal. Nothing is sent. */
  async syncPlan(serial: string): Promise<DeviceSyncPlan> {
    await this.device(serial);
    const [onDevice, active, pending] = await Promise.all([
      this.prisma.deviceUser.findMany({ where: { deviceSerial: serial }, orderBy: { pin: 'asc' } }),
      this.employees.devicePins(),
      this.prisma.deviceCommand.count({ where: { deviceSerial: serial, status: { in: ['PENDING', 'SENT'] } } }),
    ]);
    const devicePins = new Set(onDevice.map((u) => u.pin));
    const activePins = new Set(active.map((e) => e.pin));
    const reported = onDevice.reduce<Date | null>((latest, u) => (!latest || u.seenAt > latest ? u.seenAt : latest), null);
    return {
      serial,
      usersReportedAt: reported?.toISOString() ?? null,
      onDevice: onDevice.length,
      toAdd: active.filter((e) => !devicePins.has(e.pin)).map((e) => ({ pin: e.pin, name: e.name })),
      toDelete: onDevice.filter((u) => !activePins.has(u.pin)).map((u) => ({ pin: u.pin, name: u.name })),
      pendingCommands: pending,
    };
  }

  /**
   * Send the plan: add the active employees missing from the terminal, and (only when asked) delete its users who
   * aren't active employees. Never clears the terminal. Faces and fingerprints are still registered at the terminal.
   */
  async sync(serial: string, deleteExtras: boolean, actorId: string): Promise<DeviceSyncPlan> {
    const plan = await this.syncPlan(serial);
    const commands = [
      ...plan.toAdd.map((u) => this.protocol.upsertUserCommand(u.pin, u.name)),
      ...(deleteExtras ? plan.toDelete.map((u) => this.protocol.deleteUserCommand(u.pin)) : []),
    ];
    await this.queue(serial, commands, actorId);
    if (deleteExtras && plan.toDelete.length)
      await this.prisma.deviceUser.deleteMany({
        where: { deviceSerial: serial, pin: { in: plan.toDelete.map((u) => u.pin) } },
      });
    await this.audit.log({
      actorId,
      action: 'DEVICE_USERS_SYNCED',
      entity: 'Device',
      entityId: serial,
      after: { added: plan.toAdd.map((u) => u.pin), deleted: deleteExtras ? plan.toDelete.map((u) => u.pin) : [] },
    });
    return this.syncPlan(serial);
  }

  /** A new hire goes onto every terminal right away (they still register a face or finger there). */
  async addEmployeeToTerminals(employeeId: string): Promise<void> {
    const e = (await this.employees.devicePins()).find((x) => x.id === employeeId);
    if (!e) return;
    const devices = await this.prisma.device.findMany({ where: { serial: { not: MOBILE_DEVICE_SERIAL } } });
    for (const d of devices) await this.queue(d.serial, [this.protocol.upsertUserCommand(e.pin, e.name)], null);
  }

  async recentCommands(serial: string): Promise<DeviceCommand[]> {
    await this.device(serial);
    const rows = await this.prisma.deviceCommand.findMany({
      where: { deviceSerial: serial },
      orderBy: { id: 'desc' },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      command: c.command,
      status: c.status,
      result: c.result,
      createdAt: c.createdAt.toISOString(),
      doneAt: c.doneAt?.toISOString() ?? null,
    }));
  }

  /** Record that a terminal checked in. Unknown serials are rejected. */
  async touch(serial: string, ip?: string) {
    const device = await this.prisma.device.findUnique({ where: { serial } });
    if (!device) {
      this.logger.warn(`Rejected unknown terminal ${serial} from ${ip ?? '?'}`);
      throw new ForbiddenException('Unknown device');
    }
    await this.prisma.device.update({
      where: { serial },
      data: { lastSeenAt: new Date(), lastIp: ip ?? device.lastIp },
    });
    return device;
  }

  handshake(serial: string) {
    return this.protocol.handshakeResponse(serial);
  }

  /** Store an attendance upload from a terminal (idempotent) and recompute affected DTRs. */
  async ingest(serial: string, table: string | undefined, body: string, ip?: string) {
    await this.touch(serial, ip);
    const kind = (table ?? 'ATTLOG').toUpperCase();
    // User list or user changes (OPERLOG carries "USER PIN=..." lines among other operation logs).
    if (kind === 'OPERLOG' || kind === 'USERINFO' || kind === 'USER') {
      const users = await this.recordUsers(serial, body);
      if (users) this.logger.log(`${serial}: ${users} user(s) reported`);
    }
    if (kind !== 'ATTLOG') return { received: 0, inserted: 0, unknownPins: 0, rejected: 0 };
    const { punches, rejected } = this.protocol.parseAttendance(body);
    const pins = await this.employees.resolvePins([...new Set(punches.map((p) => p.pin))]);
    const known = punches.filter((p) => pins.has(p.pin));
    const result = await this.attendance.recordPunches(
      known.map((p) => ({
        employeeId: pins.get(p.pin)!,
        deviceSerial: serial,
        punchedAt: p.punchedAt,
        verifyMode: p.verifyMode,
      })),
    );
    if (punches.length !== known.length)
      this.logger.warn(
        `${serial}: ${punches.length - known.length} punch(es) with unknown PIN ignored`,
      );
    return { ...result, unknownPins: punches.length - known.length, rejected };
  }

  async status(siteId?: string, now = new Date()): Promise<DeviceStatus[]> {
    const devices = await this.prisma.device.findMany({
      where: siteId ? { siteId } : {},
      include: { site: true },
      orderBy: { serial: 'asc' },
    });
    return devices.map((d) => ({
      serial: d.serial,
      name: d.name,
      siteName: d.site.name,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      online: !!d.lastSeenAt && now.getTime() - d.lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
    }));
  }

  async names(): Promise<Map<string, string>> {
    const devices = await this.prisma.device.findMany({ select: { serial: true, name: true } });
    return new Map([
      ...devices.map((d) => [d.serial, d.name] as const),
      [MOBILE_DEVICE_SERIAL, 'Mobile app'],
    ]);
  }
}
