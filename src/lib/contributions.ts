// Government contributions mock API: the dated SSS, PhilHealth and Pag-IBIG rates
// payroll and reports use. Each call stands in for an HTTP request.

import { logAdmin } from "./admin/store";
import { addVersion, removeVersion, versionsOf, type Agency, type AgencyRates, type BirRates, type RateVersion, type TaxBracket } from "./reports/statutory";
import { deny } from "./session";

/** What is wrong with a tax table, if anything. */
function checkBrackets(rows: TaxBracket[]) {
  if (!rows.length) return "add at least one bracket";
  for (const r of rows) {
    if (![r.over, r.base, r.rate].every((n) => Number.isFinite(n) && n >= 0)) return "every amount must be a number, 0 or more";
    if (r.rate > 0.6) return "a rate looks too high; enter it as a percent, for example 15 for 15%";
  }
  for (let i = 1; i < rows.length; i++) if (rows[i]!.over <= rows[i - 1]!.over) return "brackets must go from lowest to highest pay";
  return null;
}

const DELAY = 200;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export const AGENCIES: { id: Agency; label: string }[] = [
  { id: "sss", label: "SSS" },
  { id: "philhealth", label: "PhilHealth" },
  { id: "pagibig", label: "Pag-IBIG" },
  { id: "bir", label: "BIR tax" },
];

export type FieldKind = "pct" | "peso";
export interface RateField {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
}

/** What each agency's rates mean, in the order the page shows them. */
export const RATE_FIELDS: { [A in Agency]: (RateField & { key: keyof AgencyRates[A] & string })[] } = {
  sss: [
    { key: "eeRate", label: "Employee share", kind: "pct", hint: "Of the monthly salary credit" },
    { key: "erRate", label: "Employer share", kind: "pct", hint: "Of the monthly salary credit" },
    { key: "mscMin", label: "Lowest salary credit", kind: "peso" },
    { key: "mscMax", label: "Highest salary credit", kind: "peso" },
    { key: "mscStep", label: "Salary credit step", kind: "peso", hint: "Pay is rounded to this bracket" },
    { key: "ecThreshold", label: "EC: higher rate from", kind: "peso", hint: "Salary credit where EC switches" },
    { key: "ecLow", label: "EC below that", kind: "peso", hint: "Employer only, per month" },
    { key: "ecHigh", label: "EC from that", kind: "peso", hint: "Employer only, per month" },
  ],
  philhealth: [
    { key: "rate", label: "Premium rate", kind: "pct", hint: "Split 50/50 between employee and employer" },
    { key: "floor", label: "Salary floor", kind: "peso" },
    { key: "ceiling", label: "Salary ceiling", kind: "peso" },
  ],
  pagibig: [
    { key: "eeRate", label: "Employee share", kind: "pct" },
    { key: "eeLowRate", label: "Employee share, low earners", kind: "pct" },
    { key: "lowLimit", label: "Low earner limit", kind: "peso", hint: "Monthly pay up to this uses the low rate" },
    { key: "erRate", label: "Employer share", kind: "pct" },
    { key: "maxFundSalary", label: "Maximum fund salary", kind: "peso", hint: "Contributions stop growing above this" },
  ],
  // Tax brackets are a table, edited row by row on the page.
  bir: [],
};

export function listVersions<A extends Agency>(agency: A): Promise<RateVersion<A>[]> {
  const denied = deny("contributions", "view");
  if (denied) return denied;
  return respond(versionsOf(agency));
}

const label = (a: Agency) => AGENCIES.find((x) => x.id === a)!.label;

export async function saveVersion<A extends Agency>(agency: A, input: { effectiveFrom: string; source: string; rates: AgencyRates[A] }, actor: string): Promise<RateVersion<A>> {
  const denied = deny("contributions", "create");
  if (denied) return denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return fail("Choose the date these rates take effect");
  if (!input.source.trim()) return fail("Name the source, for example the circular number");
  const rates = input.rates as unknown as Record<string, number>;
  for (const f of RATE_FIELDS[agency] as RateField[]) {
    const v = rates[f.key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return fail(`Enter a valid ${f.label.toLowerCase()}`);
    if (f.kind === "pct" && v > 0.5) return fail(`${f.label} looks too high. Enter it as a percent, for example 5 for 5%`);
  }
  if (agency === "sss" && (rates.mscMin! >= rates.mscMax! || rates.mscStep! <= 0)) return fail("Check the salary credit range and step");
  if (agency === "philhealth" && rates.floor! >= rates.ceiling!) return fail("The salary floor must be below the ceiling");
  if (agency === "bir") {
    const bir = input.rates as unknown as BirRates;
    for (const [name, table] of [["Monthly", bir.monthly], ["Semi-monthly", bir.semiMonthly]] as const) {
      const problem = checkBrackets(table);
      if (problem) return fail(`${name} table: ${problem}`);
    }
  }
  const existing = versionsOf(agency);
  const current = existing.find((v) => v.effectiveFrom <= new Date().toISOString().slice(0, 10));
  if (current && input.effectiveFrom < current.effectiveFrom) return fail(`Rates from ${current.effectiveFrom} already apply. New rates must take effect on or after that date.`);
  const v = addVersion(agency, input, actor);
  logAdmin({ actor, module: "Payroll", action: `Saved ${label(agency)} rates`, target: label(agency), detail: `Effective ${input.effectiveFrom} · ${input.source.trim()}` });
  return respond(v);
}

export async function deleteVersion(agency: Agency, id: string, actor: string): Promise<void> {
  const denied = deny("contributions", "delete");
  if (denied) return denied;
  const v = versionsOf(agency).find((x) => x.id === id);
  if (!v) return fail("That version no longer exists");
  if (!removeVersion(agency, id)) return fail("Rates already in force stay on record and can't be removed");
  logAdmin({ actor, module: "Payroll", action: `Removed upcoming ${label(agency)} rates`, target: label(agency), detail: `Effective ${v.effectiveFrom} · ${v.source}` });
  return respond(undefined);
}
