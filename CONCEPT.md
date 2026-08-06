# Creditable Partner Dashboard — Concept

## Why this exists

Creditable reduces restaurant no-shows by taking a refundable deposit at booking
(returned when the guest shows up, captured on a no-show). The **guest app** handles
discovery and booking; this **partner dashboard** is the other side of the
marketplace — where restaurants run their day and see the evidence that the platform
works.

A restaurant partner needs to answer, at a glance:
- *Who's coming in, and today's load?* → live reservations + today snapshot.
- *Are deposits actually cutting no-shows?* → no-show rate trend, revenue recovered.
- *When are we busy / empty?* → utilization, busiest-times heatmap, lost inventory.
- *Are guests reliable and returning?* → cancellation rate, lead time, new-vs-return.

## Where it fits

```
Guest app (repo: creditable)          Partner dashboard (this repo)
  browse + book + deposit                manage + analytics
            \                               /
             \                             /
              ▼                           ▼
            Shared Supabase (Postgres + Auth + RLS)
                          │
                          ▼
                Stripe deposit capture/refund  (roadmap)
```

Separate repos, shared schema — chosen for flexibility and independent release
cadence (not a monorepo).

## What a partner sees

1. **Overview ("one view")** — today's covers, seats filled, deposits held,
   no-shows; headline KPIs (utilization, no-show/cancel rate, covers, revenue
   recovered, avg party size) with period-over-period trends; upcoming reservations.
2. **Reservations** — filter/search, mark showed/no-show/cancel (settles deposits),
   manual bookings.
3. **Analytics** — utilization over time + by weekday, busiest-times heatmap,
   no-show/cancel/show rates, covers volume, booking lead time, new-vs-returning,
   deposit economics (held/refunded/captured), empty-seat lost inventory, CSV export.
4. **Settings** — profile, deposit policy, opening hours/capacity (feed guest-app
   availability), team.

## Data & metrics

All analytics derive from `reservations` (+ `restaurant_hours` for capacity) via the
pure `lib/metrics.ts` engine. Status-transition timestamps added in
`0002_dashboard.sql` enable lead-time and accurate historical attribution. Demo mode
generates ~90 days of realistic synthetic history so the dashboard is demoable with
no backend.

## Roadmap

- **Payments**: execute deposit hold/capture/refund (Stripe) on status transitions —
  the dashboard already models the outcomes.
- **Benchmarks**: compare a restaurant against anonymized platform averages.
- **Multi-location**: rollups across a group's venues.
- **Messaging**: automated reminders and no-show grace-window check-in.
