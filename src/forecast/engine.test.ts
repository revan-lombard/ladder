import { describe, expect, it } from 'vitest'
import {
  extraNeededForTarget,
  ladderForecast,
  measuredMonthlyCommit,
  monthsBetween,
} from './engine'
import type { Goal, GoalContribution, GoalDependency, Transaction } from '../types'

const MONTH = '2026-09-01'

let seq = 0
function mkGoal(over: Partial<Goal> & { name: string; target_amount_cents: number }): Goal {
  seq++
  return {
    id: over.id ?? `g${seq}`,
    household_id: 'h1',
    owner_id: 'u1',
    visibility: 'shared',
    target_date: null,
    ladder_position: seq,
    status: 'active',
    pillar: 'financial',
    notes: null,
    created_at: `2026-01-0${(seq % 9) + 1}T00:00:00Z`,
    ...over,
  }
}

function mkContrib(goal_id: string, amount_cents: number, contrib_date = '2026-08-15'): GoalContribution {
  seq++
  return {
    id: `c${seq}`,
    household_id: 'h1',
    owner_id: 'u1',
    visibility: 'shared',
    goal_id,
    contrib_date,
    amount_cents,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

const dep = (goal_id: string, depends_on_goal_id: string): GoalDependency => ({
  goal_id,
  depends_on_goal_id,
  household_id: 'h1',
})

const run = (
  goals: Goal[],
  monthlyCommitCents: number,
  contributions: GoalContribution[] = [],
  dependencies: GoalDependency[] = []
) => ladderForecast({ month: MONTH, goals, contributions, dependencies, monthlyCommitCents })

describe('monthsBetween', () => {
  it('handles same month, later, earlier and year wrap', () => {
    expect(monthsBetween('2026-09-01', '2026-09-01')).toBe(0)
    expect(monthsBetween('2026-09-01', '2027-01-01')).toBe(4)
    expect(monthsBetween('2027-01-01', '2026-09-01')).toBe(-4)
  })
})

describe('ladderForecast', () => {
  it('projects a single goal: R1000/month into R3000 completes in month index 2', () => {
    const g = mkGoal({ name: 'Emergency', target_amount_cents: 3000_00 })
    const f = run([g], 1000_00)
    expect(f.goals[0].projectedMonth).toBe('2026-11-01')
    expect(f.goals[0].monthsAway).toBe(2)
    expect(f.thisMonth).toEqual([{ goalId: g.id, name: 'Emergency', amountCents: 1000_00 }])
  })

  it('waterfalls overflow into the next rung the same month', () => {
    const a = mkGoal({ name: 'A', target_amount_cents: 500_00, ladder_position: 1 })
    const b = mkGoal({ name: 'B', target_amount_cents: 2000_00, ladder_position: 2 })
    const f = run([a, b], 1000_00)
    expect(f.thisMonth).toEqual([
      { goalId: a.id, name: 'A', amountCents: 500_00 },
      { goalId: b.id, name: 'B', amountCents: 500_00 },
    ])
    expect(f.goals.find((x) => x.goalId === a.id)?.monthsAway).toBe(0)
    // B: 500 in month 0, then 1000×2 → completes month index 2 (2000 total by then... 500+1000+1000=2500 ≥ 2000 at index 2)
    expect(f.goals.find((x) => x.goalId === b.id)?.monthsAway).toBe(2)
  })

  it('respects prerequisites even against ladder order', () => {
    const blocked = mkGoal({ name: 'Blocked', target_amount_cents: 1000_00, ladder_position: 1 })
    const prereq = mkGoal({ name: 'Prereq', target_amount_cents: 1000_00, ladder_position: 2 })
    const f = run([blocked, prereq], 1000_00, [], [dep(blocked.id, prereq.id)])
    // Month 0 funds the prereq (the blocked rung is locked); month 1 funds the blocked rung.
    expect(f.thisMonth).toEqual([{ goalId: prereq.id, name: 'Prereq', amountCents: 1000_00 }])
    expect(f.goals.find((x) => x.goalId === prereq.id)?.monthsAway).toBe(0)
    expect(f.goals.find((x) => x.goalId === blocked.id)?.monthsAway).toBe(1)
  })

  it('counts money already contributed this month against this month', () => {
    const g = mkGoal({ name: 'G', target_amount_cents: 3000_00 })
    const f = run([g], 1000_00, [mkContrib(g.id, 400_00, '2026-09-05')])
    // 400 already in → only 600 more this month; remaining 2600 → 600 + 1000 + 1000 = 2600 at index 2.
    expect(f.thisMonth).toEqual([{ goalId: g.id, name: 'G', amountCents: 600_00 }])
    expect(f.goals[0].monthsAway).toBe(2)
  })

  it('suggests nothing further when this month is fully contributed', () => {
    const g = mkGoal({ name: 'G', target_amount_cents: 5000_00 })
    const f = run([g], 1000_00, [mkContrib(g.id, 1200_00, '2026-09-02')])
    expect(f.thisMonth).toEqual([])
  })

  it('returns null projections at zero commitment', () => {
    const g = mkGoal({ name: 'G', target_amount_cents: 1000_00 })
    const f = run([g], 0)
    expect(f.goals[0].projectedMonth).toBeNull()
    expect(f.goals[0].monthsAway).toBeNull()
    expect(f.thisMonth).toEqual([])
  })

  it('gives up beyond the horizon', () => {
    const g = mkGoal({ name: 'Huge', target_amount_cents: 100_000_000_00 })
    const f = run([g], 100_00)
    expect(f.goals[0].projectedMonth).toBeNull()
  })

  it('treats a fully-funded active goal as complete and unlocks its dependent', () => {
    const fundedPrereq = mkGoal({ name: 'Funded', target_amount_cents: 1000_00, ladder_position: 1 })
    const next = mkGoal({ name: 'Next', target_amount_cents: 1000_00, ladder_position: 2 })
    const f = run(
      [fundedPrereq, next],
      1000_00,
      [mkContrib(fundedPrereq.id, 1000_00, '2026-07-01')],
      [dep(next.id, fundedPrereq.id)]
    )
    expect(f.goals.find((x) => x.goalId === fundedPrereq.id)?.monthsAway).toBe(0)
    expect(f.goals.find((x) => x.goalId === next.id)?.monthsAway).toBe(0)
    expect(f.thisMonth).toEqual([{ goalId: next.id, name: 'Next', amountCents: 1000_00 }])
  })

  it('reports lateness against the target date', () => {
    const late = mkGoal({ name: 'Late', target_amount_cents: 3000_00, target_date: '2026-10-15' })
    const early = mkGoal({
      name: 'Early',
      target_amount_cents: 1000_00,
      target_date: '2027-06-30',
      ladder_position: 0,
    })
    const f = run([early, late], 1000_00)
    // Early completes month 0 (Sep) vs target Jun 2027 → 9 months ahead.
    expect(f.goals.find((x) => x.goalId === early.id)?.monthsLate).toBe(-9)
    // Late: remaining 3000 after early's 0? Early takes month 0's 1000 fully? Early needs 1000 → month 0;
    // Late gets nothing in month 0, then 1000 in months 1..3 → completes 2026-12 vs target Oct → 2 late.
    expect(f.goals.find((x) => x.goalId === late.id)?.projectedMonth).toBe('2026-12-01')
    expect(f.goals.find((x) => x.goalId === late.id)?.monthsLate).toBe(2)
  })
})

describe('extraNeededForTarget', () => {
  it('returns 0 when already on track', () => {
    const g = mkGoal({ name: 'G', target_amount_cents: 1000_00, target_date: '2027-01-01' })
    const extra = extraNeededForTarget(g.id, {
      month: MONTH,
      goals: [g],
      contributions: [],
      dependencies: [],
      monthlyCommitCents: 1000_00,
    })
    expect(extra).toBe(0)
  })

  it('finds an extra amount that actually closes the gap', () => {
    const g = mkGoal({ name: 'G', target_amount_cents: 6000_00, target_date: '2026-12-31' })
    const params = {
      month: MONTH,
      goals: [g],
      contributions: [],
      dependencies: [],
      monthlyCommitCents: 1000_00,
    }
    const extra = extraNeededForTarget(g.id, params)
    expect(extra).not.toBeNull()
    // Verify the answer by re-running the forecast with it.
    const f = ladderForecast({ ...params, monthlyCommitCents: params.monthlyCommitCents + extra! })
    const projected = f.goals[0].projectedMonth!
    expect(projected <= '2026-12-01').toBe(true)
    // And it is not wildly overshooting: 6000 over Sep–Dec = 1500/month → extra ≈ 500.
    expect(extra!).toBeGreaterThanOrEqual(490_00)
    expect(extra!).toBeLessThanOrEqual(510_00)
  })

  it('returns null when the target date has passed or goal has no target', () => {
    const past = mkGoal({ name: 'Past', target_amount_cents: 1000_00, target_date: '2026-08-01' })
    const none = mkGoal({ name: 'None', target_amount_cents: 1000_00 })
    const base = { month: MONTH, contributions: [], dependencies: [], monthlyCommitCents: 100_00 }
    expect(extraNeededForTarget(past.id, { ...base, goals: [past] })).toBeNull()
    expect(extraNeededForTarget(none.id, { ...base, goals: [none] })).toBeNull()
  })
})

describe('measuredMonthlyCommit', () => {
  const txn = (kind: 'income' | 'expense', amount_cents: number, txn_date: string) =>
    ({ kind, amount_cents, txn_date }) as Transaction

  it('averages surplus over complete months with data', () => {
    const txns = [
      txn('income', 30000_00, '2026-08-25'),
      txn('expense', 25000_00, '2026-08-10'),
      txn('income', 30000_00, '2026-07-25'),
      txn('expense', 29000_00, '2026-07-02'),
    ]
    // Surpluses: Aug 5000, Jul 1000 → average 3000.
    expect(measuredMonthlyCommit(txns, MONTH)).toBe(3000_00)
  })

  it('ignores the current month and returns null with no history', () => {
    expect(measuredMonthlyCommit([txn('income', 9999_00, '2026-09-01')], MONTH)).toBeNull()
  })

  it('never suggests a negative commitment', () => {
    const txns = [txn('income', 1000_00, '2026-08-01'), txn('expense', 5000_00, '2026-08-02')]
    expect(measuredMonthlyCommit(txns, MONTH)).toBe(0)
  })
})
