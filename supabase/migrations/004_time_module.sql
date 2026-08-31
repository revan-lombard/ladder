-- LADDER Time & Commitments module v1: events, projects, task upgrades,
-- capacity settings. Run after 001–003.

-- -------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  name text not null,
  deadline date,
  -- Fallback effort when tasks carry no estimates; task estimates win.
  estimated_minutes int not null default 0 check (estimated_minutes >= 0),
  priority int not null default 2 check (priority between 0 and 3),
  goal_id uuid references public.goals (id) on delete set null,
  notes text,
  status text not null default 'active' check (status in ('active', 'complete', 'archived')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- events
-- Calendar-lite: date + optional times. Recurrence is deliberately out of v1.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  title text not null,
  category text not null default 'personal' check (category in
    ('work', 'personal', 'relationship', 'family', 'health', 'career', 'business', 'travel', 'protected')),
  event_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  location text,
  project_id uuid references public.projects (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index events_by_date on public.events (household_id, event_date);

-- ---------------------------------------------------- capacity settings
-- One row per household: the realistic weekly pool projects draw from.
create table public.time_settings (
  household_id uuid primary key references public.households (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  weekly_flexible_hours numeric not null default 20 check (weekly_flexible_hours >= 0),
  -- Never plan at 100%: default 80% planned, 20% buffer (brief §17).
  utilization_pct int not null default 80 check (utilization_pct between 10 and 100),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- task upgrades
alter table public.tasks add column description text;
alter table public.tasks add column estimated_minutes int check (estimated_minutes > 0);
alter table public.tasks add column actual_minutes int check (actual_minutes > 0);
alter table public.tasks add column project_id uuid references public.projects (id) on delete set null;
alter table public.tasks add column goal_id uuid references public.goals (id) on delete set null;
alter table public.tasks add column energy text check (energy in ('low', 'medium', 'high'));

-- Widen statuses: legacy 'open'/'done' remain valid ('open' = not started).
alter table public.tasks drop constraint tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'in_progress', 'blocked', 'done', 'cancelled'));

create index tasks_by_project on public.tasks (project_id);

-- ------------------------------------------------------------------ RLS
-- Identical 4-policy pattern as 002_rls.sql.
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'events', 'time_settings'] loop
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
