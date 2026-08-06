"use client";

import { useMemo, useState } from "react";
import type { Reservation, ReservationStatus } from "@/types/db";
import StatusBadge from "@/components/StatusBadge";
import { eur } from "@/lib/format";

type Filter = "all" | "upcoming" | "showed" | "no_show" | "cancelled" | "pending";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "showed", label: "Showed" },
  { key: "no_show", label: "No-shows" },
  { key: "cancelled", label: "Cancelled" },
  { key: "pending", label: "Pending" },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservationsView({
  initial,
  restaurant,
}: {
  initial: Reservation[];
  restaurant: { id: string; name: string; deposit_amount: number };
}) {
  const [rows, setRows] = useState<Reservation[]>(initial);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const now = Date.now();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "upcoming")
          return new Date(r.slot_at).getTime() > now && r.status !== "cancelled";
        if (filter === "pending") return r.status === "pending_deposit";
        if (filter !== "all") return r.status === filter;
        return true;
      })
      .filter(
        (r) =>
          !q ||
          r.guest_name.toLowerCase().includes(q) ||
          r.guest_email.toLowerCase().includes(q),
      )
      .sort((a, b) => b.slot_at.localeCompare(a.slot_at))
      .slice(0, 200);
  }, [rows, filter, query, now]);

  async function setStatus(id: string, status: ReservationStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      );
    } catch {
      alert("Could not update reservation.");
    } finally {
      setBusyId(null);
    }
  }

  function onCreated(r: Reservation) {
    setRows((prev) => [r, ...prev]);
    setShowManual(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === f.key
                  ? "bg-brand text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest…"
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setShowManual((v) => !v)}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + Manual booking
          </button>
        </div>
      </div>

      {showManual && (
        <ManualBookingForm
          restaurant={restaurant}
          onCreated={onCreated}
          onCancel={() => setShowManual(false)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Guest</th>
              <th className="px-4 py-2 font-medium">Party</th>
              <th className="px-4 py-2 font-medium">Deposit</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => {
              const actionable =
                r.status === "confirmed" || r.status === "pending_deposit";
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2">{fmt(r.slot_at)}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.guest_name}</div>
                    <div className="text-xs text-gray-400">{r.guest_email}</div>
                  </td>
                  <td className="px-4 py-2">{r.party_size}</td>
                  <td className="px-4 py-2">{eur(r.deposit_amount)}</td>
                  <td className="px-4 py-2 text-gray-500">{r.source ?? "web"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2">
                    {actionable ? (
                      <div className="flex gap-1">
                        <ActionBtn
                          disabled={busyId === r.id}
                          tone="green"
                          onClick={() => setStatus(r.id, "showed")}
                        >
                          Showed
                        </ActionBtn>
                        <ActionBtn
                          disabled={busyId === r.id}
                          tone="red"
                          onClick={() => setStatus(r.id, "no_show")}
                        >
                          No-show
                        </ActionBtn>
                        <ActionBtn
                          disabled={busyId === r.id}
                          tone="gray"
                          onClick={() => setStatus(r.id, "cancelled")}
                        >
                          Cancel
                        </ActionBtn>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No reservations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "green" | "red" | "gray";
  disabled?: boolean;
}) {
  const tones = {
    green: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    red: "border-red-200 text-red-700 hover:bg-red-50",
    gray: "border-gray-200 text-gray-600 hover:bg-gray-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function ManualBookingForm({
  restaurant,
  onCreated,
  onCancel,
}: {
  restaurant: { id: string; deposit_amount: number };
  onCreated: (r: Reservation) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("19:00");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const slotAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: name,
          guestEmail: email || "walkin@example.com",
          partySize: party,
          slotAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data.reservation);
    } catch {
      alert("Could not create booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-6"
    >
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Guest name"
        className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
      />
      <input
        type="number"
        min={1}
        max={20}
        value={party}
        onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))}
        className="rounded-lg border px-3 py-2 text-sm"
      />
      <div className="flex gap-2 sm:col-span-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add booking"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
