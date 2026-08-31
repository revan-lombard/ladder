import { addMonths, monthStartOf } from '../../lib/dates'
import { formatZAR } from '../../lib/money'
import type { Insight, InsightInputs } from '../types'

/**
 * For each active goal with a target date: required monthly contribution
 * (remaining ÷ months left) vs the actual trailing-3-month contribution
 * rate. Fires when required exceeds actual by more than 10%.
 */
export function goalOffTrack(inputs: InsightInputs): Insight[] {
  const out: Insight[] = []

  for (const goal of inputs.goals) {
    if (goal.status !== 'active' || !goal.target_date) continue

    const contributed = inputs.contributions
      .filter((c) => c.goal_id === goal.id)
      .reduce((s, c) => s + c.amount_cents, 0)
    const remaining = goal.target_amount_cents - contributed
    if (remaining <= 0) continue

    const targetMonth = monthStartOf(goal.target_date)
    let monthsLeft = 0
    for (let m = inputs.month; m < targetMonth; m = addMonths(m, 1)) monthsLeft++
    if (monthsLeft <= 0) {
      out.push({
        id: `goal-overdue:${goal.id}`,
        rule: 'goalOffTrack',
        severity: 'alert',
        title: `"${goal.name}" has passed its target date`,
        body: `${formatZAR(remaining)} still needed and the target date has arrived.`,
        why: [
          { label: 'Target', valueCents: goal.target_amount_cents },
          { label: 'Contributed', valueCents: contributed },
          { label: 'Remaining', valueCents: remaining },
          { label: 'Target date', value: goal.target_date },
        ],
      })
      continue
    }

    const required = Math.ceil(remaining / monthsLeft)

    const recentMonths = [1, 2, 3].map((n) => addMonths(inputs.month, -n))
    const recent = inputs.contributions.filter(
      (c) => c.goal_id === goal.id && recentMonths.includes(monthStartOf(c.contrib_date))
    )
    const actualRate = Math.round(recent.reduce((s, c) => s + c.amount_cents, 0) / 3)

    if (required <= actualRate * 1.1) continue

    out.push({
      id: `goal-off-track:${goal.id}`,
      rule: 'goalOffTrack',
      severity: 'watch',
      title: `"${goal.name}" is off track`,
      body: `Needs ${formatZAR(required)}/month to hit ${goal.target_date}; recent pace is ${formatZAR(actualRate)}/month.`,
      why: [
        { label: 'Remaining', valueCents: remaining },
        { label: 'Months left', value: String(monthsLeft) },
        { label: 'Required per month', valueCents: required },
        { label: 'Actual pace (3-month avg)', valueCents: actualRate },
      ],
    })
  }
  return out
}
