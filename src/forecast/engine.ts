/**
 * Ladder forecast engine — PURE, like insights/time/life. Simulates a
 * committed rand-per-month amount flowing down the ladder (lowest rung
 * first, prerequisites respected) and answers: when does each rung land,
 * and what exactly should this month's contribution be?
 *
 * Deliberately naive-but-honest: fixed targets, no interest/growth on saved
 * money, no income forecasting. Committed money in, completion dates out.
 */
import { addMonths, monthStartOf } from '../lib/dates'
import type { Goal, GoalContribution, GoalDependency, Transaction } from '../types'

/** Ten years: past this, "not reachable at the current pace" is the answer. */
export const FORECAST_HORIZON_MONTHS = 120

export interface GoalForecast {
  goalId: string
  name: string
  remainingCents: number
  /** Month ('YYYY-MM-01') the goal completes; null if out of reach. */
  projectedMonth: string | null
  /** 0 = completes this month. Null when projectedMonth is null. */
  monthsAway: number | null
  /** vs target_date: positive = late, negative = early. Null without both dates. */
  monthsLate: number | null
}

export interface AllocationLine {
  goalId: string
  name: string
  amountCents: number
}

export interface LadderForecast {
  goals: GoalForecast[]
  /** Suggested split of what's left of this month's commitment. */
  thisMonth: AllocationLine[]
}

/** Whole months from a to b ('YYYY-MM-01' each); positive when b is later. */
export function monthsBetween(a: string, b: string): number {
  return (
    (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
    (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))
  )
}

export interface ForecastParams {
  /** Current month, 'YYYY-MM-01'. */
  month: string
  goals: Goal[]
  contributions: GoalContribution[]
  dependencies: GoalDependency[]
  monthlyCommitCents: number
}

export function ladderForecast(params: ForecastParams): LadderForecast {
  const { month, contributions, dependencies, monthlyCommitCents } = params

  const ladder = params.goals
    .filter((g) => g.status !== 'archived')
    .sort((a, b) => a.ladder_position - b.ladder_position || a.created_at.localeCompare(b.created_at))

  const contributed = new Map<string, number>()
  for (const c of contributions) {
    contributed.set(c.goal_id, (contributed.get(c.goal_id) ?? 0) + c.amount_cents)
  }

  const remaining = new Map<string, number>()
  const done = new Set<string>()
  for (const g of ladder) {
    const left = Math.max(0, g.target_amount_cents - (contributed.get(g.id) ?? 0))
    remaining.set(g.id, left)
    // Fully-funded actives count as complete for unlocking dependents.
    if (g.status === 'complete' || left === 0) done.add(g.id)
  }

  const prereqOf = new Map(dependencies.map((d) => [d.goal_id, d.depends_on_goal_id]))
  const unlocked = (g: Goal) => {
    const prereq = prereqOf.get(g.id)
    return !prereq || done.has(prereq)
  }

  // Money already contributed this month counts toward this month's commitment.
  const spentThisMonth = contributions
    .filter((c) => monthStartOf(c.contrib_date) === month)
    .reduce((s, c) => s + c.amount_cents, 0)

  const completedAt = new Map<string, number>() // goalId -> simulation month index
  const thisMonth: AllocationLine[] = []

  if (monthlyCommitCents > 0) {
    for (let i = 0; i < FORECAST_HORIZON_MONTHS; i++) {
      let budget = i === 0 ? Math.max(0, monthlyCommitCents - spentThisMonth) : monthlyCommitCents
      while (budget > 0) {
        const target = ladder.find((g) => !done.has(g.id) && unlocked(g))
        if (!target) break // everything reachable is funded (or a cycle blocks the rest)
        const pay = Math.min(remaining.get(target.id)!, budget)
        remaining.set(target.id, remaining.get(target.id)! - pay)
        budget -= pay
        if (i === 0) thisMonth.push({ goalId: target.id, name: target.name, amountCents: pay })
        if (remaining.get(target.id) === 0) {
          done.add(target.id)
          completedAt.set(target.id, i)
        }
      }
      if (ladder.every((g) => done.has(g.id))) break
    }
  }

  const goals: GoalForecast[] = ladder
    .filter((g) => g.status === 'active')
    .map((g) => {
      const left = Math.max(0, g.target_amount_cents - (contributed.get(g.id) ?? 0))
      const at = left === 0 ? 0 : completedAt.get(g.id) ?? null
      const projectedMonth = at === null ? null : addMonths(month, at)
      const target = g.target_date ? monthStartOf(g.target_date) : null
      return {
        goalId: g.id,
        name: g.name,
        remainingCents: left,
        projectedMonth,
        monthsAway: at,
        monthsLate: projectedMonth && target ? monthsBetween(target, projectedMonth) : null,
      }
    })

  return { goals, thisMonth }
}

/**
 * Smallest extra rand/month that lands the goal by its target date, or null
 * when no target exists, the target month has passed, or no amount within
 * 100× the remaining/month bound gets there (blocked by an unreachable
 * prerequisite, say).
 */
export function extraNeededForTarget(goalId: string, params: ForecastParams): number | null {
  const goal = params.goals.find((g) => g.id === goalId)
  if (!goal?.target_date) return null
  const targetMonth = monthStartOf(goal.target_date)
  if (monthsBetween(params.month, targetMonth) < 0) return null

  const hitsTarget = (extra: number) => {
    const f = ladderForecast({
      ...params,
      monthlyCommitCents: params.monthlyCommitCents + extra,
    })
    const g = f.goals.find((x) => x.goalId === goalId)
    return g?.projectedMonth !== null && g!.projectedMonth! <= targetMonth
  }

  if (hitsTarget(0)) return 0
  // Upper bound: everything on the ladder, due this month.
  const totalRemaining = params.goals
    .filter((g) => g.status === 'active')
    .reduce((s, g) => s + g.target_amount_cents, 0)
  let lo = 0
  let hi = totalRemaining
  if (!hitsTarget(hi)) return null
  while (hi - lo > 100) {
    // R1 precision
    const mid = Math.floor((lo + hi) / 2)
    if (hitsTarget(mid)) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * Default commitment when none is set: average measured surplus over the
 * last `months` complete months that have data. Null with no history.
 */
export function measuredMonthlyCommit(
  transactions: Transaction[],
  month: string,
  months = 3
): number | null {
  let surplus = 0
  let monthsWithData = 0
  for (let i = 1; i <= months; i++) {
    const m = addMonths(month, -i)
    let any = false
    for (const t of transactions) {
      if (monthStartOf(t.txn_date) !== m) continue
      any = true
      surplus += t.kind === 'income' ? t.amount_cents : -t.amount_cents
    }
    if (any) monthsWithData++
  }
  if (monthsWithData === 0) return null
  return Math.max(0, Math.round(surplus / monthsWithData))
}
