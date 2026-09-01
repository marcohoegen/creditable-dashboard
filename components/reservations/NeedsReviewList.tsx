"use client";

import { useState } from "react";
import type { Reservation, ReservationStatus } from "@/types/db";
import { wouldCharge } from "@/lib/no-show-review";

// Bookings whose service time has passed with no outcome recorded.
//
// This is the "no-show automation": the system finds them, a human decides.
// Marking a no-show here can charge the guest, so the button says so before it
// is pressed rather than after.
export default function NeedsReviewList({
  reservations,
}: {
  reservations: Reservation[];
}) {
  const [rows, setRows] = useState(reservations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function resolve(id: string, status: ReservationStatus) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      if (status === "no_show") {
        setNotice(
          data.charge?.charged
            ? "No-show recorded and the fee was charged."
            : "No-show recorded. No fee was charged.",
        );
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setNotice("Could not update that reservation.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <h2 className="text-sm font-semibold text-amber-900">
        Needs review ({rows.length})
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Service has passed and no outcome was recorded. Marking a no-show
        charges the guest&apos;s saved card where there is one.
      </p>
      <ul className="mt-3 divide-y divide-amber-200">
        {rows.map((r) => {
          const when = new Date(r.slot_at);
          const charges = wouldCharge(r);
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{r.guest_name}</span>{" "}
                <span className="text-gray-600">
                  · {r.party_size} · {when.toLocaleDateString()}{" "}
                  {when.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="text-xs text-gray-500">
                  {charges
                    ? `No-show would charge €${r.deposit_amount}`
                    : "No saved card — no-show would not charge"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => resolve(r.id, "showed")}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Showed
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => resolve(r.id, "no_show")}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {charges ? `No-show · charge €${r.deposit_amount}` : "No-show"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {notice && <p className="mt-3 text-sm text-amber-900">{notice}</p>}
    </div>
  );
}
