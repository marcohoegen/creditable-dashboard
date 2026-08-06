import type { ReservationStatus } from "@/types/db";

const STYLES: Record<ReservationStatus, string> = {
  pending_deposit: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  showed: "bg-emerald-100 text-emerald-800",
  no_show: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const LABELS: Record<ReservationStatus, string> = {
  pending_deposit: "Pending",
  confirmed: "Confirmed",
  showed: "Showed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
