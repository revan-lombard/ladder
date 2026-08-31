-- LADDER Life-OS foundation: assets, liabilities, net worth snapshots,
-- decision log, household values, essential-spend flag. Run after 001–004.

-- ----------------------------------------------------------------- assets
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  kind text not null default 'cash' check (kind in
    ('cash', 'investment', 'retirement', 'vehicle', 'property', 'business', 'other')),
  current_value_cents bigint not null check (current_value_cents >= 0),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ liabilities
create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  kind text not null default 'other' check (kind in
    ('home_loan', 'vehicle_finance', 'credit_card', 'personal_loan', 'store_account', 'other')),
  balance_cents bigint not null check (balance_cents >= 0),
  interest_rate_pct numeric,
  monthly_payment_cents bigint check (monthly_payment_cents >= 0),
  asset_id uuid references public.assets (id) on delete set null,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------- net worth snapshots
-- Point-in-time record so the trend survives later asset/liability edits.
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  snap_date date not null,
  assets_cents bigint not null,
  liabilities_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (household_id, snap_date)
);

-- ------------------------------------------------------------- decisions
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  title text not null,
  reason text,
  alternatives text,
  expected_outcome text,
  decided_on date not null,
  review_date date,
  actual_outcome text,
  status text not null default 'active' check (status in ('active', 'reviewed', 'superseded')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ household values
create table public.household_values (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  rank int not null default 0,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- life settings
create table public.life_settings (
  household_id uuid primary key references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  -- Which goal's contributions count as the emergency fund.
  emergency_goal_id uuid references public.goals (id) on delete set null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------- essential-spend flag
-- Essential = the household cannot realistically cut it in a crisis.
alter table public.categories add column is_essential boolean not null default false;

-- Sensible defaults for the seeded tree (children inherit via parent in code).
update public.categories set is_essential = true
where parent_id is null and name in ('Housing', 'Transport', 'Food', 'Family');

-- ------------------------------------------------------------------ RLS
do $$
declare
  t text;
begin
  foreach t in array array[
    'assets', 'liabilities', 'net_worth_snapshots', 'decisions',
    'household_values', 'life_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$
      create policy %1$s_select on public.%1$I for select using (
        owner_id = auth.uid()
        or (visibility = 'shared' and public.is_household_member(household_id))
      )$p$, t);

    execute format($p$
      create policy %1$s_insert on public.%1$I for insert with check (
        owner_id = auth.uid() and public.is_household_member(household_id)
      )$p$, t);

    execute format($p$
      create policy %1$s_update on public.%1$I for update using (
        owner_id = auth.uid()
        or (visibility = 'shared' and public.is_household_member(household_id))
      ) with check (
        public.is_household_member(household_id)
      )$p$, t);

    execute format($p$
      create policy %1$s_delete on public.%1$I for delete using (
        owner_id = auth.uid()
        or (visibility = 'shared' and public.is_household_member(household_id))
      )$p$, t);
  end loop;
end $$;
