import { NextResponse } from "next/server";
import { getCurrentRestaurant } from "@/lib/session";
import { createManualReservation } from "@/lib/reservations";

// POST /api/reservations  — staff manual booking.
export async function POST(request: Request) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { guestName, guestEmail, partySize, slotAt, notes } =
    (body ?? {}) as Record<string, unknown>;

  if (
    typeof guestName !== "string" ||
    !guestName.trim() ||
    typeof guestEmail !== "string" ||
    typeof slotAt !== "string" ||
    Number.isNaN(Date.parse(slotAt)) ||
    typeof partySize !== "number" ||
    partySize < 1 ||
    partySize > 20
  ) {
    return NextResponse.json({ error: "Invalid fields." }, { status: 400 });
  }

  try {
    const reservation = await createManualReservation({
      restaurant,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      partySize,
      slotAt,
      notes: typeof notes === "string" ? notes : undefined,
    });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
