import { NextResponse } from "next/server";
import { getCurrentRestaurant } from "@/lib/session";
import { updateSettings, type SettingsProfile } from "@/lib/settings";

// PATCH /api/settings  body: { profile, hours }
export async function PATCH(request: Request) {
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

  const { profile, hours } = (body ?? {}) as {
    profile?: SettingsProfile;
    hours?: unknown;
  };
  if (!profile || typeof profile.name !== "string") {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }

  try {
    await updateSettings(
      restaurant,
      {
        name: profile.name,
        cuisine: profile.cuisine ?? "",
        address: profile.address ?? "",
        description: profile.description ?? "",
        deposit_amount: Math.max(0, Number(profile.deposit_amount) || 0),
        // Clamped server-side too: the cutoff decides whether a fee is
        // defensible, so it must not be settable to anything by a crafted request.
        cancellation_cutoff_hours: Math.min(
          168,
          Math.max(0, Number(profile.cancellation_cutoff_hours) || 0),
        ),
      },
      Array.isArray(hours) ? hours : [],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
