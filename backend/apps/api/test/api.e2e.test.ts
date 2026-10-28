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
  for (const who of ['hr', 'manager', 'employee', 'payroll', 'partner']) {
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
    const mandaue = sites.find((s) => s.name === 'Manila')!;
    const res = await http()
      .get('/dashboard/summary')
      .query({ siteId: mandaue.id })
      .set(auth('hr'))
      .expect(200);
    expect(res.body.kpis.headcount).toBe(48);
    expect(res.body.presentBySite).toEqual([
      expect.objectContaining({ siteName: 'Manila' }),
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
    expect(manager.items.every((i) => i.employee.siteName === 'Manila')).toBe(true);
  });

  it('blocks managers from deciding requests outside their team', async () => {
    const outside = (await pending('hr')).items.find(
      (i) => i.employee.siteName !== 'Manila',
    )!;
    await http().post(`/approvals/${outside.id}/approve`).set(auth('manager')).send({}).expect(403);
  });

  it('HR may only look: the workflow sends requests to the supervisor (or the Super Admin)', async () => {
    const fix = (await pending('hr')).items.find(
      (i) => i.type === 'DTR_FIX' && i.employee.fullName === 'Mark Dela Cruz',
    )!;
    expect(fix).toMatchObject({ waitingFor: 'Manager or supervisor', canDecide: false });
    await http().post(`/approvals/${fix.id}/approve`).set(auth('hr')).send({}).expect(403);
  });

  it('approves a DTR fix, recomputes the DTR, audits it, and refuses a second decision', async () => {
    const fix = (await pending('partner')).items.find(
      (i) => i.type === 'DTR_FIX' && i.employee.fullName === 'Mark Dela Cruz',
    )!;
    const auditBefore = await prisma.auditLog.count();
    const res = await http()
      .post(`/approvals/${fix.id}/approve`)
      .set(auth('partner'))
      .send({})
      .expect(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', decidedBy: 'Partner (Super Admin)' });
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
      .set(auth('partner'))
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
  // Jose's supervisor is Carlo (the Approver), so his requests are Carlo's to decide.
  const approveAsHr = async (id: string) =>
    http().post(`/approvals/${id}/approve`).set(auth('manager')).send({}).expect(200);

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

describe('me/profile', () => {
  it("returns the signed-in person's own record, with their government numbers readable", async () => {
    const res = await http().get('/me/profile').set(auth('employee')).expect(200);
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'employee@msma.test' }, include: { employee: true } });
    expect(res.body.employeeNo).toBe(me.employee!.employeeNo);
    expect(res.body.fullName).toBe(`${me.employee!.firstName} ${me.employee!.lastName}`);
    expect(res.body.personal).toBeTruthy();
    expect(res.body.govIds?.tin).toMatch(/^\d{3}-\d{3}-\d{3}-\d{3}$/); // decrypted for their owner
  });

  it('is refused for a login without an employee record', async () => {
    await http().get('/me/profile').set(auth('partner')).expect(403);
  });
});

describe('org chart: reports to', () => {
  const idOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email }, include: { employee: true } })).employee!;

  it('changes who someone reports to, records it in their history, and puts it back', async () => {
    const jose = await idOf('employee@msma.test');
    const hr = await idOf('hr@msma.test');
    const before = (await prisma.employee.findUniqueOrThrow({ where: { id: jose.id }, include: { manager: true } })).manager;
    await http().put(`/employees/${jose.id}/manager`).set(auth('hr')).send({ managerNo: hr.employeeNo }).expect(200);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: jose.id } })).managerId).toBe(hr.id);
    const activity = (await http().get(`/employees/${jose.id}/activity`).set(auth('hr')).expect(200)).body;
    expect(activity[0].section).toBe('Manager changed');
    await http().put(`/employees/${jose.id}/manager`).set(auth('hr')).send({ managerNo: before?.employeeNo ?? null }).expect(200);
  });

  it('refuses a loop, reporting to yourself, and HR changing their own manager', async () => {
    const jose = await idOf('employee@msma.test');
    const carlo = await idOf('manager@msma.test');
    const hr = await idOf('hr@msma.test');
    // Jose reports to Carlo, so Carlo can't report to Jose.
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: jose.id } })).managerId).toBe(carlo.id);
    await http().put(`/employees/${carlo.id}/manager`).set(auth('hr')).send({ managerNo: jose.employeeNo }).expect(400);
    await http().put(`/employees/${jose.id}/manager`).set(auth('hr')).send({ managerNo: jose.employeeNo }).expect(400);
    await http().put(`/employees/${hr.id}/manager`).set(auth('hr')).send({ managerNo: carlo.employeeNo }).expect(403);
    await http().put(`/employees/${jose.id}/manager`).set(auth('manager')).send({ managerNo: null }).expect(403);
  });
});

describe('201 document review', () => {
  const pdf = Buffer.from('%PDF-1.4\n% review test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
  const myFile = async () => (await http().get('/me/201-file').set(auth('employee')).expect(200)).body;
  const joseId = async () => (await prisma.user.findUniqueOrThrow({ where: { email: 'employee@msma.test' } })).employeeId!;

  it('an employee upload waits for HR, counts once verified, and can be sent back with a note', async () => {
    const before = await myFile();
    // A paper the employee may add and doesn't have yet.
    const missing = before.items.find((i: { status: string; type: string }) => i.status === 'MISSING' && ['BIRTH_CERTIFICATE', 'DIPLOMA_TOR', 'GOVERNMENT_ID', 'RESUME', 'NBI_CLEARANCE', 'POLICE_CLEARANCE', 'PREVIOUS_COE'].includes(i.type));
    // None missing: use a paper they already have (the review steps are the same; only the count check is skipped).
    const pick = missing ?? before.items.find((i: { type: string }) => i.type === 'GOVERNMENT_ID');
    const wasMissing = !!missing;
    const up = await http().post('/me/documents').set(auth('employee')).field('type', pick.type).attach('file', pdf, 'mine.pdf').expect(201);
    expect(up.body.reviewStatus).toBe('SUBMITTED');
    let item = (await myFile()).items.find((i: { type: string }) => i.type === pick.type);
    if (wasMissing) expect(item.status).toBe('MISSING'); // not counted until HR checks it
    expect(item.documents.find((d: { id: string }) => d.id === up.body.id).reviewStatus).toBe('SUBMITTED');
    const papers = (await http().get('/documents/papers').set(auth('hr')).expect(200)).body;
    expect(papers.some((p: { items: { documents: { id: string; reviewStatus: string }[] }[] }) => p.items.some((i) => i.documents.some((d) => d.id === up.body.id && d.reviewStatus === 'SUBMITTED')))).toBe(true);
    await http().post(`/documents/${up.body.id}/verify`).set(auth('hr')).expect(200);
    item = (await myFile()).items.find((i: { type: string }) => i.type === pick.type);
    expect(['ON_FILE', 'EXPIRING']).toContain(item.status);
    // HR sees it verified (a verified restricted paper, like an ID, is hidden from the employee again).
    const hrView = (await http().get(`/employees/${await joseId()}/201-file`).set(auth('hr')).expect(200)).body;
    expect(hrView.items.find((i: { type: string }) => i.type === pick.type).documents.find((d: { id: string }) => d.id === up.body.id).reviewStatus).toBe('VERIFIED');
    await http().post(`/documents/${up.body.id}/verify`).set(auth('hr')).expect(400); // already reviewed

    // A second upload sent back: archived, and the employee sees why.
    const again = await http().post('/me/documents').set(auth('employee')).field('type', pick.type).attach('file', pdf, 'blurry.pdf').expect(201);
    await http().post(`/documents/${again.body.id}/return`).set(auth('hr')).send({ note: 'Too blurry, please rescan' }).expect(200);
    item = (await myFile()).items.find((i: { type: string }) => i.type === pick.type);
    expect(item.note).toBe('Too blurry, please rescan');
    expect(item.documents.some((d: { id: string }) => d.id === again.body.id)).toBe(false);
  });

  it('HR marks a paper not applicable or required; employees cannot add restricted papers or review', async () => {
    const id = await joseId();
    const file = await myFile();
    const target = file.items.find((i: { status: string }) => i.status === 'MISSING');
    await http().put(`/employees/${id}/201-file/${target.type}`).set(auth('hr')).send({ state: 'NOT_APPLICABLE' }).expect(200);
    let item = (await myFile()).items.find((i: { type: string }) => i.type === target.type);
    expect(item.status).toBe('NOT_NEEDED');
    expect(item.override).toBe('NOT_APPLICABLE');
    await http().put(`/employees/${id}/201-file/${target.type}`).set(auth('hr')).send({ state: null }).expect(200);
    item = (await myFile()).items.find((i: { type: string }) => i.type === target.type);
    expect(item.status).toBe('MISSING');
    await http().post('/me/documents').set(auth('employee')).field('type', 'DISCIPLINARY_RECORD').attach('file', pdf, 'case.pdf').expect(403);
    await http().post('/me/documents').set(auth('employee')).field('type', 'EMPLOYMENT_CONTRACT').attach('file', pdf, 'contract.pdf').expect(403);
    const mine = await http().post('/me/documents').set(auth('employee')).field('type', 'RESUME').attach('file', pdf, 'cv.pdf').expect(201);
    await http().post(`/documents/${mine.body.id}/verify`).set(auth('employee')).expect(403);
    await http().post(`/documents/${mine.body.id}/verify`).set(auth('hr')).expect(200);
    // Withdraw: only your own, only before HR checks it.
    const oops = await http().post('/me/documents').set(auth('employee')).field('type', 'RESUME').attach('file', pdf, 'wrong.pdf').expect(201);
    await http().delete(`/me/documents/${oops.body.id}`).set(auth('hr')).expect(404);
    await http().delete(`/me/documents/${oops.body.id}`).set(auth('employee')).expect(204);
    await http().delete(`/me/documents/${mine.body.id}`).set(auth('employee')).expect(400);
  });
});

describe('announcements and company settings', () => {
  it('HR posts an announcement everyone sees; employees cannot post; it can be taken down', async () => {
    const posted = (await http().post('/announcements').set(auth('hr')).send({ title: 'Town hall on Friday', body: 'Main hall, 4 PM' }).expect(201)).body;
    expect(posted.postedOn).toMatch(/^Posted /);
    const seen = (await http().get('/announcements').set(auth('employee')).expect(200)).body;
    expect(seen[0]).toMatchObject({ title: 'Town hall on Friday', postedBy: expect.any(String) });
    await http().post('/announcements').set(auth('employee')).send({ title: 'Hello everyone' }).expect(403);
    await http().delete(`/announcements/${posted.id}`).set(auth('hr')).expect(204);
    expect((await http().get('/announcements').set(auth('employee')).expect(200)).body.some((a: { id: string }) => a.id === posted.id)).toBe(false);
  });

  it('only the Super Admin changes company settings, with the same checks as the website', async () => {
    const current = (await http().get('/settings').set(auth('employee')).expect(200)).body;
    expect(current.companyName).toBeTruthy();
    await http().put('/admin/settings').set(auth('hr')).send(current).expect(403);
    await http().put('/admin/settings').set(auth('partner')).send({ ...current, tin: '12345' }).expect(400);
    await http().put('/admin/settings').set(auth('partner')).send({ ...current, workStart: '18:00', workEnd: '08:00' }).expect(400);
    const saved = (await http().put('/admin/settings').set(auth('partner')).send({ ...current, idleMinutes: 45 }).expect(200)).body;
    expect(saved.idleMinutes).toBe(45);
    expect((await http().get('/settings').set(auth('employee')).expect(200)).body.idleMinutes).toBe(45);
    await http().put('/admin/settings').set(auth('partner')).send(current).expect(200);
  });

  it('HR saves scheduling rules and the leave policy; the policy comes with the leave state', async () => {
    const rules = (await http().put('/settings/scheduling').set(auth('hr')).send({ overtimeThresholdMinutes: 30, defaultBreakMinutes: 60, publishLeadDays: 7 }).expect(200)).body;
    expect((await http().get('/settings/scheduling').set(auth('manager')).expect(200)).body).toEqual(rules);
    await http().put('/settings/scheduling').set(auth('employee')).send(rules).expect(403);
    await http().put('/settings/leave-policy').set(auth('hr')).send({ allowHalfDays: false, allowNegative: false, defaultCarryOver: 5, accrual: 'yearly' }).expect(200);
    expect((await http().get('/leave/state').set(auth('hr')).expect(200)).body.policy).toMatchObject({ allowHalfDays: false, defaultCarryOver: 5 });
    await http().put('/settings/leave-policy').set(auth('hr')).send({ allowHalfDays: true, allowNegative: false, defaultCarryOver: 0, accrual: 'yearly' }).expect(200);
    await http().put('/settings/scheduling').set(auth('hr')).send({ overtimeThresholdMinutes: 0, defaultBreakMinutes: 60, publishLeadDays: 7 }).expect(200);
  });
});

describe('remote work days', () => {
  const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const officeOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email }, include: { employee: { include: { site: true } } } })).employee!;

  // HR's office gets the declared day (HR hasn't clocked in this test run, so the double-tap guard stays out of the way).
  it('HR or the Super Admin declares them; a covered employee clocks in from home and it counts in attendance', async () => {
    const princess = await officeOf('hr@msma.test');
    await http().post('/timekeeping/remote-days').set(auth('employee')).send({ from: today(), to: today(), offices: [princess.site.name], reason: 'Typhoon test' }).expect(403);
    await http().post('/timekeeping/remote-days').set(auth('manager')).send({ from: today(), to: today(), offices: [princess.site.name], reason: 'Typhoon test' }).expect(403);
    const day = (await http().post('/timekeeping/remote-days').set(auth('hr')).send({ from: today(), to: today(), offices: [princess.site.name], reason: 'Typhoon test' }).expect(201)).body;
    await http().post('/timekeeping/remote-days').set(auth('partner')).send({ from: today(), to: today(), offices: [], reason: 'Overlap' }).expect(409);
    const clock = (await http().post('/timekeeping/clock').set(auth('hr')).send({ kind: 'in', match: 93 }).expect(201)).body;
    expect(clock.kind).toBe('in');
    await http().post('/timekeeping/clock').set(auth('hr')).send({ kind: 'in', match: 90 }).expect(409); // already in
    const raw = await prisma.rawPunch.findFirst({ where: { employeeId: princess.id, deviceSerial: 'REMOTE-WEB' }, orderBy: { punchedAt: 'desc' } });
    expect(raw?.verifyMode).toBe('FACE');
    const state = (await http().get('/timekeeping/remote').set(auth('hr')).expect(200)).body;
    expect(state.remoteDays.some((d: { id: string }) => d.id === day.id)).toBe(true);
    expect(state.remotePunches.some((p: { id: string; match: number }) => p.id === clock.id && p.match === 93)).toBe(true);
    // Their office's remote day: switching their own day isn't needed, and it can't be cancelled once used.
    await http().post('/timekeeping/wfh').set(auth('hr')).send({ on: true }).expect(409);
    await http().delete(`/timekeeping/remote-days/${day.id}`).set(auth('partner')).expect(409);
  });

  it('working from home by choice: clock in, then switching back sets the home punch aside', async () => {
    const princess = await officeOf('hr@msma.test');
    // Someone in another office (not covered by the declared day above) who hasn't clocked in this run.
    let who = '';
    for (const w of ['manager', 'payroll']) if ((await officeOf(w + '@msma.test')).siteId !== princess.siteId) { who = w; break; }
    expect(who).not.toBe('');
    const me = await officeOf(who + '@msma.test');
    void me;
    await http().post('/timekeeping/clock').set(auth(who)).send({ kind: 'in', match: 88 }).expect(403); // not a remote day for them
    await http().post('/timekeeping/wfh').set(auth(who)).send({ on: true }).expect(204);
    const p = (await http().post('/timekeeping/clock').set(auth(who)).send({ kind: 'in', match: 88 }).expect(201)).body;
    await http().post('/timekeeping/wfh').set(auth(who)).send({ on: false }).expect(204);
    const row = await prisma.remotePunch.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.voidedAt).not.toBeNull();
    expect(await prisma.punchVoid.findUnique({ where: { rawPunchId: row.rawPunchId! } })).not.toBeNull(); // the punch itself is untouched (append-only)
    const state = (await http().get('/timekeeping/remote').set(auth(who)).expect(200)).body;
    expect(state.remotePunches.find((x: { id: string }) => x.id === p.id).voided.reason).toBe('Switched back to an office day');
    await http().post('/timekeeping/clock').set(auth(who)).send({ kind: 'in', match: 88 }).expect(403); // office day again
  });
});

describe('employee self-service contact details', () => {
  it('an employee changes their own mobile and emergency contact, but nothing else', async () => {
    const before = (await http().get('/me/profile').set(auth('employee')).expect(200)).body;
    const res = await http()
      .patch('/me/personal')
      .set(auth('employee'))
      .send({ mobileNo: '09171234567', emergencyContact: { name: 'Ana Reyes', relationship: 'Spouse', phone: '09170001111' }, workEmail: 'hacked@example.com', bank: { bankName: 'X', accountName: 'Y', accountNumber: '1' } })
      .expect(200);
    expect(res.body.mobileNo).toBe('09171234567');
    expect(res.body.personal.emergencyContact.name).toBe('Ana Reyes');
    expect(res.body.email).toBe(before.email); // work email is HR's to change
    expect(JSON.stringify(res.body.personal.bank)).toBe(JSON.stringify(before.personal.bank)); // so is the bank account
    await http().patch('/me/personal').set(auth('employee')).send({ mobileNo: before.mobileNo, emergencyContact: before.personal.emergencyContact }).expect(200);
  });
});

describe('approver tools: cases and performance reviews', () => {
  const noOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email }, include: { employee: true } })).employee!.employeeNo;

  it('an approver files and updates cases for their own team only; HR only looks; removing keeps the record', async () => {
    const jose = await noOf('employee@msma.test'); // on the manager's team
    const princess = await noOf('hr@msma.test'); // not on it
    const filed = (await http().post('/cases').set(auth('manager')).send({ employeeNo: jose, type: 'Attendance', summary: 'Late three times this week' }).expect(201)).body;
    expect(filed).toMatchObject({ employeeId: jose, status: 'Open', type: 'Attendance' });
    await http().post('/cases').set(auth('manager')).send({ employeeNo: princess, type: 'Conduct', summary: 'Not my team' }).expect(403);
    await http().post('/cases').set(auth('hr')).send({ employeeNo: jose, type: 'Conduct', summary: 'HR only looks' }).expect(403);
    await http().post('/cases').set(auth('employee')).send({ employeeNo: jose, type: 'Conduct', summary: 'Employees cannot' }).expect(403);
    expect((await http().get('/cases').set(auth('hr')).expect(200)).body.some((c: { id: string }) => c.id === filed.id)).toBe(true);
    await http().get('/cases').set(auth('employee')).expect(403);
    const updated = (await http().put(`/cases/${filed.id}`).set(auth('manager')).send({ status: 'Under review' }).expect(200)).body;
    expect(updated.status).toBe('Under review');
    await http().put(`/cases/${filed.id}`).set(auth('hr')).send({ status: 'Resolved' }).expect(403);
    await http().delete(`/cases/${filed.id}`).set(auth('manager')).expect(204);
    expect((await http().get('/cases').set(auth('manager')).expect(200)).body.some((c: { id: string }) => c.id === filed.id)).toBe(false);
    expect((await prisma.employeeCase.findUniqueOrThrow({ where: { id: filed.id } })).closedAt).not.toBeNull(); // kept on record
  });

  it("an approver marks their team's performance reviews; others' are refused", async () => {
    const jose = await noOf('employee@msma.test');
    const princess = await noOf('hr@msma.test');
    const year = new Date().getFullYear();
    await http().put(`/performance/reviews/${jose}`).set(auth('manager')).send({ status: 'Submitted', year }).expect(200);
    expect((await http().get('/performance/reviews').query({ year }).set(auth('manager')).expect(200)).body[jose]).toBe('Submitted');
    await http().put(`/performance/reviews/${princess}`).set(auth('manager')).send({ status: 'Submitted', year }).expect(403);
    await http().put(`/performance/reviews/${jose}`).set(auth('hr')).send({ status: 'Pending', year }).expect(403);
  });
});
