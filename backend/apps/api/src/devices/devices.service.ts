import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { DeviceStatus } from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUNCH_PROTOCOL, type PunchProtocolAdapter } from './punch-protocol';

export const MOBILE_DEVICE_SERIAL = 'MOBILE-APP';
const ONLINE_WINDOW_MS = 5 * 60_000;

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
    @Inject(PUNCH_PROTOCOL) private readonly protocol: PunchProtocolAdapter,
  ) {}

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
    if ((table ?? 'ATTLOG').toUpperCase() !== 'ATTLOG')
      return { received: 0, inserted: 0, unknownPins: 0, rejected: 0 };
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
