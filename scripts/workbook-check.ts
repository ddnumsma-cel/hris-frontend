// heyhr's own pay formulas run on the inputs of MSMA's payroll workbook (Payroll Template - Sample_1.xlsx,
// Sep 11 – 25, 2026 cut-off), step by step against what the workbook computed. Nothing here is copied from
// the register: each person's day-by-day hours (sheet A_1), day types (A_2), absences (DTR_FT) and pay
// settings go into lib/pay/engine.ts, and each result is compared with the workbook's own column.
// Run: npm run check:workbook   (fixture: scripts/fixtures/ft-msma-2026-09-25.json)

import { readFileSync } from "node:fs";
import { computePay } from "../src/lib/pay/engine";
import { withholding } from "../src/lib/reports/statutory";
import { MSMA_ROSTER } from "../src/lib/msmaRoster";
import type { DayRow } from "../src/lib/timekeeping/api";

interface FileDay { date: string; type: string; reg: number; ot: number; nsd: number; am: string; pm: string }
interface FilePerson {
  name: string;
  monthly: number;
  days: FileDay[];
  file: { hourly: number; premium: number; ot: number; nsd: number; meal: number; absences: number; sss: number; ph: number; pi: number; deMinimis: number; otherNT: number; taxable: number; tax: number; net: number; newHire: boolean };
}

const people = JSON.parse(readFileSync(new URL("./fixtures/ft-msma-2026-09-25.json", import.meta.url), "utf8")) as FilePerson[];
const FROM = "2026-09-11";
const TO = "2026-09-25";

const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** The workbook's days as heyhr attendance: Mon–Fri workdays (8:30–5:00), weekends rest days. */
function daysOf(p: FilePerson, dates: string[]): DayRow[] {
  return dates.map((date) => {
    const f = p.days.find((d) => d.date === date);
    const rest = [0, 6].includes(weekday(date));
    const code = `${f?.am ?? ""} ${f?.pm ?? ""}`.trim().toUpperCase();
    const ot = (f?.ot ?? 0) + (f?.nsd ?? 0);
    const kind = rest ? "rest" : code === "VL" || code === "SL" ? "leave" : "work";
    const absent = code === "ABS";
    const worked = rest ? ((f?.reg ?? 0) + ot) * 60 : absent || kind === "leave" ? 0 : 480 + ot * 60;
    return {
      date,
      kind,
      dayType: rest ? "rest" : "ordinary",
      status: absent ? "absent" : kind === "leave" ? "leave" : worked > 0 ? "done" : "rest",
      workedMinutes: worked,
      approvedOvertimeMinutes: ot * 60,
      nightMinutes: (f?.nsd ?? 0) * 60,
      lateMinutes: 0,
      lateRawMinutes: 0,
      undertimeMinutes: code === "UT" ? 240 : 0,
      lunchMinutes: 0,
      extraMinutes: 0,
    } as unknown as DayRow;
  });
}

const cutoff: string[] = [];
for (let d = FROM; d <= TO; d = addDays(d, 1)) cutoff.push(d);

type Step = "hourly" | "premium" | "overtime" | "absences" | "contributions" | "tax" | "taxable" | "take-home";
const results: Record<Step, { ok: number; diffs: string[] }> = Object.fromEntries(
  (["hourly", "premium", "overtime", "absences", "contributions", "tax", "taxable", "take-home"] as Step[]).map((s) => [s, { ok: 0, diffs: [] }]),
) as never;
const compare = (step: Step, who: string, heyhr: number, file: number, note = "") => {
  if (Math.abs(heyhr - file) < 0.005) results[step].ok++;
  else results[step].diffs.push(`${who}: heyhr ₱${peso(heyhr)} · file ₱${peso(file)} (${heyhr > file ? "+" : "−"}₱${peso(Math.abs(heyhr - file))})${note ? ` — ${note}` : ""}`);
};

for (const p of people) {
  if (!p.monthly) continue;
  const [last, first] = p.name.split(", ");
  const r = MSMA_ROSTER.find((x) => x.lastName === last && x.firstName === first)!;
  // Days after the cut-off (the workbook's A_1 runs one day past it) are left out, as heyhr pays them next cut-off.
  const late = p.days.filter((d) => d.date > TO && (d.reg || d.ot || d.nsd));
  const newHire = p.file.newHire;
  // A new hire in the workbook: 8 workdays marked absent before the start date.
  const hired = newHire ? cutoff.filter((d) => ![0, 6].includes(weekday(d)))[8] : undefined;
  const pay = computePay({
    monthlySalary: p.monthly,
    from: FROM,
    to: TO,
    employedFrom: hired,
    days: daysOf(p, cutoff),
    history: [],
    unpaidLeaveDays: 0,
    adjustments: [
      ...(r.cashAdvance ? [{ id: "ca", label: "Cash advance", amount: -r.cashAdvance, taxable: false }] : []),
      ...(r.sssLoan ? [{ id: "sss", label: "SSS loan", amount: -r.sssLoan, taxable: false }] : []),
      ...(r.pagibigLoan ? [{ id: "hdmf", label: "Pag-IBIG loan", amount: -r.pagibigLoan, taxable: false }] : []),
    ],
    profile: { workWeek: "5-day", transportAllowance: r.transport, otMealRate: 0, deMinimis: r.deMinimis, otherNonTaxable: r.otherNonTaxable },
  });
  const who = p.name;
  const lateNote = late.length ? `the file also pays ${late.map((d) => d.date).join(", ")} (after the cut-off)` : "";

  compare("hourly", who, pay.hourly, p.file.hourly);
  compare("premium", who, pay.premiumPay, p.file.premium, lateNote);
  compare("overtime", who, r2(pay.overtimePay + pay.nightPay + pay.otMeal), r2(p.file.ot + p.file.nsd + p.file.meal), lateNote);
  if (newHire) {
    const fileBasic = r2(p.monthly / 2 - p.file.absences);
    compare("absences", who, pay.basic, fileBasic, "new hire: half month less 8 h × hourly for each workday before the start");
  } else compare("absences", who, r2(pay.absentDeduction + pay.halfDayDeduction + pay.undertimeDeduction), p.file.absences);
  compare("contributions", who, r2(pay.sssEe + pay.phEe + pay.piEe), r2(p.file.sss + p.file.ph + p.file.pi), `SSS ${peso(pay.sssEe)}/${peso(p.file.sss)} · PhilHealth ${peso(pay.phEe)}/${peso(p.file.ph)} · Pag-IBIG ${peso(pay.piEe)}/${peso(p.file.pi)}`);
  // Tax from the same taxable amount the file used, so this tests the tax table alone.
  compare("tax", who, withholding(p.file.taxable, "semi-monthly", TO), p.file.tax, `on taxable ₱${peso(p.file.taxable)}`);
  compare("taxable", who, pay.taxable, p.file.taxable);
  compare("take-home", who, pay.net, p.file.net);
}

let failed = 0;
for (const [step, r] of Object.entries(results)) {
  console.log(`\n${r.diffs.length ? "DIFF" : "PASS"} ${step}: ${r.ok} of ${r.ok + r.diffs.length} match`);
  for (const d of r.diffs) console.log(`   ${d}`);
  failed += r.diffs.length;
}
console.log(failed ? `\n${failed} differences` : "\nEvery step matches the workbook");
