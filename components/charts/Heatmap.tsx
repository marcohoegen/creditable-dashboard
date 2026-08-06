import type { HeatCell } from "@/lib/metrics";
import { WEEKDAY_LABELS } from "@/lib/format";

// Weekday × hour covers heatmap. Pure CSS grid (no chart lib needed). Rows are
// weekdays (Mon-first for restaurant intuition), columns are service hours.
export default function Heatmap({
  cells,
  startHour = 11,
  endHour = 23,
}: {
  cells: HeatCell[];
  startHour?: number;
  endHour?: number;
}) {
  const max = cells.reduce((m, c) => Math.max(m, c.covers), 0) || 1;
  const lookup = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.covers]));
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-10" />
            {hours.map((h) => (
              <th
                key={h}
                className="text-center text-[10px] font-medium text-gray-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekdayOrder.map((wd) => (
            <tr key={wd}>
              <td className="pr-1 text-right text-[11px] font-medium text-gray-500">
                {WEEKDAY_LABELS[wd]}
              </td>
              {hours.map((h) => {
                const v = lookup.get(`${wd}-${h}`) ?? 0;
                const intensity = v / max;
                return (
                  <td key={h}>
                    <div
                      title={`${WEEKDAY_LABELS[wd]} ${h}:00 — ${v} covers`}
                      className="h-6 w-6 rounded"
                      style={{
                        backgroundColor:
                          v === 0
                            ? "#f1f5f9"
                            : `rgba(15, 118, 110, ${0.15 + intensity * 0.85})`,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
