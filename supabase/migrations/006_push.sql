-- LADDER push notifications: one row per device that opted in. Run after 001–005.
--
-- Subscriptions are strictly personal (a phone belongs to one person), so the
-- shared-visibility pattern from 002 does not apply: owner-only policies.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  -- The browser push endpoint uniquely identifies a device+browser pair.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select on public.push_subscriptions
  for select using (owner_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (
    owner_id = auth.uid() and public.is_household_member(household_id)
  );

create policy push_subscriptions_update on public.push_subscriptions
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_household_member(household_id));

create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (owner_id = auth.uid());
