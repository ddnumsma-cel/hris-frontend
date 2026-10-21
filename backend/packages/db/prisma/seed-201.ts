/**
 * Synthetic 201 file data: personal data sheets, dependents, employment history and documents.
 * Uses its own random generator so the rest of the seed (and its tests) stay unchanged.
 * Documents point to small sample PDFs ("SAMPLE — synthetic document") written to the document store.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  addDays,
  addMonths,
  type DateKey,
  dateKeyToUtcDate,
  DOCUMENT_CATALOG,
  type DocumentType,
  suggestedExpiry,
} from '@msma/shared';
import { FEMALE_NAMES, MALE_NAMES } from './seed-data';

export interface Seed201Employee {
  id: string;
  key?: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  position: string;
  siteName: string;
  status: string;
  hireDate: DateKey;
  dailyRate: string;
}

// ---------- deterministic randomness (independent of the main seed) ----------
let state = 201_2026;
function rand(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const chance = (p: number) => rand() < p;
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('');

const BARANGAYS = [
  ['Lahug', 'Cebu City'],
  ['Mabolo', 'Cebu City'],
  ['Talamban', 'Cebu City'],
  ['Guadalupe', 'Cebu City'],
  ['Banilad', 'Cebu City'],
  ['Subangdaku', 'Mandaue City'],
  ['Bakilid', 'Mandaue City'],
  ['Tipolo', 'Mandaue City'],
  ['Pusok', 'Lapu-Lapu City'],
  ['Gun-ob', 'Lapu-Lapu City'],
  ['Basak', 'Lapu-Lapu City'],
] as const;

// ---------- sample PDFs ----------

/** A one-page PDF with a few lines of text (valid xref offsets, no dependencies). */
function samplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '-');
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 60 ${760 - i * 26} Td (${esc(l)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function writeSampleFiles(storageDir: string) {
  const dir = join(storageDir, 'seed');
  mkdirSync(dir, { recursive: true });
  const files = new Map<DocumentType, { key: string; size: number; sha256: string }>();
  for (const def of DOCUMENT_CATALOG) {
    if (def.handling === 'FIELD') continue;
    const pdf = samplePdf([
      'SAMPLE - synthetic document',
      'MSMA HRIS demo. Not a real record.',
      def.label,
      'Replace with the scanned original when using real data.',
    ]);
    const key = `seed/${def.code}.pdf`;
    writeFileSync(join(storageDir, key), pdf);
    files.set(def.code, {
      key,
      size: pdf.length,
      sha256: createHash('sha256').update(pdf).digest('hex'),
    });
  }
  return files;
}

// ---------- main ----------

export async function seed201(
  prisma: PrismaClient,
  opts: { employees: Seed201Employee[]; hrUserId: string; payrollUserId: string; today: DateKey },
) {
  const { employees, hrUserId, payrollUserId, today } = opts;
  const storageDir = resolve(
    process.env.DOCUMENT_STORAGE_DIR ?? resolve(__dirname, '../../../storage/documents'),
  );
  const files = writeSampleFiles(storageDir);

  const people: Prisma.EmployeeUpdateArgs[] = [];
  const dependents: Prisma.DependentCreateManyInput[] = [];
  const events: Prisma.EmploymentEventCreateManyInput[] = [];
  const docs: Prisma.EmployeeDocumentCreateManyInput[] = [];

  for (const e of employees) {
    const isJose = e.key === 'jose'; // the mobile demo employee
    const complete = e.key === 'princess' || e.key === 'liza'; // HR and payroll demo users: complete files
    const miss = (p: number) => !complete && chance(p);

    // Personal data sheet
    const civilStatus = chance(0.42) ? 'MARRIED' : chance(0.06) ? 'WIDOWED' : 'SINGLE';
    const [brgy, city] = pick(BARANGAYS);
    const hasEmergency = complete || !chance(0.07);
    const licensed = /Accountant|Finance Manager/.test(e.position);
    const regularizationDate = e.status === 'REGULAR' ? addMonths(e.hireDate, 6) : null;
    people.push({
      where: { id: e.id },
      data: {
        civilStatus,
        address: `${int(1, 250)} ${pick(['Rizal', 'Mabini', 'Osmeña', 'Gorordo', 'Juan Luna', 'P. Burgos'])} St., Brgy. ${brgy}, ${city}, Cebu`,
        personalEmail:
          `${e.firstName}.${e.lastName}${int(1, 99)}`.toLowerCase().replace(/[^a-z0-9.]/g, '') +
          '@example.com',
        emergencyName: hasEmergency
          ? `${pick(e.gender === 'M' ? FEMALE_NAMES : MALE_NAMES)} ${e.lastName}`
          : null,
        emergencyRelationship: hasEmergency
          ? civilStatus === 'MARRIED'
            ? 'Spouse'
            : pick(['Mother', 'Father', 'Sister', 'Brother'])
          : null,
        emergencyPhone: hasEmergency ? `09${int(15, 99)} ${digits(3)} ${digits(4)}` : null,
        licenseType: licensed ? 'PRC (CPA)' : null,
        regularizationDate: regularizationDate ? dateKeyToUtcDate(regularizationDate) : null,
        biometricEnrolledAt: dateKeyToUtcDate(addDays(e.hireDate, 1)),
      },
    });
    const children = civilStatus === 'MARRIED' ? int(0, 3) : 0;
    const childNames: string[] = [];
    if (civilStatus === 'MARRIED')
      dependents.push({
        employeeId: e.id,
        name: `${pick(e.gender === 'M' ? FEMALE_NAMES : MALE_NAMES)} ${e.lastName}`,
        relationship: 'SPOUSE',
        birthDate: dateKeyToUtcDate(`${int(1972, 2000)}-0${int(1, 9)}-1${int(0, 9)}`),
      });
    for (let c = 0; c < children; c++) {
      const name = `${pick(chance(0.5) ? FEMALE_NAMES : MALE_NAMES)} ${e.lastName}`;
      childNames.push(name);
      dependents.push({
        employeeId: e.id,
        name,
        relationship: 'CHILD',
        birthDate: dateKeyToUtcDate(`${int(2008, 2024)}-0${int(1, 9)}-2${int(0, 8)}`),
      });
    }

    // Employment history (effective-dated)
    const years = Math.max(0, Number(today.slice(0, 4)) - Number(e.hireDate.slice(0, 4)));
    const raises = Math.min(3, Math.floor(years / 2));
    const current = Number(e.dailyRate);
    const startRate = current / Math.pow(1.06, raises);
    events.push({
      employeeId: e.id,
      type: 'HIRED',
      effectiveDate: dateKeyToUtcDate(e.hireDate),
      positionTitle: e.position,
      siteName: e.siteName,
      dailyRate: new Prisma.Decimal((Math.round(startRate / 5) * 5).toFixed(2)),
      remarks: e.status === 'PROBATIONARY' ? '6-month probation' : null,
    });
    if (regularizationDate && regularizationDate <= today)
      events.push({
        employeeId: e.id,
        type: 'REGULARIZED',
        effectiveDate: dateKeyToUtcDate(regularizationDate),
        positionTitle: e.position,
        siteName: e.siteName,
        dailyRate: null,
        remarks: 'Passed probation',
      });
    for (let r = 1; r <= raises; r++) {
      const eff = `${Number(today.slice(0, 4)) - (raises - r) * 2 - 1}-01-01`;
      if (eff <= e.hireDate) continue;
      events.push({
        employeeId: e.id,
        type: 'SALARY_ADJUSTED',
        effectiveDate: dateKeyToUtcDate(eff),
        positionTitle: e.position,
        siteName: e.siteName,
        dailyRate: new Prisma.Decimal(
          r === raises
            ? current.toFixed(2)
            : (Math.round((startRate * Math.pow(1.06, r)) / 5) * 5).toFixed(2),
        ),
        remarks: 'Annual merit increase',
      });
    }

    // Documents
    const add = (
      type: DocumentType,
      issuedOn: DateKey,
      extra: { expiresOn?: DateKey | null; referenceNo?: string; notes?: string } = {},
    ) => {
      const file = files.get(type)!;
      const def = DOCUMENT_CATALOG.find((d) => d.code === type)!;
      const expiresOn =
        extra.expiresOn !== undefined
          ? extra.expiresOn
          : def.tracksExpiry
            ? suggestedExpiry(type, issuedOn)
            : null;
      docs.push({
        id: randomUUID(),
        employeeId: e.id,
        type,
        fileName: `${type.toLowerCase().replace(/_/g, '-')}-${e.lastName.toLowerCase().replace(/[^a-z]/g, '')}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        sha256: file.sha256,
        storageKey: file.key,
        issuedOn: dateKeyToUtcDate(issuedOn),
        expiresOn: expiresOn ? dateKeyToUtcDate(expiresOn) : null,
        referenceNo: extra.referenceNo ?? null,
        notes: extra.notes ?? null,
        uploadedById: def.access === 'PAYROLL' ? payrollUserId : hrUserId,
        uploadedAt: new Date(
          `${issuedOn > e.hireDate ? issuedOn : e.hireDate}T02:${String(int(10, 59))}:00Z`,
        ),
      });
    };
    const before = (days: number) => addDays(e.hireDate, -days);

    if (!miss(0.03)) add('RESUME', before(int(20, 60)));
    if (!miss(0.06)) add('BIRTH_CERTIFICATE', before(int(5, 30)));
    if (civilStatus === 'MARRIED' && !miss(0.15)) add('MARRIAGE_CERTIFICATE', before(int(5, 30)));
    for (const child of childNames)
      if (!miss(0.2)) add('CHILD_BIRTH_CERTIFICATE', before(int(5, 30)), { referenceNo: child });
    if (!miss(0.04)) {
      const idIssued = addDays(today, -int(200, 1500));
      add('GOVERNMENT_ID', idIssued, {
        expiresOn: isJose ? addDays(today, 40) : addDays(idIssued, int(900, 3650)),
        referenceNo: `${pick(['UMID', "Driver's license", 'Passport', 'PhilSys ID'])} ${digits(4)}-${digits(4)}`,
      });
    }
    if (!miss(0.05)) add('DIPLOMA_TOR', before(int(200, 2000)));
    if (licensed && !miss(0.1)) {
      const issued = addDays(today, -int(300, 1000));
      add('PROFESSIONAL_LICENSE', issued, {
        expiresOn: chance(0.3) ? addDays(today, int(5, 28)) : addMonths(issued, 36),
        referenceNo: `PRC ${digits(7)}`,
      });
    }
    if (chance(0.6)) add('PREVIOUS_COE', before(int(10, 90)));
    // Clearances are renewed yearly: issue dates spread over the last 13 months, so some are expiring or expired.
    if (!miss(0.04))
      add(
        'NBI_CLEARANCE',
        isJose
          ? addDays(addMonths(today, -12), 19)
          : addDays(today, -int(10, complete ? 300 : 400)),
      );
    if (!miss(0.06)) add('POLICE_CLEARANCE', addDays(today, -int(5, complete ? 150 : 200)));
    if (!isJose && !miss(0.05))
      add('MEDICAL_RESULTS', before(int(3, 20)), { notes: 'Fit to work' });

    if (!miss(0.02)) add('TIN_BIR_1902', before(int(1, 10)));
    if (!miss(0.03)) add('SSS_E1', before(int(1, 10)));
    if (!miss(0.04)) add('PHILHEALTH_PMRF', before(int(1, 10)));
    if (!miss(0.04)) add('PAGIBIG_MDF', before(int(1, 10)));

    if (!miss(0.02)) add('EMPLOYMENT_CONTRACT', e.hireDate);
    if (!miss(0.08)) add('JOB_DESCRIPTION', e.hireDate);
    if (!miss(0.05))
      add(
        'PROBATION_REGULARIZATION',
        regularizationDate && regularizationDate <= today ? regularizationDate : e.hireDate,
      );
    if (!miss(0.06)) add('HANDBOOK_ACKNOWLEDGMENT', addDays(e.hireDate, int(0, 5)));
    if (!miss(0.03)) add('DATA_PRIVACY_CONSENT', e.hireDate, { referenceNo: 'DPA consent v2' });
    // A few employees were enrolled on the time clocks before consent forms were collected.
    if (!miss(0.03)) add('BIOMETRIC_CONSENT', e.hireDate, { referenceNo: 'Biometric consent v1' });
    if (chance(0.3)) add('NDA', e.hireDate);

    if (e.status === 'REGULAR')
      for (let y = 0; y < Math.min(2, years); y++) {
        const on = `${Number(today.slice(0, 4)) - 1 - y}-12-15`;
        if (on > e.hireDate)
          add('PERFORMANCE_APPRAISAL', on, {
            notes: pick(['Meets expectations', 'Exceeds expectations', 'Meets expectations']),
          });
      }
    for (let t = 0, n = int(0, 3); t < n; t++)
      add('TRAINING_CERTIFICATE', addDays(today, -int(30, 900)), {
        referenceNo: pick([
          'Occupational Safety and Health (8 hours)',
          'Data Privacy Awareness',
          'Customer Service Excellence',
          'Excel for Payroll',
          'Fire Safety and Evacuation',
        ]),
      });
    if (chance(0.12))
      add('COMMENDATION', addDays(today, -int(30, 700)), { notes: 'Employee of the month' });
    if (chance(0.03))
      add('DISCIPLINARY_RECORD', addDays(today, -int(60, 500)), {
        referenceNo: `NTE-${today.slice(0, 4)}-${digits(3)}`,
        notes: 'Tardiness. Written warning issued.',
      });
    if (chance(0.2))
      add('LOAN_DOCUMENT', addDays(today, -int(30, 400)), {
        referenceNo: `${pick(['SSS salary loan', 'Pag-IBIG MPL', 'Company loan'])} ${digits(6)}`,
      });
  }

  for (const p of people) await prisma.employee.update(p);
  await prisma.dependent.createMany({ data: dependents });
  await prisma.employmentEvent.createMany({ data: events });
  await prisma.employeeDocument.createMany({ data: docs });
  console.log(`201 files: ${docs.length} sample documents in ${storageDir}`);
}
