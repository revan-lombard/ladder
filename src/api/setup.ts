import { supabase } from '../lib/supabase'

/**
 * Onboarding checklist status — cheap HEAD-count queries, all in parallel.
 * Steps complete themselves when the real data exists; nothing is stored.
 */

async function exists(table: string, column?: string, value?: string): Promise<boolean> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (column && value) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}

export interface SetupStatus {
  hasAccount: boolean
  hasExpense: boolean
  hasIncome: boolean
  hasBudget: boolean
  hasGoal: boolean
  hasEmergencyGoal: boolean
  hasAssetOrLiability: boolean
  hasTimeSettings: boolean
  hasValues: boolean
  hasMeeting: boolean
}

export async function getSetupStatus(householdId: string): Promise<SetupStatus> {
  const [
    hasAccount,
    hasExpense,
    hasIncome,
    hasBudget,
    hasGoal,
    hasAsset,
    hasLiability,
    hasTimeSettings,
    hasValues,
    hasMeeting,
    lifeSettings,
  ] = await Promise.all([
    exists('accounts'),
    exists('transactions', 'kind', 'expense'),
    exists('transactions', 'kind', 'income'),
    exists('budgets'),
    exists('goals'),
    exists('assets'),
    exists('liabilities'),
    exists('time_settings'),
    exists('household_values'),
    exists('meetings'),
    supabase.from('life_settings').select('emergency_goal_id').eq('household_id', householdId).maybeSingle(),
  ])

  return {
    hasAccount,
    hasExpense,
    hasIncome,
    hasBudget,
    hasGoal,
    hasEmergencyGoal: Boolean(lifeSettings.data?.emergency_goal_id),
    hasAssetOrLiability: hasAsset || hasLiability,
    hasTimeSettings,
    hasValues,
    hasMeeting,
  }
}
