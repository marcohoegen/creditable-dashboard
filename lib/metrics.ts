// Pure analytics engine for the restaurant dashboard. Takes reservations (+
// opening hours for capacity) and computes every KPI, time series, and the
// heatmap. No I/O, no framework — identical for demo and live data, and fully
// unit-testable (see test/metrics.test.ts). All date math is UTC-based so
// grouping is timezone-stable.

import type { Reservation, RestaurantHours } from "@/types/db";

export const MS_PER_DAY = 86_400_000;

// Kept local so this pure module has no runtime imports (cleanly unit-testable).
// `lib/format.ts` holds UI-facing copies for components.
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UTC "YYYY-MM-DD" key for an ISO timestamp (timezone-stable grouping). */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** A reservation still "counts" as occupying a seat unless it was cancelled. */
export function isActive(r: Reservation): boolean {
  return r.status !== "cancelled";
}

export interface StatusCounts {
  pending_deposit: number;
  confirmed: number;
  showed: number;
  no_show: number;
  cancelled: number;
  total: number;
}

export function statusCounts(rs: Reservation[]): StatusCounts {
  const c: StatusCounts = {
    pending_deposit: 0,
    confirmed: 0,
    showed: 0,
    no_show: 0,
    cancelled: 0,
    total: rs.length,
  };
  for (const r of rs) c[r.status] += 1;
  return c;
}

// ── Rates ──────────────────────────────────────────────────────────────────

/** no_show / (showed + no_show). 0 when no completed reservations. */
export function noShowRate(rs: Reservation[]): number {
  const c = statusCounts(rs);
  const completed = c.showed + c.no_show;
  return completed === 0 ? 0 : c.no_show / completed;
}

export function showRate(rs: Reservation[]): number {
  const c = statusCounts(rs);
  const completed = c.showed + c.no_show;
  return completed === 0 ? 0 : c.showed / completed;
}

/** cancelled / total bookings. */
export function cancelRate(rs: Reservation[]): number {
  return rs.length === 0 ? 0 : statusCounts(rs).cancelled / rs.length;
}

// ── Covers & party size ──────────────────────────────────────────────────────

/** Guests actually served (showed). */
export function coversServed(rs: Reservation[]): number {
  return rs
    .filter((r) => r.status === "showed")
    .reduce((s, r) => s + r.party_size, 0);
}

/** Booked covers (everything not cancelled). */
export function bookedCovers(rs: Reservation[]): number {
  return rs.filter(isActive).reduce((s, r) => s + r.party_size, 0);
}

export function averagePartySize(rs: Reservation[]): number {
  const active = rs.filter(isActive);
  if (active.length === 0) return 0;
  return active.reduce((s, r) => s + r.party_size, 0) / active.length;
}

// ── Deposits ─────────────────────────────────────────────────────────────────

export interface DepositOutcomes {
  /** Outstanding deposits on upcoming/active bookings. */
  held: number;
  /** Returned to guests who showed up. */
  refunded: number;
  /** Kept from no-shows — this is recovered revenue. */
  captured: number;
}

export function depositOutcomes(rs: Reservation[]): DepositOutcomes {
  const out: DepositOutcomes = { held: 0, refunded: 0, captured: 0 };
  for (const r of rs) {
    if (r.status === "showed") out.refunded += r.deposit_amount;
    else if (r.status === "no_show") out.captured += r.deposit_amount;
    else if (r.status === "pending_deposit" || r.status === "confirmed")
      out.held += r.deposit_amount;
  }
  return out;
}

// ── Lead time ────────────────────────────────────────────────────────────────

/** Days between booking creation and the reserved slot (>= 0). */
export function leadTimeDays(r: Reservation): number {
  const lead =
    (new Date(r.slot_at).getTime() - new Date(r.created_at).getTime()) /
    MS_PER_DAY;
  return Math.max(0, lead);
}

export function averageLeadTimeDays(rs: Reservation[]): number {
  const active = rs.filter(isActive);
  if (active.length === 0) return 0;
  return active.reduce((s, r) => s + leadTimeDays(r), 0) / active.length;
}

export interface Bucket {
  label: string;
  count: number;
}

export function leadTimeHistogram(rs: Reservation[]): Bucket[] {
  const buckets: Bucket[] = [
    { label: "Same day", count: 0 },
    { label: "1–2 days", count: 0 },
    { label: "3–7 days", count: 0 },
    { label: "1–2 weeks", count: 0 },
    { label: "2+ weeks", count: 0 },
  ];
  for (const r of rs.filter(isActive)) {
    const d = leadTimeDays(r);
    if (d < 1) buckets[0].count += 1;
    else if (d < 3) buckets[1].count += 1;
    else if (d < 8) buckets[2].count += 1;
    else if (d < 15) buckets[3].count += 1;
    else buckets[4].count += 1;
  }
  return buckets;
}

// ── New vs returning (by guest email) ────────────────────────────────────────

export interface NewReturning {
  newGuests: number;
  returning: number;
}

/** A reservation is "returning" if that email appears in an earlier booking. */
export function newVsReturning(rs: Reservation[]): NewReturning {
  const ordered = [...rs].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const seen = new Set<string>();
  const out: NewReturning = { newGuests: 0, returning: 0 };
  for (const r of ordered) {
    const key = r.guest_email.toLowerCase();
    if (seen.has(key)) out.returning += 1;
    else {
      out.newGuests += 1;
      seen.add(key);
    }
  }
  return out;
}

// ── Capacity ─────────────────────────────────────────────────────────────────

/** Number of bookable slots in one opening-hours row. */
export function slotsInRow(row: RestaurantHours): number {
  const [oh, om] = row.open_time.split(":").map(Number);
  const [ch, cm] = row.close_time.split(":").map(Number);
  const minutes = ch * 60 + cm - (oh * 60 + om);
  return minutes <= 0 ? 0 : Math.floor(minutes / row.slot_minutes);
}

/** Total seats available on a given weekday (0=Sun…6=Sat). */
export function seatsForWeekday(
  hours: RestaurantHours[],
  weekday: number,
): number {
  return hours
    .filter((h) => h.weekday === weekday)
    .reduce((s, h) => s + slotsInRow(h) * h.capacity_per_slot, 0);
}

// ── Time series & aggregations ───────────────────────────────────────────────

function eachDay(fromISO: string, toISO: string): string[] {
  const days: string[] = [];
  const start = new Date(`${dayKey(fromISO)}T00:00:00.000Z`).getTime();
  const end = new Date(`${dayKey(toISO)}T00:00:00.000Z`).getTime();
  for (let t = start; t <= end; t += MS_PER_DAY) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export interface DailyPoint {
  date: string;
  reservations: number;
  covers: number;
  showed: number;
  no_show: number;
  cancelled: number;
  capacity: number;
  utilization: number;
}

/** Per-day series across [from, to], padding empty days with zeros. */
export function dailySeries(
  rs: Reservation[],
  hours: RestaurantHours[],
  fromISO: string,
  toISO: string,
): DailyPoint[] {
  const byDay = new Map<string, Reservation[]>();
  for (const r of rs) {
    const k = dayKey(r.slot_at);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(r);
  }
  return eachDay(fromISO, toISO).map((date) => {
    const dayRs = byDay.get(date) ?? [];
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const capacity = seatsForWeekday(hours, weekday);
    const covers = bookedCovers(dayRs);
    const c = statusCounts(dayRs);
    return {
      date,
      reservations: dayRs.length,
      covers,
      showed: c.showed,
      no_show: c.no_show,
      cancelled: c.cancelled,
      capacity,
      utilization: capacity === 0 ? 0 : covers / capacity,
    };
  });
}

/** Overall utilization = booked covers ÷ available seats across the range. */
export function utilization(
  rs: Reservation[],
  hours: RestaurantHours[],
  fromISO: string,
  toISO: string,
): number {
  let capacity = 0;
  for (const date of eachDay(fromISO, toISO)) {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    capacity += seatsForWeekday(hours, weekday);
  }
  if (capacity === 0) return 0;
  return bookedCovers(rs) / capacity;
}

export interface WeekdayPoint {
  weekday: number;
  label: string;
  reservations: number;
  covers: number;
  noShowRate: number;
}

export function byWeekday(rs: Reservation[]): WeekdayPoint[] {
  return WEEKDAY_LABELS.map((label, weekday) => {
    const dayRs = rs.filter(
      (r) => new Date(r.slot_at).getUTCDay() === weekday,
    );
    return {
      weekday,
      label,
      reservations: dayRs.length,
      covers: bookedCovers(dayRs),
      noShowRate: noShowRate(dayRs),
    };
  });
}

export interface HeatCell {
  weekday: number;
  hour: number;
  covers: number;
}

/** Weekday × hour covers grid for a busiest-times heatmap. */
export function heatmap(rs: Reservation[]): HeatCell[] {
  const grid = new Map<string, number>();
  for (const r of rs.filter(isActive)) {
    const d = new Date(r.slot_at);
    const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
    grid.set(key, (grid.get(key) ?? 0) + r.party_size);
  }
  const cells: HeatCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const covers = grid.get(`${weekday}-${hour}`) ?? 0;
      if (covers > 0) cells.push({ weekday, hour, covers });
    }
  }
  return cells;
}

// ── Top-level summary (overview KPIs) ────────────────────────────────────────

export interface Summary {
  counts: StatusCounts;
  noShowRate: number;
  showRate: number;
  cancelRate: number;
  utilization: number;
  coversServed: number;
  bookedCovers: number;
  averagePartySize: number;
  averageLeadTimeDays: number;
  deposits: DepositOutcomes;
  newReturning: NewReturning;
}

/** Filter to [from, to] by slot date, then summarize. */
export function inRange(
  rs: Reservation[],
  fromISO: string,
  toISO: string,
): Reservation[] {
  const from = dayKey(fromISO);
  const to = dayKey(toISO);
  return rs.filter((r) => {
    const k = dayKey(r.slot_at);
    return k >= from && k <= to;
  });
}

export function summarize(
  rs: Reservation[],
  hours: RestaurantHours[],
  fromISO: string,
  toISO: string,
): Summary {
  const scoped = inRange(rs, fromISO, toISO);
  return {
    counts: statusCounts(scoped),
    noShowRate: noShowRate(scoped),
    showRate: showRate(scoped),
    cancelRate: cancelRate(scoped),
    utilization: utilization(scoped, hours, fromISO, toISO),
    coversServed: coversServed(scoped),
    bookedCovers: bookedCovers(scoped),
    averagePartySize: averagePartySize(scoped),
    averageLeadTimeDays: averageLeadTimeDays(scoped),
    deposits: depositOutcomes(scoped),
    newReturning: newVsReturning(scoped),
  };
}
