"use client";

import { useState } from "react";
import type { Restaurant, RestaurantHours } from "@/types/db";
import { WEEKDAY_LABELS } from "@/lib/format";

export default function SettingsForm({
  restaurant,
  hours,
}: {
  restaurant: Restaurant;
  hours: RestaurantHours[];
}) {
  const [profile, setProfile] = useState({
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    address: restaurant.address,
    description: restaurant.description,
    deposit_amount: restaurant.deposit_amount,
  });
  const [rows, setRows] = useState(
    [...hours].sort((a, b) => a.weekday - b.weekday || a.open_time.localeCompare(b.open_time)),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateRow(i: number, patch: Partial<RestaurantHours>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, hours: rows }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      alert("Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Restaurant profile
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Cuisine">
            <input
              value={profile.cuisine}
              onChange={(e) =>
                setProfile({ ...profile, cuisine: e.target.value })
              }
              className="input"
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input
              value={profile.address}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
              className="input"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={profile.description}
              onChange={(e) =>
                setProfile({ ...profile, description: e.target.value })
              }
              className="input"
              rows={2}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">
          Deposit policy
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Refundable deposit charged per guest at booking.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">€</span>
          <input
            type="number"
            min={0}
            step={1}
            value={profile.deposit_amount}
            onChange={(e) =>
              setProfile({
                ...profile,
                deposit_amount: Math.max(0, Number(e.target.value) || 0),
              })
            }
            className="input w-28"
          />
          <span className="text-sm text-gray-500">per guest</span>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-700">
          Opening hours & capacity
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Drives bookable time slots in the guest app.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-1 pr-4 font-medium">Day</th>
                <th className="py-1 pr-4 font-medium">Open</th>
                <th className="py-1 pr-4 font-medium">Close</th>
                <th className="py-1 pr-4 font-medium">Slot (min)</th>
                <th className="py-1 pr-4 font-medium">Seats / slot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td className="py-1 pr-4 font-medium text-gray-600">
                    {WEEKDAY_LABELS[r.weekday]}
                  </td>
                  <td className="py-1 pr-4">
                    <input
                      type="time"
                      value={r.open_time}
                      onChange={(e) => updateRow(i, { open_time: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="py-1 pr-4">
                    <input
                      type="time"
                      value={r.close_time}
                      onChange={(e) =>
                        updateRow(i, { close_time: e.target.value })
                      }
                      className="input"
                    />
                  </td>
                  <td className="py-1 pr-4">
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={r.slot_minutes}
                      onChange={(e) =>
                        updateRow(i, { slot_minutes: Number(e.target.value) || 30 })
                      }
                      className="input w-20"
                    />
                  </td>
                  <td className="py-1 pr-4">
                    <input
                      type="number"
                      min={1}
                      value={r.capacity_per_slot}
                      onChange={(e) =>
                        updateRow(i, {
                          capacity_per_slot: Number(e.target.value) || 1,
                        })
                      }
                      className="input w-20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600">Saved ✓</span>
        )}
      </div>

      <style>{`.input{border:1px solid #d1d5db;border-radius:0.5rem;padding:0.4rem 0.6rem;font-size:0.875rem;width:100%}`}</style>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
