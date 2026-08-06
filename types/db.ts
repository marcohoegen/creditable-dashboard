// Types mirroring the SHARED Supabase schema. The base tables come from the
// guest app (supabase/migrations/0001_init.sql); the dashboard adds the
// status-transition timestamps and metadata in 0002_dashboard.sql.

export type ReservationStatus =
  | "pending_deposit"
  | "confirmed"
  | "showed"
  | "no_show"
  | "cancelled";

export type ReservationSource = "web" | "manual";

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  address: string;
  lat: number;
  lng: number;
  image_url: string | null;
  /** Refundable deposit charged per guest, in EUR. */
  deposit_amount: number;
  created_at?: string;
}

export interface RestaurantHours {
  id?: string;
  restaurant_id: string;
  /** 0 = Sunday … 6 = Saturday (Postgres extract(dow) convention). */
  weekday: number;
  open_time: string; // "HH:MM"
  close_time: string; // "HH:MM"
  slot_minutes: number;
  capacity_per_slot: number;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  guest_name: string;
  guest_email: string;
  party_size: number;
  slot_at: string; // ISO timestamp
  deposit_amount: number;
  status: ReservationStatus;
  created_at: string; // ISO — when the booking was made
  // Added by 0002_dashboard.sql (all optional; only set once a transition happens):
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  checked_in_at?: string | null; // guest showed
  no_show_marked_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
  source?: ReservationSource;
}

/** A restaurant-scoped user (maps Supabase auth.users → a restaurant). */
export interface RestaurantUser {
  user_id: string;
  restaurant_id: string;
  role: "owner" | "staff";
}
