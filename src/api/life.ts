import { supabase } from '../lib/supabase'
import type {
  Asset,
  Decision,
  HouseholdValue,
  Liability,
  LifeSettings,
  NetWorthSnapshot,
} from '../types'

/* ------------------------------------------------- assets & liabilities */

export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await supabase.from('assets').select('*').order('created_at')
  if (error) throw error
  return data as Asset[]
}

export async function upsertAsset(input: {
  id?: string
  household_id: string
  name: string
  kind: Asset['kind']
  current_value_cents: number
}): Promise<void> {
  const { error } = await supabase.from('assets').upsert(input)
  if (error) throw error
}

export async function archiveAsset(id: string): Promise<void> {
  const { error } = await supabase.from('assets').update({ archived: true }).eq('id', id)
  if (error) throw error
}

export async function listLiabilities(): Promise<Liability[]> {
  const { data, error } = await supabase.from('liabilities').select('*').order('created_at')
  if (error) throw error
  return data as Liability[]
}

export async function upsertLiability(input: {
  id?: string
  household_id: string
  name: string
  kind: Liability['kind']
  balance_cents: number
  monthly_payment_cents: number | null
}): Promise<void> {
  const { error } = await supabase.from('liabilities').upsert(input)
  if (error) throw error
}

export async function archiveLiability(id: string): Promise<void> {
  const { error } = await supabase.from('liabilities').update({ archived: true }).eq('id', id)
  if (error) throw error
}

/* ------------------------------------------------------------ snapshots */

export async function listSnapshots(): Promise<NetWorthSnapshot[]> {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('*')
    .order('snap_date', { ascending: false })
    .limit(24)
  if (error) throw error
  return data as NetWorthSnapshot[]
}

export async function recordSnapshot(input: {
  household_id: string
  snap_date: string
  assets_cents: number
  liabilities_cents: number
}): Promise<void> {
  const { error } = await supabase
    .from('net_worth_snapshots')
    .upsert(input, { onConflict: 'household_id,snap_date' })
  if (error) throw error
}

/* ------------------------------------------------------------ decisions */

export async function listDecisions(): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .order('decided_on', { ascending: false })
  if (error) throw error
  return data as Decision[]
}

export async function createDecision(input: {
  household_id: string
  title: string
  reason: string | null
  alternatives: string | null
  expected_outcome: string | null
  decided_on: string
  review_date: string | null
}): Promise<void> {
  const { error } = await supabase.from('decisions').insert(input)
  if (error) throw error
}

export async function reviewDecision(id: string, actual_outcome: string): Promise<void> {
  const { error } = await supabase
    .from('decisions')
    .update({ actual_outcome, status: 'reviewed' })
    .eq('id', id)
  if (error) throw error
}

/* --------------------------------------------------------------- values */

export async function listValues(): Promise<HouseholdValue[]> {
  const { data, error } = await supabase.from('household_values').select('*').order('rank')
  if (error) throw error
  return data as HouseholdValue[]
}

export async function saveValues(householdId: string, names: string[]): Promise<void> {
  const { error: delErr } = await supabase
    .from('household_values')
    .delete()
    .eq('household_id', householdId)
  if (delErr) throw delErr
  if (names.length === 0) return
  const { error } = await supabase
    .from('household_values')
    .insert(names.map((name, rank) => ({ household_id: householdId, name, rank })))
  if (error) throw error
}

/* -------------------------------------------------------- life settings */

export async function getLifeSettings(householdId: string): Promise<LifeSettings> {
  const { data, error } = await supabase
    .from('life_settings')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle()
  if (error) throw error
  return (data as LifeSettings | null) ?? { household_id: householdId, emergency_goal_id: null }
}

export async function saveLifeSettings(settings: LifeSettings): Promise<void> {
  const { error } = await supabase
    .from('life_settings')
    .upsert(settings, { onConflict: 'household_id' })
  if (error) throw error
}

/* ------------------------------------------- essential category toggle */

export async function setCategoryEssential(id: string, essential: boolean): Promise<void> {
  const { error } = await supabase.from('categories').update({ is_essential: essential }).eq('id', id)
  if (error) throw error
}
