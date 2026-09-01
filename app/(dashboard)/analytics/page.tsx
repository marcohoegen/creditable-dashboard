import Link from "next/link";
import { redirect } from "next/navigation";
import Card from "@/components/Card";
import KpiCard from "@/components/kpi/KpiCard";
import RangePicker from "@/components/RangePicker";
import TrendLineChart from "@/components/charts/TrendLineChart";
import BarChart from "@/components/charts/BarChart";
import StatusDonut from "@/components/charts/StatusDonut";
import Heatmap from "@/components/charts/Heatmap";
import { getCurrentRestaurant } from "@/lib/session";
import { getDashboardData } from "@/lib/reservations";
import {
  byWeekday,
  dailySeries,
  heatmap,
  inRange,
  leadTimeHistogram,
  summarize,
} from "@/lib/metrics";
import { parseRange, resolveRange, delta } from "@/lib/range";
import { eur, pct, shortDate } from "@/lib/format";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/login");

  const { hours, reservations } = await getDashboardData(restaurant);
  const now = new Date();
  const key = parseRange(searchParams.range);
  const range = resolveRange(key, now);

  const scoped = inRange(reservations, range.fromISO, range.toISO);
  const cur = summarize(reservations, hours, range.fromISO, range.toISO);
  const prev = summarize(reservations, hours, range.prevFromISO, range.prevToISO);

  const series = dailySeries(scoped, hours, range.fromISO, range.toISO).map(
    (p) => ({ ...p, label: shortDate(`${p.date}T00:00:00Z`) }),
  );
  const weekday = byWeekday(scoped);
  const heat = heatmap(scoped);
  const leadBuckets = leadTimeHistogram(scoped);

  // Lost inventory: empty seats across the range.
  const totalCapacity = series.reduce((s, p) => s + p.capacity, 0);
  const totalCovers = series.reduce((s, p) => s + p.covers, 0);
  const emptySeats = Math.max(0, totalCapacity - totalCovers);

  const newReturning = [
    { name: "New", value: cur.newReturning.newGuests, color: "#0f766e" },
    { name: "Returning", value: cur.newReturning.returning, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-500">
            {restaurant.name} · last {key} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker value={key} />
          <Link
            href={`/api/export?range=${key}`}
            className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Utilization"
          value={pct(cur.utilization)}
          delta={delta(cur.utilization, prev.utilization)}
          higherIsBetter
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
          label="Show rate"
          value={pct(cur.showRate, 1)}
          delta={delta(cur.showRate, prev.showRate)}
          higherIsBetter
        />
      </div>

      {/* Utilization & volume trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Utilization over time">
          <TrendLineChart
            data={series}
            percent
            series={[
              { key: "utilization", label: "Utilization", color: "#0f766e" },
            ]}
          />
        </Card>
        <Card title="Covers per day">
          <TrendLineChart
            data={series}
            series={[
              { key: "covers", label: "Covers", color: "#0f766e" },
              { key: "capacity", label: "Capacity", color: "#cbd5e1" },
            ]}
          />
        </Card>
      </div>

      {/* Busiest times heatmap */}
      <Card title="Busiest times (covers by weekday × hour)">
        <Heatmap cells={heat} />
      </Card>

      {/* Weekday breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Covers by weekday">
          <BarChart data={weekday} dataKey="covers" color="#0f766e" />
        </Card>
        <Card title="No-show rate by weekday">
          <BarChart data={weekday} dataKey="noShowRate" color="#ef4444" percent />
        </Card>
      </div>

      {/* Lead time + guests */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Booking lead time">
          <BarChart data={leadBuckets} dataKey="count" color="#3b82f6" />
        </Card>
        <Card title="New vs returning guests">
          {newReturning.length ? (
            <StatusDonut data={newReturning} />
          ) : (
            <p className="text-sm text-gray-500">No data.</p>
          )}
        </Card>
      </div>

      {/* No-show fee economics + lost inventory */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Covered by card"
          value={eur(cur.deposits.held)}
          sub="fee exposure on active bookings"
        />
        <KpiCard
          label="Not charged"
          value={eur(cur.deposits.refunded)}
          sub="guests who showed up"
        />
        <KpiCard
          label="Fees recovered"
          value={eur(cur.deposits.captured)}
          sub="charged to no-shows"
          higherIsBetter
        />
        <KpiCard
          label="Empty seats"
          value={String(emptySeats)}
          sub="unsold capacity in range"
          higherIsBetter={false}
        />
      </div>
    </div>
  );
}
