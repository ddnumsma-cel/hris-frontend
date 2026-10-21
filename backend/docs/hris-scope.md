# MSMA HRIS: scope, replacing Xeleqt

Status: **Draft for HR / Accounting review** (28 Sep 2026). Sources: MSMA's breakdown of the current Xeleqt system, the
MSMA "201 File Checklist" (`docs/201-file-checklist.md`), and a fact-checked web research pass (sources at the end).
Legal points are summaries for planning, **not legal advice**. The Firm and a CPA confirm them before go-live.

## 1. What Xeleqt is

- **Xeleqt Agility** (web: agility.xeleqt.com, plus a mobile app) is the "workforce" product of **Xeleqt Technology
  Innovations Inc.** (Cebu City, affiliated with Spingine Corporation). The company presents itself as an AI operations
  platform for field-heavy businesses (fleet, worksite, workforce), not as a Philippine-compliance HRIS.
- That is why MSMA sees asset, equipment, signage, project, expense and fund modules it does not use: they serve
  logistics, construction and manufacturing clients.
- No independent reviews, public pricing or full feature list could be verified. The Agility product page was removed.

## 2. MSMA's breakdown, checked

| Xeleqt area                                               | MSMA's call     | Verdict                                       | Why                                                                                                                                              |
| --------------------------------------------------------- | --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Leave, undertime, overtime, time adjustments              | **Must have**   | ✅ Agree                                      | Core. They must feed one rules engine (schedule, rest days, holidays), not four separate forms.                                                  |
| Asset: workspace, equipment, signages, event management   | Unnecessary     | ✅ Drop                                       | Not HR.                                                                                                                                          |
| Payroll groups                                            | To be confirmed | ⚠️ Keep as a **setting**                      | Needed to run payroll per group (semi-monthly vs monthly, site, cost center). No separate module.                                                |
| Workflow: project management, to-do list, expenses, funds | Unnecessary     | ✅ Drop                                       | Not HR. The dashboard's "Things to do today" covers HR to-dos.                                                                                   |
| Shift assignment, shift swap                              | Unnecessary     | ⚠️ Keep **basic shift assignment**, drop swap | Overtime, rest-day, holiday and night-differential pay depend on each person's schedule. A swap feature can wait.                                |
| **BIR Forms**                                             | Unnecessary     | ❌ **Do not drop** (see 3.1)                  | The employer must issue 2316 and file 1601-C / 1604-C + alphalist. Either the HRIS makes them, or it exports reconciled data for the accountant. |
| Presence: Check-in report                                 | Unnecessary     | ✅ Drop the report                            | The DTR and the dashboard's live punches replace it.                                                                                             |
| **Payroll report**                                        | Unnecessary     | ❌ **Do not drop** (see 3.2)                  | The payroll register / worksheet is the employer's evidence in labor cases.                                                                      |
| Benefits, expense, fund request reports                   | Unnecessary     | ✅ Drop                                       | Not required.                                                                                                                                    |
| Work-from-home report, shift assignment report            | Unnecessary     | ⚠️ Reports can wait                           | The underlying data (who worked where, on which schedule) is still needed if MSMA allows WFH or official business.                               |

## 3. What the law requires the HRIS (or someone) to produce

### 3.1 BIR (withholding tax on compensation)

- **BIR Form 2316** for every employee: by 31 January of the next year, or on the last pay day for someone who leaves
  mid-year (even if clearance is not finished).
- **BIR Form 1604-C + Alphalist of Employees** by 31 January (moves to the next working day on weekends).
- **Monthly 1601-C** remittances, which must add up to the annual 1604-C. The alphalist must match every 2316.
- Exact monthly due dates and file formats: **confirm with the CPA** (research could not verify them).

### 3.2 Labor Code pay rules (built into DTR + payroll)

| Situation                             | Minimum                                              |
| ------------------------------------- | ---------------------------------------------------- |
| Overtime on an ordinary day           | +25% of the hourly rate (Art. 87)                    |
| Work on the scheduled rest day        | +30% (Art. 93)                                       |
| Overtime on a rest day or holiday     | +30% of that day's hourly rate                       |
| Special day that is also the rest day | +50%                                                 |
| Regular holiday worked / not worked   | 200% / 100% of the daily wage (Art. 94)              |
| Night differential, 10 PM to 6 AM     | +10% per hour, added on top (Art. 86)                |
| Service incentive leave               | 5 days a year after 1 year of service                |
| 13th month pay                        | 1/12 of basic pay earned in the year, by 24 December |

Managerial employees and field personnel are excluded from some of these (the HRIS needs a per-employee flag).

### 3.3 Records

- Keep DTRs, payroll worksheets and payslips **at least 3 years** from the last entry (Omnibus Rules, Book III Rule X
  Sec. 12). Tax records are generally kept **10 years**. Archive; never delete early.
- Court example: _Adstratworld v. Magallones_ (G.R. 233679, 2022). The employer paid for holiday pay, SIL and 13th month
  because it had no payment records.

### 3.4 Data Privacy Act (RA 10173)

- A plain-language **privacy notice** before collecting data (especially biometrics).
- Biometric consent must be freely given and recorded, and refusing must not be penalised: keep a **non-biometric way
  to clock in**. (The HRIS already blocks enrollment without consent, and phone clock-in sends no biometric data.)
- A **privacy impact assessment** (NPC Circular 2023-06) and, if relying on legitimate interest, a documented assessment
  (NPC Circular 2023-07).
- **NPC registration:** mandatory at 250+ employees, 1,000+ people's sensitive data, or high-risk processing. At ~180
  employees MSMA may still be covered because of biometrics, IDs and medical records. If not, file the sworn
  declaration. A **DPO** is required either way. A new system must be registered within 20 days of going live.

## 4. Where the MSMA HRIS stands today

| Area                                                                           | Built                                       | Still to build                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| 201 file (checklist of 38 document types, restricted records, audit, renewals) | ✅                                          | Retention job, onboarding checklist                                |
| Attendance: machines (ADMS push), phone clock-in, DTR engine                   | ✅                                          | Machine choice (ADR-0003), geofence                                |
| Leave: file (phone), balances, approve (web)                                   | ✅                                          | Web Leave page, SIL rule, leave policies/accruals                  |
| Overtime                                                                       | Approve only                                | **File from phone and web**                                        |
| Time adjustments (DTR fix)                                                     | Approve + recompute                         | **File from phone and web**                                        |
| Undertime                                                                      | Computed from DTR                           | **Undertime request** (permission to leave early)                  |
| Schedules                                                                      | One shift per employee                      | Shift assignment per site/date, rest days, holiday calendar screen |
| Pay rules                                                                      | OT, night diff, holidays (sample)           | Rest-day and stacked premiums, managerial flag                     |
| Payroll                                                                        | Sample preview (SAMPLE banner)              | Run lifecycle, **payroll register**, 13th month, final pay         |
| Government                                                                     | SSS/PhilHealth/Pag-IBIG shares (unverified) | Rates confirmed by CPA, remittance lists                           |
| BIR                                                                            | Withholding tax (unverified)                | **2316, 1601-C, 1604-C/alphalist** (or reconciled exports)         |
| Privacy                                                                        | Consent-first, audit log, restricted access | Privacy notice acknowledgment, PIA, DPO view                       |

## 5. Build order (proposed)

**Must have (before replacing Xeleqt)**

1. Requests: file **overtime, undertime, time adjustment** from phone and web; web Leave page; manager → HR approval;
   every decision audited. _(Phase 11)_
2. Schedules: shift assignment per site, rest days, holiday calendar that HR can edit. _(Phase 12)_
3. Pay rules: rest-day and stacked premiums, SIL, 13th month, managerial/field flag. _(Phase 12)_
4. Payroll run (draft → reviewed → approved → locked), **payroll register**, payslips, final pay. _(Phase 13)_
5. BIR and government outputs: 2316 per employee, 1601-C monthly, alphalist, remittance lists, or reconciled exports if
   the accountant keeps filing. _(Phase 14)_
6. Privacy pack: notice acknowledgment, retention/archiving, access review. _(Phase 15)_
7. Go-live: AWS, backups, MFA for admins, importing current data from Xeleqt, the attendance machines. _(Phase 16)_

**Should have:** manager dashboards per site, official business / WFH request (if allowed), CSV + print on every report.

**Later / dropped:** assets, workspace, equipment, signage, events, projects, to-do lists, expenses, funds, shift swap,
check-in / benefits / expense / fund reports.

## 6. Build vs buy

- Building fits what sets MSMA apart: the 201 file, plain language for HR, lawyers and accountants, multi-site attendance
  and approvals.
- Statutory payroll and BIR outputs are the highest-risk part. **Run the in-house payroll in parallel** with the current
  payroll (Xeleqt or the accountant) for at least one full year-end (2316 + alphalist) before switching. Rates stay
  flagged `verified: false` until a CPA signs off.
- For scale: GreatDay HR advertises about ₱77 per employee per month, including BIR 2316 and alphalist, roughly
  ₱166,000 a year for 180 people.

## 7. Open questions for MSMA

1. Who produces the 2316, 1601-C and alphalist today: Xeleqt, or the accountant? (This decides whether 3.1 is built
   in-house or exported.)
2. Any night shifts, rotating shifts, compressed work weeks or work from home at the 3 sites?
3. Payroll groups: who is paid semi-monthly vs monthly, and does cost need to be split per site?
4. Can we get an export of current employees, leave balances and last year's payroll from Xeleqt?
5. Has MSMA appointed a DPO, and is it registered with the NPC or has it filed the sworn declaration?

## Sources

- [Xeleqt (vendor site)](https://www.xeleqt.com/) and [Cebu Chamber profile](https://cebuchamber.org/xeleqt-augmenting-possibilities-with-ai-solutions-for-the-future-of-work/)
- [Sprout: first-time BIR 1604-C alphalist filing](https://sprout.ph/articles/first-time-bir-1604c-alphalist-filing-guide/)
- [Respicio: BIR 2316 and alphalist requirements](https://www.respicio.ph/commentaries/bir-guidelines-on-the-submission-of-form-2316-and-alphalist-requirements)
- [NDV Law: night differential and holiday pay](https://ndvlaw.com/mandatory-night-shift-differential-and-holiday-pay-for-24-7-foreign-bpo-operations-in-the-philippines/)
- [Divina Law: employee data retention](https://www.divinalaw.com/dose-of-law/employee-data-retention-period/)
- [L&E Global: employee monitoring under the DPA (2026)](https://leglobal.law/2026/05/29/philippines-employee-monitoring-and-the-right-to-privacy-key-considerations-under-the-data-privacy-act-of-2012/)
- [Respicio: biometric attendance and privacy](https://www.respicio.ph/commentaries/employee-privacy-rights-for-biometric-attendance-systems-1)
- [NPC Circular 2022-04 (registration)](https://privacy.gov.ph/wp-content/uploads/2023/05/Circular-2022-04-1.pdf)
- [GreatDay HR features](https://greatdayhr.ph/feature/) and [pricing](https://greatdayhr.ph/price/)
