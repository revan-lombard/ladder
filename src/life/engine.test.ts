import { describe, expect, it } from 'vitest'
import {
  achievements,
  isEssentialCategory,
  monthlyAverages,
  netWorth,
  resilience,
} from './engine'
import type { Asset, Category, GoalContribution, Liability, Transaction } from '../types'

const base = {
  household_id: 'hh',
  owner_id: 'me',
  visibility: 'shared' as const,
  created_at: '2026-01-01T00:00:00Z',
}
let seq = 0

const asset = (value: number, archived = false): Asset => ({
  ...base, id: `a-${++seq}`, name: 'asset', kind: 'cash',
  current_value_cents: value, notes: null, archived,
})
const liability = (balance: number, monthlyPayment: number | null = null): Liability => ({
  ...base, id: `l-${++seq}`, name: 'debt', kind: 'other', balance_cents: balance,
  interest_rate_pct: null, monthly_payment_cents: monthlyPayment, asset_id: null,
  notes: null, archived: false,
})
const category = (name: string, essential: boolean, parentId: string | null = null): Category => ({
  ...base, id: `c-${++seq}`, parent_id: parentId, name, kind: 'expense',
  pillar: 'financial', sort_order: 0, is_essential: essential, archived: false,
})
const txn = (
  date: string, amount: number, categoryId: string | null,
  kind: 'expense' | 'income' = 'expense', personId: string | null = null
): Transaction => ({
  ...base, id: `t-${++seq}`, account_id: 'acct', category_id: categoryId, kind,
  txn_date: date, description: 'x', amount_cents: amount, person_id: personId, notes: null,
})
const contrib = (amount: number): GoalContribution => ({
  ...base, id: `g-${++seq}`, goal_id: 'goal', contrib_date: '2026-07-01',
  amount_cents: amount, note: null,
})

const M = '2026-09-01'

describe('netWorth', () => {
  it('sums active assets minus liabilities', () => {
    const result = netWorth([asset(500_000), asset(100_000, true)], [liability(200_000)])
    expect(result.netCents).toBe(300_000)
    expect(result.assetsCents).toBe(500_000) // archived excluded
  })
})

describe('isEssentialCategory', () => {
  it('inherits from the parent', () => {
    const housing = category('Housing', true)
    const rent = category('Rent', false, housing.id)
    const hobbies = category('Hobbies', false)
    const cats = [housing, rent, hobbies]
    expect(isEssentialCategory(rent.id, cats)).toBe(true)
    expect(isEssentialCategory(hobbies.id, cats)).toBe(false)
    expect(isEssentialCategory(null, cats)).toBe(false)
  })
})

describe('monthlyAverages', () => {
  const housing = category('Housing', true)
  const fun = category('Fun', false)
  const cats = [housing, fun]

  it('averages complete months only, splitting essential spend', () => {
    const result = monthlyAverages(
      [
        txn('2026-09-15', 999_999, fun.id), // current month must be ignored
        txn('2026-08-01', 3_000_000, null, 'income'),
        txn('2026-08-05', 1_000_000, housing.id),
        txn('2026-08-20', 500_000, fun.id),
        txn('2026-07-01', 3_000_000, null, 'income'),
        txn('2026-07-05', 1_200_000, housing.id),
      ],
      M,
      cats
    )
    expect(result).not.toBeNull()
    expect(result!.incomeCents).toBe(3_000_000)
    expect(result!.essentialCents).toBe(1_100_000)
  })

  it('returns null with no history at all', () => {
    expect(monthlyAverages([txn('2026-09-15', 100, fun.id)], M, cats)).toBeNull()
  })
})

describe('resilience', () => {
  const housing = category('Housing', true)
  const cats = [housing]
  const history = [
    txn('2026-08-01', 3_000_000, null, 'income', 'me'),
    txn('2026-08-02', 1_000_000, null, 'income', 'partner'),
    txn('2026-08-05', 1_500_000, housing.id),
    txn('2026-07-01', 3_000_000, null, 'income', 'me'),
    txn('2026-07-02', 1_000_000, null, 'income', 'partner'),
    txn('2026-07-05', 1_500_000, housing.id),
  ]

  it('computes the full panel', () => {
    const r = resilience({
      transactions: history,
      categories: cats,
      currentMonth: M,
      emergencyGoalContributions: [contrib(4_500_000)], // R45k vs R15k/mo essential
      liabilities: [liability(5_000_000, 400_000)], // R4k/mo payments vs R40k income
    })
    expect(r.emergencyMonths).toBe(3)
    expect(r.incomeDependencyPct).toBe(75) // me: 6m of 8m total
    expect(r.debtLoadPct).toBe(10)
    expect(r.monthlyFlexibilityCents).toBe(2_500_000)
  })

  it('is honest about missing data', () => {
    const r = resilience({
      transactions: [],
      categories: cats,
      currentMonth: M,
      emergencyGoalContributions: [],
      liabilities: [],
    })
    expect(r.emergencyMonths).toBeNull()
    expect(r.incomeDependencyPct).toBeNull()
    expect(r.debtLoadPct).toBeNull()
    expect(r.monthlyFlexibilityCents).toBeNull()
  })
})

describe('achievements', () => {
  it('earns and withholds correctly', () => {
    const result = achievements({
      transactions: [txn('2026-08-01', 100, null)],
      contributions: [contrib(1_200_000)],
      completedGoalCount: 0,
      netCents: 12_000_000,
      hasNetWorthData: true,
      emergencyMonths: 1.5,
    })
    const byId = new Map(result.map((a) => [a.id, a.earned]))
    expect(byId.get('first-txn')).toBe(true)
    expect(byId.get('hundred-txn')).toBe(false)
    expect(byId.get('first-10k')).toBe(true)
    expect(byId.get('first-goal')).toBe(false)
    expect(byId.get('emergency-3m')).toBe(false)
    expect(byId.get('networth-100k')).toBe(true)
  })
  it('never awards net worth without data', () => {
    const result = achievements({
      transactions: [],
      contributions: [],
      completedGoalCount: 0,
      netCents: 0,
      hasNetWorthData: false,
      emergencyMonths: null,
    })
    expect(result.find((a) => a.id === 'networth-100k')!.earned).toBe(false)
  })
})
