# Creditable — Partner Dashboard

The restaurant-facing side of [Creditable](https://github.com/marcohoegen/creditable),
the deposit-backed reservation platform. Partner restaurants use this dashboard to
manage bookings and see the analytics that prove the platform's value — utilization,
no-show rate, cancellation rate, and deposit revenue recovered.

> **Separate repo by design** (not a monorepo). It shares the **same Supabase
> project/schema** as the guest app. See [`CONCEPT.md`](./CONCEPT.md).

## Features

- **One-view overview** — today's covers/utilization/deposits/no-shows + headline
  KPIs with period-over-period trends.
- **Reservations** — filter/search, mark **showed** / **no-show** / **cancel**
  (settles the deposit), and add **manual** walk-in/phone bookings.
- **Analytics** — utilization over time, a weekday×hour **busiest-times heatmap**,
  no-show & cancellation rates, covers, booking lead time, new-vs-returning guests,
  deposit economics, empty-seat (lost inventory), and **CSV export**.
- **Settings** — profile, deposit policy, and opening hours/capacity (which drive
  guest-app availability).

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · **Recharts**.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No backend required** — without Supabase env vars the
dashboard runs in **demo mode** with ~90 days of synthetic history
([`lib/demo-data.ts`](./lib/demo-data.ts)), so every chart and the heatmap are fully
populated and you can demo it to prospective partners.

### Connecting to the shared Supabase project

1. Apply [`supabase/migrations/0002_dashboard.sql`](./supabase/migrations/0002_dashboard.sql)
   to the **same** Supabase project the guest app uses (it's additive/idempotent).
2. `cp .env.local.example .env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Create a `restaurant_users` row linking your Supabase auth user to a restaurant.
4. Restart `npm run dev`, sign in with the magic link, and you'll see that
   restaurant's live reservations and analytics.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`lib/metrics.ts`) |

## How the analytics work

[`lib/metrics.ts`](./lib/metrics.ts) is a pure, unit-tested module that turns
`Reservation[]` (+ opening hours for capacity) into every KPI, time series, and the
heatmap — identical for demo and live data. Extend
[`test/metrics.test.ts`](./test/metrics.test.ts) when you change it.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture/onboarding guide.
