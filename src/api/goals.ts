import { supabase } from '../lib/supabase'
import type { Goal, GoalContribution, GoalDependency, GoalStatus } from '../types'

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('ladder_position')
    .order('created_at')
  if (error) throw error
  return data as Goal[]
}

export async function createGoal(input: {
  household_id: string
  name: string
  target_amount_cents: number
  target_date: string | null
  ladder_position: number
}): Promise<Goal> {
  const { data, error } = await supabase.from('goals').insert(input).select().single()
  if (error) throw error
  return data as Goal
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, 'name' | 'target_amount_cents' | 'target_date' | 'ladder_position' | 'status' | 'notes'>>
): Promise<void> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id)
  if (error) throw error
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  return updateGoal(id, { status })
}

/** Swap ladder positions of two goals (reorder one step). */
export async function swapPositions(a: Goal, b: Goal): Promise<void> {
  await updateGoal(a.id, { ladder_position: b.ladder_position })
  await updateGoal(b.id, { ladder_position: a.ladder_position })
}

export async function listContributions(): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from('goal_contributions')
    .select('*')
    .order('contrib_date', { ascending: false })
  if (error) throw error
  return data as GoalContribution[]
}

export async function addContribution(input: {
  household_id: string
  goal_id: string
  contrib_date: string
  amount_cents: number
  note?: string
}): Promise<void> {
  const { error } = await supabase.from('goal_contributions').insert(input)
  if (error) throw error
}

export async function listDependencies(): Promise<GoalDependency[]> {
  const { data, error } = await supabase.from('goal_dependencies').select('*')
  if (error) throw error
  return data as GoalDependency[]
}

/** One prerequisite per goal; null clears it. Guards against direct 2-cycles. */
export async function setDependency(
  household_id: string,
  goal_id: string,
  depends_on_goal_id: string | null,
  existing: GoalDependency[]
): Promise<void> {
  if (depends_on_goal_id) {
    const reverse = existing.find(
      (d) => d.goal_id === depends_on_goal_id && d.depends_on_goal_id === goal_id
    )
    if (reverse) throw new Error('That would create a circular dependency.')
  }
  await supabase.from('goal_dependencies').delete().eq('goal_id', goal_id)
  if (depends_on_goal_id) {
    const { error } = await supabase
      .from('goal_dependencies')
      .insert({ household_id, goal_id, depends_on_goal_id })
    if (error) throw error
  }
}
