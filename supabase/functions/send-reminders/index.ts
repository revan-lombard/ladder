/**
 * LADDER daily reminder push (Supabase Edge Function, Deno runtime).
 *
 * Two modes:
 *  - Scheduled (pg_cron → net.http_post with the service role key): builds a
 *    per-person morning digest — today's events, tasks due/overdue, decisions
 *    ready for review — respecting row visibility (private rows only reach
 *    their owner), and pushes to every registered device with something to say.
 *  - Test ({ "test": true } with a signed-in user's JWT): pings only the
 *    caller's own devices so the Settings "Send test" button can verify the
 *    whole pipeline.
 *
 * Secrets: VAPID_KEYS (JSON from tools/generate-vapid.mjs → .env.vapid.local).
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS')!), {
  extractable: false,
})
const appServer = await webpush.ApplicationServer.new({
  contactInformation: 'mailto:r4v3n.lmb@gmail.com',
  vapidKeys,
})

interface SubRow {
  endpoint: string
  p256dh: string
  auth: string
  owner_id: string
}

async function pushTo(sub: SubRow, payload: { title: string; body: string; url?: string }) {
  const subscriber = appServer.subscribe({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  })
  try {
    await subscriber.pushTextMessage(JSON.stringify(payload), {})
    return true
  } catch (err) {
    // 404/410 = the device revoked or lost the subscription; drop the row.
    const status = err instanceof webpush.PushMessageError ? err.response?.status : undefined
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    } else {
      console.error(`push failed for ${sub.endpoint.slice(0, 40)}…`, err)
    }
    return false
  }
}

/** Calendar date in the household's timezone, as YYYY-MM-DD. */
function todayInJoburg(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}))

  const { data, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth, owner_id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const subs = (data ?? []) as SubRow[]
  if (!subs.length) return Response.json({ sent: 0, of: 0, reason: 'no subscriptions' })

  if (body.test) {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? ''
    const { data: userData } = await admin.auth.getUser(jwt)
    const uid = userData?.user?.id
    if (!uid) return Response.json({ error: 'not signed in' }, { status: 401 })
    const mine = subs.filter((s) => s.owner_id === uid)
    let sent = 0
    for (const s of mine) {
      if (await pushTo(s, { title: 'LADDER', body: 'Test notification — pushes are working 🎉' })) sent++
    }
    return Response.json({ sent, of: mine.length })
  }

  const today = todayInJoburg()
  const [decisions, events, tasks] = await Promise.all([
    admin
      .from('decisions')
      .select('title, owner_id, visibility')
      .eq('status', 'active')
      .lte('review_date', today),
    admin
      .from('events')
      .select('title, owner_id, visibility')
      .eq('event_date', today)
      .order('start_time', { nullsFirst: false }),
    admin
      .from('tasks')
      .select('title, due_date, owner_id, visibility')
      .in('status', ['open', 'in_progress', 'blocked'])
      .lte('due_date', today),
  ])

  type Row = { title: string; owner_id: string; visibility: string; due_date?: string }
  const visibleTo = (rows: Row[] | null, uid: string) =>
    (rows ?? []).filter((r) => r.visibility === 'shared' || r.owner_id === uid)

  let sent = 0
  for (const sub of subs) {
    const ev = visibleTo(events.data as Row[], sub.owner_id)
    const tk = visibleTo(tasks.data as Row[], sub.owner_id)
    const dec = visibleTo(decisions.data as Row[], sub.owner_id)

    const lines: string[] = []
    if (ev.length) {
      const names = ev.slice(0, 3).map((e) => e.title).join(', ')
      lines.push(`🗓 Today: ${names}${ev.length > 3 ? ` +${ev.length - 3} more` : ''}`)
    }
    if (tk.length) {
      const overdue = tk.filter((t) => (t.due_date ?? today) < today).length
      lines.push(`✅ ${tk.length} task${tk.length === 1 ? '' : 's'} due${overdue ? ` (${overdue} overdue)` : ''}`)
    }
    if (dec.length) {
      lines.push(dec.length === 1 ? `🤔 Review decision: ${dec[0].title}` : `🤔 ${dec.length} decisions ready for review`)
    }
    if (!lines.length) continue // nothing to say → no notification

    if (await pushTo(sub, { title: 'LADDER — your day', body: lines.join('\n'), url: '/ladder/' })) sent++
  }
  return Response.json({ sent, of: subs.length, date: today })
})
