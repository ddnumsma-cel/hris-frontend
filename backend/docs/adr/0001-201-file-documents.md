# ADR-0001: How the 201 file stores documents

**Status:** Accepted (sample) · **Date:** 28 Sep 2026 · **Deciders:** MSMA IT team, HR, the Firm (retention periods)

## Context

The 201 File Checklist (`docs/201-file-checklist.md`) asks for three storage patterns (fields, uploads, restricted
records), expiry tracking, consent before biometric enrollment, and retention rules per document type. HR, lawyers and
accountants must be able to see at a glance what is missing, and every view of a sensitive record must be logged
(Data Privacy Act).

## Decision

- **One catalog in code** (`packages/shared/src/records201.ts`): 38 document types with section, handling, access class,
  requirement (required / if applicable / optional / on separation / automatic), expiry and retention. API, web and
  mobile use the same catalog and the same `computeChecklist()` function, which is unit-tested.
- **Files outside the database**, behind a `DocumentStorage` interface: local disk now (`storage/documents`, gitignored),
  S3 on AWS. The database keeps metadata only (`EmployeeDocument`: type, dates, reference, uploader, SHA-256).
- **Access by class**, not per document: GENERAL, PAYROLL, PERFORMANCE, RESTRICTED, HEALTH (`canOpenDocument`).
  Documents a caller may not open are counted but their details (e.g. ID numbers) are not sent.
- **Every opening is audited** (`DOCUMENT_OPENED`), as are uploads, changes and removals.
- **No hard delete** from the app: removal archives the row with a reason; disposal after the retention period is a
  later, separate process.
- **Uploads are checked by content** (PDF/JPG/PNG magic bytes, 8 MB), stored under server-generated keys.

## Options considered

|                 | A. Catalog in code + file store (chosen) | B. Document types in a DB table, editable by HR | C. Files in PostgreSQL (bytea)         |
| --------------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Complexity      | Low                                      | Medium (admin UI, migrations of rules)          | Low                                    |
| Change the list | Code change + deploy                     | HR can change it                                | Code change                            |
| Backups / cost  | DB small; files in S3 are cheap          | Same as A                                       | DB grows with every scan; slow backups |
| Fits AWS        | Direct (S3)                              | Direct                                          | Poor                                   |

B is the likely next step once the Product Owner confirms the list in Sprint 0 and HR needs to add company-specific
types; the catalog's shape was chosen so it can move into a table without changing the API.

## Consequences

- Easier: one place to change rules; checklist status is consistent everywhere; S3 migration is one class.
- Harder: HR cannot add a document type without a release (see option B).
- Revisit: retention periods (SAMPLE values, `RETENTION_VERIFIED = false`), a clinic role for medical records, employee
  self-upload from the phone, and automated disposal.
