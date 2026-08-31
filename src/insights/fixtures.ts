// Shared test fixture builders — plain objects matching the domain types.
import type { Budget, Category, Goal, GoalContribution, Transaction } from '../types'
import type { InsightInputs } from './types'

const base = {
  household_id: 'hh',
  owner_id: 'me',
  visibility: 'shared' as const,
  created_at: '2026-01-01T00:00:00Z',
}

let seq = 0
const id = () => `id-${++seq}`

export function cat(name: string, kind: 'expense' | 'income' = 'expense'): Category {
  return {
    ...base,
    id: id(),
    parent_id: 'parent',
    name,
    kind,
    pillar: 'financial',
    sort_order: 0,
    archived: false,
  }
}

export function txn(
  date: string,
  amountCents: number,
  categoryId: string | null,
  kind: 'expense' | 'income' = 'expense'
): Transaction {
  return {
    ...base,
    id: id(),
    account_id: 'acct',
    category_id: categoryId,
    kind,
    txn_date: date,
    description: 'fixture',
    amount_cents: amountCents,
    person_id: null,
    notes: null,
  }
}

export function budget(month: string, categoryId: string, amountCents: number): Budget {
  return { ...base, id: id(), category_id: categoryId, month, amount_cents: amountCents }
}

export function goal(
  name: string,
  targetCents: number,
  targetDate: string | null,
  status: Goal['status'] = 'active'
): Goal {
  return {
    ...base,
    id: id(),
    name,
    target_amount_cents: targetCents,
    target_date: targetDate,
    ladder_position: 0,
    status,
    pillar: 'financial',
    notes: null,
  }
}

export function contrib(goalId: string, date: string, amountCents: number): GoalContribution {
  return {
    ...base,
    id: id(),
    goal_id: goalId,
    contrib_date: date,
    amount_cents: amountCents,
    note: null,
  }
}

export function inputs(partial: Partial<InsightInputs>): InsightInputs {
  return {
    month: '2026-08-01',
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    contributions: [],
    ...partial,
  }
}
