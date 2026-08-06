import { getCurrentRestaurant } from "@/lib/session";
import { getDashboardData } from "@/lib/reservations";
import { inRange } from "@/lib/metrics";
import { parseRange, resolveRange } from "@/lib/range";

// GET /api/export?range=30 — CSV of reservations in the selected window.
export async function GET(request: Request) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) {
    return new Response("Not authenticated", { status: 401 });
  }

  const key = parseRange(new URL(request.url).searchParams.get("range") ?? undefined);
  const range = resolveRange(key);
  const { reservations } = await getDashboardData(restaurant);
  const scoped = inRange(reservations, range.fromISO, range.toISO).sort((a, b) =>
    a.slot_at.localeCompare(b.slot_at),
  );

  const header = [
    "slot_at",
    "guest_name",
    "guest_email",
    "party_size",
    "status",
    "deposit_amount",
    "source",
    "created_at",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...scoped.map((r) =>
      [
        r.slot_at,
        r.guest_name,
        r.guest_email,
        r.party_size,
        r.status,
        r.deposit_amount,
        r.source ?? "web",
        r.created_at,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creditable-reservations-${key}d.csv"`,
    },
  });
}
