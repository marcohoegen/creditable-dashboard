import "server-only";

// Client for the guest app's internal platform API.
//
// The guest app owns the payment rails — Stripe keys, webhook, payment_events —
// and this dashboard is a SEPARATE repo by design. Rather than shipping a second
// copy of the code that charges cards (two implementations of money movement,
// free to drift), the dashboard asks the guest app to do it.
//
// Unconfigured is a supported state: staff can still mark a no-show, it just
// doesn't charge. That mirrors how every other capability here degrades.

export const PLATFORM_API_URL = process.env.PLATFORM_API_URL ?? "";
export const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export const isPlatformConfigured =
  PLATFORM_API_URL.length > 0 && INTERNAL_API_SECRET.length > 0;

export interface ChargeOutcome {
  charged: boolean;
  paymentStatus?: string;
  reason?: string;
  error?: string;
}

/**
 * Ask the guest app to charge the no-show fee for a reservation.
 *
 * Never throws: a payment problem must not prevent staff from recording what
 * actually happened in the dining room. The outcome is returned so the UI can
 * say whether money moved.
 */
export async function requestNoShowCharge(
  reservationId: string,
): Promise<ChargeOutcome> {
  if (!isPlatformConfigured) {
    return { charged: false, reason: "platform_not_configured" };
  }

  try {
    const res = await fetch(
      `${PLATFORM_API_URL.replace(/\/$/, "")}/api/internal/reservations/${reservationId}/charge-no-show`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${INTERNAL_API_SECRET}` },
        cache: "no-store",
      },
    );
    const data = (await res.json().catch(() => ({}))) as ChargeOutcome;
    if (!res.ok) {
      return {
        charged: false,
        reason: data.reason ?? `http_${res.status}`,
        error: data.error,
      };
    }
    return data;
  } catch (err) {
    return {
      charged: false,
      reason: "unreachable",
      error: err instanceof Error ? err.message : "Platform API unreachable",
    };
  }
}
