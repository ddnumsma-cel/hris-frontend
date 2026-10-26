import { describe, expect, it } from 'vitest';
import { formatPHP } from './money';
import {
  computePayslip,
  monthlyEquivalent,
  PayrollDay,
  SAMPLE_STATUTORY_RATES as RATES,
  withholdingTax,
} from './payroll';

const day = (over: Partial<PayrollDay> = {}): PayrollDay => ({
  status: 'PRESENT',
  holidayType: null,
  paidLeave: true,
  lateMinutes: 0,
  undertimeMinutes: 0,
  otMinutes: 0,
  nightDiffMinutes: 0,
  ...over,
});
const present = (n: number) => Array.from({ length: n }, () => day());

/** Serialise a computation to peso strings for readable golden assertions. */
function pesos(p: ReturnType<typeof computePayslip>) {
  return {
    daysPaid: p.daysPaid.toFixed(1),
    basic: formatPHP(p.basicPay),
    ot: formatPHP(p.overtimePay),
    nd: formatPHP(p.nightDiffPay),
    holiday: formatPHP(p.holidayPay),
    lateUt: formatPHP(p.lateUndertimeDeduction),
    gross: formatPHP(p.grossPay),
    sss: formatPHP(p.sss),
    philhealth: formatPHP(p.philhealth),
    pagibig: formatPHP(p.pagibig),
    tax: formatPHP(p.withholdingTax),
    deductions: formatPHP(p.totalDeductions),
    net: formatPHP(p.netPay),
  };
}

describe('payroll preview golden cases (SAMPLE rates)', () => {
  it('minimum-rate employee, 13 full days, below the tax threshold', () => {
    // monthly = 610 × 313 / 12 = 15,910.83 → SSS MSC 16,000
    const p = computePayslip({ dailyRate: '610.00', days: present(13), rates: RATES });
    expect(p.monthlyEquivalent.toFixed(2)).toBe('15910.83');
    expect(pesos(p)).toEqual({
      daysPaid: '13.0',
      basic: '₱7,930.00',
      ot: '₱0.00',
      nd: '₱0.00',
      holiday: '₱0.00',
      lateUt: '₱0.00',
      gross: '₱7,930.00',
      sss: '₱400.00',
      philhealth: '₱198.89',
      pagibig: '₱100.00',
      tax: '₱0.00',
      deductions: '₱698.89',
      net: '₱7,231.11',
    });
  });

  it('OT at +25%, 30 minutes late = half day, regular holiday worked (200%) and unworked (100%), paid leave, absence', () => {
    const days: PayrollDay[] = [
      day({ otMinutes: 130, lateMinutes: 30 }),
      ...present(9),
      day({ holidayType: 'REGULAR' }), // worked regular holiday
      day({ status: 'HOLIDAY', holidayType: 'REGULAR' }), // unworked regular holiday, still paid
      day({ status: 'LEAVE' }),
      day({ status: 'ABSENT' }),
      day({ status: 'RESTDAY' }),
    ];
    const p = computePayslip({ dailyRate: '1150.00', days, rates: RATES });
    expect(pesos(p)).toEqual({
      daysPaid: '13.0',
      basic: '₱13,800.00', // 12 paid working days × 1,150
      ot: '₱389.32', // 1,150 / 480 × 1.25 × 130
      nd: '₱0.00',
      holiday: '₱2,300.00', // +100% worked + 100% unworked
      lateUt: '₱575.00', // 30 minutes late = half a day (workbook), not 1,150 / 480 × 30
      gross: '₱15,914.32',
      sss: '₱750.00',
      philhealth: '₱374.95',
      pagibig: '₱100.00',
      tax: '₱640.86', // 15% of (14,689.37 − 10,417)
      deductions: '₱1,865.81',
      net: '₱14,048.51',
    });
  });

  it('every 3rd late under 30 minutes in the cut-off = a day absent; undertime = a flat 4 hours', () => {
    const late = (m: number) => day({ lateMinutes: m });
    const lateUt = (days: PayrollDay[]) => formatPHP(computePayslip({ dailyRate: '1000.00', days, rates: RATES }).lateUndertimeDeduction);
    expect(lateUt([late(10), late(10), ...present(11)])).toBe('₱0.00'); // 2 lates: nothing
    expect(lateUt([late(10), late(10), late(10), ...present(10)])).toBe('₱1,000.00'); // 3rd late: a day
    expect(lateUt([late(10), late(45), late(10), ...present(10)])).toBe('₱500.00'); // 45 min = half day, not one of the 3
    expect(lateUt([day({ undertimeMinutes: 15 }), ...present(12)])).toBe('₱500.00'); // any undertime = 4 h
  });

  it('highest-rate employee hits the SSS ceiling and the 20% tax bracket', () => {
    const p = computePayslip({ dailyRate: '2500.00', days: present(13), rates: RATES });
    expect(pesos(p)).toMatchObject({
      gross: '₱32,500.00',
      sss: '₱875.00', // MSC capped at 35,000
      philhealth: '₱815.10',
      pagibig: '₱100.00', // capped
      tax: '₱3,746.08', // 937.50 + 20% of (30,709.90 − 16,667)
      deductions: '₱5,536.18',
      net: '₱26,963.82',
    });
  });

  it('night differential is +10% of the hourly rate', () => {
    const p = computePayslip({
      dailyRate: '800.00',
      days: [day({ nightDiffMinutes: 60 })],
      rates: RATES,
    });
    expect(formatPHP(p.nightDiffPay)).toBe('₱10.00');
  });

  it('special non-working day worked adds 30%', () => {
    const p = computePayslip({
      dailyRate: '1000.00',
      days: [day({ holidayType: 'SPECIAL' })],
      rates: RATES,
    });
    expect(formatPHP(p.holidayPay)).toBe('₱300.00');
  });

  it('no days means no pay and no tax', () => {
    const p = computePayslip({ dailyRate: '900.00', days: [], rates: RATES });
    expect(p.grossPay.toFixed(2)).toBe('0.00');
    expect(p.withholdingTax.toFixed(2)).toBe('0.00');
  });

  it('marks every sample statutory table as unverified', () => {
    expect(Object.values(RATES).every((r) => r.verified === false)).toBe(true);
  });
});

describe('withholding tax table (semi-monthly)', () => {
  it('is continuous at bracket edges', () => {
    expect(withholdingTax('10417', RATES.withholdingTax).toFixed(2)).toBe('0.00');
    expect(withholdingTax('16667', RATES.withholdingTax).toFixed(2)).toBe('937.50');
    expect(withholdingTax('33333', RATES.withholdingTax).toFixed(2)).toBe('4270.70');
  });

  it('uses the monthly equivalent of a 6-day work week', () => {
    expect(monthlyEquivalent('1200').toFixed(2)).toBe('31300.00');
  });
});
