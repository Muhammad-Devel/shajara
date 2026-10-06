const PARTIAL_ISO = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Parses "YYYY", "YYYY-MM" or "YYYY-MM-DD" to UTC ms (earliest instant of that period). Returns null if invalid. */
export function parsePartialDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = PARTIAL_ISO.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  // reject overflow such as 1950-02-31
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return ms;
}

/** Latest instant of a partial date ("1950" → 1950-12-31). Used when we must not accuse the user of an error. */
export function latestInstant(value: string | null | undefined): number | null {
  const start = parsePartialDate(value);
  if (start === null || !value) return null;
  const parts = value.split("-").length;
  const d = new Date(start);
  if (parts === 1) return Date.UTC(d.getUTCFullYear() + 1, 0, 1) - 1;
  if (parts === 2) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
  return start;
}

export const DAY_MS = 86_400_000;
