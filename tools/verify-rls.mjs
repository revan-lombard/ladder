/**
 * LADDER RLS verification matrix — the hard gate before real data (plan M2).
 *
 * Run from the repo root AFTER the three migrations have been executed:
 *
 *   $env:LADDER_PASSWORD_A = "<user A password>"
 *   $env:LADDER_PASSWORD_B = "<user B password>"
 *   node tools/verify-rls.mjs
 *
 * Passwords are read from the environment so they never enter chat logs or
 * source control. The script creates a throwaway test account + transactions,
 * verifies every access rule, and cleans up after itself.
 */
import { createClient } from '@supabase/supabase-js'
// Node 20 has no native WebSocket; supabase-js needs one even though we never
// use realtime here.
import ws from 'ws'

const URL = 'https://tsqyxvckftioztlniqop.supabase.co'
const KEY = 'sb_publishable_ZwSjRHPdkBTxADzbAZjl5Q_f3wLMydm'
const EMAIL_A = process.env.LADDER_EMAIL_A ?? 'r4v3n.lmb@gmail.com'
const EMAIL_B = process.env.LADDER_EMAIL_B ?? 'bronwen2504@icloud.com'
const PASS_A = process.env.LADDER_PASSWORD_A
const PASS_B = process.env.LADDER_PASSWORD_B

if (!PASS_A || !PASS_B) {
  console.error('Set LADDER_PASSWORD_A and LADDER_PASSWORD_B env vars first.')
  process.exit(1)
}

let passed = 0
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  ok ? passed++ : failed++
}

const opts = { auth: { persistSession: false }, realtime: { transport: ws } }
const clientA = createClient(URL, KEY, opts)
const clientB = createClient(URL, KEY, opts)
const anon = createClient(URL, KEY, opts)

const { error: errA } = await clientA.auth.signInWithPassword({ email: EMAIL_A, password: PASS_A })
const { error: errB } = await clientB.auth.signInWithPassword({ email: EMAIL_B, password: PASS_B })
check('User A signs in', !errA, errA?.message)
check('User B signs in', !errB, errB?.message)
if (errA || errB) process.exit(1)

// Household discovered via membership (RLS allows reading own memberships).
const { data: hmA } = await clientA.from('household_members').select('household_id')
const householdId = hmA?.[0]?.household_id
check('User A belongs to a household', Boolean(householdId))
const { data: hmB } = await clientB.from('household_members').select('household_id')
check('User B belongs to the same household', hmB?.[0]?.household_id === householdId)

// Seeded categories visible to both.
const { data: catsA } = await clientA.from('categories').select('id')
const { data: catsB } = await clientB.from('categories').select('id')
check('A reads seeded categories', (catsA?.length ?? 0) > 10, `${catsA?.length ?? 0} rows`)
check('B reads seeded categories', (catsB?.length ?? 0) > 10, `${catsB?.length ?? 0} rows`)

// Test fixtures: A creates an account + one shared and one private transaction.
const { data: acct, error: acctErr } = await clientA
  .from('accounts')
  .insert({ household_id: householdId, name: 'RLS-TEST account', kind: 'other' })
  .select()
  .single()
check('A creates a shared account', !acctErr, acctErr?.message)

const today = new Date().toISOString().slice(0, 10)
const mkTxn = (visibility, description) => ({
  household_id: householdId,
  account_id: acct.id,
  kind: 'expense',
  txn_date: today,
  description,
  amount_cents: 12345,
  visibility,
})

const { data: sharedTxn, error: e1 } = await clientA
  .from('transactions').insert(mkTxn('shared', 'RLS-TEST shared')).select().single()
check('A inserts shared transaction', !e1, e1?.message)

const { data: privateTxn, error: e2 } = await clientA
  .from('transactions').insert(mkTxn('private', 'RLS-TEST private')).select().single()
check('A inserts private transaction', !e2, e2?.message)

// --- The matrix ---
const { data: bSees } = await clientB
  .from('transactions').select('id, description').like('description', 'RLS-TEST%')
check('B sees the SHARED transaction', bSees?.some((t) => t.id === sharedTxn.id))
check('B does NOT see the PRIVATE transaction in lists', !bSees?.some((t) => t.id === privateTxn.id))

const { data: bDirect } = await clientB
  .from('transactions').select('id').eq('id', privateTxn.id)
check('B cannot fetch the private row by id', (bDirect?.length ?? 0) === 0)

const { data: bUpd } = await clientB
  .from('transactions').update({ notes: 'edited by B' }).eq('id', sharedTxn.id).select()
check('B CAN update the shared row', (bUpd?.length ?? 0) === 1)

const { data: bUpdPriv } = await clientB
  .from('transactions').update({ notes: 'hacked' }).eq('id', privateTxn.id).select()
check('B cannot update the private row', (bUpdPriv?.length ?? 0) === 0)

const { data: bDelPriv } = await clientB
  .from('transactions').delete().eq('id', privateTxn.id).select()
check('B cannot delete the private row', (bDelPriv?.length ?? 0) === 0)

const { error: forged } = await clientB.from('transactions').insert({
  ...mkTxn('shared', 'RLS-TEST forged'),
  household_id: '00000000-0000-0000-0000-000000000001',
})
check('Insert with forged household_id is rejected', Boolean(forged), forged?.message)

// Anonymous access: every table must return zero rows.
let anonLeaks = 0
for (const table of ['profiles', 'households', 'household_members', 'accounts',
  'categories', 'transactions', 'budgets', 'goals', 'goal_contributions',
  'goal_dependencies', 'meetings', 'tasks', 'projects', 'events', 'time_settings',
  'assets', 'liabilities', 'net_worth_snapshots', 'decisions', 'household_values', 'life_settings',
  'push_subscriptions']) {
  const { data } = await anon.from(table).select('*').limit(1)
  if ((data?.length ?? 0) > 0) anonLeaks++
}
check('Anonymous client gets 0 rows on all 22 tables', anonLeaks === 0, `${anonLeaks} leaks`)

// Profiles: A can see B's profile (same household), and vice versa.
const { data: profsA } = await clientA.from('profiles').select('id')
check('A sees both household profiles', (profsA?.length ?? 0) === 2, `${profsA?.length ?? 0}`)

// Cleanup (as A — owner).
await clientA.from('transactions').delete().like('description', 'RLS-TEST%')
await clientA.from('accounts').delete().eq('id', acct.id)
const { data: leftovers } = await clientA
  .from('transactions').select('id').like('description', 'RLS-TEST%')
check('Cleanup complete', (leftovers?.length ?? 0) === 0)

console.log(`\n${failed === 0 ? '🟢 ALL CHECKS PASSED' : '🔴 FAILURES PRESENT'} — ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
