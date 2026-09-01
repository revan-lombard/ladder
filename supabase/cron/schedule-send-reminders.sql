-- Schedule the daily reminder push. NOT a migration — run this once in the
-- SQL Editor AFTER deploying the send-reminders Edge Function, replacing
-- SERVICE_ROLE_KEY_HERE with the key from Project Settings → API (keep it
-- out of source control).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 04:30 UTC = 06:30 South Africa (SAST has no daylight saving).
select cron.schedule(
  'ladder-send-reminders',
  '30 4 * * *',
  $$
  select net.http_post(
    url := 'https://tsqyxvckftioztlniqop.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  )
  $$
);

-- To inspect: select * from cron.job;
-- To remove:  select cron.unschedule('ladder-send-reminders');
