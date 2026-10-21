import Decimal from 'decimal.js';

/**
 * Money rules (see CLAUDE.md):
 * - Stored as NUMERIC(14,2); handled as decimal.js in code; never JS floats.
 * - Displayed as Philippine peso, e.g. ₱14,862.50.
 */
export { Decimal };

export type MoneyInput = Decimal | string | number | { toString(): string };

export function money(value: MoneyInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(value.toString());
}

/** Round to centavos, half-up (standard for payroll amounts). */
export function roundMoney(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, v) => total.plus(money(v)), new Decimal(0));
}

/** Serialise for JSON / API responses: always a string with 2 decimals, e.g. "14862.50". */
export function moneyString(value: MoneyInput): string {
  return roundMoney(value).toFixed(2);
}

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format as PHP, e.g. formatPHP("14862.5") => "₱14,862.50". */
export function formatPHP(value: MoneyInput): string {
  // Intl.NumberFormat accepts decimal strings exactly (ES2023); older engines coerce
  // to number, which is safe for display after rounding to centavos.
  return phpFormatter.format(roundMoney(value).toFixed(2) as unknown as number);
}
