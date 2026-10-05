// Government contribution and withholding tax rules, kept as dated data with
// their source. A new circular is a new entry, not a code change. Verify on the
// official site before using these for real pay.

export interface Rule<T> {
  effectiveFrom: string;
  source: string;
  lastVerified: string;
  rates: T;
}

export const SSS: Rule<{ eeRate: number; erRate: number; mscMin: number; mscMax: number; mscStep: number; ecLow: number; ecHigh: number; ecThreshold: number }> = {
  effectiveFrom: "2025-01-01",
  source: "SSS contribution schedule 2025 (sss.gov.ph)",
  lastVerified: "2026-09",
  rates: { eeRate: 0.05, erRate: 0.1, mscMin: 5000, mscMax: 35000, mscStep: 500, ecLow: 10, ecHigh: 30, ecThreshold: 15000 },
};

export const PHILHEALTH: Rule<{ rate: number; floor: number; ceiling: number }> = {
  effectiveFrom: "2024-01-01",
  source: "PhilHealth premium schedule (philhealth.gov.ph)",
  lastVerified: "2026-09",
  rates: { rate: 0.05, floor: 10000, ceiling: 100000 },
};

export const PAGIBIG: Rule<{ eeRate: number; eeLowRate: number; lowLimit: number; erRate: number; maxFundSalary: number }> = {
  effectiveFrom: "2024-02-01",
  source: "HDMF Circular (pagibigfund.gov.ph)",
  lastVerified: "2026-09",
  rates: { eeRate: 0.02, eeLowRate: 0.01, lowLimit: 1500, erRate: 0.02, maxFundSalary: 10000 },
};

export const BIR_MONTHLY: Rule<{ over: number; base: number; rate: number }[]> = {
  effectiveFrom: "2023-01-01",
  source: "BIR withholding tax table, RR 11-2018 as amended (TRAIN)",
  lastVerified: "2026-09",
  rates: [
    { over: 666_667, base: 183_541.8, rate: 0.35 },
    { over: 166_667, base: 33_541.8, rate: 0.3 },
    { over: 66_667, base: 8_541.8, rate: 0.25 },
    { over: 33_333, base: 1_875, rate: 0.2 },
    { over: 20_833, base: 0, rate: 0.15 },
  ],
};

export const BIR_SEMI_MONTHLY: Rule<{ over: number; base: number; rate: number }[]> = {
  ...BIR_MONTHLY,
  rates: [
    { over: 333_333, base: 91_770.7, rate: 0.35 },
    { over: 83_333, base: 16_770.7, rate: 0.3 },
    { over: 33_333, base: 4_270.7, rate: 0.25 },
    { over: 16_667, base: 937.5, rate: 0.2 },
    { over: 10_417, base: 0, rate: 0.15 },
  ],
};

/** Non-taxable ceiling for 13th month and other benefits. */
export const THIRTEENTH_MONTH_EXEMPT = 90_000;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly Salary Credit: the ₱500 bracket the pay falls in, within the floor and ceiling. */
export function sssMsc(monthly: number) {
  const r = SSS.rates;
  if (monthly <= 0) return 0;
  const msc = Math.round(monthly / r.mscStep) * r.mscStep;
  return Math.min(r.mscMax, Math.max(r.mscMin, msc));
}

/** Monthly SSS: employee share, employer share and Employees' Compensation (employer only). */
export function sss(monthly: number) {
  const msc = sssMsc(monthly);
  if (!msc) return { msc: 0, ee: 0, er: 0, ec: 0 };
  return { msc, ee: round2(msc * SSS.rates.eeRate), er: round2(msc * SSS.rates.erRate), ec: msc < SSS.rates.ecThreshold ? SSS.rates.ecLow : SSS.rates.ecHigh };
}

/** Monthly PhilHealth premium, split 50/50. */
export function philhealth(monthly: number) {
  if (monthly <= 0) return { ee: 0, er: 0 };
  const r = PHILHEALTH.rates;
  const half = round2((Math.min(r.ceiling, Math.max(r.floor, monthly)) * r.rate) / 2);
  return { ee: half, er: half };
}

/** Monthly Pag-IBIG, on pay up to the Maximum Fund Salary. */
export function pagibig(monthly: number) {
  if (monthly <= 0) return { ee: 0, er: 0 };
  const r = PAGIBIG.rates;
  const base = Math.min(monthly, r.maxFundSalary);
  return { ee: round2(base * (monthly <= r.lowLimit ? r.eeLowRate : r.eeRate)), er: round2(base * r.erRate) };
}

export function withholding(taxable: number, period: "monthly" | "semi-monthly") {
  const table = period === "monthly" ? BIR_MONTHLY.rates : BIR_SEMI_MONTHLY.rates;
  const b = table.find((x) => taxable > x.over);
  return b ? round2(b.base + (taxable - b.over) * b.rate) : 0;
}
