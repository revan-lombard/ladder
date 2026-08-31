-- LADDER schema — run first, then 002_rls.sql, then 003_seed_categories.sql.
-- Conventions: money in integer cents (bigint); date-only values as `date`;
-- every domain table carries household_id + owner_id + visibility.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',
                           split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this migration ran.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- -------------------------------------------------------------- households
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  kind text not null default 'cheque'
    check (kind in ('cheque', 'savings', 'credit_card', 'cash', 'other')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- categories
-- Tree via parent_id. `pillar` is the v2+ extensibility hook (health, career…).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  pillar text not null default 'financial',
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index categories_unique_name
  on public.categories (household_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- ------------------------------------------------------------ transactions
-- Expenses AND income in one table; `kind` gives the sign, amounts positive.
-- owner_id = who entered the row; person_id = whose money it was (null = household).
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  account_id uuid not null references public.accounts (id),
  category_id uuid references public.categories (id),
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  txn_date date not null,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  person_id uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

create index transactions_by_month on public.transactions (household_id, txn_date desc);
create index transactions_by_category on public.transactions (category_id);
create index transactions_by_account on public.transactions (account_id);

-- ----------------------------------------------------------------- budgets
-- month is always the first of the month.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (household_id, category_id, month)
);

-- ------------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  target_amount_cents bigint not null check (target_amount_cents > 0),
  target_date date,
  ladder_position int not null default 0,
  status text not null default 'active' check (status in ('active', 'complete', 'archived')),
  pillar text not null default 'financial',
  notes text,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  goal_id uuid not null references public.goals (id) on delete cascade,
  contrib_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  note text,
  created_at timestamptz not null default now()
);

create index goal_contributions_by_goal on public.goal_contributions (goal_id);

-- One prerequisite per goal (goal_id is the PK). App checks for 2-cycles.
create table public.goal_dependencies (
  goal_id uuid primary key references public.goals (id) on delete cascade,
  depends_on_goal_id uuid not null references public.goals (id) on delete cascade,
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  check (goal_id <> depends_on_goal_id)
);

-- ---------------------------------------------------------------- meetings
-- agenda is a jsonb SNAPSHOT frozen when the meeting starts, so the record
-- stays stable as underlying data changes afterwards.
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  kind text not null check (kind in ('weekly', 'monthly')),
  meeting_date date not null,
  agenda jsonb not null default '{}'::jsonb,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, kind, meeting_date)
);

-- ------------------------------------------------------------------- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  meeting_id uuid references public.meetings (id) on delete set null,
  title text not null,
  priority int not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
