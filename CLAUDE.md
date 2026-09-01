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

- **It is a no-show fee, not a deposit.** `deposit_amount` is **per guest** and
  nothing is taken at booking; the guest saves a card and is charged only on a
  no-show. Metric names in `lib/metrics.ts` still say "deposits" (held /
  refunded / captured) — that is the internal vocabulary, but **guest- and
  partner-facing copy must not**: it reads "covered by card", "not charged",
  "fees recovered".
- **`payment_status` is separate from `status`** — the booking lifecycle vs. the
  saved card (`not_required → awaiting_card → card_ready → charging → charged |
  charge_failed`). `PaymentBadge` shows it so staff can see, before pressing
  No-show, whether it will actually charge anyone.
- **Status lifecycle:** `pending_deposit → confirmed → showed | no_show | cancelled`.
  Reservation actions stamp the matching timestamp (`STATUS_TIMESTAMP` map).
- **Keep demo data realistic & deterministic** (`lib/demo-data.ts` uses a seeded RNG).
- TypeScript strict, path alias `@/*`, Tailwind `brand` palette.

## Charging a no-show (Phase 4)

Marking a reservation `no_show` can take real money. The Stripe rails live in
the **guest app** — it owns the keys, the webhook and the `payment_events` audit
trail — so this repo does NOT charge cards itself. [`lib/platform.ts`](./lib/platform.ts)
calls the guest app's `POST /api/internal/reservations/:id/charge-no-show`,
authenticated with a shared `INTERNAL_API_SECRET`. **Do not add a Stripe SDK
here**: two implementations of money movement will drift, and only one of them
will be the one that got audited.

The status change is committed **before** the charge is attempted, deliberately:
what happened in the dining room is a fact staff recorded, and must not be lost
because Stripe was briefly unreachable. The charge outcome comes back in the
PATCH response so the UI can say whether money actually moved; `charge_failed`
remains chargeable, so a decline can be retried.

Unconfigured (`PLATFORM_API_URL`/`INTERNAL_API_SECRET` unset) is a supported
mode — no-shows are recorded, nothing is charged.

**No-show marking is never automatic.** [`lib/no-show-review.ts`](./lib/no-show-review.ts)
surfaces bookings whose service has passed with no outcome recorded, as a
review queue on the overview; a human still decides. Auto-charging would turn
every forgotten tap on "Showed" into a chargeback the restaurant loses. Extend
[`test/no-show-review.test.ts`](./test/no-show-review.test.ts) when you touch it.

## Scope guardrails

Out of scope (roadmap in `CONCEPT.md`): cross-restaurant benchmarks;
multi-location rollups; venue self-onboarding (restaurants are still created by
hand in SQL). **Don't merge with the guest app or create a monorepo.**

## Git workflow

Develop on a feature branch; run `npm run build` + `npm test` before pushing. **No PR
unless asked.**
