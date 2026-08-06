import { NextResponse } from "next/server";
import type { ReservationStatus } from "@/types/db";
import { updateReservationStatus } from "@/lib/reservations";

const ALLOWED: ReservationStatus[] = [
  "confirmed",
  "showed",
  "no_show",
  "cancelled",
];

// PATCH /api/reservations/:id  body: { status }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const status = (body as { status?: string })?.status as ReservationStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    await updateReservationStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
