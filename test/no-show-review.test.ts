import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_GRACE_MINUTES,
  needsReview,
  pendingReview,
  wouldCharge,
} from "../lib/no-show-review.ts";

// This queue decides which bookings a human is asked to rule on, and marking one
// a no-show can charge a real card — so the boundaries matter.

const SLOT = "2026-09-10T19:00:00.000Z";
const after = (mins: number) =>
  new Date(new Date(SLOT).getTime() + mins * 60_000);

test("a booking is not up for review before its grace period elapses", () => {
  assert.equal(needsReview({ status: "confirmed", slot_at: SLOT }, after(30)), false);
  assert.equal(
    needsReview({ status: "confirmed", slot_at: SLOT }, after(DEFAULT_GRACE_MINUTES)),
    false,
  );
});

test("a booking with no outcome after the grace period needs review", () => {
  assert.equal(
    needsReview({ status: "confirmed", slot_at: SLOT }, after(DEFAULT_GRACE_MINUTES + 1)),
    true,
  );
});

test("a booking still awaiting its card also needs review", () => {
  assert.equal(
    needsReview({ status: "pending_deposit", slot_at: SLOT }, after(200)),
    true,
  );
});

test("already-resolved bookings are never surfaced", () => {
  for (const status of ["showed", "no_show", "cancelled"] as const) {
    assert.equal(
      needsReview({ status, slot_at: SLOT }, after(500)),
      false,
      `${status} should not need review`,
    );
  }
});

test("a custom grace period is respected", () => {
  assert.equal(needsReview({ status: "confirmed", slot_at: SLOT }, after(20), 15), true);
  assert.equal(needsReview({ status: "confirmed", slot_at: SLOT }, after(20), 60), false);
});

test("the queue is ordered oldest first", () => {
  const rows = [
    { status: "confirmed" as const, slot_at: "2026-09-10T21:00:00.000Z" },
    { status: "confirmed" as const, slot_at: "2026-09-10T18:00:00.000Z" },
    { status: "confirmed" as const, slot_at: "2026-09-10T19:30:00.000Z" },
  ];
  const now = new Date("2026-09-11T06:00:00.000Z");
  assert.deepEqual(
    pendingReview(rows, now).map((r) => r.slot_at),
    [
      "2026-09-10T18:00:00.000Z",
      "2026-09-10T19:30:00.000Z",
      "2026-09-10T21:00:00.000Z",
    ],
  );
});

test("the queue excludes future and resolved bookings", () => {
  const now = new Date("2026-09-10T21:00:00.000Z");
  const rows = [
    { status: "confirmed" as const, slot_at: "2026-09-10T18:00:00.000Z" }, // due
    { status: "confirmed" as const, slot_at: "2026-09-11T19:00:00.000Z" }, // future
    { status: "showed" as const, slot_at: "2026-09-10T17:00:00.000Z" }, // resolved
  ];
  assert.deepEqual(
    pendingReview(rows, now).map((r) => r.slot_at),
    ["2026-09-10T18:00:00.000Z"],
  );
});

test("wouldCharge is true only where a usable card is on file", () => {
  assert.equal(wouldCharge({ payment_status: "card_ready" }), true);
  // A previous decline is retryable, so it still warns that money may move.
  assert.equal(wouldCharge({ payment_status: "charge_failed" }), true);
});

test("wouldCharge is false where marking a no-show takes no money", () => {
  for (const status of [
    "not_required",
    "awaiting_card",
    "card_failed",
    "charging",
    "charged",
  ]) {
    assert.equal(wouldCharge({ payment_status: status }), false, status);
  }
  assert.equal(wouldCharge({}), false);
  assert.equal(wouldCharge({ payment_status: null }), false);
});
