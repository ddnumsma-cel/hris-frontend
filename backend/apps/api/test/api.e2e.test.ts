import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import {
  addDays,
  ApprovalListResponseSchema,
  cutoffFor,
  DashboardSummarySchema,
  formatTime,
  manilaDateKey,
  manilaParts,
  manilaToday,
  utcDateToDateKey,
} from '@msma/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttendanceService } from '../src/attendance/attendance.service';
import { createApp } from '../src/bootstrap-app';
import { config } from '../src/config';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;
const tokens: Record<string, string> = {};
const PASSWORD = 'Demo@2026';

const http = () => request(app.getHttpServer());
const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toMatch(/_test/); // never run against the demo database
  app = await createApp({ logger: false });
  await app.init();
  prisma = app.get(PrismaService);
  // Same step as `pnpm db:seed`: derive DTRs from the seeded punches.
  const first = await prisma.rawPunch.findFirst({ orderBy: { punchedAt: 'asc' } });
  await app
    .get(AttendanceService)
    .recompute(manilaDateKey(first!.punchedAt), manilaDateKey(new Date()));
  for (const who of ['hr', 'manager', 'employee', 'payroll']) {
    const res = await http()
      .post('/auth/login')
      .send({ email: `${who}@msma.test`, password: PASSWORD })
      .expect(200);
    tokens[who] = res.body.accessToken;
  }
});

afterAll(async () => {
  await app?.close();
});

describe('auth', () => {
  it('logs in and returns the session user', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: 'HR@msma.test', password: PASSWORD })
      .expect(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.user).toMatchObject({
      email: 'hr@msma.test',
      role: 'HR_ADMIN',
      displayName: 'Princess Alcantara',
    });
  });

  it('rejects a wrong password with 401', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: 'hr@msma.test', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toBe('Incorrect email or password');
  });

  it('validates the body with Zod (400 with issues)', async () => {
    const res = await http().post('/auth/login').send({ email: 'not-an-email' }).expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('requires a token for protected endpoints', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
    const me = await http().get('/auth/me').set(auth('employee')).expect(200);
    expect(me.body.displayName).toBe('Jose Reyes');
  });
});

describe('dashboard summary', () => {
  it('returns KPIs, trend, punches, devices and payroll matching the shared schema', async () => {
    const res = await http().get('/dashboard/summary').set(auth('hr')).expect(200);
    const summary = DashboardSummarySchema.parse(res.body); // throws if the contract drifts
    expect(summary.kpis.headcount).toBe(180);
    expect(summary.kpis.pendingApprovals).toBe(9);
    expect(summary.presentBySite).toHaveLength(3);
    expect(summary.trend.length).toBeGreaterThanOrEqual(13);
    expect(summary.trend.length).toBeLessThanOrEqual(14);
    expect(summary.devices).toHaveLength(4);
    expect(summary.payroll?.sample).toBe(true);
    expect(summary.payroll?.gross).toMatch(/^\d+\.\d{2}$/);
  });

  it('filters by site', async () => {
    const sites = (await http().get('/employees/filters').set(auth('hr')).expect(200)).body
      .sites as { id: string; name: string }[];
    const mandaue = sites.find((s) => s.name === 'Mandaue branch')!;
    const res = await http()
      .get('/dashboard/summary')
      .query({ siteId: mandaue.id })
      .set(auth('hr'))
      .expect(200);
    expect(res.body.kpis.headcount).toBe(48);
    expect(res.body.presentBySite).toEqual([
      expect.objectContaining({ siteName: 'Mandaue branch' }),
    ]);
  });

  it('limits managers to their site and hides payroll', async () => {
    const res = await http().get('/dashboard/summary').set(auth('manager')).expect(200);
    expect(res.body.kpis.headcount).toBe(48);
    expect(res.body.payroll).toBeNull();
  });

  it('is forbidden for employees', async () => {
    await http().get('/dashboard/summary').set(auth('employee')).expect(403);
  });
});

describe('approvals', () => {
  const pending = async (who: string) =>
    ApprovalListResponseSchema.parse(
      (await http().get('/approvals').query({ status: 'PENDING' }).set(auth(who)).expect(200)).body,
    );

  it('HR sees all pending requests; managers see only their team', async () => {
    const hr = await pending('hr');
    const manager = await pending('manager');
    expect(hr.total).toBe(9);
    expect(manager.total).toBeGreaterThan(0);
    expect(manager.total).toBeLessThan(hr.total);
    expect(manager.items.every((i) => i.employee.siteName === 'Mandaue branch')).toBe(true);
  });

  it('blocks managers from deciding requests outside their team', async () => {
    const outside = (await pending('hr')).items.find(
      (i) => i.employee.siteName !== 'Mandaue branch',
    )!;
    await http().post(`/approvals/${outside.id}/approve`).set(auth('manager')).send({}).expect(403);
  });

  it('approves a DTR fix, recomputes the DTR, audits it, and refuses a second decision', async () => {
    const fix = (await pending('hr')).items.find(
      (i) => i.type === 'DTR_FIX' && i.employee.fullName === 'Mark Dela Cruz',
    )!;
    const auditBefore = await prisma.auditLog.count();
    const res = await http()
      .post(`/approvals/${fix.id}/approve`)
      .set(auth('hr'))
      .send({})
      .expect(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', decidedBy: 'Princess Alcantara' });
    expect(await prisma.auditLog.count()).toBe(auditBefore + 1);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: fix.id } });
    expect(audit).toMatchObject({ action: 'APPROVAL_APPROVED', entity: 'ApprovalRequest' });

    const correction = await prisma.dtrCorrection.findFirst({
      where: { approval: { id: fix.id } },
    });
    const dtr = await prisma.dailyTimeRecord.findFirst({
      where: { employeeId: correction!.employeeId, date: correction!.date },
    });
    expect(dtr?.timeOut?.toISOString()).toBe(correction!.requestedTimeOut!.toISOString());
    expect(dtr?.remarks).toContain('CORRECTED');

    const again = await http()
      .post(`/approvals/${fix.id}/approve`)
      .set(auth('hr'))
      .send({})
      .expect(409);
    expect(again.body.message).toContain('Already approved');
  });

  it('requires a reason to reject, then records it', async () => {
    const ot = (await pending('manager')).items.find((i) => i.type === 'OT')!;
    const missing = await http()
      .post(`/approvals/${ot.id}/reject`)
      .set(auth('manager'))
      .send({})
      .expect(400);
    expect(missing.body.issues[0].message).toBe('Please give a reason');
    const res = await http()
      .post(`/approvals/${ot.id}/reject`)
      .set(auth('manager'))
      .send({ reason: 'Not pre-approved' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'REJECTED',
      reason: 'Not pre-approved',
      decidedBy: 'Carlo Dizon',
    });
    const otRequest = await prisma.otRequest.findFirst({ where: { approval: { id: ot.id } } });
    expect(otRequest?.status).toBe('REJECTED');
  });

  it('employees cannot use the approvals inbox', async () => {
    await http().get('/approvals').set(auth('employee')).expect(403);
  });
});

describe('filing overtime, undertime and time adjustments', () => {
  /** A past day Jose (employee@msma.test) worked, from his own attendance. */
  const workedDay = async (skip = 0) => {
    const rows = (await http().get('/me/attendance').set(auth('employee')).expect(200)).body as {
      date: string;
      status: string;
      timeOut: string | null;
    }[];
    return rows.filter((r) => r.status === 'PRESENT' && r.date < manilaToday() && r.timeOut)[skip]
      .date;
  };
  const approveAsHr = async (id: string) =>
    http().post(`/approvals/${id}/approve`).set(auth('hr')).send({}).expect(200);

  it('files overtime, audits it, and refuses duplicates, bad lengths and old dates', async () => {
    const date = addDays(manilaToday(), -1);
    const res = await http()
      .post('/me/overtime-requests')
      .set(auth('employee'))
      .send({ date, minutes: 90, reason: 'Month-end closing' })
      .expect(201);
    expect(res.body).toMatchObject({ type: 'OT', status: 'PENDING' });
    expect(res.body.detail).toContain('1 hr 30 min');
    expect(await prisma.auditLog.findFirst({ where: { entityId: res.body.id } })).toMatchObject({
      action: 'OT_SUBMITTED',
    });

    const dup = await http()
      .post('/me/overtime-requests')
      .set(auth('employee'))
      .send({ date, minutes: 60, reason: 'Again' })
      .expect(409);
    expect(dup.body.message).toMatch(/already have a pending overtime request/);
    await http()
      .post('/me/overtime-requests')
      .set(auth('employee'))
      .send({ date, minutes: 20, reason: 'Too short' })
      .expect(400);
    const old = await http()
      .post('/me/overtime-requests')
      .set(auth('employee'))
      .send({ date: addDays(manilaToday(), -40), minutes: 60, reason: 'Old' })
      .expect(400);
    expect(old.body.message).toMatch(/30 days back/);
  });

  it('files undertime inside the shift and works out how early', async () => {
    const outside = await http()
      .post('/me/undertime-requests')
      .set(auth('employee'))
      .send({ date: manilaToday(), leaveTime: '18:00', reason: 'After the shift' })
      .expect(400);
    expect(outside.body.message).toMatch(/during your shift/);

    const date = await workedDay();
    const res = await http()
      .post('/me/undertime-requests')
      .set(auth('employee'))
      .send({ date, leaveTime: '15:00', reason: 'Dental appointment' })
      .expect(201);
    expect(res.body).toMatchObject({ type: 'UNDERTIME', status: 'PENDING' });
    expect(res.body.detail).toContain('2 hrs early');
    await approveAsHr(res.body.id);
    const request = await prisma.undertimeRequest.findFirst({
      where: { approval: { id: res.body.id } },
    });
    expect(request).toMatchObject({ status: 'APPROVED', minutes: 120 });
  });

  it('shows approved undertime on the DTR (seeded example)', async () => {
    const seeded = await prisma.undertimeRequest.findFirst({
      where: { reason: 'Dental appointment', status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
    });
    const dtr = await prisma.dailyTimeRecord.findFirst({
      where: { employeeId: seeded!.employeeId, date: seeded!.date },
    });
    expect(dtr!.undertimeMinutes).toBeGreaterThan(0);
    expect(dtr!.remarks).toContain('UNDERTIME_APPROVED');
  });

  it('a time adjustment updates the DTR once approved', async () => {
    await http()
      .post('/me/time-adjustments')
      .set(auth('employee'))
      .send({ date: addDays(manilaToday(), 1), timeOut: '17:00', reason: 'Future' })
      .expect(400);
    await http()
      .post('/me/time-adjustments')
      .set(auth('employee'))
      .send({ date: addDays(manilaToday(), -2), reason: 'No times given' })
      .expect(400);

    const date = await workedDay(1);
    const res = await http()
      .post('/me/time-adjustments')
      .set(auth('employee'))
      .send({ date, timeOut: '18:30', reason: 'Stayed for the client call' })
      .expect(201);
    expect(res.body.detail).toContain('time out 18:30');
    await approveAsHr(res.body.id);
    const correction = await prisma.dtrCorrection.findFirst({
      where: { approval: { id: res.body.id } },
    });
    const dtr = await prisma.dailyTimeRecord.findFirst({
      where: { employeeId: correction!.employeeId, date: correction!.date },
    });
    expect(formatTime(dtr!.timeOut)).toBe('18:30');
    expect(dtr!.remarks).toContain('CORRECTED');
  });

  it('payroll pays overtime only when it was approved', async () => {
    const pendingOt = await prisma.otRequest.findFirst({
      where: { reason: 'Inventory count', status: { not: 'APPROVED' } },
    });
    const date = utcDateToDateKey(pendingOt!.date);
    const dtr = await prisma.dailyTimeRecord.findFirst({
      where: { employeeId: pendingOt!.employeeId, date: pendingOt!.date },
    });
    expect(dtr!.otMinutes).toBeGreaterThan(0); // the clock shows overtime...
    const preview = await http()
      .post('/payroll/preview')
      .query({ cutoff: cutoffFor(date).code })
      .set(auth('payroll'))
      .expect(200);
    const line = preview.body.lines.find(
      (l: { employeeId: string }) => l.employeeId === pendingOt!.employeeId,
    );
    expect(line.otMinutes).toBe(0); // ...but it is not approved, so it is not paid
  });
});

describe('/iclock (ZKTeco ADMS)', () => {
  const stamp = () => {
    const p = manilaParts(new Date(Date.now() - 60_000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  };

  it('answers the handshake for a registered terminal', async () => {
    const res = await http()
      .get('/iclock/cdata')
      .query({ SN: 'ZKMD0001', options: 'all' })
      .expect(200);
    expect(res.text).toContain('GET OPTION FROM: ZKMD0001');
  });

  it('rejects unknown terminals', async () => {
    await http()
      .post('/iclock/cdata?SN=UNKNOWN1&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('1001\t2026-09-25 08:00:00\t0\t15\t0\t0')
      .expect(403);
  });

  it('stores ATTLOG punches idempotently, ignores bad lines and updates the DTR', async () => {
    const employee = await prisma.employee.findFirst({
      where: { site: { code: 'MND' }, lastName: 'Villanueva' },
    });
    const line = `${employee!.biometricPin}\t${stamp()}\t0\t15\t0\t0`;
    const body = `${line}\nnot a punch\n9999999\t${stamp()}\t0\t1\t0\t0\n`;
    const before = await prisma.rawPunch.count({ where: { employeeId: employee!.id } });

    for (let i = 0; i < 2; i++) {
      const res = await http()
        .post('/iclock/cdata?SN=ZKMD0001&table=ATTLOG&Stamp=9999')
        .set('Content-Type', 'text/plain')
        .send(body)
        .expect(200);
      expect(res.text).toBe('OK');
    }
    expect(await prisma.rawPunch.count({ where: { employeeId: employee!.id } })).toBe(before + 1);

    const punch = await prisma.rawPunch.findFirst({
      where: { employeeId: employee!.id },
      orderBy: { punchedAt: 'desc' },
    });
    expect(punch).toMatchObject({ deviceSerial: 'ZKMD0001', verifyMode: 'FACE' });
    const device = await prisma.device.findUnique({ where: { serial: 'ZKMD0001' } });
    expect(Date.now() - device!.lastSeenAt!.getTime()).toBeLessThan(60_000);
  });

  it('keeps raw punches append-only', async () => {
    const p = await prisma.rawPunch.findFirst();
    await expect(prisma.rawPunch.delete({ where: { id: p!.id } })).rejects.toThrow(/append-only/);
  });
});

describe('phone clock-in (temporary)', () => {
  it('needs the phone check, records how the phone was unlocked, and absorbs double taps', async () => {
    await http().post('/me/clock').set(auth('employee')).send({}).expect(400);
    const res = await http()
      .post('/me/clock')
      .set(auth('employee'))
      .send({ phoneCheck: 'PHONE_BIOMETRIC' })
      .expect(200);
    const punch = await prisma.rawPunch.findFirst({
      where: { deviceSerial: 'MOBILE-APP', punchedAt: new Date(res.body.punchedAt) },
    });
    expect(punch?.verifyMode).toBe('PHONE_BIOMETRIC');
    const again = await http()
      .post('/me/clock')
      .set(auth('employee'))
      .send({ phoneCheck: 'PHONE_PASSCODE' })
      .expect(409);
    expect(again.body.message).toMatch(/wait a minute/);
  });

  it('can be switched off once the attendance machines are in use', async () => {
    config.phoneClockEnabled = false;
    try {
      const res = await http()
        .post('/me/clock')
        .set(auth('manager'))
        .send({ phoneCheck: 'PHONE_PASSCODE' })
        .expect(403);
      expect(res.body.message).toMatch(/attendance machine/);
    } finally {
      config.phoneClockEnabled = true;
    }
  });
});

describe('sign-in throttling', () => {
  it('locks an email for 15 minutes after 5 wrong passwords', async () => {
    const email = 'nobody-throttle@msma.test';
    for (let i = 0; i < 5; i++)
      await http()
        .post('/auth/login')
        .send({ email, password: `wrong-${i}` })
        .expect(401);
    const locked = await http().post('/auth/login').send({ email, password: 'wrong' }).expect(429);
    expect(locked.body.message).toMatch(/Too many wrong passwords/);
    // Other accounts are not affected.
    await http()
      .post('/auth/login')
      .send({ email: 'hr@msma.test', password: PASSWORD })
      .expect(200);
  });
});

describe('sign-in throttling under parallel guesses', () => {
  it('counts attempts before the password check, so a burst cannot get past 5', async () => {
    const email = 'nobody-burst@msma.test';
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        http()
          .post('/auth/login')
          .send({ email, password: `guess-${i}` }),
      ),
    );
    expect(results.filter((r) => r.status === 401)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(7);
  });
});
