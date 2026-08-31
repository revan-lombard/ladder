// Life-OS engine — PURE, like insights and time. Net worth, financial
// resilience (brief §5), the emergency simulator (§19) and achievements
// (§13). All money in cents; averages use complete months only.

import { addMonths, monthStartOf } from '../lib/dates'
import type {
  Asset,
  Category,
  GoalContribution,
  Liability,
  Transaction,
} from '../types'

export function netWorth(assets: Asset[], liabilities: Liability[]) {
  const assetsCents = assets
    .filter((a) => !a.archived)
    .reduce((s, a) => s + a.current_value_cents, 0)
  const liabilitiesCents = liabilities
    .filter((l) => !l.archived)
    .reduce((s, l) => s + l.balance_cents, 0)
  return { assetsCents, liabilitiesCents, netCents: assetsCents - liabilitiesCents }
}

/** A category is essential when it or its parent carries the flag. */
export function isEssentialCategory(categoryId: string | null, categories: Category[]): boolean {
  if (!categoryId) return false
  const c = categories.find((x) => x.id === categoryId)
  if (!c) return false
  if (c.is_essential) return true
  if (c.parent_id) {
    const parent = categories.find((x) => x.id === c.parent_id)
    return parent?.is_essential ?? false
  }
  return false
}

/**
 * Averages over the previous `months` COMPLETE months (current month is in
 * progress and would understate). Returns null when no complete month in
 * the window has any data — resilience metrics must not fake confidence.
 */
export function monthlyAverages(
  transactions: Transaction[],
  currentMonth: string,
  categories: Category[],
  months = 3
): { incomeCents: number; essentialCents: number; totalExpenseCents: number } | null {
  const window = Array.from({ length: months }, (_, i) => addMonths(currentMonth, -(i + 1)))
  let income = 0
  let essential = 0
  let expenses = 0
  let monthsWithData = 0

  for (const m of window) {
    let any = false
    for (const t of transactions) {
      if (monthStartOf(t.txn_date) !== m) continue
      any = true
      if (t.kind === 'income') income += t.amount_cents
      else {
        expenses += t.amount_cents
        if (isEssentialCategory(t.category_id, categories)) essential += t.amount_cents
      }
    }
    if (any) monthsWithData++
  }
  if (monthsWithData === 0) return null
  return {
    incomeCents: Math.round(income / monthsWithData),
    essentialCents: Math.round(essential / monthsWithData),
    totalExpenseCents: Math.round(expenses / monthsWithData),
  }
}

export interface Resilience {
  /** Months of essential spending the emergency fund covers; null when unknowable. */
  emergencyMonths: number | null
  emergencyFundCents: number
  essentialMonthlyCents: number | null
  /** Largest single person's share of household income, 0–100; null without data. */
  incomeDependencyPct: number | null
  /** Debt payments as % of income; null without data. */
  debtLoadPct: number | null
  /** Income minus essential spending, per month. */
  monthlyFlexibilityCents: number | null
}

export function resilience(params: {
  transactions: Transaction[]
  categories: Category[]
  currentMonth: string
  emergencyGoalContributions: GoalContribution[]
  liabilities: Liability[]
}): Resilience {
  const { transactions, categories, currentMonth, emergencyGoalContributions, liabilities } = params

  const fund = emergencyGoalContributions.reduce((s, c) => s + c.amount_cents, 0)
  const avgs = monthlyAverages(transactions, currentMonth, categories)

  const emergencyMonths =
    avgs && avgs.essentialCents > 0
      ? Math.round((fund / avgs.essentialCents) * 10) / 10
      : null

  // Income dependency: share of the biggest earner over complete months.
  const window = [1, 2, 3].map((i) => addMonths(currentMonth, -i))
  const byPerson = new Map<string, number>()
  let totalIncome = 0
  for (const t of transactions) {
    if (t.kind !== 'income' || !window.includes(monthStartOf(t.txn_date))) continue
    const key = t.person_id ?? 'household'
    byPerson.set(key, (byPerson.get(key) ?? 0) + t.amount_cents)
    totalIncome += t.amount_cents
  }
  const incomeDependencyPct =
    totalIncome > 0 ? Math.round((Math.max(...byPerson.values()) / totalIncome) * 100) : null

  const monthlyDebt = liabilities
    .filter((l) => !l.archived)
    .reduce((s, l) => s + (l.monthly_payment_cents ?? 0), 0)
  const debtLoadPct =
    avgs && avgs.incomeCents > 0 ? Math.round((monthlyDebt / avgs.incomeCents) * 100) : null

  const monthlyFlexibilityCents = avgs ? avgs.incomeCents - avgs.essentialCents : null

  return {
    emergencyMonths,
    emergencyFundCents: fund,
    essentialMonthlyCents: avgs?.essentialCents ?? null,
    incomeDependencyPct,
    debtLoadPct,
    monthlyFlexibilityCents,
  }
}

/* ---------------------------------------------------------- achievements */

export interface Achievement {
  id: string
  title: string
  earned: boolean
}

export function achievements(params: {
  transactions: Transaction[]
  contributions: GoalContribution[]
  completedGoalCount: number
  netCents: number | null
  hasNetWorthData: boolean
  emergencyMonths: number | null
}): Achievement[] {
  const { transactions, contributions, completedGoalCount, netCents, hasNetWorthData, emergencyMonths } = params
  const contributed = contributions.reduce((s, c) => s + c.amount_cents, 0)

  return [
    { id: 'first-txn', title: 'First transaction tracked', earned: transactions.length >= 1 },
    { id: 'hundred-txn', title: '100 transactions tracked', earned: transactions.length >= 100 },
    { id: 'first-10k', title: 'First R10 000 toward goals', earned: contributed >= 1_000_000 },
    { id: 'first-goal', title: 'First rung climbed', earned: completedGoalCount >= 1 },
    {
      id: 'emergency-3m',
      title: '3-month emergency cushion',
      earned: emergencyMonths !== null && emergencyMonths >= 3,
    },
    {
      id: 'networth-100k',
      title: 'R100 000 net worth',
      earned: hasNetWorthData && netCents !== null && netCents >= 10_000_000,
    },
  ]
}
