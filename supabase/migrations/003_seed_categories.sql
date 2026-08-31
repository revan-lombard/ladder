-- LADDER seed: household + members + default category tree.
-- ✏️ EDIT the two emails below to the real account emails BEFORE running.
-- Requires both auth users to exist already (dashboard-created) and
-- 001 + 002 to have run.

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_household uuid;
  v_parent uuid;
  parent_name text;
  child_name text;
  parents jsonb := $j$
  {
    "Housing":   ["Rent", "Bond", "Rates", "Levy", "Electricity", "Water", "Internet", "Maintenance", "Security"],
    "Transport": ["Vehicle payment", "Insurance", "Fuel", "Maintenance", "Tyres", "Licence", "Toll", "Parking"],
    "Food":      ["Groceries", "Restaurants", "Takeaways", "Coffee"],
    "Family":    ["Baby", "Childcare", "Medical", "Clothing", "School", "Stationery", "Activities", "Toys"],
    "Financial": ["Savings", "Investments", "Retirement", "Debt repayment", "Insurance"],
    "Lifestyle": ["Entertainment", "Hobbies", "Gym", "Technology", "Clothing", "Subscriptions"],
    "Luxury":    ["Sports car", "Motorcycle", "Track days", "Modifications", "Luxury holidays"]
  }
  $j$::jsonb;
  sort_i int := 0;
begin
  select id into v_user_a from auth.users where email = 'r4v3n.lmb@gmail.com';
  select id into v_user_b from auth.users where email = 'bronwen2504@icloud.com';

  if v_user_a is null or v_user_b is null then
    raise exception 'Edit the two emails in 003_seed_categories.sql to match the dashboard-created users.';
  end if;

  insert into public.households (name) values ('Our Household')
  returning id into v_household;

  insert into public.household_members (household_id, user_id)
  values (v_household, v_user_a), (v_household, v_user_b);

  -- Expense tree (owner = user A; visibility shared).
  for parent_name in select jsonb_object_keys(parents) loop
    sort_i := sort_i + 10;
    insert into public.categories (household_id, owner_id, name, kind, sort_order)
    values (v_household, v_user_a, parent_name, 'expense', sort_i)
    returning id into v_parent;

    for child_name in select jsonb_array_elements_text(parents -> parent_name) loop
      insert into public.categories (household_id, owner_id, parent_id, name, kind)
      values (v_household, v_user_a, v_parent, child_name, 'expense');
    end loop;
  end loop;

  -- Income tree so income entries categorise cleanly.
  insert into public.categories (household_id, owner_id, name, kind, sort_order)
  values (v_household, v_user_a, 'Income', 'income', 999)
  returning id into v_parent;

  insert into public.categories (household_id, owner_id, parent_id, name, kind)
  values
    (v_household, v_user_a, v_parent, 'Salary', 'income'),
    (v_household, v_user_a, v_parent, 'Other income', 'income');

  raise notice 'Seed complete: household %', v_household;
end $$;
