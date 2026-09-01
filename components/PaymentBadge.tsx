import type { PaymentStatus } from "@/types/db";

// What the saved card is doing. Deliberately separate from StatusBadge: the
// booking lifecycle and the money are different questions, and staff need to
// see at a glance whether marking a no-show would actually charge anyone.

const STYLES: Record<PaymentStatus, string> = {
  not_required: "bg-gray-100 text-gray-500",
  awaiting_card: "bg-amber-100 text-amber-800",
  card_ready: "bg-blue-100 text-blue-800",
  card_failed: "bg-orange-100 text-orange-800",
  charging: "bg-purple-100 text-purple-800",
  charged: "bg-emerald-100 text-emerald-800",
  charge_failed: "bg-red-100 text-red-800",
};

const LABELS: Record<PaymentStatus, string> = {
  not_required: "No card",
  awaiting_card: "Awaiting card",
  card_ready: "Card saved",
  card_failed: "Card failed",
  charging: "Charging…",
  charged: "Fee charged",
  charge_failed: "Charge failed",
};

export default function PaymentBadge({
  status,
}: {
  status?: PaymentStatus | null;
}) {
  const value: PaymentStatus = status ?? "not_required";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[value]}`}
      title={LABELS[value]}
    >
      {LABELS[value]}
    </span>
  );
}
