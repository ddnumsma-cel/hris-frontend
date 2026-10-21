// Reading a typed time of day (the time pickers in components/form).

/** "17:04", "1704" or "7:4" → "17:04"; null when it isn't a time of day. */
export function parseTime(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2}):?(\d{2})$/) ?? text.trim().match(/^(\d{1,2}):(\d{1})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}
