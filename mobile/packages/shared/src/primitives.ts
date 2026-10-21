import { z } from 'zod';

// ---------- Primitives ----------
export const MoneySchema = z
  .string()
  .regex(/^-?\d+\.\d{2}$/)
  .describe('PHP amount as a decimal string, e.g. "14862.50"');
export const InstantSchema = z
  .string()
  .describe('ISO-8601 UTC instant, e.g. "2026-09-25T00:02:11.000Z"');
export const DateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('Manila calendar date "YYYY-MM-DD"');
export const CutoffCodeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD..YYYY-MM-DD')
  .describe('Payroll cutoff "YYYY-MM-DD..YYYY-MM-DD"');
