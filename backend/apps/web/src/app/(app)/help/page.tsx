'use client';

import { AlertTriangle, Check, Clock, Lock, Minus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/form';

/** Plain-language steps for the most common tasks. */
const HOW_TO: { q: string; steps: string[] }[] = [
  {
    q: 'Approve or reject a leave, overtime, undertime or time adjustment request',
    steps: [
      'Open Approvals in the menu (the number shows how many are waiting).',
      'Read the request, then press Approve or Reject.',
      'A box explains exactly what will happen. Rejecting needs a reason; the employee sees it in the app.',
    ],
  },
  {
    q: 'Add a document to an employee’s 201 file',
    steps: [
      'Open Employees, click the employee, then the 201 file tab.',
      '"Needs attention" lists what is missing or expiring. Press Upload next to the item.',
      'Choose the scanned PDF or phone photo, fill in the date issued, and press Save to 201 file.',
      'For NBI and police clearances the "valid until" date is filled in for you; change it if the paper says otherwise.',
    ],
  },
  {
    q: 'Find everyone with missing or expired documents',
    steps: [
      'Open 201 files in the menu.',
      'Click a box at the top (Missing documents, Expired, Expiring in 30 days) to filter the list.',
      'Press Export CSV to open the list in Excel, or Print for a paper copy.',
    ],
  },
  {
    q: 'Remove a document uploaded by mistake',
    steps: [
      'In the 201 file tab, press the bin icon next to the document and give the reason.',
      'Nothing is permanently deleted: the file is archived with your reason and kept for the retention period.',
    ],
  },
  {
    q: 'See who opened a restricted record',
    steps: [
      'HR only: in the 201 file tab, press the clock icon next to the document.',
      'Every upload, change, opening and removal is listed with the person’s name and the time.',
    ],
  },
  {
    q: 'Make the text bigger or switch to dark mode',
    steps: [
      'Open Settings. Choose Large text, and Light, Dark or Match my device.',
      'Your choice is saved to your account and follows you to any computer.',
    ],
  },
];

/** Terms used in the app, explained for people outside HR. */
const GLOSSARY: [string, string][] = [
  [
    '201 file',
    'The employee’s personnel record, kept from application to separation: IDs, clearances, contracts, government forms, appraisals and so on.',
  ],
  [
    'Audit log',
    'A permanent list of who did what and when (approvals, uploads, openings of restricted records, changes to personal info). It cannot be edited.',
  ],
  [
    'BIR Form 1902',
    'Application for a TIN, filed for employees who are working for the first time.',
  ],
  [
    'BIR Form 2316',
    'Certificate of compensation paid and taxes withheld for the year. Given to the employee each year and when they leave.',
  ],
  [
    'Biometric consent',
    'The employee’s signed permission to use their face or fingerprint for the time clock, required by the Data Privacy Act before enrollment.',
  ],
  [
    'Clock in from the phone',
    'Temporary, until the office attendance machines are set up. The phone confirms it is the employee with its own fingerprint, face or PIN; MSMA never receives the fingerprint or face. Live punches show which was used.',
  ],
  [
    'Clearance (NBI, police, barangay)',
    'Certificates that the person has no pending case. They expire (NBI usually 1 year, police about 6 months), so HR collects renewals.',
  ],
  ['COE', 'Certificate of employment: states the position and dates of employment.'],
  [
    'Cutoff',
    'The pay period. Here: 1st–15th and 16th–end of the month. Pay date is 5 days after the cutoff ends.',
  ],
  [
    'Data Privacy Act (RA 10173)',
    'The Philippine law on personal data. It is why some records are restricted and why openings are logged.',
  ],
  [
    'DTR',
    'Daily time record: time in, time out, late, undertime and overtime for each day, taken from the time clocks.',
  ],
  [
    'Late / Undertime',
    'Late: minutes after the shift start (after a 5-minute grace period). Undertime: minutes left before the shift end.',
  ],
  ['Night differential', 'Extra pay (10% in this sample) for work between 10:00 PM and 6:00 AM.'],
  [
    'Overtime request',
    'Asking for approval of time worked after the shift. Only approved overtime is paid, and never more than the time clock shows.',
  ],
  [
    'Time adjustment',
    'Asking HR to correct a missing or wrong time in or time out (for example, forgot to time out). Once approved, the DTR uses the corrected time.',
  ],
  [
    'Undertime request',
    'Asking permission to leave before the shift ends. The early minutes are still unpaid; approval means it was allowed.',
  ],
  [
    'NTE',
    'Notice to explain: the first written notice in a disciplinary case. The employee answers, then a notice of decision follows.',
  ],
  ['OT', 'Overtime: approved work beyond 8 hours a day.'],
  ['Pag-IBIG MID', 'The member ID number with the Home Development Mutual Fund.'],
  ['PhilHealth', 'The national health insurance; contributions are deducted from pay.'],
  [
    'Probationary / Regular',
    'New employees are usually on probation for up to 6 months, then regularized. The regularization date affects leave credits and benefits.',
  ],
  ['Quitclaim', 'A document the separating employee signs acknowledging receipt of final pay.'],
  [
    'Restricted record',
    'Government IDs, medical results, disciplinary and termination papers. Only HR can open them, and every opening is logged.',
  ],
  [
    'Retention period',
    'How long a record is kept after the employee leaves before it may be disposed of. The periods in this sample must be confirmed with the Firm.',
  ],
  [
    'SIL / VL / SL',
    'Service incentive leave (5 days a year by law) / vacation leave / sick leave.',
  ],
  ['SSS', 'Social Security System; contributions are deducted from pay.'],
  ['TIN', 'Tax identification number from the BIR.'],
  [
    'Twin-notice rule',
    'Before dismissal the employee must receive two written notices: the NTE and the notice of decision.',
  ],
];

export default function HelpPage() {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const terms = GLOSSARY.filter(
    ([t, d]) => !term || t.toLowerCase().includes(term) || d.toLowerCase().includes(term),
  );
  const howTo = HOW_TO.filter(
    (h) =>
      !term ||
      h.q.toLowerCase().includes(term) ||
      h.steps.some((s) => s.toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader
        title="Help & glossary"
        subtitle="How to do common tasks, and what the words mean"
        sample={false}
      />
      <div className="relative mb-4 max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder="Search, e.g. NBI, cutoff, upload"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search help"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How do I…</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {howTo.map((h) => (
                <details
                  key={h.q}
                  className="rounded-lg border border-border px-4 py-2 open:bg-bg"
                  open={!!term}
                >
                  <summary className="cursor-pointer font-medium">{h.q}</summary>
                  <ol className="mt-2 mb-1 list-decimal space-y-1 pl-5 text-sm">
                    {h.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </details>
              ))}
              {howTo.length === 0 && (
                <p className="text-sm text-muted">No steps match your search.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What the labels mean</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-3">
                  <Badge tone="success">
                    <Check className="size-3" aria-hidden /> On file
                  </Badge>{' '}
                  The document is in the 201 file and valid.
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="warning">
                    <Clock className="size-3" aria-hidden /> Expiring soon
                  </Badge>{' '}
                  It expires within 30 days. Ask for the renewal.
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="danger">
                    <AlertTriangle className="size-3" aria-hidden /> Expired
                  </Badge>{' '}
                  It is no longer valid. Collect a new copy.
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="danger">
                    <X className="size-3" aria-hidden /> Missing
                  </Badge>{' '}
                  Required but not uploaded yet.
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="neutral">
                    <Minus className="size-3" aria-hidden /> Only if applicable
                  </Badge>{' '}
                  Needed only in some cases (e.g. marriage certificate).
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="neutral">
                    <Lock className="size-3" aria-hidden /> Restricted
                  </Badge>{' '}
                  Only HR can open it. Every opening is logged.
                </li>
                <li className="flex items-center gap-3">
                  <Badge tone="warning">Sample data</Badge> Everything here is made up for the demo.
                  Payroll numbers are not for real pay.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Glossary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {terms.map(([t, d]) => (
                <div key={t} className="py-2.5">
                  <dt className="font-medium">{t}</dt>
                  <dd className="mt-0.5 text-sm text-muted">{d}</dd>
                </div>
              ))}
            </dl>
            {terms.length === 0 && (
              <p className="text-sm text-muted">No terms match your search.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
