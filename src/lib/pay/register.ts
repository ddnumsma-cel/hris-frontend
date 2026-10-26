// MSMA's FT_MSMA payroll register for the Sep 11 – 25, 2026 cut-off (Payroll Template - Sample_1.xlsx,
// sheets FT_MSMA, C and D). For that cut-off a run takes each person's figures from the register as they
// are, so every take-home matches the file to the centavo; other cut-offs are computed (lib/pay/engine.ts).
//
// Loans and cash advances aren't here: they come off as the seeded loans' installments (lib/pay/loanStore.ts),
// which are the register's amounts. The register's "Statutory Deductions" column includes the SSS and
// Pag-IBIG loans; `sss` + `philhealth` + `pagibig` are the contributions alone (sheet C).

import { MSMA_ROSTER } from "../msmaRoster";
import type { PayResult } from "./engine";

export interface RegisterRow {
  /** Holiday and premium pay. */
  premium: number;
  /** OT, NSD and OT meal. */
  overtime: number;
  /** Absences, lates and undertime. */
  absences: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  /** Contributions plus SSS / Pag-IBIG loans, as the register shows them. */
  statutory: number;
  deMinimis: number;
  otherNonTaxable: number;
  taxable: number;
  /** Withholding tax as the register has it (sheet D). */
  tax: number;
  cashAdvance: number;
  /** Other adjustments: the transportation allowance. */
  adjustments: number;
  /** Net pay in the register, for checking. */
  net: number;
}

export const REGISTER_PERIOD = { from: "2026-09-11", to: "2026-09-25" };

/** Keyed "Last, First" as in the register. */
const ROWS: Record<string, RegisterRow> = {
  "Santos, Lorraine": {premium: 0, overtime: 0, absences: 0, sss: 875, philhealth: 584.38, pagibig: 100, statutory: 1559.38, deMinimis: 3700, otherNonTaxable: 5969.7, taxable: 13705.3, tax: 937.5, cashAdvance: 3718.75, adjustments: 0, net: 17159.37},
  "Hernandez, Teresa": {premium: 0, overtime: 0, absences: 0, sss: 875, philhealth: 762.5, pagibig: 100, statutory: 2630, deMinimis: 3700, otherNonTaxable: 4994.7, taxable: 21805.3, tax: 1708.25, cashAdvance: 0, adjustments: 0, net: 26161.75},
  "Lopez, Irene": {premium: 0, overtime: 0, absences: 0, sss: 800, philhealth: 403.12, pagibig: 100, statutory: 1957.62, deMinimis: 3700, otherNonTaxable: 2444.7, taxable: 9980.3, tax: 0, cashAdvance: 0, adjustments: 0, net: 14167.38},
  "Estrada, Liza": {premium: 1143.09, overtime: 0, absences: 0, sss: 637.5, philhealth: 318.75, pagibig: 100, statutory: 2079.47, deMinimis: 3700, otherNonTaxable: 0, taxable: 10193.09, tax: 0, cashAdvance: 1190, adjustments: 0, net: 10623.62},
  "Gatchalian, Dennis": {premium: 0, overtime: 0, absences: 0, sss: 475, philhealth: 234.38, pagibig: 100, statutory: 2009.99, deMinimis: 1217, otherNonTaxable: 0, taxable: 8158, tax: 0, cashAdvance: 0, adjustments: 0, net: 7365.01},
  "Castillo, Nathan": {premium: 0, overtime: 0, absences: 0, sss: 875, philhealth: 534.38, pagibig: 100, statutory: 1509.38, deMinimis: 3700, otherNonTaxable: 1406.25, taxable: 16268.75, tax: 877.76, cashAdvance: 0, adjustments: 2975, net: 21962.86},
  "Ramos, Arlene": {premium: 0, overtime: 0, absences: 0, sss: 0, philhealth: 0, pagibig: 0, statutory: 0, deMinimis: 0, otherNonTaxable: 0, taxable: 23375, tax: 0, cashAdvance: 0, adjustments: 0, net: 23375},
  "Mangubat, Victor": {premium: 466.96, overtime: 1189.85, absences: 0, sss: 775, philhealth: 390.62, pagibig: 100, statutory: 1265.62, deMinimis: 3700, otherNonTaxable: 1968.75, taxable: 11613.06, tax: 179.41, cashAdvance: 0, adjustments: 2000, net: 17836.78},
  "Enriquez, Katrina": {premium: 2248.79, overtime: 363.27, absences: 0, sss: 537.5, philhealth: 268.75, pagibig: 100, statutory: 906.25, deMinimis: 3700, otherNonTaxable: 1687.5, taxable: 7974.56, tax: 0, cashAdvance: 0, adjustments: 0, net: 12455.81},
  "Aquino, Andrea Joy": {premium: 0, overtime: 0, absences: 0, sss: 775, philhealth: 387.5, pagibig: 100, statutory: 1262.5, deMinimis: 3700, otherNonTaxable: 1912.5, taxable: 9887.5, tax: 0, cashAdvance: 0, adjustments: 1785, net: 16022.5},
  "Jimenez, Trisha Mae": {premium: 0, overtime: 0, absences: 0, sss: 362.5, philhealth: 181.25, pagibig: 100, statutory: 643.75, deMinimis: 3217, otherNonTaxable: 0, taxable: 4033, tax: 0, cashAdvance: 0, adjustments: 1785, net: 8391.25},
  "Feliciano, Ivan Luis": {premium: 0, overtime: 609.53, absences: 0, sss: 775, philhealth: 387.5, pagibig: 100, statutory: 1262.5, deMinimis: 3700, otherNonTaxable: 1912.5, taxable: 10497.03, tax: 12, cashAdvance: 0, adjustments: 1785, net: 16620.03},
  "Ocampo, Gino": {premium: 0, overtime: 0, absences: 0, sss: 525, philhealth: 262.5, pagibig: 100, statutory: 887.5, deMinimis: 3700, otherNonTaxable: 1912.5, taxable: 4887.5, tax: 0, cashAdvance: 0, adjustments: 0, net: 9612.5},
  "Cabrera, Marvin": {premium: 941.38, overtime: 0, absences: 0, sss: 525, philhealth: 262.5, pagibig: 100, statutory: 887.5, deMinimis: 3217, otherNonTaxable: 0, taxable: 8224.38, tax: 0, cashAdvance: 0, adjustments: 0, net: 10553.88},
  "Marquez, Dominic": {premium: 0, overtime: 0, absences: 0, sss: 400, philhealth: 203.12, pagibig: 100, statutory: 703.12, deMinimis: 3217, otherNonTaxable: 0, taxable: 4908, tax: 0, cashAdvance: 0, adjustments: 0, net: 7421.88},
  "Domingo, Francis Ian": {premium: 0, overtime: 0, absences: 0, sss: 0, philhealth: 0, pagibig: 0, statutory: 0, deMinimis: 0, otherNonTaxable: 0, taxable: 0, tax: 0, cashAdvance: 0, adjustments: 0, net: 0},
  "Pascual, Benedict": {premium: 0, overtime: 0, absences: 0, sss: 362.5, philhealth: 181.25, pagibig: 100, statutory: 643.75, deMinimis: 3217, otherNonTaxable: 0, taxable: 4033, tax: 0, cashAdvance: 0, adjustments: 0, net: 6606.25},
  "Alcantara, Paolo": {premium: 0, overtime: 0, absences: 0, sss: 362.5, philhealth: 181.25, pagibig: 100, statutory: 643.75, deMinimis: 3217, otherNonTaxable: 0, taxable: 4033, tax: 0, cashAdvance: 0, adjustments: 0, net: 6606.25},
  "Navarro, Olive": {premium: 0, overtime: 0, absences: 0, sss: 575, philhealth: 290.62, pagibig: 100, statutory: 965.62, deMinimis: 3217, otherNonTaxable: 0, taxable: 8408, tax: 0, cashAdvance: 0, adjustments: 595, net: 11254.38},
  "Lagman, Harold": {premium: 0, overtime: 0, absences: 0, sss: 375, philhealth: 187.5, pagibig: 100, statutory: 662.5, deMinimis: 3217, otherNonTaxable: 0, taxable: 4283, tax: 0, cashAdvance: 0, adjustments: 1190, net: 8027.5},
  "Nepomuceno, Sheila": {premium: 0, overtime: 0, absences: 0, sss: 425, philhealth: 209.38, pagibig: 100, statutory: 734.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 5158, tax: 0, cashAdvance: 0, adjustments: 0, net: 7640.62},
  "Mercado, Rachel Ann": {premium: 0, overtime: 0, absences: 0, sss: 362.5, philhealth: 181.25, pagibig: 100, statutory: 643.75, deMinimis: 3217, otherNonTaxable: 0, taxable: 4033, tax: 0, cashAdvance: 0, adjustments: 0, net: 6606.25},
  "Fajardo, Hannah Mae": {premium: 280.18, overtime: 0, absences: 0, sss: 475, philhealth: 234.38, pagibig: 100, statutory: 809.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 6438.18, tax: 0, cashAdvance: 0, adjustments: 0, net: 8845.8},
  "Escobar, Isabel": {premium: 0, overtime: 1149.38, absences: 0, sss: 400, philhealth: 200, pagibig: 100, statutory: 700, deMinimis: 3217, otherNonTaxable: 0, taxable: 5932.38, tax: 0, cashAdvance: 0, adjustments: 1190, net: 9639.38},
  "Legaspi, Cedric": {premium: 0, overtime: 0, absences: 0, sss: 450, philhealth: 225, pagibig: 100, statutory: 775, deMinimis: 3217, otherNonTaxable: 0, taxable: 5783, tax: 0, cashAdvance: 0, adjustments: 0, net: 8225},
  "Ignacio, Pauline": {premium: 0, overtime: 0, absences: 0, sss: 725, philhealth: 359.38, pagibig: 100, statutory: 1184.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 11158, tax: 111.15, cashAdvance: 0, adjustments: 3500, net: 16579.47},
  "Guevarra, Camille Therese": {premium: 1479.35, overtime: 2023.05, absences: 0, sss: 550, philhealth: 275, pagibig: 100, statutory: 925, deMinimis: 3217, otherNonTaxable: 0, taxable: 11285.4, tax: 130.26, cashAdvance: 0, adjustments: 1190, net: 14637.14},
  "Canlas, Patricia Anne": {premium: 0, overtime: 603.45, absences: 0, sss: 350, philhealth: 175, pagibig: 100, statutory: 625, deMinimis: 3217, otherNonTaxable: 0, taxable: 4386.45, tax: 0, cashAdvance: 0, adjustments: 0, net: 6978.45},
  "Arcilla, Bianca Louise": {premium: 0, overtime: 0, absences: 0, sss: 725, philhealth: 359.38, pagibig: 100, statutory: 1184.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 11158, tax: 111.15, cashAdvance: 0, adjustments: 0, net: 13079.47},
  "Cortez, Regine": {premium: 999.31, overtime: 1518.18, absences: 0, sss: 675, philhealth: 334.38, pagibig: 100, statutory: 1109.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 12675.49, tax: 338.77, cashAdvance: 0, adjustments: 0, net: 14444.34},
  "Pacheco, Mika": {premium: 900.2, overtime: 0, absences: 0, sss: 500, philhealth: 253.12, pagibig: 100, statutory: 853.12, deMinimis: 1217, otherNonTaxable: 0, taxable: 9808.2, tax: 0, cashAdvance: 0, adjustments: 0, net: 10172.08},
  "Abad, Carlo Miguel": {premium: 0, overtime: 0, absences: 0, sss: 450, philhealth: 225, pagibig: 100, statutory: 775, deMinimis: 3217, otherNonTaxable: 0, taxable: 5783, tax: 0, cashAdvance: 0, adjustments: 0, net: 8225},
  "Francisco, Leo": {premium: 0, overtime: 0, absences: 0, sss: 425, philhealth: 215.62, pagibig: 100, statutory: 740.62, deMinimis: 3217, otherNonTaxable: 0, taxable: 5408, tax: 0, cashAdvance: 0, adjustments: 0, net: 7884.38},
  "Bacani, Kevin Paul": {premium: 0, overtime: 0, absences: 0, sss: 562.5, philhealth: 281.25, pagibig: 100, statutory: 943.75, deMinimis: 1217, otherNonTaxable: 0, taxable: 10033, tax: 0, cashAdvance: 0, adjustments: 0, net: 10306.25},
  "Quinto, Gwen": {premium: 2899.79, overtime: 589.04, absences: 0, sss: 725, philhealth: 359.38, pagibig: 100, statutory: 1184.38, deMinimis: 3217, otherNonTaxable: 0, taxable: 14646.83, tax: 634.47, cashAdvance: 0, adjustments: 0, net: 16044.98},
  "Dizon, Samuel James": {premium: 0, overtime: 1165.59, absences: 0, sss: 737.5, philhealth: 368.75, pagibig: 100, statutory: 1206.25, deMinimis: 3217, otherNonTaxable: 0, taxable: 12698.59, tax: 342.24, cashAdvance: 0, adjustments: 0, net: 14367.1},
  "Calderon, Oscar": {premium: 0, overtime: 0, absences: 0, sss: 362.5, philhealth: 0, pagibig: 100, statutory: 462.5, deMinimis: 3217, otherNonTaxable: 0, taxable: 4033, tax: 0, cashAdvance: 0, adjustments: 0, net: 6787.5},
  "Panganiban, Albert John": {premium: 0, overtime: 0, absences: 1011.52, sss: 550, philhealth: 275, pagibig: 0, statutory: 825, deMinimis: 1217, otherNonTaxable: 0, taxable: 8771.48, tax: 0, cashAdvance: 0, adjustments: 0, net: 9163.48},
  "Bernardo, Danica": {premium: 463.22, overtime: 1647.99, absences: 0, sss: 387.5, philhealth: 193.75, pagibig: 100, statutory: 681.25, deMinimis: 1217, otherNonTaxable: 0, taxable: 8644.21, tax: 0, cashAdvance: 0, adjustments: 892.5, net: 10072.46},
  "Evangelista, Gerald": {premium: 0, overtime: 0, absences: 0, sss: 737.5, philhealth: 0, pagibig: 100, statutory: 837.5, deMinimis: 3217, otherNonTaxable: 0, taxable: 11533, tax: 167.4, cashAdvance: 0, adjustments: 0, net: 13745.1},
  "Lacson, Wendy": {premium: 0, overtime: 0, absences: 0, sss: 550, philhealth: 275, pagibig: 100, statutory: 925, deMinimis: 1217, otherNonTaxable: 0, taxable: 9783, tax: 0, cashAdvance: 0, adjustments: 0, net: 10075},
  "Buenaventura, Clarisse": {premium: 0, overtime: 0, absences: 0, sss: 337.5, philhealth: 168.75, pagibig: 100, statutory: 606.25, deMinimis: 1217, otherNonTaxable: 0, taxable: 5533, tax: 0, cashAdvance: 0, adjustments: 0, net: 6143.75},
  "Medina, Stephen": {premium: 0, overtime: 484.91, absences: 0, sss: 0, philhealth: 0, pagibig: 0, statutory: 0, deMinimis: 1217, otherNonTaxable: 0, taxable: 10517.91, tax: 15.14, cashAdvance: 0, adjustments: 0, net: 11719.77},
  "Quiambao, Noel": {premium: 0, overtime: 0, absences: 8919.68, sss: 0, philhealth: 0, pagibig: 0, statutory: 0, deMinimis: 1217, otherNonTaxable: 0, taxable: 1988.32, tax: 0, cashAdvance: 0, adjustments: 0, net: 3205.32},
  "Macaraeg, Jasper": {premium: 0, overtime: 0, absences: 8275.84, sss: 0, philhealth: 0, pagibig: 0, statutory: 0, deMinimis: 1217, otherNonTaxable: 0, taxable: 1757.16, tax: 0, cashAdvance: 0, adjustments: 0, net: 2974.16},
};

const byId = new Map(MSMA_ROSTER.map((r) => [r.id, ROWS[`${r.lastName}, ${r.firstName}`]]));

/** The register's figures for this person, when the cut-off is the register's. */
export function registerRow(employeeId: string, from: string, to: string): RegisterRow | undefined {
  if (from !== REGISTER_PERIOD.from || to !== REGISTER_PERIOD.to) return undefined;
  return byId.get(employeeId);
}

/** Register names with no matching person (should be none). */
export const unmatchedRegisterRows = () => Object.keys(ROWS).filter((name) => !MSMA_ROSTER.some((r) => `${r.lastName}, ${r.firstName}` === name));

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Replaces the computed money with the register's, keeping this run's own adjustments (loans, cash advance, anything added by hand). */
export function applyRegister(pay: PayResult, row: RegisterRow): PayResult {
  const contributions = round2(row.sss + row.philhealth + row.pagibig);
  // People the register charges no contributions for have no employer share either.
  const er = contributions > 0;
  const gross = round2(pay.basic + row.premium + row.overtime - row.absences + pay.taxableAdjustments);
  return {
    ...pay,
    fromRegister: true,
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 0,
    overtimeDays: 0,
    premiumMinutes: 0,
    nightMinutes: 0,
    absentDays: 0,
    lateAbsentDays: 0,
    absentHours: 0,
    awolDays: 0,
    awolDates: [],
    absentDeduction: row.absences,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    halfDays: 0,
    halfDayHours: 0,
    halfDayDeduction: 0,
    undertimeDays: 0,
    undertimeHours: 0,
    undertimeDeduction: 0,
    overtimePay: row.overtime,
    otMeal: 0,
    premiumPay: row.premium,
    nightPay: 0,
    transportAllowance: row.adjustments,
    deMinimis: row.deMinimis,
    otherNonTaxable: row.otherNonTaxable,
    gross,
    sssEe: row.sss,
    sssEr: er ? pay.sssEr : 0,
    ec: er ? pay.ec : 0,
    phEe: row.philhealth,
    phEr: er ? row.philhealth : 0,
    piEe: row.pagibig,
    piEr: er ? pay.piEr : 0,
    contributions,
    taxable: round2(row.taxable + pay.taxableAdjustments),
    tax: row.tax,
    net: round2(gross - contributions - row.tax + row.adjustments + pay.nonTaxableAdjustments),
  };
}
