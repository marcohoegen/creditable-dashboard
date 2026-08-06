// Small presentation helpers shared across the dashboard.

export function eur(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function pct(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UTC "YYYY-MM-DD" key for an ISO timestamp (TZ-stable grouping). */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}
