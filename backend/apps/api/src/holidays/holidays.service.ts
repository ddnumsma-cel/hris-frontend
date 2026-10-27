import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  AddHoliday,
  ChangeHoliday,
  dateKeyToUtcDate,
  HolidayCalendar,
  HolidayChange,
  HolidayRule,
  SavedHolidays,
  utcDateToDateKey,
} from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type RuleRow = Prisma.HolidayRuleGetPayload<object>;
type ChangeRow = Prisma.HolidayChangeGetPayload<object>;

const ruleView = (r: RuleRow): HolidayRule => ({
  id: r.id,
  name: r.name,
  type: r.type === 'REGULAR' ? 'regular' : 'special',
  repeat: r.repeat as HolidayRule['repeat'],
  offices: r.offices,
  source: r.source,
  builtIn: false,
  active: true,
});
const changeView = (c: ChangeRow): HolidayChange => ({
  id: c.id,
  ruleId: c.ruleId,
  year: c.year,
  kind: c.kind === 'cancel' ? 'cancel' : 'move',
  ...(c.date ? { date: utcDateToDateKey(c.date) } : {}),
  source: c.source,
  by: c.by,
  at: c.at.toISOString(),
});

/**
 * The company holiday calendar. The national holidays (and how their dates are worked out) are built into the
 * website; this keeps what HR adds (company, local holidays) and the yearly moves or cancellations from
 * proclamations, so every browser and the phone app see the same calendar. The website also sends the holidays it
 * works out for a few years, so the backend's own day records mark them.
 */
@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async saved(): Promise<SavedHolidays> {
    const [rules, changes] = await Promise.all([
      this.prisma.holidayRule.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.holidayChange.findMany({ orderBy: { at: 'asc' } }),
    ]);
    return { rules: rules.map(ruleView), changes: changes.map(changeView) };
  }

  async add(input: AddHoliday, user: AuthUser): Promise<HolidayRule> {
    const [, m, d] = input.date.split('-').map(Number);
    const repeat: HolidayRule['repeat'] = input.everyYear ? { kind: 'fixed', month: m!, day: d! } : { kind: 'once', date: input.date };
    const id = `hol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.holidayRule.create({
        data: { id, name: input.name, type: input.type === 'regular' ? 'REGULAR' : 'SPECIAL', repeat, offices: input.offices, source: input.source, createdBy: user.displayName },
      });
      await this.audit.log({ actorId: user.userId, action: 'HOLIDAY_ADDED', entity: 'HolidayRule', entityId: id, after: { ...input } }, tx);
      return r;
    });
    return ruleView(row);
  }

  async remove(ruleId: string, user: AuthUser): Promise<void> {
    const r = await this.prisma.holidayRule.findUnique({ where: { id: ruleId } });
    if (!r) throw new NotFoundException("That holiday no longer exists, or it's a national holiday (cancel it for one year instead)");
    await this.prisma.$transaction(async (tx) => {
      await tx.holidayChange.deleteMany({ where: { ruleId } });
      await tx.holidayRule.delete({ where: { id: ruleId } });
      await this.audit.log({ actorId: user.userId, action: 'HOLIDAY_REMOVED', entity: 'HolidayRule', entityId: ruleId, before: { name: r.name, source: r.source } }, tx);
    });
  }

  /** Move a holiday (national or HR's) to another date, or cancel it, for one year. Replaces that year's change. */
  async change(input: ChangeHoliday, user: AuthUser): Promise<HolidayChange> {
    if (input.kind === 'move' && (!input.date || !input.date.startsWith(`${input.year}-`)))
      throw new BadRequestException(`Choose the new date in ${input.year}`);
    const data = {
      kind: input.kind,
      date: input.kind === 'move' && input.date ? dateKeyToUtcDate(input.date) : null,
      source: input.source,
      by: user.displayName,
      at: new Date(),
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.holidayChange.upsert({
        where: { ruleId_year: { ruleId: input.ruleId, year: input.year } },
        create: { ruleId: input.ruleId, year: input.year, ...data },
        update: data,
      });
      await this.audit.log({ actorId: user.userId, action: 'HOLIDAY_CHANGED', entity: 'HolidayChange', entityId: c.id, after: { ...input } }, tx);
      return c;
    });
    return changeView(row);
  }

  async undoChange(ruleId: string, year: number, user: AuthUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.holidayChange.deleteMany({ where: { ruleId, year } });
      if (count) await this.audit.log({ actorId: user.userId, action: 'HOLIDAY_CHANGE_UNDONE', entity: 'HolidayChange', entityId: `${ruleId}|${year}`, after: { ruleId, year } }, tx);
    });
  }

  /** Replace the backend's holidays in these years with the ones the website worked out (one row per date). */
  async setCalendar(input: HolidayCalendar): Promise<{ holidays: number }> {
    const byDate = new Map<string, { name: string; type: 'REGULAR' | 'SPECIAL' }>();
    for (const h of input.holidays) {
      if (!input.years.includes(Number(h.date.slice(0, 4)))) continue;
      const prev = byDate.get(h.date);
      byDate.set(h.date, {
        name: prev ? `${prev.name} / ${h.name}` : h.name,
        // A regular holiday wins when two fall on one date.
        type: prev?.type === 'REGULAR' || h.type === 'regular' ? 'REGULAR' : 'SPECIAL',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      for (const y of input.years)
        await tx.holiday.deleteMany({ where: { date: { gte: dateKeyToUtcDate(`${y}-01-01`), lte: dateKeyToUtcDate(`${y}-12-31`) } } });
      await tx.holiday.createMany({ data: [...byDate].map(([date, h]) => ({ date: dateKeyToUtcDate(date), name: h.name.slice(0, 200), type: h.type })) });
    });
    return { holidays: byDate.size };
  }
}
