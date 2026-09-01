import "server-only";
import type {
  Reservation,
  ReservationStatus,
  Restaurant,
  RestaurantHours,
} from "@/types/db";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEMO_HOURS,
  DEMO_RESTAURANT,
  generateDemoReservations,
} from "@/lib/demo-data";
import { requestNoShowCharge, type ChargeOutcome } from "@/lib/platform";

export interface DashboardData {
  restaurant: Restaurant;
  hours: RestaurantHours[];
  reservations: Reservation[];
}

const HISTORY_DAYS = 120;

/**
 * Load everything the dashboard needs for a restaurant: profile, hours, and the
 * recent reservation history (last 120 days + upcoming). Demo mode returns
 * synthetic data; live mode queries the shared Supabase project.
 */
export async function getDashboardData(
  restaurant: Restaurant,
): Promise<DashboardData> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      restaurant: DEMO_RESTAURANT,
      hours: DEMO_HOURS,
      reservations: generateDemoReservations(),
    };
  }

  const since = new Date(
    Date.now() - HISTORY_DAYS * 86_400_000,
  ).toISOString();

  const [hoursRes, reservationsRes] = await Promise.all([
    supabase
      .from("restaurant_hours")
      .select("*")
      .eq("restaurant_id", restaurant.id),
    supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("slot_at", since)
      .order("slot_at", { ascending: true }),
  ]);

  if (hoursRes.error) throw new Error(hoursRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);

  return {
    restaurant,
    hours: hoursRes.data ?? [],
    reservations: reservationsRes.data ?? [],
  };
}

/** Timestamp column to stamp for each terminal status transition. */
const STATUS_TIMESTAMP: Partial<Record<ReservationStatus, string>> = {
  confirmed: "confirmed_at",
  showed: "checked_in_at",
  no_show: "no_show_marked_at",
  cancelled: "cancelled_at",
};

/**
 * Update a reservation's status (mark showed / no-show / cancel / confirm),
 * stamping the matching transition timestamp. Demo mode is a no-op success so
 * the UI can update optimistically.
 *
 * Marking a no-show is the one transition that can move real money: it asks the
 * guest app to charge the saved card. The status change is committed FIRST and
 * the charge is attempted after, deliberately — what happened in the dining
 * room is a fact staff recorded, and it must not be lost because Stripe or the
 * platform API was briefly unreachable. A failed charge is reported back so the
 * UI can say so, and is retryable (`charge_failed` stays chargeable).
 */
export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<{ charge?: ChargeOutcome }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    // Demo mode: simulate the charge outcome so the flow is demonstrable.
    return status === "no_show"
      ? { charge: { charged: false, reason: "demo_mode" } }
      : {};
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  const stampCol = STATUS_TIMESTAMP[status];
  if (stampCol) patch[stampCol] = now;

  const { error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (status === "no_show") {
    return { charge: await requestNoShowCharge(id) };
  }
  return {};
}

export interface ManualReservationInput {
  restaurant: Restaurant;
  guestName: string;
  guestEmail: string;
  partySize: number;
  slotAt: string;
  notes?: string;
}

/** Create a walk-in / phone reservation entered by staff. */
export async function createManualReservation(
  input: ManualReservationInput,
): Promise<Reservation> {
  const now = new Date().toISOString();
  const reservation: Reservation = {
    id: crypto.randomUUID(),
    restaurant_id: input.restaurant.id,
    guest_name: input.guestName,
    guest_email: input.guestEmail,
    party_size: input.partySize,
    slot_at: input.slotAt,
    deposit_amount: input.restaurant.deposit_amount * input.partySize,
    status: "confirmed",
    created_at: now,
    confirmed_at: now,
    updated_at: now,
    source: "manual",
    notes: input.notes ?? null,
  };

  const supabase = getSupabaseServerClient();
  if (!supabase) return reservation; // demo mode

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      restaurant_id: reservation.restaurant_id,
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email,
      party_size: reservation.party_size,
      slot_at: reservation.slot_at,
      deposit_amount: reservation.deposit_amount,
      status: reservation.status,
      source: "manual",
      notes: reservation.notes,
      confirmed_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
