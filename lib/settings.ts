import "server-only";
import type { Restaurant, RestaurantHours } from "@/types/db";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface SettingsProfile {
  name: string;
  cuisine: string;
  address: string;
  description: string;
  deposit_amount: number;
  /** Hours before the slot up to which a guest may cancel free of charge. */
  cancellation_cutoff_hours: number;
}

/**
 * Persist profile/deposit + opening hours for a restaurant. Demo mode (no
 * Supabase) is a no-op success so the UI behaves identically.
 */
export async function updateSettings(
  restaurant: Restaurant,
  profile: SettingsProfile,
  hours: RestaurantHours[],
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error: profileErr } = await supabase
    .from("restaurants")
    .update({
      name: profile.name,
      cuisine: profile.cuisine,
      address: profile.address,
      description: profile.description,
      deposit_amount: profile.deposit_amount,
      cancellation_cutoff_hours: profile.cancellation_cutoff_hours,
    })
    .eq("id", restaurant.id);
  if (profileErr) throw new Error(profileErr.message);

  // Upsert each hours row that belongs to this restaurant.
  for (const row of hours) {
    if (row.restaurant_id !== restaurant.id) continue;
    const payload = {
      id: row.id,
      restaurant_id: restaurant.id,
      weekday: row.weekday,
      open_time: row.open_time,
      close_time: row.close_time,
      slot_minutes: row.slot_minutes,
      capacity_per_slot: row.capacity_per_slot,
    };
    const { error } = await supabase.from("restaurant_hours").upsert(payload);
    if (error) throw new Error(error.message);
  }
}
