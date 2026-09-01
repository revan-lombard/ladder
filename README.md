# 🪜 LADDER

**Build the life you want. One rung at a time.**

A private, intelligent personal + family life-management PWA for a two-person household: money tracking, budgets, a goal ladder, weekly/monthly planning, and honest data-driven insights. LADDER tells you what the data says — not what you want to hear.

## Stack

- **Vite 6 + React 19 + TypeScript + Tailwind 4** — static PWA on GitHub Pages (free), HashRouter for subpath routing
- **Supabase** — Postgres + Auth (password only, two dashboard-created users) + Row Level Security as the *entire* security boundary
- **TanStack Query** — data fetching/invalidation
- **Deterministic insights** — pure, unit-tested rules in `src/insights/` (no LLM in MVP); every insight carries its "why" numbers
- **Money** as integer cents, **dates** as `YYYY-MM-DD` strings end-to-end, currency `en-ZA` ZAR

## Supabase setup (once)

1. Create a free project at supabase.com (region: closest to South Africa).
2. **Authentication → Providers → Email**: disable "Confirm email". Never enable magic links (their `#access_token` URLs collide with HashRouter — password sign-in only).
3. **Authentication → Users → Add user** twice (auto-confirm on) — the two household members. No signup flow exists by design.
4. **SQL Editor**: run the files in `supabase/migrations/` in numeric order (edit the user emails at the top of 003 first).
5. **Project Settings → API**: copy the URL and anon key into `.env.local` (see `.env.example`) and into GitHub repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

> Free-tier note: Supabase pauses projects after ~7 days of inactivity. Data persists — unpause from the dashboard. Weekly use keeps it warm. A paused project also stops the daily reminder cron.

## Push notifications (once)

Daily morning digest (06:30 SAST): today's events, tasks due, decisions ready for review. Each phone opts in via **Settings → Notifications** in the app — on iPhone the PWA must be installed to the home screen first (Safari → Share → Add to Home Screen, iOS 16.4+).

1. `node tools/generate-vapid.mjs` → writes `.env.vapid.local` (gitignored). The public key goes in `.env.local` and the deploy workflow; the `VAPID_KEYS` value is the Edge Function secret. *(Already done for this project — keys exist; regenerating invalidates every device's subscription.)*
2. **Edge Functions → Deploy a new function** in the dashboard (or `npx supabase functions deploy send-reminders`): name it `send-reminders`, paste `supabase/functions/send-reminders/index.ts`.
3. **Edge Functions → send-reminders → Secrets**: add `VAPID_KEYS` with the JSON value from `.env.vapid.local`.
4. **SQL Editor**: run `supabase/migrations/006_push.sql`, then `supabase/cron/schedule-send-reminders.sql` (paste your service role key where marked — never commit it).
5. In the deployed app on each phone: **Settings → Notifications → Enable on this device**, then **Send test**.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173/ladder/
npm test           # vitest — money/date utils + insight rules
```

## Deploy

Push to `main` → GitHub Actions builds (tests must pass) and publishes to Pages. One-time: repo **Settings → Pages → Source → GitHub Actions**.

## Security model

- The anon key ships in the bundle — that is normal and safe **only because RLS is on for every table** with a deny-by-default posture.
- Every domain row carries `household_id`, `owner_id`, `visibility ('private'|'shared')`. Owners have full access; shared rows are readable+writable by both household members; private rows are invisible to the partner.
- No client writes to `households` / `household_members` — managed via SQL editor.
- Verify RLS with the two-browser matrix in the plan before entering real data.

## Project layout

```
supabase/migrations/  001_schema.sql · 002_rls.sql · 003_seed_categories.sql
src/
  lib/        supabase client · money.ts (cents) · dates.ts (string dates)
  api/        plain async Supabase calls per domain
  hooks/      useAuth + TanStack Query wrappers
  insights/   pure rule functions + agenda builders + tests (no imports from app)
  components/ AppShell, BottomNav, QuickAddSheet, ui primitives
  pages/      Login · Dashboard · Money · Budget · Goals · Planning · Settings
```
