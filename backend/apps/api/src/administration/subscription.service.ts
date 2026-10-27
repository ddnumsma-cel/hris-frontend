import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { manilaToday } from '@msma/shared';
import { PrismaService } from '../prisma/prisma.service';

interface Plan {
  id: string;
  name: string;
  employeeSeatLimit: number;
  adminAccountLimit: number;
  gracePercent: number;
}
interface ClientTerms {
  id: string;
  name: string;
  planId: string;
  renewalDate: string;
  seatLimitOverride?: number;
  extension?: { seats: number; until: string };
}
interface Saved {
  plans: Plan[];
  client: ClientTerms;
}

const KEY = 'subscription';
/** As the website's demo: the Growth plan (50 seats) for MSMA. */
const DEFAULT: Saved = {
  plans: [
    { id: 'plan-starter', name: 'Starter', employeeSeatLimit: 20, adminAccountLimit: 8, gracePercent: 5 },
    { id: 'plan-growth', name: 'Growth', employeeSeatLimit: 50, adminAccountLimit: 15, gracePercent: 5 },
    { id: 'plan-business', name: 'Business', employeeSeatLimit: 150, adminAccountLimit: 30, gracePercent: 5 },
  ],
  client: { id: 'org-msma', name: 'MSMA Group', planId: 'plan-growth', renewalDate: '2027-01-31' },
};

// The website's rules (lib/subscription/rules.ts): limit, grace and status.
const capOf = (limit: number, grace: number) => limit + Math.floor((limit * grace) / 100);
function statusOf(used: number, limit: number, cap: number) {
  if (used > cap) return 'over';
  if (used > limit) return 'grace';
  if (used >= limit) return 'at';
  if (used >= limit * 0.8) return 'near';
  return 'ok';
}

/** A 409 the website reads by its code (SeatLimitDialog). */
export class SeatLimitException extends ConflictException {
  constructor(message: string, code: 'SEAT_LIMIT_REACHED' | 'ADMIN_LIMIT_REACHED') {
    super({ statusCode: 409, message, code });
  }
}

/**
 * The client's plan and seats. Seats are counted from the records every time, never stored: one seat = one employee
 * who isn't separated (last day passed); admin accounts = HR, Approver (Partner) and Accounting logins.
 */
@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private async saved(): Promise<Saved> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: KEY } });
    return (row?.value as unknown as Saved | undefined) ?? DEFAULT;
  }

  private async save(next: Saved) {
    await this.prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: next as object }, update: { value: next as object } });
  }

  private async counts() {
    const today = new Date(`${manilaToday()}T00:00:00Z`);
    const [seats, admins] = await Promise.all([
      this.prisma.employee.count({ where: { active: true, OR: [{ separationDate: null }, { separationDate: { gte: today } }] } }),
      this.prisma.user.count({ where: { role: { in: ['HR_ADMIN', 'MANAGER', 'PAYROLL_ADMIN'] } } }),
    ]);
    return { seats, admins };
  }

  async usage() {
    const s = await this.saved();
    const plan = s.plans.find((p) => p.id === s.client.planId) ?? s.plans[0]!;
    const { seats, admins } = await this.counts();
    const ext = s.client.extension && s.client.extension.until >= manilaToday() ? s.client.extension : undefined;
    const seatLimit = (s.client.seatLimitOverride ?? plan.employeeSeatLimit) + (ext?.seats ?? 0);
    const seatCap = capOf(seatLimit, plan.gracePercent);
    const adminCap = capOf(plan.adminAccountLimit, plan.gracePercent);
    return {
      clientId: s.client.id,
      clientName: s.client.name,
      planId: plan.id,
      planName: plan.name,
      renewalDate: s.client.renewalDate,
      seatsUsed: seats,
      seatLimit,
      seatCap,
      adminsUsed: admins,
      adminLimit: plan.adminAccountLimit,
      adminCap,
      gracePercent: plan.gracePercent,
      ...(s.client.seatLimitOverride ? { seatLimitOverride: s.client.seatLimitOverride } : {}),
      ...(s.client.extension ? { extension: s.client.extension } : {}),
      status: statusOf(seats, seatLimit, seatCap),
      adminStatus: statusOf(admins, plan.adminAccountLimit, adminCap),
    };
  }

  async plans() {
    return (await this.saved()).plans;
  }

  async events() {
    const s = await this.saved();
    const rows = await this.prisma.subscriptionEvent.findMany({ orderBy: { at: 'desc' }, take: 500 });
    return rows.map((e) => ({ id: e.id, clientId: s.client.id, clientName: s.client.name, kind: e.kind, message: e.message, ...(e.by ? { by: e.by } : {}), at: e.at.toISOString(), seats: e.seats, admins: e.admins }));
  }

  async log(kind: string, message: string, by?: string) {
    const u = await this.usage();
    await this.prisma.subscriptionEvent.create({ data: { kind, message, by: by ?? null, seats: `${u.seatsUsed} / ${u.seatLimit}`, admins: `${u.adminsUsed} / ${u.adminLimit}` } });
  }

  /** Before adding employees: refused (409 SEAT_LIMIT_REACHED, logged) past the limit plus grace. */
  async assertSeats(count = 1) {
    const u = await this.usage();
    if (u.seatsUsed + count <= u.seatCap) return;
    await this.log('blocked', `Add refused: ${count === 1 ? 'an employee' : `${count} employees`} at ${u.seatsUsed} of ${u.seatLimit} employee seats`);
    throw new SeatLimitException(
      `All ${u.seatLimit} employee seats are used${u.seatCap > u.seatLimit ? ` (including the ${u.seatCap - u.seatLimit}-seat grace)` : ''}. Ask your Super Admin to request more seats.`,
      'SEAT_LIMIT_REACHED',
    );
  }

  async requestUpgrade(note: string, by: string) {
    await this.log('upgrade-request', `Upgrade requested${note ? `: "${note}"` : ''}`, by);
    return this.usage();
  }

  // ---------- Our platform team ----------

  private async client(clientId: string) {
    const s = await this.saved();
    if (clientId !== s.client.id) throw new NotFoundException('That client no longer exists');
    return s;
  }

  async changePlan(clientId: string, planId: string, by: string) {
    const s = await this.client(clientId);
    const plan = s.plans.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('Choose a plan');
    const from = s.plans.find((p) => p.id === s.client.planId)?.name ?? 'No plan';
    await this.save({ ...s, client: { ...s.client, planId } });
    await this.log('plan-changed', `Plan changed: ${from} → ${plan.name}`, by);
    return { plan, from, usage: await this.usage() };
  }

  async setOverride(clientId: string, seats: number | null, by: string) {
    const s = await this.client(clientId);
    const { seatLimitOverride: _old, ...rest } = s.client;
    void _old;
    await this.save({ ...s, client: seats === null ? rest : { ...rest, seatLimitOverride: seats } });
    await this.log('seat-override', seats === null ? 'Seat limit override removed (plan limit applies)' : `Seat limit overridden to ${seats}`, by);
    return this.usage();
  }

  async setExtension(clientId: string, extension: { seats: number; until: string } | null, by: string) {
    const s = await this.client(clientId);
    if (extension && extension.until < manilaToday()) throw new BadRequestException("The end date can't be in the past");
    const { extension: _old, ...rest } = s.client;
    void _old;
    await this.save({ ...s, client: extension ? { ...rest, extension } : rest });
    await this.log('extension', extension ? `Temporary extension: +${extension.seats} seats until ${extension.until}` : 'Temporary extension ended', by);
    return this.usage();
  }
}
