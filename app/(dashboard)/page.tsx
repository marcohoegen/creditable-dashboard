import Card from "@/components/Card";
import NeedsReviewList from "@/components/reservations/NeedsReviewList";
import { pendingReview } from "@/lib/no-show-review";
import KpiCard from "@/components/kpi/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import TrendLineChart from "@/components/charts/TrendLineChart";
import StatusDonut from "@/components/charts/StatusDonut";
import { getCurrentRestaurant } from "@/lib/session";
import { getDashboardData } from "@/lib/reservations";
import { redirect } from "next/navigation";
import {
  bookedCovers,
  dailySeries,
  depositOutcomes,
  inRange,
  isActive,
  seatsForWeekday,
  summarize,
} from "@/lib/metrics";
import { resolveRange, delta } from "@/lib/range";
import { dayKey, eur, pct, shortDate } from "@/lib/format";

export default async function OverviewPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/login");

  const { hours, reservations } = await getDashboardData(restaurant);
  const now = new Date();
  const todayK = dayKey(now.toISOString());
  const range = resolveRange("30", now);

  const cur = summarize(reservations, hours, range.fromISO, range.toISO);
  const prev = summarize(reservations, hours, range.prevFromISO, range.prevToISO);
  const series = dailySeries(
    inRange(reservations, range.fromISO, range.toISO),
    hours,
    range.fromISO,
    range.toISO,
  ).map((p) => ({ ...p, label: shortDate(`${p.date}T00:00:00Z`) }));

  // Today snapshot.
  const todayRs = reservations.filter((r) => dayKey(r.slot_at) === todayK);
  const expectedCovers = bookedCovers(todayRs);
  const todayCapacity = seatsForWeekday(hours, now.getUTCDay());
  const todayUtil = todayCapacity ? expectedCovers / todayCapacity : 0;
  const depositsHeldToday = depositOutcomes(todayRs).held;
  const noShowsToday = todayRs.filter((r) => r.status === "no_show").length;

  // Service is over and nobody marked these seated, no-show or cancelled. They
  // are surfaced for a human decision rather than auto-marked: automatically
  // charging a guest because staff forgot to tap "seated" is how you lose
  // chargebacks. See lib/no-show-review.ts.
  const needsReview = pendingReview(reservations, now).slice(0, 8);

  const upcoming = reservations
    .filter((r) => new Date(r.slot_at) > now && isActive(r))
    .sort((a, b) => a.slot_at.localeCompare(b.slot_at))
    .slice(0, 6);

  const donut = [
    { name: "Showed", value: cur.counts.showed, color: "#10b981" },
    { name: "No-show", value: cur.counts.no_show, color: "#ef4444" },
    { name: "Cancelled", value: cur.counts.cancelled, color: "#9ca3af" },
    { name: "Confirmed", value: cur.counts.confirmed, color: "#3b82f6" },
    { name: "Pending", value: cur.counts.pending_deposit, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Overview</h1>
        <p className="text-sm text-gray-500">
          {restaurant.name} · last 30 days
        </p>
      </header>

      {/* Today snapshot */}
      <Card title="Today">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Snapshot label="Covers booked" value={String(expectedCovers)} />
          <Snapshot
            label="Seats filled"
            value={pct(todayUtil)}
            sub={`${expectedCovers}/${todayCapacity} seats`}
          />
          <Snapshot label="Covered by card" value={eur(depositsHeldToday)} />
          <Snapshot label="No-shows today" value={String(noShowsToday)} />
        </div>
      </Card>

      {/* Headline KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Utilization"
          value={pct(cur.utilization)}
          delta={delta(cur.utilization, prev.utilization)}
          higherIsBetter
          trend={series.map((p) => p.utilization)}
        />
        <KpiCard
          label="No-show rate"
          value={pct(cur.noShowRate, 1)}
          delta={delta(cur.noShowRate, prev.noShowRate)}
          higherIsBetter={false}
        />
        <KpiCard
          label="Cancellation rate"
          value={pct(cur.cancelRate, 1)}
          delta={delta(cur.cancelRate, prev.cancelRate)}
          higherIsBetter={false}
        />
        <KpiCard
          label="Covers served"
          value={String(cur.coversServed)}
          delta={delta(cur.coversServed, prev.coversServed)}
          higherIsBetter
          trend={series.map((p) => p.covers)}
        />
        <KpiCard
          label="No-show fees recovered"
          value={eur(cur.deposits.captured)}
          sub="captured from no-shows"
          delta={delta(cur.deposits.captured, prev.deposits.captured)}
          higherIsBetter
        />
        <KpiCard
          label="Avg party size"
          value={cur.averagePartySize.toFixed(1)}
          delta={delta(cur.averagePartySize, prev.averagePartySize)}
          higherIsBetter
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Covers vs capacity" className="lg:col-span-2">
          <TrendLineChart
            data={series}
            series={[
              { key: "covers", label: "Covers", color: "#0f766e" },
              { key: "capacity", label: "Capacity", color: "#cbd5e1" },
            ]}
          />
        </Card>
        <Card title="Reservation outcomes">
          <StatusDonut data={donut} />
        </Card>
      </div>

      {needsReview.length > 0 && <NeedsReviewList reservations={needsReview} />}

      {/* Upcoming */}
      <Card title="Upcoming reservations">
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming reservations.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((r) => {
              const when = new Date(r.slot_at);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.guest_name}</span>
                    <span className="text-gray-400">
                      {" "}
                      · party of {r.party_size}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">
                      {when.toLocaleString([], {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Snapshot({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
