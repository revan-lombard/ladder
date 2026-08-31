import { supabase } from '../lib/supabase'
import type { Budget } from '../types'

export async function listBudgetsForMonth(monthISO: string): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('month', monthISO)
  if (error) throw error
  return data as Budget[]
}

/** Insert-or-update on the (household, category, month) unique key. */
export async function upsertBudget(input: {
  household_id: string
  category_id: string
  month: string
  amount_cents: number
}): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .upsert(input, { onConflict: 'household_id,category_id,month' })
  if (error) throw error
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

/** Copy every budget row from one month into another (skips existing). */
export async function copyBudgets(fromMonth: string, toMonth: string): Promise<number> {
  const source = await listBudgetsForMonth(fromMonth)
  const existing = await listBudgetsForMonth(toMonth)
  const existingCats = new Set(existing.map((b) => b.category_id))
  const rows = source
    .filter((b) => !existingCats.has(b.category_id))
    .map((b) => ({
      household_id: b.household_id,
      category_id: b.category_id,
      month: toMonth,
      amount_cents: b.amount_cents,
    }))
  if (rows.length === 0) return 0
  const { error } = await supabase.from('budgets').insert(rows)
  if (error) throw error
  return rows.length
}
