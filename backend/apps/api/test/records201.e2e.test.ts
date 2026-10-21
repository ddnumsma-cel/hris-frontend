import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { File201Schema, RecordsListResponseSchema, RecordsSummarySchema } from '@msma/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/bootstrap-app';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;
const tokens: Record<string, string> = {};
let jose: string; // employee@msma.test
let otherEmployee: string; // not on Carlo's team

const http = () => request(app.getHttpServer());
const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
const PDF = Buffer.from('%PDF-1.4\n% MSMA e2e sample\n');

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toMatch(/_test/);
  app = await createApp({ logger: false });
  await app.init();
  prisma = app.get(PrismaService);
  for (const who of ['hr', 'manager', 'employee', 'payroll']) {
    const res = await http()
      .post('/auth/login')
      .send({ email: `${who}@msma.test`, password: 'Demo@2026' })
      .expect(200);
    tokens[who] = res.body.accessToken;
  }
  jose = (await prisma.user.findUniqueOrThrow({ where: { email: 'employee@msma.test' } }))
    .employeeId!;
  const carlo = (await prisma.user.findUniqueOrThrow({ where: { email: 'manager@msma.test' } }))
    .employeeId!;
  otherEmployee = (await prisma.employee.findFirstOrThrow({
    where: { managerId: { not: carlo }, id: { not: carlo } },
  }))!.id;
});

afterAll(async () => {
  await app?.close();
});

describe('201 checklist', () => {
  it('shows the employee their own file: NBI expiring, medical results missing', async () => {
    const res = await http().get('/me/201-file').set(auth('employee')).expect(200);
    const file = File201Schema.parse(res.body);
    const item = (t: string) => file.items.find((i) => i.type === t)!;
    expect(item('NBI_CLEARANCE').status).toBe('EXPIRING');
    expect(item('MEDICAL_RESULTS').status).toBe('MISSING');
    expect(item('LEAVE_RECORDS').status).toBe('AUTOMATIC');
    expect(file.summary.percent).toBeLessThan(100);
    expect(file.retentionVerified).toBe(false);
    // Restricted items are counted but their details (ID numbers) are not sent to the employee.
    expect(item('GOVERNMENT_ID').count).toBeGreaterThan(0);
    expect(item('GOVERNMENT_ID').documents).toEqual([]);
    expect(item('NBI_CLEARANCE').documents[0].canOpen).toBe(true);
  });

  it('lets managers see their team only', async () => {
    await http().get(`/employees/${jose}/201-file`).set(auth('manager')).expect(200);
    await http().get(`/employees/${otherEmployee}/201-file`).set(auth('manager')).expect(403);
    await http().get(`/employees/${otherEmployee}/201-file`).set(auth('employee')).expect(403);
  });

  it('summarises all 201 files for HR, not for managers', async () => {
    const res = await http().get('/records/summary').set(auth('hr')).expect(200);
    const s = RecordsSummarySchema.parse(res.body);
    expect(s.employees).toBe(180);
    expect(s.complete + s.incomplete).toBeLessThanOrEqual(180);
    expect(s.renewals.some((r) => r.employeeId === jose && r.type === 'NBI_CLEARANCE')).toBe(true);
    await http().get('/records/summary').set(auth('manager')).expect(403);

    const list = RecordsListResponseSchema.parse(
      (await http().get('/records?filter=INCOMPLETE&pageSize=200').set(auth('hr')).expect(200))
        .body,
    );
    expect(list.items.every((i) => i.summary.missing > 0)).toBe(true);
  });

  it('adds the 201 status to the employee list for HR only', async () => {
    const hr = await http().get('/employees?pageSize=5').set(auth('hr')).expect(200);
    expect(hr.body.items[0].record201).toMatchObject({ percent: expect.any(Number) });
    const mgr = await http().get('/employees?pageSize=5').set(auth('manager')).expect(200);
    expect(mgr.body.items[0].record201).toBeNull();
  });
});

describe('201 documents', () => {
  let medicalId: string;

  it('uploads a PDF, fills in the checklist item and logs it', async () => {
    const res = await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('hr'))
      .field('type', 'MEDICAL_RESULTS')
      .field('issuedOn', '2026-09-01')
      .field('notes', 'Fit to work')
      .attach('file', PDF, { filename: 'medical.pdf', contentType: 'application/pdf' })
      .expect(201);
    medicalId = res.body.id;
    expect(res.body).toMatchObject({ type: 'MEDICAL_RESULTS', mimeType: 'application/pdf' });
    const file = (await http().get('/me/201-file').set(auth('employee'))).body;
    expect(file.items.find((i: { type: string }) => i.type === 'MEDICAL_RESULTS').status).toBe(
      'ON_FILE',
    );
    const log = await prisma.auditLog.findFirst({
      where: { entityId: medicalId, action: 'DOCUMENT_UPLOADED' },
    });
    expect(log).not.toBeNull();
  });

  it('rejects files that are not really PDF/JPG/PNG, and future issue dates', async () => {
    const fake = await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('hr'))
      .field('type', 'NDA')
      .attach('file', Buffer.from('MZ not a pdf'), {
        filename: 'nda.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(fake.body.message).toMatch(/Only PDF, JPG or PNG/);
    await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('hr'))
      .field('type', 'NDA')
      .field('issuedOn', '2099-01-01')
      .attach('file', PDF, { filename: 'nda.pdf' })
      .expect(400);
  });

  it('suggests the expiry of a clearance from its issue date', async () => {
    const res = await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('hr'))
      .field('type', 'POLICE_CLEARANCE')
      .field('issuedOn', '2026-09-01')
      .attach('file', PDF, { filename: 'police.pdf' })
      .expect(201);
    expect(res.body.expiresOn).toBe('2027-02-28');
  });

  it('keeps health records HR-only and logs every opening', async () => {
    const opened = await http().get(`/documents/${medicalId}/file`).set(auth('hr')).expect(200);
    expect(opened.headers['content-type']).toBe('application/pdf');
    expect(opened.headers['cache-control']).toContain('no-store');
    expect(Buffer.from(opened.body).equals(PDF)).toBe(true);

    const denied = await http().get(`/documents/${medicalId}/file`).set(auth('employee'));
    expect(denied.status).toBe(403);
    expect(denied.body.message).toMatch(/ask HR for a copy/);
    await http().get(`/documents/${medicalId}/file`).set(auth('manager')).expect(403);
    await http().get(`/documents/${medicalId}/file`).set(auth('payroll')).expect(403);

    const views = await http().get(`/documents/${medicalId}/views`).set(auth('hr')).expect(200);
    expect(views.body.items.map((v: { action: string }) => v.action)).toContain('DOCUMENT_OPENED');
    await http().get(`/documents/${medicalId}/views`).set(auth('payroll')).expect(403);
  });

  it('lets payroll add payroll papers only', async () => {
    await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('payroll'))
      .field('type', 'MEDICAL_RESULTS')
      .attach('file', PDF, { filename: 'x.pdf' })
      .expect(403);
    await http()
      .post(`/employees/${jose}/documents`)
      .set(auth('payroll'))
      .field('type', 'LOAN_DOCUMENT')
      .field('referenceNo', 'SSS salary loan 123456')
      .attach('file', PDF, { filename: 'loan.pdf' })
      .expect(201);
  });

  it('archives a document with a reason instead of deleting it', async () => {
    await http()
      .post(`/documents/${medicalId}/archive`)
      .set(auth('hr'))
      .send({ reason: 'x' })
      .expect(400);
    await http()
      .post(`/documents/${medicalId}/archive`)
      .set(auth('hr'))
      .send({ reason: 'Uploaded to the wrong employee' })
      .expect(204);
    await http().get(`/documents/${medicalId}/file`).set(auth('hr')).expect(404);
    const row = await prisma.employeeDocument.findUniqueOrThrow({ where: { id: medicalId } });
    expect(row.archivedReason).toBe('Uploaded to the wrong employee');
  });
});

describe('personal info and consent', () => {
  it('validates government numbers and limits payroll to them', async () => {
    const bad = await http()
      .patch(`/employees/${jose}/personal`)
      .set(auth('hr'))
      .send({
        govIds: {
          tin: '123',
          sss: '34-1234567-8',
          philhealth: '12-345678901-2',
          pagibig: '1234-5678-9012',
        },
      })
      .expect(400);
    expect(bad.body.issues[0].message).toMatch(/123-456-789-000/);
    await http()
      .patch(`/employees/${jose}/personal`)
      .set(auth('payroll'))
      .send({ address: 'Somewhere' })
      .expect(403);
  });

  it('asks for a marriage certificate once the civil status is Married (audit-logged)', async () => {
    await http()
      .patch(`/employees/${jose}/personal`)
      .set(auth('hr'))
      .send({ civilStatus: 'MARRIED', effectiveDate: '2026-09-20' })
      .expect(200);
    const file = (await http().get(`/employees/${jose}/201-file`).set(auth('hr'))).body;
    expect(file.items.find((i: { type: string }) => i.type === 'MARRIAGE_CERTIFICATE').status).toBe(
      'MISSING',
    );
    const log = await prisma.auditLog.findFirst({
      where: { entityId: jose, action: 'PERSONAL_INFO_UPDATED' },
      orderBy: { at: 'desc' },
    });
    expect(log?.after).toMatchObject({ civilStatus: 'MARRIED', effectiveDate: '2026-09-20' });
  });

  it('refuses biometric enrollment until the consent form is on file', async () => {
    const noConsent = await prisma.employee.findFirstOrThrow({
      where: { documents: { none: { type: 'BIOMETRIC_CONSENT' } } },
    });
    const res = await http()
      .post(`/employees/${noConsent.id}/biometric-enrollment`)
      .set(auth('hr'))
      .expect(409);
    expect(res.body.message).toMatch(/consent form is not on file/);
    await http()
      .post(`/employees/${noConsent.id}/documents`)
      .set(auth('hr'))
      .field('type', 'BIOMETRIC_CONSENT')
      .field('referenceNo', 'Biometric consent v1')
      .attach('file', PDF, { filename: 'consent.pdf' })
      .expect(201);
    await http()
      .post(`/employees/${noConsent.id}/biometric-enrollment`)
      .set(auth('hr'))
      .expect(201);
  });
});

describe('personal data sheet visibility', () => {
  it('is sent to HR, but not to managers or payroll', async () => {
    const hr = await http().get(`/employees/${jose}`).set(auth('hr')).expect(200);
    expect(hr.body.personal).toMatchObject({ address: expect.any(String) });
    const mgr = await http().get(`/employees/${jose}`).set(auth('manager')).expect(200);
    expect(mgr.body.personal).toBeNull();
    const pay = await http().get(`/employees/${jose}`).set(auth('payroll')).expect(200);
    expect(pay.body.personal).toBeNull();
    expect(pay.body.govIds.tin).toMatch(/^\d{3}-/); // payroll still sees government numbers
  });
});
