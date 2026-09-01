# CLAUDE.md — Agent guide for the Creditable Partner Dashboard

> Operating guide for AI agents (and humans). Read this first.
> Companion docs: [`README.md`](./README.md) (setup) · [`CONCEPT.md`](./CONCEPT.md)
> (product & architecture).

## What this is

The **restaurant-facing dashboard** for Creditable, the deposit-backed reservation
platform. Restaurants manage their bookings here and view performance analytics
(utilization, no-show rate, cancellation rate, deposit revenue recovered).

**This is a SEPARATE repo from the guest app — deliberately NOT a monorepo.** It
shares the **same Supabase project/schema** as the guest app
(`marcohoegen/creditable`). Do not merge the two; do not introduce a monorepo.

Stack: Next.js (App Router) · TypeScript (strict) · Tailwind · Supabase · Recharts.

## ⚠️ Two data modes (most important concept)

Gated by `isSupabaseConfigured` in [`lib/supabase/env.ts`](./lib/supabase/env.ts):

| Mode | When | Data | Auth |
| --- | --- | --- | --- |
| **Demo** | no `NEXT_PUBLIC_SUPABASE_*` | synthetic history ([`lib/demo-data.ts`](./lib/demo-data.ts)) | auto "logged in" as the demo restaurant; writes simulated |
| **Live** | env vars set | shared Supabase Postgres | Supabase magic-link; restaurant resolved via `restaurant_users` |

**Demo mode must always work with zero config** (it's how the dashboard is shown to
prospective partners). Every data function keeps a seed fallback — see the
`if (!supabase) return <demo>` pattern in [`lib/reservations.ts`](./lib/reservations.ts),
[`lib/session.ts`](./lib/session.ts), and [`lib/settings.ts`](./lib/settings.ts).

## Commands

`npm run dev` · `npm run build` (run before pushing — catches TS + Recharts SSR) ·
`npm run lint` · `npm test` (pure metrics tests, fast loop).

## Architecture

- **`lib/metrics.ts`** — the heart: a **pure, unit-tested** analytics engine. Takes
  `Reservation[]` (+ `RestaurantHours[]` for capacity) → all KPIs, time series,
  weekday rollups, heatmap, lead-time buckets, deposit outcomes, new-vs-returning.
  No I/O, all UTC date math (timezone-stable). **Extend
  [`test/metrics.test.ts`](./test/metrics.test.ts) whenever you touch it.**
- **Server Components do the math**: pages (`app/(dashboard)/*`) load data via the
  `server-only` data layer and compute metrics with `lib/metrics.ts`, then pass plain
  serializable arrays to client chart components.
- **Charts are client-only** (`components/charts/*`, `"use client"`, Recharts). Never
  import Recharts into a Server Component. The heatmap is pure CSS (no lib).
- **Data layer is `server-only`**: [`lib/reservations.ts`](./lib/reservations.ts),
  [`lib/session.ts`](./lib/session.ts), [`lib/settings.ts`](./lib/settings.ts). Never
  import these into a client component — clients mutate via the `app/api/*` route
  handlers (`PATCH /api/reservations/:id`, `POST /api/reservations`, `PATCH
  /api/settings`, `GET /api/export`).
- **Range selection** is URL-driven (`?range=7|30|90`) so analytics stay
  server-computed; see [`lib/range.ts`](./lib/range.ts) and `RangePicker`.

## Shared schema (coordinate carefully)

Base tables (`restaurants`, `restaurant_hours`, `reservations`) are owned by the
**guest app** repo (`supabase/migrations/0001_init.sql`). This repo adds, via
[`supabase/migrations/0002_dashboard.sql`](./supabase/migrations/0002_dashboard.sql)
— **additive & idempotent**:
- `restaurant_users` (auth → restaurant mapping) + restaurant-scoped RLS;
- reservation status-transition timestamps (`checked_in_at`, `cancelled_at`,
  `no_show_marked_at`, `confirmed_at`, `updated_at`) + `notes`, `source`;
- the `restaurant_daily_stats` view.

Plus [`0003_reservation_read.sql`](./supabase/migrations/0003_reservation_read.sql):
the restaurant-scoped **SELECT** policy on `reservations`. The dashboard used to
rely on the guest app's `reservations_public_read using (true)` for reads — which
also exposed every guest name and email to anyone with the public anon key. The
guest app's `0003_data_safety.sql` drops that policy, so **this migration must be
applied or the dashboard reads zero reservations in live mode.** Both repos ship
the same policy, guarded/idempotent, so migration order between them doesn't
matter.

Guest reservation *writes* now go through the guest app's `book_slot()` function
(atomic capacity check); direct inserts into `reservations` are no longer
permitted for `anon`. Dashboard-side manual bookings via `POST /api/reservations`
run as an authenticated restaurant user and are unaffected.

The guest app stays the canonical schema owner; keep changes here additive and
consider upstreaming. `types/db.ts` mirrors the schema — keep them in sync.

## Conventions

- **Deposit semantics:** restaurant `deposit_amount` is **per guest**; a reservation's
  deposit = `deposit_amount × party_size`. Outcomes are derived from status:
  `showed` → refunded, `no_show` → captured (recovered revenue), active → held.
  Payments are **not** wired (roadmap) — the dashboard models money, doesn't move it.
- **Status lifecycle:** `pending_deposit → confirmed → showed | no_show | cancelled`.
  Reservation actions stamp the matching timestamp (`STATUS_TIMESTAMP` map).
- **Keep demo data realistic & deterministic** (`lib/demo-data.ts` uses a seeded RNG).
- TypeScript strict, path alias `@/*`, Tailwind `brand` palette.

## Scope guardrails

Out of scope (roadmap in `CONCEPT.md`): Stripe deposit capture/refund execution;
cross-restaurant benchmarks; multi-location rollups; automated no-show/reminder
messaging. **Don't merge with the guest app or create a monorepo.**

## Git workflow

Develop on a feature branch; run `npm run build` + `npm test` before pushing. **No PR
unless asked.**
