// Pure "which bookings still need a decision" logic — no IO, no `server-only`.
//
// DELIBERATELY NOT AUTOMATIC MARKING. It would be easy to mark a booking as a
// no-show once its slot passed and charge the guest, but that turns every
// forgotten tap on "seated" into a charge on a guest who actually turned up —
// and those become chargebacks the restaurant loses. So the automation here
// surfaces a review queue for staff; a human still decides that money moves.

import type { Reservation } from "@/types/db";

/** Minutes after the slot before an unresolved booking is worth chasing. */
export const DEFAULT_GRACE_MINUTES = 90;

/**
 * A booking whose service time has passed but which nobody marked as seated,
 * no-show or cancelled.
 */
export function needsReview(
  reservation: Pick<Reservation, "status" | "slot_at">,
  now: Date = new Date(),
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): boolean {
  if (
    reservation.status !== "confirmed" &&
    reservation.status !== "pending_deposit"
  ) {
    return false;
  }
  const deadline =
    new Date(reservation.slot_at).getTime() + graceMinutes * 60_000;
  return now.getTime() > deadline;
}

/** All bookings awaiting a staff decision, oldest first. */
export function pendingReview<
  T extends Pick<Reservation, "status" | "slot_at">,
>(
  reservations: T[],
  now: Date = new Date(),
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): T[] {
  return reservations
    .filter((r) => needsReview(r, now, graceMinutes))
    .sort(
      (a, b) =>
        new Date(a.slot_at).getTime() - new Date(b.slot_at).getTime(),
    );
}

/** Whether marking this booking a no-show would actually charge the guest. */
export function wouldCharge(
  reservation: { payment_status?: string | null },
): boolean {
  return (
    reservation.payment_status === "card_ready" ||
    reservation.payment_status === "charge_failed"
  );
}
