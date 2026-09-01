-- LADDER forecast: the committed monthly amount that feeds the ladder.
-- Null = not set; the app then derives a default from measured surplus.
-- Run after 001–006.

alter table public.life_settings
  add column ladder_monthly_commit_cents bigint
  check (ladder_monthly_commit_cents >= 0);
