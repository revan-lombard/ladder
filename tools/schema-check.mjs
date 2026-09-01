// Anonymous schema sanity check: every table should exist and return ZERO
// rows (RLS blocks anon). A missing table returns a "relation ... does not
// exist" error instead.
import { createClient } from '@supabase/supabase-js'
// Node 20 has no native WebSocket; supabase-js needs one even though we never
// use realtime here.
import ws from 'ws'

const anon = createClient(
  'https://tsqyxvckftioztlniqop.supabase.co',
  'sb_publishable_ZwSjRHPdkBTxADzbAZjl5Q_f3wLMydm',
  { auth: { persistSession: false }, realtime: { transport: ws } }
)

const tables = ['profiles', 'households', 'household_members', 'accounts',
  'categories', 'transactions', 'budgets', 'goals', 'goal_contributions',
  'goal_dependencies', 'meetings', 'tasks', 'projects', 'events', 'time_settings',
  'assets', 'liabilities', 'net_worth_snapshots', 'decisions', 'household_values', 'life_settings',
  'push_subscriptions']

let bad = 0
for (const t of tables) {
  const { data, error } = await anon.from(t).select('*').limit(1)
  if (error) { console.log(`❌ ${t}: ${error.message}`); bad++ }
  else if (data.length > 0) { console.log(`❌ ${t}: anon can read rows!`); bad++ }
  else console.log(`✅ ${t}: exists, anon blocked`)
}
console.log(bad === 0 ? '\n🟢 schema OK, anon fully blocked' : `\n🔴 ${bad} problems`)
process.exit(bad === 0 ? 0 : 1)
