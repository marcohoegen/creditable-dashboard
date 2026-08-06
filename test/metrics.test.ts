import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageLeadTimeDays,
  averagePartySize,
  cancelRate,
  depositOutcomes,
  leadTimeHistogram,
  newVsReturning,
  noShowRate,
  seatsForWeekday,
  showRate,
  slotsInRow,
  statusCounts,
  summarize,
  utilization,
} from "../lib/metrics.ts";
import type { Reservation, RestaurantHours } from "../types/db.ts";

function res(partial: Partial<Reservation>): Reservation {
  return {
    id: Math.random().toString(36).slice(2),
    restaurant_id: "r1",
    guest_name: "Guest",
    guest_email: "guest@example.com",
    party_size: 2,
    slot_at: "2026-06-10T18:00:00.000Z",
    deposit_amount: 40,
    status: "showed",
    created_at: "2026-06-08T12:00:00.000Z",
    ...partial,
  };
}

const sample: Reservation[] = [
  res({ status: "showed", party_size: 2, deposit_amount: 40 }),
  res({ status: "showed", party_size: 4, deposit_amount: 80 }),
  res({ status: "no_show", party_size: 2, deposit_amount: 40 }),
  res({ status: "cancelled", party_size: 3, deposit_amount: 60 }),
  res({ status: "confirmed", party_size: 2, deposit_amount: 40 }),
];

test("statusCounts tallies every status", () => {
  const c = statusCounts(sample);
  assert.equal(c.total, 5);
  assert.equal(c.showed, 2);
  assert.equal(c.no_show, 1);
  assert.equal(c.cancelled, 1);
  assert.equal(c.confirmed, 1);
});

test("no-show rate = no_show / (showed + no_show)", () => {
  assert.equal(noShowRate(sample), 1 / 3);
});

test("show rate complements no-show rate", () => {
  assert.equal(showRate(sample), 2 / 3);
});

test("cancel rate = cancelled / total", () => {
  assert.equal(cancelRate(sample), 1 / 5);
});

test("rates are 0 with no reservations (no divide-by-zero)", () => {
  assert.equal(noShowRate([]), 0);
  assert.equal(cancelRate([]), 0);
  assert.equal(showRate([]), 0);
});

test("deposit outcomes split by status", () => {
  const d = depositOutcomes(sample);
  assert.equal(d.refunded, 120); // 40 + 80 showed
  assert.equal(d.captured, 40); // no_show
  assert.equal(d.held, 40); // confirmed
});

test("average party size ignores cancelled", () => {
  // active: 2,4,2,2 → 10/4
  assert.equal(averagePartySize(sample), 2.5);
});

test("new vs returning by email ordered by created_at", () => {
  const rs: Reservation[] = [
    res({ guest_email: "a@x.com", created_at: "2026-01-01T00:00:00Z" }),
    res({ guest_email: "a@x.com", created_at: "2026-01-05T00:00:00Z" }),
    res({ guest_email: "b@x.com", created_at: "2026-01-03T00:00:00Z" }),
  ];
  assert.deepEqual(newVsReturning(rs), { newGuests: 2, returning: 1 });
});

test("lead time histogram buckets bookings", () => {
  const rs = [
    res({ created_at: "2026-06-10T10:00:00Z", slot_at: "2026-06-10T18:00:00Z" }), // same day
    res({ created_at: "2026-06-08T18:00:00Z", slot_at: "2026-06-10T18:00:00Z" }), // 2 days
    res({ created_at: "2026-05-21T18:00:00Z", slot_at: "2026-06-10T18:00:00Z" }), // 20 days
  ];
  const buckets = leadTimeHistogram(rs);
  assert.equal(buckets[0].count, 1); // same day
  assert.equal(buckets[1].count, 1); // 1-2 days
  assert.equal(buckets[4].count, 1); // 2+ weeks
});

test("avg lead time ignores cancelled", () => {
  const rs = [
    res({ created_at: "2026-06-08T18:00:00Z", slot_at: "2026-06-10T18:00:00Z" }), // 2d
    res({
      status: "cancelled",
      created_at: "2026-01-01T00:00:00Z",
      slot_at: "2026-06-10T18:00:00Z",
    }),
  ];
  assert.equal(averageLeadTimeDays(rs), 2);
});

test("capacity helpers compute seats from hours", () => {
  const row: RestaurantHours = {
    restaurant_id: "r1",
    weekday: 2,
    open_time: "17:00",
    close_time: "22:00",
    slot_minutes: 30,
    capacity_per_slot: 10,
  };
  assert.equal(slotsInRow(row), 10); // 5h / 30min
  assert.equal(seatsForWeekday([row], 2), 100);
  assert.equal(seatsForWeekday([row], 3), 0); // different weekday
});

test("utilization = booked covers / available seats", () => {
  // 2026-06-09 is a Tuesday (weekday 2). One day in range.
  const hours: RestaurantHours[] = [
    {
      restaurant_id: "r1",
      weekday: 2,
      open_time: "17:00",
      close_time: "22:00",
      slot_minutes: 30,
      capacity_per_slot: 10, // 100 seats
    },
  ];
  const rs = [
    res({ status: "showed", party_size: 20, slot_at: "2026-06-09T18:00:00Z" }),
  ];
  assert.equal(
    utilization(rs, hours, "2026-06-09T00:00:00Z", "2026-06-09T23:59:59Z"),
    0.2,
  );
});

test("summarize scopes to the date range", () => {
  const hours: RestaurantHours[] = [];
  const rs = [
    res({ slot_at: "2026-06-09T18:00:00Z", status: "showed" }),
    res({ slot_at: "2026-05-01T18:00:00Z", status: "no_show" }), // out of range
  ];
  const s = summarize(rs, hours, "2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z");
  assert.equal(s.counts.total, 1);
  assert.equal(s.counts.showed, 1);
});
