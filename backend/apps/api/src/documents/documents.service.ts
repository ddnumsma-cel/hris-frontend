import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeDocument as DocumentRow } from '@msma/db';
import {
  canManageDocument,
  canOpenDocument,
  type ChecklistDoc,
  computeChecklist,
  dateKeyToUtcDate,
  type DocumentType,
  documentType,
  type DocumentViews,
  type EmployeeDocument,
  type ExpiringDocument,
  type File201,
  manilaToday,
  MAX_UPLOAD_BYTES,
  type Record201Brief,
  type RecordsListQuery,
  type RecordsListResponse,
  type RecordsSummary,
  type RequirementOverrides,
  suggestedExpiry,
  type UpdateDocument,
  type UploadDocumentFields,
  utcDateToDateKey,
} from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.decorators';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  cleanFileName,
  DocumentStorage,
  EXTENSION,
  sha256,
  sniffMimeType,
} from './document-storage';

/** The file part of a multipart upload (multer, memory storage). */
export interface UploadedFileData {
  originalname: string;
  size: number;
  buffer: Buffer;
}

type Facts = Awaited<ReturnType<EmployeesService['checklistFacts']>>[number];
type DocMeta = Pick<
  DocumentRow,
  'id' | 'employeeId' | 'type' | 'issuedOn' | 'expiresOn' | 'uploadedAt' | 'reviewStatus'
>;

/** Only papers HR has checked count toward a complete 201 file; an employee's upload waits for review. */
const verified = <T extends { reviewStatus: string }>(docs: T[]) => docs.filter((d) => d.reviewStatus !== 'SUBMITTED');

/**
 * Papers an employee may upload themselves: the pre-employment papers on the website's 201 checklist. Everything HR or
 * Accounting makes or keeps (contracts, personnel actions, payroll and disciplinary records) is added by them. Who may
 * open each paper afterwards is unchanged (canOpenDocument).
 */
const SELF_SUBMITTABLE: ReadonlySet<DocumentType> = new Set<DocumentType>(['RESUME', 'BIRTH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'CHILD_BIRTH_CERTIFICATE', 'GOVERNMENT_ID', 'DIPLOMA_TOR', 'PROFESSIONAL_LICENSE', 'PREVIOUS_COE', 'NBI_CLEARANCE', 'POLICE_CLEARANCE', 'MEDICAL_RESULTS']);
export const selfSubmittable = (type: DocumentType) => SELF_SUBMITTABLE.has(type);

const toChecklistDoc = (d: DocMeta): ChecklistDoc => ({
  type: d.type,
  issuedOn: d.issuedOn ? utcDateToDateKey(d.issuedOn) : null,
  expiresOn: d.expiresOn ? utcDateToDateKey(d.expiresOn) : null,
  uploadedAt: d.uploadedAt.toISOString(),
});

/** Files that make up the 201 file: checklist status, uploads, access control and the view log. */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    private readonly storage: DocumentStorage,
  ) {}

  // ---------- access ----------

  private async accessContext(user: AuthUser, employeeId: string) {
    const isSelf = user.employeeId === employeeId;
    const isDirectManager =
      user.role === 'MANAGER' &&
      !!user.employeeId &&
      (await this.employees.managerIdOf(employeeId)) === user.employeeId;
    return { role: user.role, isSelf, isDirectManager };
  }

  /** Who may see an employee's checklist at all (not necessarily open every file). */
  async assertCanSeeFile(user: AuthUser, employeeId: string) {
    const ctx = await this.accessContext(user, employeeId);
    const ok =
      ['HR_ADMIN', 'SYSTEM_ADMIN', 'PAYROLL_ADMIN'].includes(user.role) ||
      ctx.isSelf ||
      ctx.isDirectManager;
    if (!ok) throw new ForbiddenException('You can only see your own 201 file or your team’s');
    return ctx;
  }

  // ---------- reads ----------

  private currentDocs(employeeIds: string[]) {
    return this.prisma.employeeDocument.findMany({
      where: { employeeId: { in: employeeIds }, archivedAt: null },
      include: { uploadedBy: { select: { displayName: true } } },
      orderBy: [{ issuedOn: 'desc' }, { uploadedAt: 'desc' }],
    });
  }

  /** The full 201 checklist for one employee, filtered to what the caller may see. */
  async file201(user: AuthUser, employeeId: string, today = manilaToday()): Promise<File201> {
    const ctx = await this.assertCanSeeFile(user, employeeId);
    const [facts] = await this.employees.checklistFacts({ ids: [employeeId] });
    if (!facts) throw new NotFoundException('Employee not found');
    const docs = await this.currentDocs([employeeId]);
    const req = (await this.requirements([employeeId])).get(employeeId);
    const { items, summary } = computeChecklist(facts.facts, verified(docs).map(toChecklistDoc), today, req?.overrides);
    const reviewerIds = [...new Set(docs.map((d) => d.reviewedById).filter((x): x is string => !!x))];
    const reviewers = new Map((await this.prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));

    return {
      employee: {
        id: facts.id,
        employeeNo: facts.employeeNo,
        fullName: facts.fullName,
        separationDate: facts.facts.separationDate,
      },
      summary,
      items: items.map((item) => {
        const def = documentType(item.type);
        const canOpen = canOpenDocument(def.access, ctx);
        const uploadable = def.handling !== 'FIELD';
        return {
          ...item,
          canManage: uploadable && canManageDocument(def.access, user.role),
          note: req?.notes.get(item.type) ?? null,
          override: req?.overrides[item.type] ?? null,
          // Metadata of documents the caller may not open (ID numbers, case references) stays hidden. Exception: an
          // employee sees their own upload while it waits for HR (not openable, no reference number or notes), so it
          // doesn't look lost; once verified it is hidden again like every restricted paper.
          documents: canOpen || ctx.isSelf
            ? docs
                .filter((d) => d.type === item.type && (canOpen || d.reviewStatus === 'SUBMITTED'))
                .map((d): EmployeeDocument => ({
                  id: d.id,
                  type: d.type,
                  fileName: d.fileName,
                  mimeType: d.mimeType,
                  sizeBytes: d.sizeBytes,
                  issuedOn: d.issuedOn ? utcDateToDateKey(d.issuedOn) : null,
                  expiresOn: d.expiresOn ? utcDateToDateKey(d.expiresOn) : null,
                  referenceNo: canOpen ? d.referenceNo : null,
                  notes: canOpen ? d.notes : null,
                  uploadedAt: d.uploadedAt.toISOString(),
                  uploadedBy: d.uploadedBy?.displayName ?? null,
                  canOpen,
                  reviewStatus: d.reviewStatus === 'SUBMITTED' ? 'SUBMITTED' : 'VERIFIED',
                  reviewedBy: d.reviewedById ? (reviewers.get(d.reviewedById) ?? null) : null,
                  reviewedAt: d.reviewedAt?.toISOString() ?? null,
                }))
            : [],
        };
      }),
      biometric: {
        consentOnFile: await this.hasCurrent(employeeId, 'BIOMETRIC_CONSENT'),
        enrolledAt: facts.biometricEnrolledAt?.toISOString() ?? null,
      },
      retentionVerified: false,
    };
  }

  async hasCurrent(employeeId: string, type: DocumentType): Promise<boolean> {
    return (
      (await this.prisma.employeeDocument.count({
        where: { employeeId, type, archivedAt: null },
      })) > 0
    );
  }

  /** HR's per-person decisions (not applicable / required) and return notes, by employee. */
  private async requirements(employeeIds: string[]) {
    const rows = await this.prisma.documentRequirement.findMany({ where: { employeeId: { in: employeeIds } } });
    const out = new Map<string, { overrides: RequirementOverrides; notes: Map<DocumentType, string> }>();
    for (const r of rows) {
      const e = out.get(r.employeeId) ?? { overrides: {}, notes: new Map<DocumentType, string>() };
      if (r.state === 'NOT_APPLICABLE' || r.state === 'REQUIRED') e.overrides[r.type] = r.state;
      if (r.returnNote) e.notes.set(r.type, r.returnNote);
      out.set(r.employeeId, e);
    }
    return out;
  }

  /** Checklist summaries for many employees (one query for all their documents). */
  private async summaries(facts: Facts[], today: string) {
    const docs = await this.prisma.employeeDocument.findMany({
      where: { employeeId: { in: facts.map((f) => f.id) }, archivedAt: null },
      select: {
        id: true,
        employeeId: true,
        type: true,
        issuedOn: true,
        expiresOn: true,
        uploadedAt: true,
        reviewStatus: true,
      },
    });
    const reqs = await this.requirements(facts.map((f) => f.id));
    const byEmployee = new Map<string, DocMeta[]>();
    for (const d of docs)
      byEmployee.set(d.employeeId, [...(byEmployee.get(d.employeeId) ?? []), d]);
    return facts.map((f) => {
      const own = byEmployee.get(f.id) ?? [];
      return { facts: f, docs: own, ...computeChecklist(f.facts, verified(own).map(toChecklistDoc), today, reqs.get(f.id)?.overrides) };
    });
  }

  /** Short 201 status per employee for the employee list. */
  async briefs(employeeIds: string[], today = manilaToday()): Promise<Map<string, Record201Brief>> {
    if (!employeeIds.length) return new Map();
    const facts = await this.employees.checklistFacts({ ids: employeeIds });
    const rows = await this.summaries(facts, today);
    return new Map(
      rows.map((r) => [
        r.facts.id,
        {
          percent: r.summary.percent,
          missing: r.summary.missing,
          expiring: r.summary.expiring,
          expired: r.summary.expired,
        },
      ]),
    );
  }

  /** The "201 files" page: every employee with what is missing or expiring. */
  async list(query: RecordsListQuery, today = manilaToday()): Promise<RecordsListResponse> {
    const facts = await this.employees.checklistFacts({ siteId: query.siteId, q: query.q });
    const rows = (await this.summaries(facts, today)).filter((r) => {
      if (
        query.missingType &&
        !r.items.some((i) => i.type === query.missingType && i.status === 'MISSING')
      )
        return false;
      switch (query.filter) {
        case 'INCOMPLETE':
          return r.summary.missing > 0;
        case 'EXPIRING':
          return r.summary.expiring > 0;
        case 'EXPIRED':
          return r.summary.expired > 0;
        case 'COMPLETE':
          return r.summary.missing === 0 && r.summary.expired === 0;
        default:
          return true;
      }
    });
    // Most urgent first: expired, then most missing, then name.
    rows.sort(
      (a, b) =>
        b.summary.expired - a.summary.expired ||
        a.summary.percent - b.summary.percent ||
        a.facts.fullName.localeCompare(b.facts.fullName),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize).map((r) => {
        const expiring = r.items
          .filter(
            (i) =>
              i.expiresOn &&
              (i.status === 'EXPIRING' || i.status === 'EXPIRED' || i.status === 'ON_FILE'),
          )
          .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
        return {
          employeeId: r.facts.id,
          employeeNo: r.facts.employeeNo,
          fullName: r.facts.fullName,
          siteName: r.facts.siteName,
          position: r.facts.position,
          summary: r.summary,
          missingTypes: r.items.filter((i) => i.status === 'MISSING').map((i) => i.type),
          nextExpiry: expiring[0]
            ? { type: expiring[0].type, expiresOn: expiring[0].expiresOn! }
            : null,
        };
      }),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Dashboard numbers for HR: complete files, renewals due, most-missing documents. */
  async summary(siteId: string | undefined, today = manilaToday()): Promise<RecordsSummary> {
    const facts = await this.employees.checklistFacts({ siteId });
    const rows = await this.summaries(facts, today);
    const renewals: ExpiringDocument[] = [];
    for (const r of rows) {
      for (const item of r.items) {
        if (item.status !== 'EXPIRING' && item.status !== 'EXPIRED') continue;
        const doc = r.docs
          .filter((d) => d.type === item.type && d.expiresOn)
          .find((d) => utcDateToDateKey(d.expiresOn!) === item.expiresOn);
        renewals.push({
          documentId: doc?.id ?? '',
          employeeId: r.facts.id,
          employeeName: r.facts.fullName,
          siteName: r.facts.siteName,
          type: item.type,
          expiresOn: item.expiresOn!,
          status: item.status,
        });
      }
    }
    renewals.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));

    const missingCounts = new Map<DocumentType, number>();
    for (const r of rows)
      for (const i of r.items)
        if (i.status === 'MISSING') missingCounts.set(i.type, (missingCounts.get(i.type) ?? 0) + 1);

    const sites = new Map<string, { employees: number; complete: number }>();
    const isComplete = (r: (typeof rows)[number]) =>
      r.summary.missing === 0 && r.summary.expired === 0;
    for (const r of rows) {
      const s = sites.get(r.facts.siteName) ?? { employees: 0, complete: 0 };
      s.employees += 1;
      if (isComplete(r)) s.complete += 1;
      sites.set(r.facts.siteName, s);
    }

    return {
      employees: rows.length,
      complete: rows.filter(isComplete).length,
      incomplete: rows.filter((r) => r.summary.missing > 0).length,
      withExpired: rows.filter((r) => r.summary.expired > 0).length,
      expiringSoon: renewals.filter((r) => r.status === 'EXPIRING').length,
      renewals: renewals.slice(0, 300),
      topMissing: [...missingCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([type, count]) => ({ type, count })),
      bySite: [...sites.entries()].map(([siteName, s]) => ({ siteName, ...s })),
      withoutBiometricConsent: rows.filter(
        (r) => !r.docs.some((d) => d.type === 'BIOMETRIC_CONSENT'),
      ).length,
    };
  }

  // ---------- writes ----------

  private checkDates(issuedOn: string | null | undefined, expiresOn: string | null | undefined) {
    if (issuedOn && issuedOn > manilaToday())
      throw new BadRequestException('The issue date cannot be in the future');
    if (issuedOn && expiresOn && expiresOn < issuedOn)
      throw new BadRequestException('The expiry date must be after the issue date');
  }

  async upload(
    user: AuthUser,
    employeeId: string,
    fields: UploadDocumentFields,
    file: UploadedFileData | undefined,
  ): Promise<EmployeeDocument> {
    if (!canManageDocument(documentType(fields.type).access, user.role))
      throw new ForbiddenException('Your role cannot add this kind of document');
    // HR uploads from the originals, so the paper is verified as it is added.
    return this.save(user, employeeId, fields, file, false);
  }

  /** An employee adds one of their own papers; HR checks it against the original (verify or return). */
  async submitOwn(user: AuthUser, fields: UploadDocumentFields, file: UploadedFileData | undefined): Promise<EmployeeDocument> {
    if (!user.employeeId) throw new ForbiddenException('This account is not linked to an employee record');
    if (!selfSubmittable(fields.type))
      throw new ForbiddenException(`HR adds your ${documentType(fields.type).label} themselves`);
    return this.save(user, user.employeeId, fields, file, true);
  }

  private async save(
    user: AuthUser,
    employeeId: string,
    fields: UploadDocumentFields,
    file: UploadedFileData | undefined,
    submitted: boolean,
  ): Promise<EmployeeDocument> {
    const def = documentType(fields.type);
    if (def.handling === 'FIELD')
      throw new BadRequestException(`${def.label} is filled in as data, not uploaded`);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to upload');
    if (file.size > MAX_UPLOAD_BYTES)
      throw new BadRequestException(
        `The file is too large (limit ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`,
      );
    const mimeType = sniffMimeType(file.buffer);
    if (!mimeType) throw new BadRequestException('Only PDF, JPG or PNG files can be uploaded');
    await this.employees.managerIdOf(employeeId); // 404 if the employee doesn't exist

    const issuedOn = fields.issuedOn ?? null;
    const expiresOn =
      fields.expiresOn ?? (def.tracksExpiry ? suggestedExpiry(def.code, issuedOn) : null);
    this.checkDates(issuedOn, expiresOn);

    const id = randomUUID();
    const storageKey = `${employeeId}/${id}.${EXTENSION[mimeType]}`;
    await this.storage.put(storageKey, file.buffer);
    const doc = await this.prisma.$transaction(async (tx) => {
      const row = await tx.employeeDocument.create({
        data: {
          id,
          employeeId,
          type: def.code,
          fileName: cleanFileName(file.originalname, EXTENSION[mimeType]),
          mimeType,
          sizeBytes: file.size,
          sha256: sha256(file.buffer),
          storageKey,
          issuedOn: issuedOn ? dateKeyToUtcDate(issuedOn) : null,
          expiresOn: expiresOn ? dateKeyToUtcDate(expiresOn) : null,
          referenceNo: fields.referenceNo ?? null,
          notes: fields.notes ?? null,
          uploadedById: user.userId,
          reviewStatus: submitted ? 'SUBMITTED' : 'VERIFIED',
          ...(submitted ? {} : { reviewedById: user.userId, reviewedAt: new Date() }),
        },
      });
      // A new upload answers any earlier return note.
      await tx.documentRequirement.updateMany({ where: { employeeId, type: def.code }, data: { returnNote: null } });
      await this.audit.log(
        {
          actorId: user.userId,
          action: submitted ? 'DOCUMENT_SUBMITTED' : 'DOCUMENT_UPLOADED',
          entity: 'EmployeeDocument',
          entityId: row.id,
          after: { employeeId, type: row.type, fileName: row.fileName, issuedOn, expiresOn },
        },
        tx,
      );
      return row;
    });
    return { ...this.toDto(doc, user.displayName, true), reviewStatus: submitted ? 'SUBMITTED' : 'VERIFIED' };
  }

  // ---------- review ----------

  private async reviewable(user: AuthUser, id: string) {
    const doc = await this.findCurrent(id);
    if (!canManageDocument(documentType(doc.type).access, user.role)) throw new ForbiddenException('Your role cannot review this document');
    if (doc.employeeId === user.employeeId) throw new ForbiddenException("You can't review your own papers. Ask a colleague to.");
    if (doc.reviewStatus !== 'SUBMITTED') throw new BadRequestException('Only a paper waiting for review can be verified or returned');
    return doc;
  }

  /** The employee takes back their own upload before HR reviews it (kept in the archive). */
  async withdrawOwn(user: AuthUser, id: string) {
    const doc = await this.findCurrent(id);
    if (doc.employeeId !== user.employeeId) throw new NotFoundException('Document not found');
    if (doc.reviewStatus !== 'SUBMITTED') throw new BadRequestException('HR has already checked this paper. Ask HR if it needs changing.');
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeDocument.update({ where: { id }, data: { archivedAt: new Date(), archivedReason: 'Withdrawn by the employee' } });
      await this.audit.log({ actorId: user.userId, action: 'DOCUMENT_WITHDRAWN', entity: 'EmployeeDocument', entityId: id, after: { employeeId: doc.employeeId, type: doc.type } }, tx);
    });
  }

  /** HR checked the upload against the original. */
  async verify(user: AuthUser, id: string) {
    const doc = await this.reviewable(user, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeeDocument.updateMany({ where: { id, reviewStatus: 'SUBMITTED', archivedAt: null }, data: { reviewStatus: 'VERIFIED', reviewedById: user.userId, reviewedAt: new Date() } });
      if (!count) throw new BadRequestException('Someone else just reviewed this paper');
      await this.audit.log({ actorId: user.userId, action: 'DOCUMENT_VERIFIED', entity: 'EmployeeDocument', entityId: id, after: { employeeId: doc.employeeId, type: doc.type } }, tx);
    });
    return { employeeId: doc.employeeId, label: documentType(doc.type).label };
  }

  /** HR sends the upload back with what to fix; the file is archived (kept), the paper is missing again. */
  async sendBack(user: AuthUser, id: string, note: string) {
    const doc = await this.reviewable(user, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeeDocument.updateMany({ where: { id, reviewStatus: 'SUBMITTED', archivedAt: null }, data: { archivedAt: new Date(), archivedReason: `Returned: ${note}`, reviewedById: user.userId, reviewedAt: new Date() } });
      if (!count) throw new BadRequestException('Someone else just reviewed this paper');
      await tx.documentRequirement.upsert({ where: { employeeId_type: { employeeId: doc.employeeId, type: doc.type } }, create: { employeeId: doc.employeeId, type: doc.type, returnNote: note, updatedById: user.userId }, update: { returnNote: note, updatedById: user.userId } });
      await this.audit.log({ actorId: user.userId, action: 'DOCUMENT_RETURNED', entity: 'EmployeeDocument', entityId: id, after: { employeeId: doc.employeeId, type: doc.type, note } }, tx);
    });
    return { employeeId: doc.employeeId, label: documentType(doc.type).label };
  }

  /** HR: a paper doesn't apply to this person, or is required although the usual rule says not (null: the usual rule). */
  async setRequirement(user: AuthUser, employeeId: string, type: DocumentType, state: 'NOT_APPLICABLE' | 'REQUIRED' | null) {
    const def = documentType(type);
    if (!canManageDocument(def.access, user.role)) throw new ForbiddenException('Your role cannot change this paper');
    if (employeeId === user.employeeId) throw new ForbiddenException("You can't change what your own 201 file needs. Ask a colleague to.");
    await this.employees.managerIdOf(employeeId); // 404 if the employee doesn't exist
    await this.prisma.$transaction(async (tx) => {
      await tx.documentRequirement.upsert({ where: { employeeId_type: { employeeId, type } }, create: { employeeId, type, state, updatedById: user.userId }, update: { state, updatedById: user.userId } });
      await this.audit.log({ actorId: user.userId, action: state === 'NOT_APPLICABLE' ? 'DOCUMENT_NOT_APPLICABLE' : state === 'REQUIRED' ? 'DOCUMENT_REQUIRED' : 'DOCUMENT_RULE_RESTORED', entity: 'Employee', entityId: employeeId, after: { type: def.label } }, tx);
    });
  }

  /** The 201 documents page: every current employee's checklist papers in one list (HR and the Super Admin). */
  async allPapers(today = manilaToday()) {
    const facts = await this.employees.checklistFacts({});
    const [docs, reqs] = await Promise.all([this.currentDocs(facts.map((f) => f.id)), this.requirements(facts.map((f) => f.id))]);
    const reviewerIds = [...new Set(docs.map((d) => d.reviewedById).filter((x): x is string => !!x))];
    const reviewers = new Map((await this.prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
    return facts.map((f) => {
      const own = docs.filter((d) => d.employeeId === f.id);
      const req = reqs.get(f.id);
      const { items } = computeChecklist(f.facts, verified(own).map(toChecklistDoc), today, req?.overrides);
      return {
        employeeNo: f.employeeNo,
        items: items.map((item) => ({
          type: item.type,
          status: item.status,
          required: item.required,
          expiresOn: item.expiresOn,
          note: req?.notes.get(item.type) ?? null,
          documents: own
            .filter((d) => d.type === item.type)
            .map((d) => ({ id: d.id, fileName: d.fileName, uploadedAt: d.uploadedAt.toISOString(), uploadedBy: d.uploadedBy?.displayName ?? null, expiresOn: d.expiresOn ? utcDateToDateKey(d.expiresOn) : null, referenceNo: d.referenceNo, notes: d.notes, reviewStatus: d.reviewStatus === 'SUBMITTED' ? 'SUBMITTED' : 'VERIFIED', reviewedBy: d.reviewedById ? (reviewers.get(d.reviewedById) ?? null) : null, reviewedAt: d.reviewedAt?.toISOString() ?? null })),
        })),
      };
    });
  }

  private toDto(d: DocumentRow, uploadedBy: string | null, canOpen: boolean): EmployeeDocument {
    return {
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      issuedOn: d.issuedOn ? utcDateToDateKey(d.issuedOn) : null,
      expiresOn: d.expiresOn ? utcDateToDateKey(d.expiresOn) : null,
      referenceNo: d.referenceNo,
      notes: d.notes,
      uploadedAt: d.uploadedAt.toISOString(),
      uploadedBy,
      canOpen,
    };
  }

  private async findCurrent(id: string): Promise<DocumentRow> {
    const doc = await this.prisma.employeeDocument.findUnique({ where: { id } });
    if (!doc || doc.archivedAt) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(user: AuthUser, id: string, patch: UpdateDocument): Promise<EmployeeDocument> {
    const doc = await this.findCurrent(id);
    if (!canManageDocument(documentType(doc.type).access, user.role))
      throw new ForbiddenException('Your role cannot change this document');
    const issuedOn =
      patch.issuedOn !== undefined
        ? patch.issuedOn
        : doc.issuedOn && utcDateToDateKey(doc.issuedOn);
    const expiresOn =
      patch.expiresOn !== undefined
        ? patch.expiresOn
        : doc.expiresOn && utcDateToDateKey(doc.expiresOn);
    this.checkDates(issuedOn, expiresOn);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.employeeDocument.update({
        where: { id },
        data: {
          issuedOn: issuedOn ? dateKeyToUtcDate(issuedOn) : null,
          expiresOn: expiresOn ? dateKeyToUtcDate(expiresOn) : null,
          ...(patch.referenceNo !== undefined ? { referenceNo: patch.referenceNo } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        },
        include: { uploadedBy: { select: { displayName: true } } },
      });
      await this.audit.log(
        {
          actorId: user.userId,
          action: 'DOCUMENT_UPDATED',
          entity: 'EmployeeDocument',
          entityId: id,
          before: {
            issuedOn: doc.issuedOn,
            expiresOn: doc.expiresOn,
            referenceNo: doc.referenceNo,
            notes: doc.notes,
          },
          after: patch,
        },
        tx,
      );
      return row;
    });
    return this.toDto(updated, updated.uploadedBy?.displayName ?? null, true);
  }

  /** Remove a document from the 201 file. The file is kept (archived) for the retention period. */
  async archive(user: AuthUser, id: string, reason: string): Promise<void> {
    const doc = await this.findCurrent(id);
    if (!canManageDocument(documentType(doc.type).access, user.role))
      throw new ForbiddenException('Your role cannot remove this document');
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeDocument.update({
        where: { id },
        data: { archivedAt: new Date(), archivedReason: reason },
      });
      await this.audit.log(
        {
          actorId: user.userId,
          action: 'DOCUMENT_ARCHIVED',
          entity: 'EmployeeDocument',
          entityId: id,
          after: { employeeId: doc.employeeId, type: doc.type, reason },
        },
        tx,
      );
    });
  }

  /** Open a file. Every opening is written to the audit log (who, when, which document). */
  async open(user: AuthUser, id: string) {
    const doc = await this.findCurrent(id);
    const def = documentType(doc.type);
    const ctx = await this.accessContext(user, doc.employeeId);
    if (!canOpenDocument(def.access, ctx))
      throw new ForbiddenException(
        def.access === 'RESTRICTED' || def.access === 'HEALTH'
          ? 'This is a restricted record. Only HR can open it; ask HR for a copy.'
          : 'You are not allowed to open this document',
      );
    const data = await this.storage.get(doc.storageKey);
    await this.audit.log({
      actorId: user.userId,
      action: 'DOCUMENT_OPENED',
      entity: 'EmployeeDocument',
      entityId: id,
      after: { employeeId: doc.employeeId, type: doc.type, access: def.access },
    });
    return { data, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  /** Who uploaded, changed, opened or removed a document (HR only). */
  async views(id: string): Promise<DocumentViews> {
    const rows = await this.audit.forEntity('EmployeeDocument', id);
    return {
      items: rows.map((r) => ({
        at: r.at.toISOString(),
        by: r.actor?.displayName ?? 'System',
        role: r.actor?.role ?? '',
        action: r.action,
      })),
    };
  }
}
