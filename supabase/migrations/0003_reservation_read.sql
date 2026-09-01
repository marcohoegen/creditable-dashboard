-- Creditable dashboard — restaurant-scoped reservation reads.
-- ADDITIVE & IDEMPOTENT. Apply after 0002_dashboard.sql.
--
-- WHY THIS EXISTS
-- The guest app's 0001_init.sql granted `reservations_public_read using (true)`,
-- and the dashboard quietly relied on it for SELECT. That policy was a GDPR hole
-- (any holder of the public anon key could read every guest name and email), so
-- the guest app's 0003_data_safety.sql drops it. Without a replacement the
-- dashboard would lose read access to its own bookings.
--
-- The guest repo's 0003 installs this same policy, but only if 0002 has already
-- run there. This file covers the other order — dashboard schema applied last —
-- so the pair is order-independent. Both are idempotent; running both is fine.

drop policy if exists "reservations_manage_read" on public.reservations;
create policy "reservations_manage_read"
  on public.reservations for select
  using (public.manages_restaurant(restaurant_id));

-- Staff manual bookings (POST /api/reservations, `source = 'manual'`) also
-- depended on the guest app's blanket `reservations_public_insert`, which 0003
-- drops — 0002 granted managers UPDATE but never INSERT. Without this policy,
-- adding a walk-in from the dashboard fails with an RLS violation in live mode.
-- Scoped to the restaurants the user actually manages.
drop policy if exists "reservations_manage_insert" on public.reservations;
create policy "reservations_manage_insert"
  on public.reservations for insert
  with check (public.manages_restaurant(restaurant_id));
