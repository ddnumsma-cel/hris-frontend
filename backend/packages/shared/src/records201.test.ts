import { describe, expect, it } from 'vitest';
import {
  addMonths,
  canManageDocument,
  canOpenDocument,
  type ChecklistDoc,
  type ChecklistEmployee,
  computeChecklist,
  DOCUMENT_CATALOG,
  DOCUMENT_TYPES,
  type DocumentType,
  expiryStatus,
  GOV_NUMBER_FORMATS,
  retainUntil,
  suggestedExpiry,
} from './records201';

const TODAY = '2026-09-25';
const employee: ChecklistEmployee = {
  civilStatus: 'SINGLE',
  childrenCount: 0,
  licenseType: null,
  hireDate: '2020-01-06',
  separationDate: null,
  personalDataComplete: true,
};
const doc = (type: DocumentType, over: Partial<ChecklistDoc> = {}): ChecklistDoc => ({
  type,
  issuedOn: '2026-01-10',
  expiresOn: null,
  uploadedAt: '2026-01-10T01:00:00.000Z',
  ...over,
});
const allRequired = DOCUMENT_CATALOG.filter((d) => d.requirement === 'REQUIRED').map((d) => d.code);
const status = (r: ReturnType<typeof computeChecklist>, t: DocumentType) =>
  r.items.find((i) => i.type === t)!.status;

describe('201 catalog', () => {
  it('has one definition per document type, in the checklist order', () => {
    expect(DOCUMENT_CATALOG.map((d) => d.code)).toEqual([...DOCUMENT_TYPES]);
  });

  it('only suggests expiry dates for types that track expiry', () => {
    for (const d of DOCUMENT_CATALOG) if (d.validityMonths) expect(d.tracksExpiry).toBe(true);
  });
});

describe('computeChecklist', () => {
  it('is 100% when every required item is on file', () => {
    const r = computeChecklist(
      employee,
      allRequired
        .filter((t) => t !== 'PERSONAL_DATA_SHEET')
        .map((t) => doc(t, t.endsWith('CLEARANCE') ? { expiresOn: '2027-01-09' } : {})),
      TODAY,
    );
    expect(r.summary).toMatchObject({ missing: 0, expired: 0, percent: 100 });
    expect(status(r, 'LEAVE_RECORDS')).toBe('AUTOMATIC');
    expect(status(r, 'COMMENDATION')).toBe('NONE_YET');
    expect(status(r, 'MARRIAGE_CERTIFICATE')).toBe('NOT_NEEDED');
    expect(status(r, 'CLEARANCE_FORM')).toBe('NOT_NEEDED'); // still employed
  });

  it('counts missing items and the personal data sheet from the record fields', () => {
    const r = computeChecklist({ ...employee, personalDataComplete: false }, [], TODAY);
    expect(r.summary.missing).toBe(allRequired.length);
    expect(r.summary.percent).toBe(0);
    expect(status(r, 'PERSONAL_DATA_SHEET')).toBe('MISSING');
  });

  it('requires marriage and children certificates, licenses and separation papers only when they apply', () => {
    const r = computeChecklist(
      {
        ...employee,
        civilStatus: 'MARRIED',
        childrenCount: 2,
        licenseType: 'PRC (CPA)',
        separationDate: '2026-09-30',
      },
      [],
      TODAY,
    );
    for (const t of [
      'MARRIAGE_CERTIFICATE',
      'CHILD_BIRTH_CERTIFICATE',
      'PROFESSIONAL_LICENSE',
      'CLEARANCE_FORM',
      'FINAL_PAY_QUITCLAIM',
    ] as const)
      expect(status(r, t)).toBe('MISSING');
    expect(status(r, 'PREVIOUS_BIR_2316')).toBe('NOT_NEEDED');
  });

  it('flags expiring and expired clearances; the newest document counts', () => {
    const expiring = computeChecklist(
      employee,
      [doc('NBI_CLEARANCE', { issuedOn: '2025-10-10', expiresOn: '2026-10-09' })],
      TODAY,
    );
    expect(status(expiring, 'NBI_CLEARANCE')).toBe('EXPIRING');
    expect(expiring.items.find((i) => i.type === 'NBI_CLEARANCE')!.expiresOn).toBe('2026-10-09');

    const expired = computeChecklist(
      employee,
      [doc('POLICE_CLEARANCE', { issuedOn: '2026-01-10', expiresOn: '2026-07-09' })],
      TODAY,
    );
    expect(status(expired, 'POLICE_CLEARANCE')).toBe('EXPIRED');
    expect(expired.summary.expired).toBe(1);

    const renewed = computeChecklist(
      employee,
      [
        doc('POLICE_CLEARANCE', { issuedOn: '2026-01-10', expiresOn: '2026-07-09' }),
        doc('POLICE_CLEARANCE', { issuedOn: '2026-09-01', expiresOn: '2027-02-28' }),
      ],
      TODAY,
    );
    expect(status(renewed, 'POLICE_CLEARANCE')).toBe('ON_FILE');
  });

  it('accepts any one valid government ID when others have expired', () => {
    const r = computeChecklist(
      employee,
      [
        doc('GOVERNMENT_ID', { expiresOn: '2025-01-01' }),
        doc('GOVERNMENT_ID', { issuedOn: '2019-05-01', expiresOn: '2029-05-01' }),
      ],
      TODAY,
    );
    expect(status(r, 'GOVERNMENT_ID')).toBe('ON_FILE');
  });
});

describe('expiry, retention and date helpers', () => {
  it('classifies expiry against the 30-day warning window', () => {
    expect(expiryStatus(null, TODAY)).toBe('VALID');
    expect(expiryStatus('2026-09-24', TODAY)).toBe('EXPIRED');
    expect(expiryStatus('2026-09-25', TODAY)).toBe('EXPIRING');
    expect(expiryStatus('2026-10-25', TODAY)).toBe('EXPIRING');
    expect(expiryStatus('2026-10-26', TODAY)).toBe('VALID');
  });

  it('adds months and clamps to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('suggests an expiry from the typical validity', () => {
    expect(suggestedExpiry('NBI_CLEARANCE', '2026-09-25')).toBe('2027-09-24');
    expect(suggestedExpiry('POLICE_CLEARANCE', '2026-09-25')).toBe('2027-03-24');
    expect(suggestedExpiry('DIPLOMA_TOR', '2026-09-25')).toBeNull();
  });

  it('keeps records during employment and for the retention period after separation', () => {
    expect(retainUntil('NBI_CLEARANCE', null)).toBeNull();
    expect(retainUntil('NBI_CLEARANCE', '2026-09-30')).toBe('2029-09-30');
    expect(retainUntil('SEPARATION_BIR_2316', '2026-09-30')).toBe('2036-09-30');
  });

  it('validates government number formats', () => {
    expect(GOV_NUMBER_FORMATS.tin.pattern.test('123-456-789-000')).toBe(true);
    expect(GOV_NUMBER_FORMATS.tin.pattern.test('123-456-789')).toBe(true);
    expect(GOV_NUMBER_FORMATS.tin.pattern.test('123456789')).toBe(false);
    expect(GOV_NUMBER_FORMATS.sss.pattern.test('34-1234567-8')).toBe(true);
    expect(GOV_NUMBER_FORMATS.philhealth.pattern.test('12-345678901-2')).toBe(true);
    expect(GOV_NUMBER_FORMATS.pagibig.pattern.test('1234-5678-9012')).toBe(true);
  });
});

describe('document access', () => {
  const ctx = (role: Parameters<typeof canOpenDocument>[1]['role'], over = {}) => ({
    role,
    isSelf: false,
    isDirectManager: false,
    ...over,
  });

  it('lets only HR open restricted and health records', () => {
    for (const access of ['RESTRICTED', 'HEALTH'] as const) {
      expect(canOpenDocument(access, ctx('HR_ADMIN'))).toBe(true);
      expect(canOpenDocument(access, ctx('SYSTEM_ADMIN'))).toBe(false);
      expect(canOpenDocument(access, ctx('PAYROLL_ADMIN'))).toBe(false);
      expect(canOpenDocument(access, ctx('MANAGER', { isDirectManager: true }))).toBe(false);
      expect(canOpenDocument(access, ctx('EMPLOYEE', { isSelf: true }))).toBe(false);
    }
  });

  it('shows appraisals to the employee, their direct manager and HR only', () => {
    expect(canOpenDocument('PERFORMANCE', ctx('EMPLOYEE', { isSelf: true }))).toBe(true);
    expect(canOpenDocument('PERFORMANCE', ctx('MANAGER', { isDirectManager: true }))).toBe(true);
    expect(canOpenDocument('PERFORMANCE', ctx('MANAGER'))).toBe(false);
    expect(canOpenDocument('PERFORMANCE', ctx('PAYROLL_ADMIN'))).toBe(false);
  });

  it('gives payroll the government and payroll papers, not the rest', () => {
    expect(canOpenDocument('PAYROLL', ctx('PAYROLL_ADMIN'))).toBe(true);
    expect(canOpenDocument('GENERAL', ctx('PAYROLL_ADMIN'))).toBe(false);
    expect(canManageDocument('PAYROLL', 'PAYROLL_ADMIN')).toBe(true);
    expect(canManageDocument('GENERAL', 'PAYROLL_ADMIN')).toBe(false);
    expect(canManageDocument('RESTRICTED', 'HR_ADMIN')).toBe(true);
    expect(canManageDocument('GENERAL', 'SYSTEM_ADMIN')).toBe(false);
  });

  it('lets employees open their own general records but not someone else’s', () => {
    expect(canOpenDocument('GENERAL', ctx('EMPLOYEE', { isSelf: true }))).toBe(true);
    expect(canOpenDocument('GENERAL', ctx('EMPLOYEE'))).toBe(false);
    expect(canOpenDocument('GENERAL', ctx('MANAGER', { isDirectManager: true }))).toBe(false);
  });
});
