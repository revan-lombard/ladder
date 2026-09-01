import { extraNeededForTarget, ladderForecast } from '../../forecast/engine'
import { monthLabel } from '../../lib/dates'
import { formatZAR } from '../../lib/money'
import type { Insight, InsightInputs } from '../types'

/**
 * Forecast-based ETAs for goals WITH target dates, judged against the
 * household's committed monthly amount flowing down the ladder in order.
 * Complements goalOffTrack (which judges recent pace per goal): this rule
 * knows a rung can only start once the rungs below it are funded.
 */
export function ladderEta(inputs: InsightInputs): Insight[] {
  const commit = inputs.monthlyCommitCents
  if (commit == null || commit < 0) return []

  const params = {
    month: inputs.month,
    goals: inputs.goals,
    contributions: inputs.contributions,
    dependencies: inputs.dependencies ?? [],
    monthlyCommitCents: commit,
  }
  const forecast = ladderForecast(params)
  const out: Insight[] = []

  for (const g of forecast.goals) {
    const goal = inputs.goals.find((x) => x.id === g.goalId)
    if (!goal?.target_date || g.remainingCents === 0) continue

    const why = [
      { label: 'Monthly commitment', valueCents: commit },
      { label: 'Remaining', valueCents: g.remainingCents },
      { label: 'Target date', value: goal.target_date },
      { label: 'Projected', value: g.projectedMonth ? monthLabel(g.projectedMonth) : 'out of reach' },
    ]

    if (g.projectedMonth === null) {
      out.push({
        id: `ladder-eta:${g.goalId}`,
        rule: 'ladderEta',
        severity: 'alert',
        title: `"${g.name}" is out of reach at the current commitment`,
        body:
          commit === 0
            ? 'No monthly amount is feeding the ladder yet — set one on the Goals page.'
            : `${formatZAR(commit)}/month never gets there within 10 years once the rungs below it are funded.`,
        why,
      })
    } else if (g.monthsLate !== null && g.monthsLate > 0) {
      const extra = extraNeededForTarget(g.goalId, params)
      out.push({
        id: `ladder-eta:${g.goalId}`,
        rule: 'ladderEta',
        severity: 'watch',
        title: `"${g.name}" lands ${g.monthsLate} month${g.monthsLate === 1 ? '' : 's'} late`,
        body: `Projected ${monthLabel(g.projectedMonth)} vs target ${goal.target_date}.${
          extra ? ` About ${formatZAR(extra)}/month more closes the gap.` : ''
        }`,
        why: extra ? [...why, { label: 'Extra needed per month', valueCents: extra }] : why,
      })
    } else if (g.monthsLate !== null && g.monthsLate < 0) {
      out.push({
        id: `ladder-eta:${g.goalId}`,
        rule: 'ladderEta',
        severity: 'win',
        title: `"${g.name}" lands ${-g.monthsLate} month${g.monthsLate === -1 ? '' : 's'} early`,
        body: `At ${formatZAR(commit)}/month it completes in ${monthLabel(g.projectedMonth)} — ahead of ${goal.target_date}.`,
        why,
      })
    }
    // Exactly on time → quiet: nothing needs attention.
  }
  return out
}
