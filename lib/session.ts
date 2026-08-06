import "server-only";
import type { Restaurant } from "@/types/db";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_RESTAURANT } from "@/lib/demo-data";

/**
 * Resolve the restaurant for the current session.
 * - Demo mode (no Supabase): the demo restaurant (auto "logged in").
 * - Live mode: the signed-in user's restaurant via `restaurant_users`.
 * Returns `null` in live mode when there is no authenticated/linked user.
 */
export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return DEMO_RESTAURANT;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!link) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", link.restaurant_id)
    .maybeSingle();
  return restaurant ?? null;
}

export const isDemoMode = (): boolean => getSupabaseServerClient() === null;
