// Sample company policies for the demo (MSMA). Loaded once into the policy store; HR can edit,
// archive or add to them like any other policy. Figures match the seeded leave types and shifts.

import type { Policy } from "./policies";

const at = "2026-01-02T09:00:00.000Z";
const p = (id: string, title: string, category: Policy["category"], summary: string, body: string, extra: Partial<Policy> = {}): Policy => ({
  id,
  title,
  category,
  version: 1,
  effectiveDate: "2026-01-01",
  summary,
  body: body.trim(),
  requireAck: true,
  status: "published",
  updatedBy: "HR Department",
  updatedAt: at,
  ...extra,
});

export const SEED_POLICIES: Policy[] = [
  p(
    "pol-handbook",
    "Employee handbook",
    "Employee handbook",
    "How we work at MSMA: employment status, work hours, pay days and where to get help.",
    `
1. Employment status
New hires serve a probationary period of up to six (6) months (Labor Code, Art. 296). You get the standards for regular employment on your first day, and an evaluation in your 3rd and 5th month. Those who meet the standards become regular employees.

2. Work hours
The regular work week is Monday to Friday, eight (8) hours a day plus a one-hour unpaid lunch break. Your shift and schedule are shown under Attendance. Saturdays, Sundays and holidays are rest days unless your supervisor schedules you in advance.

3. Pay days
Salaries are paid twice a month, on the 15th and the last day of the month, by bank transfer. When a pay day falls on a weekend or holiday, pay goes out the working day before. Payslips are on heyhr under Payslips.

4. Government contributions
MSMA registers every employee with SSS, PhilHealth, Pag-IBIG and the BIR, and deducts and remits contributions on time. Keep your numbers updated in your 201 file.

5. Your 201 file
Submit your pre-employment requirements within 30 days of hiring. Tell HR within 15 days about any change in civil status, address, dependents or contact details.

6. Where to get help
Questions about pay, leave or records: HR, through heyhr. Concerns about conduct or harassment: your department head, HR, or the Committee on Decorum and Investigation.
`,
  ),
  p(
    "pol-conduct",
    "Code of conduct and discipline",
    "Code of conduct",
    "Expected behaviour, the offences and their penalties, and how a case is handled (twin-notice rule).",
    `
1. Expected conduct
Act with honesty, integrity and respect toward clients, co-workers and the public. As a professional firm, we hold client information in strict confidence and avoid any conflict of interest.

2. Classes of offences
Light: tardiness beyond the allowed limit, improper attire, loitering, using company equipment for personal matters.
Less serious: unexcused absences, neglect of duty, discourtesy to co-workers or clients, sleeping on the job.
Serious: dishonesty, falsifying time records, insubordination, harassment, disclosing confidential client information, theft, working under the influence of alcohol or drugs.

3. Penalties
Light: 1st offence written warning; 2nd, 1-day suspension; 3rd, 3-day suspension; 4th, dismissal.
Less serious: 1st offence 3-day suspension; 2nd, 7-day suspension; 3rd, dismissal.
Serious: up to dismissal on the 1st offence, depending on the gravity.
Offences are counted within 12 months; a clean year resets the count.

4. Due process (twin-notice rule)
a) A Notice to Explain stating the facts and the rule broken. You have at least five (5) calendar days to answer in writing.
b) An administrative hearing or conference, if you ask for one or the case needs it. You may bring a representative.
c) A Notice of Decision stating the findings and the penalty, if any.
No penalty is given without these steps.

5. Conflicts of interest
Declare to HR any outside work, business interest or relationship with a client that could affect your judgment.
`,
  ),
  p(
    "pol-attendance",
    "Attendance, tardiness and overtime",
    "Attendance & time",
    "Clocking in and out, the 5-minute grace period, tardiness limits, and how to request overtime, undertime or a time adjustment.",
    `
1. Clocking in and out
Record every time-in and time-out on heyhr. Never clock in or out for someone else; that is falsifying time records, a serious offence.

2. Grace period and tardiness
There is a five (5) minute grace period. Arriving later counts as late, and the minutes past the grace period are deducted from pay.
Being late more than four (4) times in a month, or more than 60 minutes in total, is habitual tardiness and a light offence under the Code of conduct.

3. Absences
Tell your supervisor before your shift starts if you can't come in, and file the leave on heyhr. Three (3) or more straight days absent without notice may be treated as abandonment of work.

4. Overtime
Overtime needs your supervisor's go-ahead. File it on heyhr (Attendance, Request overtime / undertime) within 14 days of the day worked. Approved overtime is paid at least 25% above your hourly rate, 30% on rest days and special days, and as the law requires on regular holidays.

5. Undertime
Leaving before your shift ends also needs a request with the reason. Undertime is not offset by overtime on another day (Labor Code, Art. 88).

6. Missed or wrong punches
If you forgot to clock in or out, or a time is wrong, send a time adjustment request with the correct time and reason within 14 days.
`,
  ),
  p(
    "pol-leave",
    "Leave policy",
    "Leave",
    "Leave credits, how to file, notice periods and the leaves the law grants.",
    `
1. Yearly credits
Vacation leave: 15 days a year (covers the 5-day Service Incentive Leave). Up to 5 unused days carry over.
Sick leave: 15 days a year. Up to 5 unused days carry over.
Emergency leave: 3 days a year.
Bereavement leave: 3 days per death in the immediate family.

2. How to file
File every leave on heyhr under Leave. It goes straight to your approver.
Vacation leave: at least 5 working days ahead.
Sick and emergency leave: tell your supervisor before your shift and file as soon as you're back. Sick leave longer than 2 days needs a medical certificate.

3. Leaves under the law
Maternity leave: 105 days, plus 15 days for solo parents (RA 11210).
Paternity leave: 7 days for married male employees, first 4 deliveries (RA 8187).
Solo parent leave: 7 days a year, after 6 months of service, with a Solo Parent ID (RA 11861).
VAWC leave: up to 10 days; details are kept confidential (RA 9262).
Special leave for women: up to 2 months after gynecological surgery (RA 9710).

4. Leave without pay
When credits run out, leave may be approved without pay. More than 30 days in a year needs HR's approval.

5. Conversion
Unused vacation leave beyond the carry-over is converted to cash at year end, at your daily rate.
`,
  ),
  p(
    "pol-pay",
    "Pay, benefits and reimbursements",
    "Pay & benefits",
    "13th month pay, holiday pay, loans, and how business expenses are reimbursed.",
    `
1. 13th month pay
Every rank-and-file employee who worked at least one month in the year gets 13th month pay: one-twelfth (1/12) of the basic salary earned in the year, paid on or before December 24 (PD 851).

2. Holiday pay
Regular holidays: 100% of the daily rate even if you don't work; 200% if you work.
Special non-working days: no work, no pay unless a company rule says otherwise; 130% if you work.

3. Salary loans
SSS and Pag-IBIG loan payments are deducted from pay as the agencies bill them. Company salary advances need the department head's and Accounting's approval and are paid back over at most 6 pay periods.

4. Reimbursements
Business expenses (transport to clients, filing fees, meals during overtime work for clients) are reimbursed when filed on heyhr with the official receipt within 30 days.
Your approver endorses the claim, Accounting gives the final approval, then Accounting releases the money to you directly by cash, bank transfer, e-wallet or check. Reimbursements are not part of payroll.

5. Final pay
Final pay is released within 30 days of separation, after clearance (DOLE Labor Advisory No. 06-2020). A Certificate of Employment is issued within 3 days of request.
`,
  ),
  p(
    "pol-privacy",
    "Data privacy and confidentiality",
    "Data privacy",
    "How MSMA handles employee and client personal data under the Data Privacy Act (RA 10173).",
    `
1. Your personal data
MSMA collects only the personal data needed for employment, pay, benefits and the law. It is kept on heyhr, seen only by the people whose work needs it, and kept for as long as the law requires.

2. Your rights
You may ask to see, correct or get a copy of your data, and you may file a complaint with the Data Protection Officer or the National Privacy Commission.

3. Client information
Client files, financial records and case details are strictly confidential. Don't discuss them outside work, post them on social media, or store them on personal devices or accounts.

4. Passwords and devices
Don't share your heyhr password. Lock your screen when you step away. Report a lost device or a suspected data breach to IT and the Data Protection Officer right away; breaches must be reported to the NPC within 72 hours.

5. Breaking this policy
Breaking confidentiality is a serious offence under the Code of conduct and may also carry liability under RA 10173.
`,
  ),
  p(
    "pol-harassment",
    "Anti-sexual harassment and safe spaces",
    "Code of conduct",
    "Zero tolerance for sexual harassment and gender-based harassment at work and online (RA 7877, RA 11313).",
    `
1. Zero tolerance
MSMA does not tolerate sexual harassment or gender-based harassment in any form: in the office, at client sites, at company events, or online, including chats and social media.

2. What counts
Unwanted sexual advances, requests or remarks; sexist, homophobic or transphobic slurs; unwanted touching; sharing sexual content; stalking; and any act that creates a hostile, intimidating or offensive workplace.

3. How to report
Report to the Committee on Decorum and Investigation (CODI), HR, or any department head, verbally or in writing. Reports are kept confidential, and retaliation against anyone who reports or acts as a witness is itself a serious offence.

4. What happens next
The CODI investigates within 10 working days and recommends action. Penalties range up to dismissal, without prejudice to criminal or civil cases.
`,
  ),
  p(
    "pol-safety",
    "Workplace health and safety",
    "Health & safety",
    "Safety rules, drug-free and smoke-free workplace, and what to do in an emergency (RA 11058).",
    `
1. Safety first
Keep walkways and fire exits clear. Report hazards, broken equipment or accidents to the office administrator the same day.

2. Drug-free and smoke-free workplace
MSMA is drug-free (RA 9165) and smoke-free. Smoking and vaping are allowed only in the designated area outside the building.

3. Emergencies
Know your floor's fire exits and assembly point. Join the quarterly fire and earthquake drills. In an emergency, follow the floor marshal.

4. Health
Stay home when you're sick with something contagious and file sick leave. An annual physical exam is provided for every regular employee.

5. Mental health
You may talk to HR in confidence about stress or mental health concerns (RA 11036). Support and referrals are available.
`,
    { requireAck: false },
  ),
  p(
    "pol-remote",
    "Work from home",
    "Attendance & time",
    "Who may work from home, how to ask for it, and the rules on remote work days.",
    `
1. Who may work from home
Regular employees whose work can be done remotely may work from home up to 2 days a week, with their supervisor's approval (RA 11165, Telecommuting Act).

2. How to ask
Ask your supervisor at least one working day ahead. On remote work days declared by HR (e.g. bad weather or transport strikes), everyone works from home unless told otherwise.

3. While working from home
Clock in and out on heyhr as usual. Be reachable by phone and chat during your shift. Keep client files on company systems only, and work from a private space where others can't see your screen.

4. Same pay and rights
Remote work days count as regular work days, with the same pay, benefits and workload as in the office.
`,
    { status: "draft", requireAck: false, effectiveDate: "2026-11-01", updatedAt: "2026-10-08T09:00:00.000Z" },
  ),
];
