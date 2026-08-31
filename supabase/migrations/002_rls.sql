-- LADDER Row Level Security — the ENTIRE security boundary (anon key is public).
-- Semantics: owner has full access; shared rows readable+writable by household
-- members; private rows invisible to the partner; no cross-household writes.

-- Helper avoids recursive-policy problems; SECURITY DEFINER bypasses RLS on
-- household_members for the membership check itself.
create or replace function public.is_household_member(hh uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hh and user_id = auth.uid()
  );
$$;

-- ------------------------------------------------- non-domain tables
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

alter table public.households enable row level security;
create policy households_select on public.households for select
  using (public.is_household_member(id));
-- No insert/update/delete policies: managed via SQL editor only.

alter table public.household_members enable row level security;
create policy household_members_select on public.household_members for select
  using (user_id = auth.uid() or public.is_household_member(household_id));
-- No client writes.

-- ------------------------------------------------- domain tables
-- Identical 4-policy pattern applied to each table via one DO block.
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budgets',
    'goals', 'goal_contributions', 'goal_dependencies', 'meetings', 'tasks'
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
