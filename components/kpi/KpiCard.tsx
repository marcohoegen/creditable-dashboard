import Sparkline from "@/components/charts/Sparkline";

export interface KpiCardProps {
  label: string;
  value: string;
  /** Sub-label under the value, e.g. an absolute count. */
  sub?: string;
  /** Period-over-period change as a ratio (0.12 = +12%). */
  delta?: number;
  /** Whether a positive delta is good (green) or bad (red). */
  higherIsBetter?: boolean;
  trend?: number[];
}

export default function KpiCard({
  label,
  value,
  sub,
  delta,
  higherIsBetter = true,
  trend,
}: KpiCardProps) {
  const hasDelta = typeof delta === "number" && isFinite(delta) && delta !== 0;
  const positive = (delta ?? 0) > 0;
  const good = positive === higherIsBetter;

  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {hasDelta && (
          <span
            className={`text-xs font-medium ${
              good ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {positive ? "▲" : "▼"} {Math.abs((delta as number) * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {trend && trend.length > 1 && (
        <div className="mt-2">
          <Sparkline data={trend} color={good ? "#0f766e" : "#dc2626"} />
        </div>
      )}
    </div>
  );
}
