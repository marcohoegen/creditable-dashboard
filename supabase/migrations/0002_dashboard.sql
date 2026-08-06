-- Creditable dashboard schema additions.
-- ADDITIVE & IDEMPOTENT — safe to run on the SHARED Supabase project alongside
-- the guest app's 0001_init.sql. Apply via the Supabase SQL editor.

-- ── Reservation status-transition timestamps + metadata ──────────────────────
-- Enable lead-time analysis and accurate historical attribution.
alter table public.reservations add column if not exists confirmed_at      timestamptz;
alter table public.reservations add column if not exists cancelled_at      timestamptz;
alter table public.reservations add column if not exists checked_in_at     timestamptz; -- guest showed
alter table public.reservations add column if not exists no_show_marked_at timestamptz;
alter table public.reservations add column if not exists updated_at        timestamptz default now();
alter table public.reservations add column if not exists notes             text;
alter table public.reservations add column if not exists source            text not null default 'web'
  check (source in ('web', 'manual'));

-- ── Auth / multi-tenancy: which users manage which restaurant ────────────────
create table if not exists public.restaurant_users (
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner', 'staff')),
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

alter table public.restaurant_users enable row level security;

drop policy if exists "restaurant_users_self_read" on public.restaurant_users;
create policy "restaurant_users_self_read"
  on public.restaurant_users for select
  using (user_id = auth.uid());

-- Helper: does the current user manage this restaurant?
create or replace function public.manages_restaurant(rid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurant_users
    where user_id = auth.uid() and restaurant_id = rid
  );
$$;

-- ── Restaurant-scoped management policies for the dashboard ───────────────────
-- (Guest-app public read + public reservation insert from 0001 remain in place.)
drop policy if exists "reservations_manage_update" on public.reservations;
create policy "reservations_manage_update"
  on public.reservations for update
  using (public.manages_restaurant(restaurant_id))
  with check (public.manages_restaurant(restaurant_id));

drop policy if exists "restaurants_manage_update" on public.restaurants;
create policy "restaurants_manage_update"
  on public.restaurants for update
  using (public.manages_restaurant(id))
  with check (public.manages_restaurant(id));

drop policy if exists "restaurant_hours_manage_all" on public.restaurant_hours;
create policy "restaurant_hours_manage_all"
  on public.restaurant_hours for all
  using (public.manages_restaurant(restaurant_id))
  with check (public.manages_restaurant(restaurant_id));

-- ── Analytics aggregation view ───────────────────────────────────────────────
-- Per restaurant/day rollup. Capacity is added in the app layer (lib/metrics.ts)
-- from restaurant_hours; this view covers reservation-side aggregates.
create or replace view public.restaurant_daily_stats as
select
  r.restaurant_id,
  (r.slot_at at time zone 'UTC')::date                              as day,
  count(*)                                                           as reservations,
  sum(r.party_size) filter (where r.status <> 'cancelled')          as booked_covers,
  count(*) filter (where r.status = 'showed')                       as showed,
  count(*) filter (where r.status = 'no_show')                      as no_show,
  count(*) filter (where r.status = 'cancelled')                    as cancelled,
  coalesce(sum(r.deposit_amount) filter (where r.status = 'showed'), 0)  as deposits_refunded,
  coalesce(sum(r.deposit_amount) filter (where r.status = 'no_show'), 0) as deposits_captured
from public.reservations r
group by r.restaurant_id, day;
