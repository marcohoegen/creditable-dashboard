// Date-range helper for the dashboard. Ranges are historical windows ending
// today, with a matching previous window for period-over-period deltas.

export type RangeKey = "7" | "30" | "90";
export const RANGE_KEYS: RangeKey[] = ["7", "30", "90"];

export function rangeLabel(key: RangeKey): string {
  return `Last ${key} days`;
}

export function parseRange(value: string | undefined): RangeKey {
  return value === "7" || value === "90" ? value : "30";
}

export interface ResolvedRange {
  key: RangeKey;
  days: number;
  fromISO: string;
  toISO: string;
  prevFromISO: string;
  prevToISO: string;
}

const MS_PER_DAY = 86_400_000;

export function resolveRange(
  key: RangeKey,
  now: Date = new Date(),
): ResolvedRange {
  const days = Number(key);
  const todayKey = now.toISOString().slice(0, 10);
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`).getTime();

  const fromMs = todayStart - (days - 1) * MS_PER_DAY;
  const toMs = todayStart + MS_PER_DAY - 1; // end of today
  const prevToMs = fromMs - 1;
  const prevFromMs = fromMs - days * MS_PER_DAY;

  return {
    key,
    days,
    fromISO: new Date(fromMs).toISOString(),
    toISO: new Date(toMs).toISOString(),
    prevFromISO: new Date(prevFromMs).toISOString(),
    prevToISO: new Date(prevToMs).toISOString(),
  };
}

/** Relative change as a ratio; 0 when previous is 0. */
export function delta(current: number, previous: number): number {
  if (!previous) return 0;
  return (current - previous) / previous;
}
