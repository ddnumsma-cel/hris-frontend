# 201 File Checklist: data dictionary

Source: **"MSMA HRIS 201 File Checklist": input to the Core HR data dictionary (Sprint 0), MSMA-Solutions IT Team.**
The Product Owner confirms the final list and required fields in Sprint 0. This file is the project's copy of that
checklist and shows how the HRIS holds each item. The code that enforces it is `packages/shared/src/records201.ts`
(catalog, access rules, checklist status) and `apps/api/src/documents/` (uploads, opening files, audit log).

The 201 file is the employee's personnel record, kept from application to separation. No single law lists its contents;
they come from DOLE, BIR, SSS, PhilHealth, Pag-IBIG and Data Privacy Act requirements plus company policy.

## How the HRIS holds an item

| Checklist tag      | Meaning                                                         | In the HRIS                                                                                            |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Field**          | Structured data the system computes or reports with             | Columns on `Employee` / `GovId` / `Dependent` / `EmploymentEvent`, edited on the **Personal info** tab |
| **Upload**         | Scanned document with type, date and, where relevant, expiry    | `EmployeeDocument` row + file in the document store                                                    |
| **Field + Upload** | The number or value as a field, plus the source document        | Both of the above                                                                                      |
| **Restricted**     | Sensitive personal information: role-based access and audit log | Same document store; only HR can open; every opening is written to `AuditLog` (`DOCUMENT_OPENED`)      |

## The checklist

\* Retention periods are **SAMPLE values** (`RETENTION_VERIFIED = false`): 3 years for employment records (Labor Code
minimum per the checklist), 4 years for contracts, consents, disciplinary and separation papers (dispute periods), and
10 years for payroll and tax papers (BIR audit periods, conservative). **Confirm every period with the Firm before
go-live.**

### 1. Pre-employment and identity

| Document / data                                    | Checklist handling | In the HRIS (code)                                                          | Needed                                                  | Expiry                  | Who can open                   | Retention after separation* |
| -------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------- | ------------------------------ | --------------------------- |
| Application form or resume, with 2x2 photo         | Scan               | `RESUME`                                                                    | Required                                                | -                       | HR, System Admin, the employee | 3 years                     |
| Birth certificate (PSA)                            | Data + scan        | `BIRTH_CERTIFICATE`; fields: Birth date                                     | Required                                                | -                       | HR, System Admin, the employee | 3 years                     |
| Marriage certificate (PSA)                         | Data + scan        | `MARRIAGE_CERTIFICATE`; fields: Civil status                                | If applicable (civil status Married)                    | -                       | HR, System Admin, the employee | 3 years                     |
| Children's birth certificates (PSA)                | Data + scan        | `CHILD_BIRTH_CERTIFICATE`; fields: Dependents list; reference: Child's name | If applicable (a child is listed as dependent), several | -                       | HR, System Admin, the employee | 3 years                     |
| Valid government IDs                               | Restricted         | `GOVERNMENT_ID`; reference: ID type and number                              | Required, several                                       | Yes                     | HR only (every opening logged) | 3 years                     |
| Diploma and transcript of records                  | Scan               | `DIPLOMA_TOR`                                                               | Required                                                | -                       | HR, System Admin, the employee | 3 years                     |
| Professional license (e.g., PRC ID)                | Data + scan        | `PROFESSIONAL_LICENSE`; reference: License number                           | If applicable (a professional license type is set)      | Yes                     | HR, System Admin, the employee | 3 years                     |
| Certificates of employment from previous employers | Scan               | `PREVIOUS_COE`                                                              | Optional, several                                       | -                       | HR, System Admin, the employee | 3 years                     |
| NBI clearance                                      | Scan               | `NBI_CLEARANCE`                                                             | Required                                                | Yes (usually 12 months) | HR, System Admin, the employee | 3 years                     |
| Police or barangay clearance                       | Scan               | `POLICE_CLEARANCE`                                                          | Required                                                | Yes (usually 6 months)  | HR, System Admin, the employee | 3 years                     |
| Pre-employment medical results                     | Restricted         | `MEDICAL_RESULTS`                                                           | Required                                                | -                       | HR only (every opening logged) | 3 years                     |

### 2. Government registration numbers

| Document / data                                  | Checklist handling | In the HRIS (code)                                         | Needed                                                          | Expiry | Who can open                            | Retention after separation* |
| ------------------------------------------------ | ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------- | ------ | --------------------------------------- | --------------------------- |
| TIN, with BIR Form 1902 for first-time employees | Data + scan        | `TIN_BIR_1902`; fields: TIN                                | Required                                                        | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| SSS number (E-1 or E-4)                          | Data + scan        | `SSS_E1`; fields: SSS number                               | Required                                                        | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| PhilHealth number (PMRF)                         | Data + scan        | `PHILHEALTH_PMRF`; fields: PhilHealth number               | Required                                                        | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| Pag-IBIG MID number (MDF)                        | Data + scan        | `PAGIBIG_MDF`; fields: Pag-IBIG MID number                 | Required                                                        | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| BIR Form 2316 from previous employer (same year) | Data + scan        | `PREVIOUS_BIR_2316`; reference: Prior pay and tax withheld | If applicable (worked elsewhere earlier this year (HR decides)) | -      | HR, Payroll, System Admin, the employee | 10 years                    |

### 3. Employment records

| Document / data                                        | Checklist handling | In the HRIS (code)                                                  | Needed            | Expiry | Who can open                            | Retention after separation* |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------------- | ----------------- | ------ | --------------------------------------- | --------------------------- |
| Job offer and signed employment contract               | Scan               | `EMPLOYMENT_CONTRACT`                                               | Required          | -      | HR, System Admin, the employee          | 4 years                     |
| Job description                                        | Scan               | `JOB_DESCRIPTION`                                                   | Required          | -      | HR, System Admin, the employee          | 3 years                     |
| Personal data sheet with emergency contacts            | Data               | `PERSONAL_DATA_SHEET`; fields: Address, contacts, emergency contact | Required          | -      | HR, System Admin, the employee          | 3 years                     |
| Notice of probation and regularization                 | Data + scan        | `PROBATION_REGULARIZATION`; fields: Hire date, regularization date  | Required          | -      | HR, System Admin, the employee          | 4 years                     |
| Notices of promotion, transfer and salary adjustment   | Data + scan        | `PERSONNEL_ACTION`; fields: Employment history (effective-dated)    | Optional, several | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| Signed acknowledgment of company handbook and policies | Scan               | `HANDBOOK_ACKNOWLEDGMENT`                                           | Required          | -      | HR, System Admin, the employee          | 4 years                     |
| Data privacy consent form                              | Data + scan        | `DATA_PRIVACY_CONSENT`; reference: Form version                     | Required          | -      | HR, System Admin, the employee          | 4 years                     |
| Biometric consent form                                 | Data + scan        | `BIOMETRIC_CONSENT`; reference: Form version                        | Required          | -      | HR, System Admin, the employee          | 4 years                     |
| Non-disclosure or confidentiality agreement            | Scan               | `NDA`                                                               | Optional          | -      | HR, System Admin, the employee          | 4 years                     |

### 4. During employment

| Document / data                                                  | Checklist handling | In the HRIS (code)                                | Needed            | Expiry | Who can open                            | Retention after separation* |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------- | ----------------- | ------ | --------------------------------------- | --------------------------- |
| Performance appraisals                                           | Restricted         | `PERFORMANCE_APPRAISAL`                           | Optional, several | -      | HR, direct manager, the employee        | 3 years                     |
| Training and seminar certificates                                | Scan               | `TRAINING_CERTIFICATE`; reference: Training title | Optional, several | -      | HR, System Admin, the employee          | 3 years                     |
| Leave records                                                    | Data               | `LEAVE_RECORDS`                                   | Automatic         | -      | HR, System Admin, the employee          | -                           |
| Commendations and awards                                         | Scan               | `COMMENDATION`                                    | Optional, several | -      | HR, System Admin, the employee          | 3 years                     |
| Disciplinary records: NTE, employee response, notice of decision | Restricted         | `DISCIPLINARY_RECORD`; reference: Case reference  | Optional, several | -      | HR only (every opening logged)          | 4 years                     |
| Loan documents: SSS, Pag-IBIG, company loans                     | Data + scan        | `LOAN_DOCUMENT`; reference: Loan type and number  | Optional, several | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| Updates to civil status, dependents and address                  | Data + scan        | `RECORD_UPDATE`; reference: What changed          | Optional, several | -      | HR, System Admin, the employee          | 3 years                     |

### 5. Separation

| Document / data                                 | Checklist handling | In the HRIS (code)    | Needed            | Expiry | Who can open                            | Retention after separation* |
| ----------------------------------------------- | ------------------ | --------------------- | ----------------- | ------ | --------------------------------------- | --------------------------- |
| Resignation letter and acceptance               | Scan               | `RESIGNATION_LETTER`  | Optional          | -      | HR, System Admin, the employee          | 4 years                     |
| Termination notices (twin-notice documentation) | Restricted         | `TERMINATION_NOTICE`  | Optional, several | -      | HR only (every opening logged)          | 4 years                     |
| Clearance form                                  | Scan               | `CLEARANCE_FORM`      | On separation     | -      | HR, System Admin, the employee          | 4 years                     |
| Final pay computation and quitclaim             | Data + scan        | `FINAL_PAY_QUITCLAIM` | On separation     | -      | HR, Payroll, System Admin, the employee | 10 years                    |
| Certificate of employment issued                | Scan               | `COE_ISSUED`          | On separation     | -      | HR, System Admin, the employee          | 3 years                     |
| BIR Form 2316 for the separation year           | Data + scan        | `SEPARATION_BIR_2316` | On separation     | -      | HR, Payroll, System Admin, the employee | 10 years                    |

## Build notes (from the checklist) and how they are implemented

1. **Three storage patterns.** Structured fields live in the employee tables and are effective-dated where they change over
   time: position, site and pay are in `EmploymentEvent` (effective date); changes to civil status, dependents and address
   are saved with an effective date in the audit log (`PERSONAL_INFO_UPDATED`), plus the supporting document
   (`RECORD_UPDATE`). Uploads are `EmployeeDocument` rows with type, issue date, optional expiry and the uploader.
   Restricted records use the same store with role-based access and every view logged.
2. **Expiry tracking.** NBI and police clearances, licenses and IDs carry an expiry date. The API suggests it from the
   usual validity (NBI 12 months, police 6 months). HR sees "Expiring soon" 30 days before (`EXPIRY_WARNING_DAYS`) on the
   dashboard ("Things to do today"), on the **201 files** page and on the employee's own phone. For multi-document types
   (IDs) one valid document is enough; for renewable ones the newest document counts.
3. **Consent first.** `POST /employees/{id}/biometric-enrollment` refuses (409) until the signed biometric consent is on
   file. The dashboard counts employees already on the time clocks without a consent form.
4. **Retention.** Each document type has `retentionYears`; `retainUntil(type, separationDate)` gives the earliest disposal
   date. Nothing is hard-deleted from the app: "Remove" archives the document with a reason (`DOCUMENT_ARCHIVED`).
   Automated archiving/disposal after the retention date is a follow-up once the Firm confirms the periods.

## Not built yet (follow-ups)

- Employee self-upload from the phone (e.g. a photo of the renewed NBI clearance) with HR approval.
- Generating documents from templates (COE, notices), e-signatures, and payroll-generated final pay / BIR 2316.
- Loan amortization schedules as payroll deductions (`LOAN_DOCUMENT` holds the papers only).
- Separation workflow (clearance status per department) and automated disposal after the retention period.
- A "clinic" role for medical results, and HR sub-roles (e.g. who may open disciplinary records).
