# Accept flow, address dropdowns, bigger field library — design

Date: 2026-10-01 · Builds on `2026-10-01-onboarding-form-builder-design.md`.

## Employee
- Emergency contact lives in the **Contact** section (saved forms are migrated on load).
- Addresses use dependent dropdowns **Province → City/municipality → Barangay** from bundled PSA
  PSGC data (`public/psgc/`, one file per province, loaded on demand); street stays free text.
- After submitting, the "Sent to HR" screen shows once; afterwards **Onboarding is hidden** from the
  sidebar and its URL redirects to Overview. Copy: "HR will review your details. You'll be
  notified once you're accepted."

## HR
- **Employee Directory** header: an inbox icon with a count badge. It opens a panel listing every
  submitted Onboarding form → **Review** opens one dialog: what they submitted (left) and job details
  (right: department, position, cluster, office, start date, status, reports-to) → **Accept and add
  to directory**. Only accepted people appear in cards/table.
- **Pipeline**: two lists — **Not yet hired** (submitted, waiting; Review opens the same dialog) and
  **Hired** (accepted: ID, position, accepted date, link to profile).

## Field library (all optional; locked basics unchanged)
| Section | Fields |
|---|---|
| Personal | Middle name, Suffix, Nickname, Civil status (+ spouse), Blood type, Place of birth, Citizenship, Religion, Height, Weight |
| Contact | Personal email, Work email, Alternate mobile, Landline, Emergency contact |
| Address | Home address, Provincial / permanent address |
| Education | Highest attainment, School, Course / degree, Year graduated |
| Health | Medical conditions / allergies, PWD (yes/no + ID number) |
| Payroll | Bank name, Account name, Account number |

No Family (dependents), IDs, Other or Work background. New fields are stored as
`extras` (key → text) and reach HR as labelled "Other details".

## Persistence (demo)
Directory, profiles, 201 documents, audit log, submissions, hired list and the signed-in employee
are kept in localStorage so the flow survives a reload (mock only; noted in BACKEND_HANDOFF).

## Verification
Build + lint; browser: HR builds a form with new fields → employee fills address via dropdowns,
submits, Onboarding disappears (also after reload) → HR badge → Review → Accept → directory card;
Pipeline shows Hired; reload keeps everything.
