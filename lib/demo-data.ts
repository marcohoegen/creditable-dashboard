// Deterministic synthetic history for DEMO MODE. Generates ~90 days of past
// reservations plus ~14 days of upcoming ones for a single demo restaurant, so
// every KPI, chart, and the heatmap render fully populated with no backend.
// Distributions are realistic: weekend peaks, ~12% no-show, ~8% cancellation.

import type { Reservation, Restaurant, RestaurantHours } from "@/types/db";
import { MS_PER_DAY } from "@/lib/metrics";

export const DEMO_RESTAURANT: Restaurant = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Lumen Bistro",
  description:
    "Seasonal European plates and natural wines in a candlelit dining room.",
  cuisine: "European",
  address: "Torstraße 110, 10119 Berlin",
  lat: 52.5296,
  lng: 13.4012,
  image_url:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=60",
  deposit_amount: 20,
};

// Dinner Tue–Sun (closed Mon) + weekend lunch — gives a richer heatmap.
export const DEMO_HOURS: RestaurantHours[] = [
  ...[2, 3, 4, 5, 6, 0].map((weekday) => ({
    restaurant_id: DEMO_RESTAURANT.id,
    weekday,
    open_time: "17:00",
    close_time: "22:00",
    slot_minutes: 30,
    capacity_per_slot: 12,
  })),
  ...[5, 6, 0].map((weekday) => ({
    restaurant_id: DEMO_RESTAURANT.id,
    weekday,
    open_time: "12:00",
    close_time: "15:00",
    slot_minutes: 30,
    capacity_per_slot: 10,
  })),
];

// Deterministic PRNG so the demo dataset is stable across renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Jordan", "Mara", "Felix", "Lena", "Tomas", "Sofia", "Noah", "Emilia",
  "Luca", "Hannah", "Ben", "Clara", "Jonas", "Mia", "Paul", "Ida",
  "Finn", "Greta", "Leo", "Nina", "Anton", "Frida", "Max", "Ella",
];
const LAST_NAMES = [
  "Becker", "Vogel", "Hoffmann", "Schmidt", "Klein", "Wolf", "Braun", "Lang",
  "Krause", "Roth", "Sommer", "Winter", "Bauer", "Fuchs", "Berg", "Adler",
];

interface Guest {
  name: string;
  email: string;
}

function buildGuestPool(rand: () => number): Guest[] {
  const pool: Guest[] = [];
  for (let i = 0; i < 60; i++) {
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    pool.push({
      name: `${fn} ${ln}`,
      email: `${fn}.${ln}.${i}`.toLowerCase() + "@example.com",
    });
  }
  return pool;
}

/** Higher index weekend → busier. Index 0=Sun…6=Sat. */
function utilizationTarget(weekday: number): number {
  switch (weekday) {
    case 5: return 0.78; // Fri
    case 6: return 0.88; // Sat
    case 0: return 0.62; // Sun
    case 1: return 0; // Mon closed
    default: return 0.5; // Tue–Thu
  }
}

function isoAt(dayStart: number, hour: number, minute: number): string {
  return new Date(dayStart + (hour * 60 + minute) * 60_000).toISOString();
}

/**
 * Generate the demo reservation history. `now` is injectable for tests.
 */
export function generateDemoReservations(now: Date = new Date()): Reservation[] {
  const rand = mulberry32(20240619);
  const guests = buildGuestPool(rand);
  const reservations: Reservation[] = [];
  const nowMs = now.getTime();

  // Midnight UTC of today.
  const todayStart = new Date(
    `${now.toISOString().slice(0, 10)}T00:00:00.000Z`,
  ).getTime();

  let counter = 0;
  for (let offset = -90; offset <= 14; offset++) {
    const dayStart = todayStart + offset * MS_PER_DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const dayHours = DEMO_HOURS.filter((h) => h.weekday === weekday);
    if (dayHours.length === 0) continue;

    for (const block of dayHours) {
      const [oh, om] = block.open_time.split(":").map(Number);
      const [ch, cm] = block.close_time.split(":").map(Number);
      const openMin = oh * 60 + om;
      const closeMin = ch * 60 + cm;
      const slotCount = Math.floor(
        (closeMin - openMin) / block.slot_minutes,
      );
      const dayCapacity = slotCount * block.capacity_per_slot;

      const lunch = oh < 16;
      const target =
        utilizationTarget(weekday) * (lunch ? 0.55 : 1) * (0.8 + rand() * 0.4);
      let coversToBook = Math.round(dayCapacity * target);

      while (coversToBook > 0) {
        const slotIndex = Math.floor(rand() * slotCount);
        const slotMin = openMin + slotIndex * block.slot_minutes;
        const slotAtMs = dayStart + slotMin * 60_000;
        const partySize = 1 + Math.floor(rand() * rand() * 6); // skew small
        coversToBook -= partySize;

        // Returning-guest bias: low indices picked more often.
        const guest = guests[Math.floor(rand() * rand() * guests.length)];

        const leadDays = Math.floor(rand() * rand() * 21);
        let createdMs = slotAtMs - leadDays * MS_PER_DAY - rand() * MS_PER_DAY;
        if (createdMs > nowMs) createdMs = nowMs - rand() * MS_PER_DAY;
        if (createdMs > slotAtMs) createdMs = slotAtMs - 3_600_000;

        const slotAt = new Date(slotAtMs).toISOString();
        const createdAt = new Date(createdMs).toISOString();
        const source = rand() < 0.1 ? "manual" : "web";

        const r: Reservation = {
          id: `demo-${counter++}`,
          restaurant_id: DEMO_RESTAURANT.id,
          guest_name: guest.name,
          guest_email: guest.email,
          party_size: partySize,
          slot_at: slotAt,
          deposit_amount: DEMO_RESTAURANT.deposit_amount * partySize,
          status: "confirmed",
          created_at: createdAt,
          source,
          confirmed_at: createdAt,
          notes: null,
        };

        if (slotAtMs > nowMs) {
          // Upcoming: mostly confirmed, some still pending deposit.
          r.status = rand() < 0.2 ? "pending_deposit" : "confirmed";
        } else {
          // Past: resolve the outcome.
          const roll = rand();
          if (roll < 0.08) {
            r.status = "cancelled";
            r.cancelled_at = new Date(
              createdMs + rand() * (slotAtMs - createdMs),
            ).toISOString();
          } else if (roll < 0.2) {
            r.status = "no_show";
            r.no_show_marked_at = new Date(slotAtMs + 7_200_000).toISOString();
          } else {
            r.status = "showed";
            r.checked_in_at = slotAt;
          }
        }
        r.updated_at = r.cancelled_at ?? r.no_show_marked_at ?? r.checked_in_at ?? createdAt;

        reservations.push(r);
      }
    }
  }

  return reservations;
}
