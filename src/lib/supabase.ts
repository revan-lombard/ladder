import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// The anon key is public by design — Row Level Security is the boundary.
// When unconfigured (fresh clone / missing secrets) the app renders a setup
// notice instead of crashing; the dummy client is never actually used.
export const supabase = createClient(
  url ?? 'https://unconfigured.supabase.co',
  anonKey ?? 'unconfigured'
)
