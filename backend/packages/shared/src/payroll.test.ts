import { describe, expect, it } from 'vitest';
import { formatPHP } from './money';
import {
  computePayslip,
  PayrollDay,
  philhealthEmployeeShare,
  SAMPLE_STATUTORY_RATES as RATES,
  sssEmployeeShare,
  withholdingTax,
} from './payroll';
import { addDays } from './time';

// Cut-off Oct 11–25, 2026 (Oct 11 is a Sunday). ₱26,100 a month → daily ₱1,200, hourly ₱150 (MSMA's workbook, sheet B).
const CUTOFF = { from: '2026-10-11', to: '2026-10-25' };
const MONTHLY = '26100';
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** Every Monday–Friday of the cut-off present, other days rest days; `over` changes single dates. */
function cutoff(over: Record<string, Partial<PayrollDay>> = {}): PayrollDay[] {
  const days: PayrollDay[] = [];
  for (let d = CUTOFF.from; d <= CUTOFF.to; d = addDays(d, 1)) {
    const rest = [0, 6].includes(weekday(d));
    days.push({
      date: d,
      status: rest ? 'RESTDAY' : 'PRESENT',
      restDay: rest,
      lateMinutes: 0,
      undertimeMinutes: 0,
      otMinutes: 0,
      nightDiffMinutes: 0,
      workedMinutes: rest ? 0 : 480,
      ...over[d],
    });
  }
  return days;
}
const pay = (days: PayrollDay[], extra: Partial<Parameters<typeof computePayslip>[0]> = {}) =>
  computePayslip({ monthlySalary: MONTHLY, days, rates: RATES, cutoff: CUTOFF, hireDate: '2020-01-06', ...extra });
const php = formatPHP;

describe("payroll follows MSMA's payroll workbook", () => {
  it('a full cut-off: half the monthly salary; contributions on the monthly pay; tax without taking contributions off', () => {
    const p = pay(cutoff());
    expect(p.dailyRate.toFixed(2)).toBe('1200.00'); // 26,100 × 12 ÷ 261
    expect(p.hourlyRate.toFixed(2)).toBe('150.00');
    expect({
      basic: php(p.basicPay),
      sss: php(p.sss), // MSC 26,000 × 5% = 1,300 a month, half
      philhealth: php(p.philhealth), // 26,100 × 2.5% = 652.50 a month, half
      pagibig: php(p.pagibig), // 10,000 × 2% = 200 a month, half
      tax: php(p.withholdingTax), // 15% of (13,050 − 10,417)
      net: php(p.netPay),
    }).toEqual({
      basic: '₱13,050.00',
      sss: '₱650.00',
      philhealth: '₱326.25',
      pagibig: '₱100.00',
      tax: '₱394.95',
      net: '₱11,578.80',
    });
  });

  it('sheet B: absent 8 h, 30+ min late a half day, every 3rd shorter late a day absent, undertime a flat 4 h', () => {
    const p = pay(
      cutoff({
        '2026-10-12': { lateMinutes: 10 },
        '2026-10-13': { lateMinutes: 10 },
        '2026-10-14': { lateMinutes: 10 }, // 3rd late in the cut-off: a day absent
        '2026-10-15': { lateMinutes: 40 }, // 9:10 on an 8:30 shift: a half day, not one of the 3
        '2026-10-16': { undertimeMinutes: 15 }, // any undertime: 4 h
        '2026-10-19': { status: 'ABSENT', workedMinutes: 0 },
      }),
    );
    expect(p.absentHours).toBe(16);
    expect(p.halfDayHours).toBe(4);
    expect(p.undertimeHours).toBe(4);
    expect(php(p.lateUndertimeDeduction)).toBe('₱3,600.00'); // 24 h × 150
    expect(php(p.grossPay)).toBe('₱9,450.00');
  });

  it('two lates cost nothing; the 3rd in another week of the same cut-off still makes a day absent', () => {
    expect(php(pay(cutoff({ '2026-10-12': { lateMinutes: 10 }, '2026-10-13': { lateMinutes: 10 } })).lateUndertimeDeduction)).toBe('₱0.00');
    const p = pay(cutoff({ '2026-10-15': { lateMinutes: 10 }, '2026-10-16': { lateMinutes: 10 }, '2026-10-19': { lateMinutes: 10 } }));
    expect(php(p.lateUndertimeDeduction)).toBe('₱1,200.00');
  });

  it('sheet A: rest day worked, first 8 h at 1.3; 2 approved hours past 8 at 1.69', () => {
    const p = pay(cutoff({ '2026-10-17': { status: 'PRESENT', workedMinutes: 600, otMinutes: 120 } }));
    expect(php(p.holidayPay)).toBe('₱1,560.00'); // 480 min × 2.50 × 1.3
    expect(php(p.overtimePay)).toBe('₱507.00'); // 120 min × 2.50 × 1.69
  });

  it('sheet A: approved overtime on an ordinary day at 1.25; night hours inside it at 1.375; other night hours +10%', () => {
    const p = pay(cutoff({ '2026-10-12': { otMinutes: 60 }, '2026-10-13': { otMinutes: 60, nightDiffMinutes: 90 } }));
    // Oct 12: 60 OT min × 2.50 × 1.25 = 187.50. Oct 13: 60 night OT min × 2.50 × 1.375 = 206.25, and the other
    // 30 night min × 2.50 × 10% = 7.50.
    expect(php(p.overtimePay)).toBe('₱393.75');
    expect(php(p.nightDiffPay)).toBe('₱7.50');
  });

  it('a regular holiday worked on a workday is paid at 200% on top of the half month', () => {
    const p = pay(cutoff({ '2026-10-12': { holidayType: 'REGULAR', workedMinutes: 480 } }));
    expect(php(p.holidayPay)).toBe('₱2,400.00');
    expect(php(p.lateUndertimeDeduction)).toBe('₱0.00');
  });

  it('a mid-cut-off hire: the half month less 8 h for each workday before the start, and no contributions yet', () => {
    const p = pay(cutoff(), { hireDate: '2026-10-15' }); // Oct 12, 13, 14 not yet employed
    expect(php(p.basicPay)).toBe('₱9,450.00'); // 13,050 − 3 × 8 × 150
    expect(php(p.sss) + php(p.philhealth) + php(p.pagibig)).toBe('₱0.00₱0.00₱0.00');
  });

  it('unpaid leave costs the day; paid leave costs nothing', () => {
    expect(php(pay(cutoff({ '2026-10-12': { status: 'LEAVE', paidLeave: false } })).lateUndertimeDeduction)).toBe('₱1,200.00');
    expect(php(pay(cutoff({ '2026-10-12': { status: 'LEAVE' } })).lateUndertimeDeduction)).toBe('₱0.00');
  });

  it("contributions match the workbook's sheet C (Santos: ₱1,559.38 on ₱46,750)", () => {
    const monthly = '46750';
    const total = sssEmployeeShare(monthly, RATES.sss)
      .plus(philhealthEmployeeShare(monthly, RATES.philhealth))
      .plus(100);
    expect(php(total)).toBe('₱1,559.38'); // SSS 875 (MSC capped at 35,000) + PhilHealth 584.375 → 584.38 + Pag-IBIG 100
    // PhilHealth halves go to the even centavo: 32,250 × 2.5% = 806.25 a month → 403.125 → 403.12
    expect(php(philhealthEmployeeShare('32250', RATES.philhealth))).toBe('₱403.12');
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
});
