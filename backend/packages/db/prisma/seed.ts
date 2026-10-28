/**
 * Synthetic seed for MSMA HRIS. Never uses real employee data.
 * Deterministic (fixed random seed) except that dates are relative to "now"
 * (override with SEED_NOW=2026-09-25T02:30:00Z for reproducible tests).
 *
 * DailyTimeRecords are NOT written here: `pnpm db:seed` runs the API's
 * attendance recompute right after this script, like production would.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  addDays,
  computeDailyTimeRecord,
  computePayslip,
  cutoffFor,
  DateKey,
  dateKeyToUtcDate,
  dateRange,
  formatDate,
  formatMinutes,
  formatDateRange,
  fromManila,
  manilaDateKey,
  PayrollDay,
  roundMoney,
  SAMPLE_STATUTORY_RATES,
  ShiftDefinition,
  sumMoney,
  weekdayOf,
} from '@msma/shared';
import {
  DEPARTMENTS,
  DEVICES,
  FEMALE_NAMES,
  HEADCOUNT,
  HOLIDAYS_2026,
  LEAVE_TYPES,
  MALE_NAMES,
  SITES,
  SURNAMES,
} from './seed-data';
import { printRowCounts } from '../src/row-counts';
import { sealGovIds } from '../src/sealed';
import { ensureDataKey } from '../src/data-key';
import { resolve } from 'node:path';
import { seed201 } from './seed-201';

const prisma = new PrismaClient();
const NOW = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
const TODAY = manilaDateKey(NOW);
const PASSWORD = 'Demo@2026';
const WORKING_DAYS_TO_SEED = 14;
const SHIFT: ShiftDefinition & { code: string; name: string } = {
  code: 'DAY',
  name: 'Day shift 08:00–17:00',
  startTime: '08:00',
  endTime: '17:00',
  breakMinutes: 60,
  graceMinutes: 5,
  workDays: [1, 2, 3, 4, 5, 6],
};

// ---------- Deterministic random helpers ----------
let rngState = 20260925;
function rand(): number {
  // mulberry32
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('');
const pad = (n: number) => String(n).padStart(2, '0');
const hhmmss = (minutes: number, seconds = int(0, 59)) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}`;
const at = (date: DateKey, time: string) => {
  const [h, m, s] = time.split(':').map(Number);
  return fromManila(date, `${pad(h)}:${pad(m)}`, s ?? 0);
};

// ---------- Employee specs ----------
interface EmployeeSpec {
  id: string;
  key?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: 'M' | 'F';
  site: string;
  dept: string;
  position: string;
  isLead: boolean;
  dailyRate?: string;
  status?: 'PROBATIONARY' | 'REGULAR' | 'CONTRACTUAL' | 'PROJECT';
  hireDate?: DateKey;
}

/** People referenced by name in the demo (logins, approvals, screenshots). */
const NAMED: Omit<EmployeeSpec, 'id' | 'middleName'>[] = [
  {
    key: 'princess',
    firstName: 'Princess',
    lastName: 'Alcantara',
    gender: 'F',
    site: 'HQ',
    dept: 'HR',
    position: 'HR Manager',
    isLead: true,
    dailyRate: '2350.00',
    status: 'REGULAR',
    hireDate: '2016-06-01',
  },
  {
    key: 'liza',
    firstName: 'Liza',
    lastName: 'Mercado',
    gender: 'F',
    site: 'HQ',
    dept: 'FIN',
    position: 'Payroll Officer',
    isLead: false,
    dailyRate: '1380.00',
    status: 'REGULAR',
    hireDate: '2019-02-11',
  },
  {
    key: 'kristine',
    firstName: 'Kristine',
    lastName: 'Lim',
    gender: 'F',
    site: 'HQ',
    dept: 'FIN',
    position: 'Accountant',
    isLead: false,
  },
  {
    key: 'maria',
    firstName: 'Maria',
    lastName: 'Santos',
    gender: 'F',
    site: 'HQ',
    dept: 'SAL',
    position: 'Account Executive',
    isLead: false,
  },
  {
    key: 'grace',
    firstName: 'Grace',
    lastName: 'Tan',
    gender: 'F',
    site: 'HQ',
    dept: 'CS',
    position: 'CS Representative',
    isLead: false,
  },
  {
    key: 'rodel',
    firstName: 'Rodel',
    lastName: 'Aquino',
    gender: 'M',
    site: 'HQ',
    dept: 'WHS',
    position: 'Forklift Operator',
    isLead: false,
  },
  {
    key: 'carlo',
    firstName: 'Carlo',
    lastName: 'Dizon',
    gender: 'M',
    site: 'MND',
    dept: 'OPS',
    position: 'Branch Manager',
    isLead: true,
    dailyRate: '2200.00',
    status: 'REGULAR',
    hireDate: '2014-09-15',
  },
  {
    key: 'jose',
    firstName: 'Jose',
    lastName: 'Reyes',
    gender: 'M',
    site: 'MND',
    dept: 'OPS',
    position: 'Team Leader',
    isLead: false,
    dailyRate: '1150.00',
    status: 'REGULAR',
    hireDate: '2020-01-06',
  },
  {
    key: 'ana',
    firstName: 'Ana',
    lastName: 'Villanueva',
    gender: 'F',
    site: 'MND',
    dept: 'WHS',
    position: 'Inventory Clerk',
    isLead: false,
  },
  {
    key: 'ramon',
    firstName: 'Ramon',
    lastName: 'Bautista',
    gender: 'M',
    site: 'MND',
    dept: 'WHS',
    position: 'Forklift Operator',
    isLead: false,
  },
  {
    key: 'paolo',
    firstName: 'Paolo',
    lastName: 'Garcia',
    gender: 'M',
    site: 'MND',
    dept: 'SAL',
    position: 'Sales Associate',
    isLead: false,
  },
  {
    key: 'liezl',
    firstName: 'Liezl',
    lastName: 'Gomez',
    gender: 'F',
    site: 'MND',
    dept: 'CS',
    position: 'CS Representative',
    isLead: false,
  },
  {
    key: 'mark',
    firstName: 'Mark',
    lastName: 'Dela Cruz',
    gender: 'M',
    site: 'LLC',
    dept: 'OPS',
    position: 'Operations Staff',
    isLead: false,
  },
];

function buildEmployeeSpecs(): EmployeeSpec[] {
  const usedNames = new Set(NAMED.map((n) => `${n.firstName} ${n.lastName}`));
  const specs: EmployeeSpec[] = [];
  for (const site of SITES) {
    for (const [deptCode, count] of Object.entries(HEADCOUNT[site.code])) {
      const dept = DEPARTMENTS.find((d) => d.code === deptCode)!;
      const named = NAMED.filter((n) => n.site === site.code && n.dept === deptCode);
      const needsLead = count >= 4 && !named.some((n) => n.isLead);
      const group: Omit<EmployeeSpec, 'id' | 'middleName'>[] = [...named];
      const staffPositions = dept.positions.filter((p) => !p[3]);
      while (group.length < count) {
        const gender = rand() < 0.5 ? 'M' : 'F';
        let firstName: string;
        let lastName: string;
        do {
          firstName = pick(gender === 'M' ? MALE_NAMES : FEMALE_NAMES);
          lastName = pick(SURNAMES);
        } while (usedNames.has(`${firstName} ${lastName}`));
        usedNames.add(`${firstName} ${lastName}`);
        const lead = needsLead && !group.some((g) => g.isLead);
        // Rank-and-file are the majority: bias toward the last (most junior) positions.
        const position = lead
          ? dept.positions.find((p) => p[3])!
          : staffPositions[
              Math.min(
                staffPositions.length - 1,
                Math.floor(Math.pow(rand(), 0.6) * staffPositions.length),
              )
            ];
        group.push({
          firstName,
          lastName,
          gender,
          site: site.code,
          dept: deptCode,
          position: position[0],
          isLead: lead,
        });
      }
      for (const g of group) specs.push({ ...g, id: randomUUID(), middleName: pick(SURNAMES) });
    }
  }
  return specs;
}

function statusAndHire(spec: EmployeeSpec): {
  status: NonNullable<EmployeeSpec['status']>;
  hireDate: DateKey;
} {
  if (spec.status && spec.hireDate) return { status: spec.status, hireDate: spec.hireDate };
  if (spec.isLead)
    return {
      status: 'REGULAR',
      hireDate: `${int(2012, 2019)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
    };
  const r = rand();
  if (r < 0.15) return { status: 'PROBATIONARY', hireDate: addDays(TODAY, -int(45, 170)) };
  if (r < 0.25) return { status: 'CONTRACTUAL', hireDate: addDays(TODAY, -int(90, 400)) };
  if (r < 0.3) return { status: 'PROJECT', hireDate: addDays(TODAY, -int(60, 300)) };
  return {
    status: 'REGULAR',
    hireDate: `${int(2015, 2025)}-${pad(int(1, 12))}-${pad(int(1, 28))}`,
  };
}

function rateFor(spec: EmployeeSpec): string {
  if (spec.dailyRate) return spec.dailyRate;
  const [, min, max] = DEPARTMENTS.find((d) => d.code === spec.dept)!.positions.find(
    (p) => p[0] === spec.position,
  )!;
  return (Math.round(int(min, max) / 5) * 5).toFixed(2);
}

// ---------- Main ----------
/** Monthly salary from a daily rate (daily = monthly × 12 ÷ 261). */
const monthlyOf = (daily: string) => roundMoney(Number(daily) * 261 / 12).toFixed(2);

async function main() {
  // The sample government numbers are stored encrypted: a fresh copy gets its own key here (backend/.env).
  if ((await ensureDataKey(prisma, resolve(__dirname, '../../../.env'))) === 'created') console.log('Created an encryption key in backend/.env (HRIS_DATA_KEY).');
  console.log(`Seeding synthetic data (today in Manila: ${formatDate(TODAY)})…`);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
  );

  // Organisation
  const siteIds: Record<string, string> = {};
  for (const s of SITES) siteIds[s.code] = (await prisma.site.create({ data: s })).id;
  const deptIds: Record<string, string> = {};
  const positionIds: Record<string, string> = {};
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.create({ data: { code: d.code, name: d.name } });
    deptIds[d.code] = dept.id;
    for (const [title] of d.positions) {
      positionIds[`${d.code}:${title}`] = (
        await prisma.position.create({ data: { title, departmentId: dept.id } })
      ).id;
    }
  }
  const shift = await prisma.shift.create({
    data: {
      code: SHIFT.code,
      name: SHIFT.name,
      startTime: SHIFT.startTime,
      endTime: SHIFT.endTime,
      breakMinutes: SHIFT.breakMinutes,
      graceMinutes: SHIFT.graceMinutes!,
      workDays: SHIFT.workDays,
    },
  });
  await prisma.holiday.createMany({
    data: HOLIDAYS_2026.map((h) => ({
      date: dateKeyToUtcDate(h.date),
      name: h.name,
      type: h.type,
    })),
  });
  const holidayByDate = new Map(HOLIDAYS_2026.map((h) => [h.date, h]));

  // Employees
  const specs = buildEmployeeSpecs();
  const byKey = new Map(specs.filter((s) => s.key).map((s) => [s.key!, s]));
  const leadOf = (site: string, dept: string) =>
    specs.find((s) => s.site === site && s.dept === dept && s.isLead);
  const managerIdOf = (s: EmployeeSpec): string | null => {
    if (s.site === 'MND' || s.site === 'LLC') {
      const branchManager = leadOf(s.site, 'OPS')!;
      return branchManager.id === s.id ? null : branchManager.id;
    }
    const lead = leadOf(s.site, s.dept);
    return !lead || lead.id === s.id ? null : lead.id;
  };
  const hireInfo = new Map(specs.map((s) => [s.id, statusAndHire(s)]));
  const rates = new Map(specs.map((s) => [s.id, rateFor(s)]));
  const primaryMode = new Map(specs.map((s) => [s.id, rand() < 0.63 ? 'FACE' : 'FINGER'] as const));

  // Leads first so manager foreign keys resolve.
  const ordered = [...specs.filter((s) => s.isLead), ...specs.filter((s) => !s.isLead)];
  await prisma.employee.createMany({
    data: ordered
      .map((s) => ({
        id: s.id,
        employeeNo: '',
        biometricPin: '',
        firstName: s.firstName,
        middleName: s.middleName,
        lastName: s.lastName,
        email: `${s.firstName}.${s.lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@msma.test',
        mobileNo: `09${int(15, 99)} ${digits(3)} ${digits(4)}`,
        birthDate: dateKeyToUtcDate(`${int(1970, 2003)}-${pad(int(1, 12))}-${pad(int(1, 28))}`),
        status: hireInfo.get(s.id)!.status,
        hireDate: dateKeyToUtcDate(hireInfo.get(s.id)!.hireDate),
        dailyRate: new Prisma.Decimal(rates.get(s.id)!),
        // daily = monthly × 12 ÷ 261 (MSMA's payroll workbook), so monthly = daily × 261 ÷ 12
        monthlySalary: new Prisma.Decimal(monthlyOf(rates.get(s.id)!)),
        siteId: siteIds[s.site],
        departmentId: deptIds[s.dept],
        positionId: positionIds[`${s.dept}:${s.position}`],
        shiftId: shift.id,
        managerId: null,
      }))
      .map((row, i) => ({
        ...row,
        employeeNo: `MSMA-${String(i + 1).padStart(4, '0')}`,
        biometricPin: String(1001 + i),
      })),
  });
  for (const s of specs) {
    const managerId = managerIdOf(s);
    if (managerId) await prisma.employee.update({ where: { id: s.id }, data: { managerId } });
  }
  await prisma.govId.createMany({
    // Stored encrypted, as the API saves them (packages/db/src/sealed.ts).
    data: specs.map((s) =>
      sealGovIds({
        employeeId: s.id,
        tin: `${digits(3)}-${digits(3)}-${digits(3)}-000`,
        sss: `${int(1, 9)}${digits(1)}-${digits(7)}-${digits(1)}`,
        philhealth: `${int(1, 9)}${digits(1)}-${digits(9)}-${digits(1)}`,
        pagibig: `${int(1, 9)}${digits(3)}-${digits(4)}-${digits(4)}`,
      }),
    ),
  });

  // Users (all with password Demo@2026)
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = {
    hr: await prisma.user.create({
      data: {
        email: 'hr@msma.test',
        passwordHash,
        role: 'HR_ADMIN',
        displayName: 'Princess Alcantara',
        employeeId: byKey.get('princess')!.id,
      },
    }),
    payroll: await prisma.user.create({
      data: {
        email: 'payroll@msma.test',
        passwordHash,
        role: 'PAYROLL_ADMIN',
        displayName: 'Liza Mercado',
        employeeId: byKey.get('liza')!.id,
      },
    }),
    manager: await prisma.user.create({
      data: {
        email: 'manager@msma.test',
        passwordHash,
        role: 'MANAGER',
        displayName: 'Carlo Dizon',
        employeeId: byKey.get('carlo')!.id,
      },
    }),
    // The partners' role: everything, and may decide any approval step (no employee record).
    partner: await prisma.user.create({
      data: {
        email: 'partner@msma.test',
        passwordHash,
        role: 'SYSTEM_ADMIN',
        displayName: 'Partner (Super Admin)',
      },
    }),
    employee: await prisma.user.create({
      data: {
        email: 'employee@msma.test',
        passwordHash,
        role: 'EMPLOYEE',
        displayName: 'Jose Reyes',
        employeeId: byKey.get('jose')!.id,
      },
    }),
  };

  // Devices: three online, Lapu-Lapu last seen 12 minutes ago (shows an offline terminal)
  for (const d of DEVICES) {
    await prisma.device.create({
      data: {
        serial: d.serial,
        name: d.name,
        model: d.model,
        siteId: siteIds[d.site],
        lastSeenAt: new Date(NOW.getTime() - (d.site === 'LLC' ? 12 : int(0, 2)) * 60_000),
        lastIp: `192.168.${d.site === 'HQ' ? 10 : d.site === 'MND' ? 20 : 30}.${int(20, 60)}`,
      },
    });
  }
  const deviceFor = (s: EmployeeSpec) =>
    s.site === 'HQ'
      ? s.dept === 'WHS'
        ? 'ZKHQ0002'
        : 'ZKHQ0001'
      : s.site === 'MND'
        ? 'ZKMD0001'
        : 'ZKLL0001';

  // Leave types
  const leaveTypeIds: Record<string, string> = {};
  for (const lt of LEAVE_TYPES) {
    leaveTypeIds[lt.code] = (
      await prisma.leaveType.create({
        data: { ...lt, defaultDays: new Prisma.Decimal(lt.defaultDays) },
      })
    ).id;
  }

  // ---------- Calendar ----------
  const isWorkingDay = (d: DateKey) =>
    SHIFT.workDays.includes(weekdayOf(d)) && !holidayByDate.has(d);
  const workingDays: DateKey[] = [];
  for (let d = TODAY; workingDays.length < WORKING_DAYS_TO_SEED; d = addDays(d, -1))
    if (isWorkingDay(d)) workingDays.unshift(d);
  const ago = (n: number) => workingDays[workingDays.length - 1 - n];
  const windowFrom = workingDays[0];
  const futureWorkingDay = (n: number) => {
    let d = TODAY;
    for (let found = 0; found < n;) {
      d = addDays(d, 1);
      if (isWorkingDay(d)) found++;
    }
    return d;
  };
  const prevCutoff = cutoffFor(addDays(cutoffFor(TODAY).from, -1));
  const planFrom = prevCutoff.from < windowFrom ? prevCutoff.from : windowFrom;

  // ---------- Approved leaves inside the window ----------
  const regularStaff = specs.filter((s) => !s.key && !s.isLead);
  const leaveDays = new Map<string, Set<DateKey>>();
  const approvedLeaves: {
    spec: EmployeeSpec;
    type: string;
    from: DateKey;
    to: DateKey;
    days: number;
  }[] = [];
  const takeLeave = (spec: EmployeeSpec, from: DateKey, length: number) => {
    const days = [from];
    while (days.length < length) {
      const next = addDays(days[days.length - 1], 1);
      if (isWorkingDay(next)) days.push(next);
      else days.push(addDays(next, 1)); // skip a Sunday/holiday
    }
    const set = leaveDays.get(spec.id) ?? new Set<DateKey>();
    days.forEach((d) => set.add(d));
    leaveDays.set(spec.id, set);
    approvedLeaves.push({
      spec,
      type: rand() < 0.6 ? 'VL' : 'SL',
      from,
      to: days[days.length - 1],
      days: days.length,
    });
  };
  const shuffled = [...regularStaff].sort(() => rand() - 0.5);
  if (isWorkingDay(TODAY)) shuffled.slice(0, 5).forEach((s) => takeLeave(s, TODAY, 1));
  shuffled
    .slice(5, 14)
    .forEach((s) => takeLeave(s, ago(int(1, WORKING_DAYS_TO_SEED - 3)), int(1, 2)));

  // ---------- Scripted demo situations ----------
  type Override = { in?: string; out?: string | null; absent?: boolean };
  const overrides = new Map<string, Map<DateKey, Override>>();
  const setOverride = (key: string, date: DateKey, o: Override) => {
    const id = byKey.get(key)!.id;
    const m = overrides.get(id) ?? new Map<DateKey, Override>();
    m.set(date, o);
    overrides.set(id, m);
  };
  setOverride('jose', TODAY, { absent: true }); // clocks in from the phone during the demo
  setOverride('jose', ago(4), { in: '07:51:12', out: '19:10:40' }); // approved OT
  setOverride('ana', ago(1), { in: '07:48:03', out: '19:05:22' }); // pending OT 2 hrs
  setOverride('ramon', ago(2), { in: '07:55:41', out: '18:35:09' }); // pending OT 1.5 hrs
  setOverride('rodel', ago(1), { in: '07:40:18', out: '20:05:51' }); // pending OT 3 hrs
  setOverride('mark', ago(3), { in: '07:52:10', out: null }); // missing time-out → DTR fix
  setOverride('paolo', ago(2), { in: '07:57:33', out: null }); // missing time-out → DTR fix
  setOverride('grace', ago(2), { absent: true }); // pending sick leave for that day
  setOverride('kristine', ago(5), { in: '07:54:40', out: '15:03:12' }); // approved undertime (dentist)
  if (isWorkingDay(TODAY)) {
    // Screenshot-friendly first punches of the day
    setOverride('maria', TODAY, { in: '08:07:14', out: '17:02:00' });
    setOverride('ana', TODAY, { in: '07:59:05', out: '17:03:00' });
    setOverride('mark', TODAY, { in: '07:55:40', out: '17:06:00' });
    setOverride('grace', TODAY, { in: '07:49:30', out: '17:01:00' });
  }

  // ---------- Punch plan ----------
  const punches: Prisma.RawPunchCreateManyInput[] = [];
  const planned = new Map<string, Map<DateKey, Date[]>>();
  for (const s of specs) {
    const hired = hireInfo.get(s.id)!.hireDate;
    const perDay = new Map<DateKey, Date[]>();
    for (const d of dateRange(planFrom, TODAY)) {
      if (!isWorkingDay(d) || d < hired) continue;
      const o = overrides.get(s.id)?.get(d);
      if (leaveDays.get(s.id)?.has(d) || o?.absent) continue;
      if (!o && rand() < 0.03) continue; // absent
      const inTime = o?.in ?? hhmmss(rand() < 0.08 ? int(486, 525) : int(450, 485));
      let outTime: string | null;
      if (o && 'out' in o) outTime = o.out ?? null;
      else {
        const r = rand();
        if (r < 0.01 && d !== TODAY)
          outTime = null; // forgot to time out
        else if (r < 0.03)
          outTime = hhmmss(int(930, 1010)); // undertime
        else if (r < 0.13)
          outTime = hhmmss(s.dept === 'WHS' && rand() < 0.3 ? int(1350, 1410) : int(1080, 1230)); // OT
        else outTime = hhmmss(int(1020, 1045));
      }
      const times = [at(d, inTime), ...(outTime ? [at(d, outTime)] : [])].filter((t) => t <= NOW);
      perDay.set(d, times);
      if (d >= windowFrom) {
        for (const t of times) {
          punches.push({
            deviceSerial: deviceFor(s),
            employeeId: s.id,
            punchedAt: t,
            verifyMode: rand() < 0.05 ? 'PIN' : primaryMode.get(s.id)!,
            receivedAt: t,
          });
        }
      }
    }
    planned.set(s.id, perDay);
  }
  await prisma.rawPunch.createMany({ data: punches });

  // ---------- Leave balances ----------
  const year = Number(TODAY.slice(0, 4));
  const takenInWindow = (id: string, type: string) =>
    approvedLeaves
      .filter((l) => l.spec.id === id && l.type === type)
      .reduce((n, l) => n + l.days, 0);
  await prisma.leaveBalance.createMany({
    data: specs.flatMap((s) =>
      LEAVE_TYPES.map((lt) => {
        const baseUsed = lt.code === 'SIL' ? int(0, 2) : int(0, lt.code === 'VL' ? 12 : 10) / 2;
        return {
          employeeId: s.id,
          leaveTypeId: leaveTypeIds[lt.code],
          year,
          entitled: new Prisma.Decimal(lt.defaultDays),
          used: new Prisma.Decimal(
            Math.min(Number(lt.defaultDays), baseUsed + takenInWindow(s.id, lt.code)),
          ),
        };
      }),
    ),
  });
  // Jose's balances match the mobile mockup
  const jose = byKey.get('jose')!;
  for (const [code, used] of [
    ['VL', '7.5'],
    ['SL', '10'],
    ['SIL', '0'],
  ] as const) {
    await prisma.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: { employeeId: jose.id, leaveTypeId: leaveTypeIds[code], year },
      },
      data: { used: new Prisma.Decimal(used) },
    });
  }

  // ---------- Requests and approvals ----------
  const deciderFor = (s: EmployeeSpec) => (s.site === 'MND' ? users.manager.id : users.hr.id);
  const leaveLabel: Record<string, string> = {
    VL: 'Vacation',
    SL: 'Sick',
    SIL: 'Service incentive',
  };
  const decidedAt = (d: DateKey) => at(d, '09:30:00');

  for (const l of approvedLeaves) {
    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: l.spec.id,
        leaveTypeId: leaveTypeIds[l.type],
        startDate: dateKeyToUtcDate(l.from),
        endDate: dateKeyToUtcDate(l.to),
        days: new Prisma.Decimal(l.days),
        reason: l.type === 'SL' ? 'Not feeling well' : 'Personal errands',
        status: 'APPROVED',
        createdAt: at(addDays(l.from, -3), '10:00:00'),
      },
    });
    await prisma.approvalRequest.create({
      data: {
        type: 'LEAVE',
        employeeId: l.spec.id,
        detail: `${leaveLabel[l.type]} · ${formatDateRange(l.from, l.to)} · ${l.days} day${l.days > 1 ? 's' : ''}`,
        status: 'APPROVED',
        leaveRequestId: request.id,
        decidedById: deciderFor(l.spec),
        decidedAt: decidedAt(addDays(l.from, -2)),
        createdAt: request.createdAt,
      },
    });
  }

  const pendingCreatedAt = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000);

  async function pendingLeave(
    key: string,
    type: string,
    from: DateKey,
    to: DateKey,
    days: number,
    reason: string,
    hoursAgo: number,
  ) {
    const s = byKey.get(key)!;
    const req = await prisma.leaveRequest.create({
      data: {
        employeeId: s.id,
        leaveTypeId: leaveTypeIds[type],
        startDate: dateKeyToUtcDate(from),
        endDate: dateKeyToUtcDate(to),
        days: new Prisma.Decimal(days),
        reason,
        createdAt: pendingCreatedAt(hoursAgo),
      },
    });
    await prisma.approvalRequest.create({
      data: {
        type: 'LEAVE',
        employeeId: s.id,
        detail: `${leaveLabel[type]} · ${formatDateRange(from, to)} · ${days} day${days > 1 ? 's' : ''} · ${reason}`,
        leaveRequestId: req.id,
        createdAt: req.createdAt,
      },
    });
  }
  async function otRequest(
    key: string,
    date: DateKey,
    minutes: number,
    reason: string,
    hoursAgo: number,
    decided?: 'APPROVED' | 'REJECTED',
  ) {
    const s = byKey.get(key)!;
    const req = await prisma.otRequest.create({
      data: {
        employeeId: s.id,
        date: dateKeyToUtcDate(date),
        minutes,
        reason,
        status: decided ?? 'PENDING',
        createdAt: pendingCreatedAt(hoursAgo),
      },
    });
    await prisma.approvalRequest.create({
      data: {
        type: 'OT',
        employeeId: s.id,
        detail: `Overtime · ${formatDate(date)} · ${formatMinutes(minutes)} · ${reason}`,
        otRequestId: req.id,
        status: decided ?? 'PENDING',
        decidedById: decided ? deciderFor(s) : null,
        decidedAt: decided ? pendingCreatedAt(hoursAgo - 20) : null,
        reason: decided === 'REJECTED' ? 'Not pre-approved by supervisor' : null,
        createdAt: req.createdAt,
      },
    });
  }
  async function dtrFix(
    key: string,
    date: DateKey,
    timeOut: string,
    reason: string,
    hoursAgo: number,
  ) {
    const s = byKey.get(key)!;
    const req = await prisma.dtrCorrection.create({
      data: {
        employeeId: s.id,
        date: dateKeyToUtcDate(date),
        requestedTimeOut: at(date, timeOut),
        reason,
        createdAt: pendingCreatedAt(hoursAgo),
      },
    });
    await prisma.approvalRequest.create({
      data: {
        type: 'DTR_FIX',
        employeeId: s.id,
        detail: `Time adjustment · ${formatDate(date)} · time out ${timeOut.slice(0, 5)} · ${reason}`,
        dtrCorrectionId: req.id,
        createdAt: req.createdAt,
      },
    });
  }

  async function undertime(
    key: string,
    date: DateKey,
    leaveTime: string,
    reason: string,
    hoursAgo: number,
    decided: 'APPROVED' | 'REJECTED',
  ) {
    const s = byKey.get(key)!;
    const leaveAt = at(date, leaveTime);
    const minutes = Math.round((at(date, SHIFT.endTime).getTime() - leaveAt.getTime()) / 60_000);
    const req = await prisma.undertimeRequest.create({
      data: {
        employeeId: s.id,
        date: dateKeyToUtcDate(date),
        leaveAt,
        minutes,
        reason,
        status: decided,
        createdAt: pendingCreatedAt(hoursAgo),
      },
    });
    await prisma.approvalRequest.create({
      data: {
        type: 'UNDERTIME',
        employeeId: s.id,
        detail: `Undertime · ${formatDate(date)} · leave at ${leaveTime.slice(0, 5)} (${formatMinutes(minutes)} early) · ${reason}`,
        undertimeRequestId: req.id,
        status: decided,
        decidedById: deciderFor(s),
        decidedAt: pendingCreatedAt(hoursAgo - 2),
        createdAt: req.createdAt,
      },
    });
  }

  // 9 pending approvals
  await pendingLeave(
    'jose',
    'VL',
    futureWorkingDay(1),
    futureWorkingDay(2),
    2,
    'Family event in Bohol',
    3,
  );
  await pendingLeave('grace', 'SL', ago(2), ago(2), 1, 'Fever, with medical certificate', 20);
  await pendingLeave(
    'kristine',
    'VL',
    futureWorkingDay(8),
    futureWorkingDay(10),
    3,
    'Out-of-town trip',
    30,
  );
  await pendingLeave(
    'liezl',
    'SIL',
    futureWorkingDay(4),
    futureWorkingDay(4),
    1,
    "Child's school program",
    6,
  );
  await otRequest('ana', ago(1), 120, 'Inventory count', 14);
  await otRequest('ramon', ago(2), 90, 'Delivery backlog', 26);
  await otRequest('rodel', ago(1), 180, 'Container unloading', 12);
  await dtrFix('mark', ago(3), '17:04:00', 'Forgot to time out', 40);
  await dtrFix('paolo', ago(2), '17:10:00', 'Terminal did not read my face', 22);
  // Decided history
  await otRequest('jose', ago(4), 120, 'Month-end stock count', 90, 'APPROVED');
  await otRequest('maria', ago(6), 60, 'Client visit ran late', 150, 'REJECTED');
  await undertime('kristine', ago(5), '15:00:00', 'Dental appointment', 130, 'APPROVED');

  // ---------- Statutory rates (approximate, verified: false) ----------
  const effectiveFrom = dateKeyToUtcDate(`${year}-01-01`);
  await prisma.statutoryRate.createMany({
    data: [
      {
        name: 'SSS',
        effectiveFrom,
        config: SAMPLE_STATUTORY_RATES.sss as unknown as Prisma.InputJsonValue,
      },
      {
        name: 'PHILHEALTH',
        effectiveFrom,
        config: SAMPLE_STATUTORY_RATES.philhealth as unknown as Prisma.InputJsonValue,
      },
      {
        name: 'PAGIBIG',
        effectiveFrom,
        config: SAMPLE_STATUTORY_RATES.pagibig as unknown as Prisma.InputJsonValue,
      },
      {
        name: 'WITHHOLDING_TAX',
        effectiveFrom,
        config: SAMPLE_STATUTORY_RATES.withholdingTax as unknown as Prisma.InputJsonValue,
      },
    ],
  });

  // ---------- Previous cutoff: released payroll run (for "latest payslip") ----------
  // Released before overtime approvals were tracked here, so all clocked overtime was paid.
  const payslips: Prisma.PayslipCreateManyInput[] = [];
  for (const s of specs) {
    if (hireInfo.get(s.id)!.hireDate > prevCutoff.to) continue;
    const days: PayrollDay[] = dateRange(prevCutoff.from, prevCutoff.to).map((d) => {
      const holiday = holidayByDate.get(d);
      const dtr = computeDailyTimeRecord({
        date: d,
        punches: planned.get(s.id)!.get(d) ?? [],
        shift: SHIFT,
        holiday: holiday ?? null,
        onLeave: leaveDays.get(s.id)?.has(d) ?? false,
      });
      return { ...dtr, date: d, restDay: !SHIFT.workDays.includes(weekdayOf(d)), holidayType: holiday?.type ?? null, paidLeave: true };
    });
    const p = computePayslip({
      monthlySalary: monthlyOf(rates.get(s.id)!),
      days,
      rates: SAMPLE_STATUTORY_RATES,
      cutoff: { from: prevCutoff.from, to: prevCutoff.to },
      hireDate: hireInfo.get(s.id)!.hireDate,
      workDays: SHIFT.workDays,
    });
    payslips.push({
      payrollRunId: '',
      employeeId: s.id,
      daysPaid: new Prisma.Decimal(p.daysPaid.toString()),
      basicPay: new Prisma.Decimal(p.basicPay.toFixed(2)),
      overtimePay: new Prisma.Decimal(p.overtimePay.toFixed(2)),
      nightDiffPay: new Prisma.Decimal(p.nightDiffPay.toFixed(2)),
      holidayPay: new Prisma.Decimal(p.holidayPay.toFixed(2)),
      lateUndertimeDeduction: new Prisma.Decimal(p.lateUndertimeDeduction.toFixed(2)),
      grossPay: new Prisma.Decimal(p.grossPay.toFixed(2)),
      sss: new Prisma.Decimal(p.sss.toFixed(2)),
      philhealth: new Prisma.Decimal(p.philhealth.toFixed(2)),
      pagibig: new Prisma.Decimal(p.pagibig.toFixed(2)),
      withholdingTax: new Prisma.Decimal(p.withholdingTax.toFixed(2)),
      totalDeductions: new Prisma.Decimal(p.totalDeductions.toFixed(2)),
      netPay: new Prisma.Decimal(p.netPay.toFixed(2)),
    });
  }
  const total = (field: 'grossPay' | 'totalDeductions' | 'netPay') =>
    roundMoney(sumMoney(payslips.map((p) => String(p[field])))).toFixed(2);
  const run = await prisma.payrollRun.create({
    data: {
      cutoffFrom: dateKeyToUtcDate(prevCutoff.from),
      cutoffTo: dateKeyToUtcDate(prevCutoff.to),
      payDate: dateKeyToUtcDate(addDays(prevCutoff.to, 5)),
      status: 'RELEASED',
      totalGross: new Prisma.Decimal(total('grossPay')),
      totalDeductions: new Prisma.Decimal(total('totalDeductions')),
      totalNet: new Prisma.Decimal(total('netPay')),
    },
  });
  await prisma.payslip.createMany({ data: payslips.map((p) => ({ ...p, payrollRunId: run.id })) });

  // ---------- 201 files ----------
  const siteName = new Map<string, string>(SITES.map((s) => [s.code, s.name]));
  await seed201(prisma, {
    employees: specs.map((s) => ({
      id: s.id,
      key: s.key,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      position: s.position,
      siteName: siteName.get(s.site)!,
      status: hireInfo.get(s.id)!.status,
      hireDate: hireInfo.get(s.id)!.hireDate,
      dailyRate: rates.get(s.id)!,
    })),
    hrUserId: users.hr.id,
    payrollUserId: users.payroll.id,
    today: TODAY,
  });

  // ---------- Summary ----------
  await printRowCounts(prisma);
  console.log(
    `\nAttendance window: ${formatDate(windowFrom)} to ${formatDate(TODAY)} (${WORKING_DAYS_TO_SEED} working days)`,
  );
  console.log(`Released payroll: ${prevCutoff.label}`);
  console.log(
    `Logins (password ${PASSWORD}): hr@msma.test, payroll@msma.test, manager@msma.test, employee@msma.test`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
