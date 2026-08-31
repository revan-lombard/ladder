// Agenda builders — pure, like the rules. The Planning page snapshots the
// result into meetings.agenda (jsonb) when a meeting starts, so the record
// stays stable as data changes afterwards.

import { formatZAR } from '../lib/money'
import { addMonths, monthLabel } from '../lib/dates'
import { expensesByCategory, monthTotals } from './helpers'
import { runInsights } from './engine'
import type { InsightInputs } from './types'
import type { Agenda } from '../types'

export function buildWeeklyAgenda(inputs: InsightInputs): Agenda {
  const totals = monthTotals(inputs.transactions, inputs.month)
  const insights = runInsights(inputs)
  const actuals = expensesByCategory(inputs.transactions, inputs.month)

  const money: string[] = [
    `Month so far: ${formatZAR(totals.income)} in, ${formatZAR(totals.expenses)} out (${formatZAR(totals.income - totals.expenses)} surplus)`,
  ]
  for (const b of inputs.budgets) {
    const actual = actuals.get(b.category_id) ?? 0
    if (b.amount_cents > 0 && actual > b.amount_cents) {
      const name = inputs.categories.find((c) => c.id === b.category_id)?.name ?? '?'
      money.push(`${name}: ${formatZAR(actual - b.amount_cents)} over budget — what happened?`)
    }
  }
  if (money.length === 1) money.push('No categories over budget — anything unexpected coming?')

  const goalLines = inputs.goals
    .filter((g) => g.status === 'active')
    .map((g) => {
      const contributed = inputs.contributions
        .filter((c) => c.goal_id === g.id)
        .reduce((s, c) => s + c.amount_cents, 0)
      const pct = Math.min(Math.round((contributed / g.target_amount_cents) * 100), 100)
      return `${g.name}: ${pct}% (${formatZAR(contributed)} of ${formatZAR(g.target_amount_cents)})`
    })

  const wins = insights.filter((i) => i.severity === 'win').map((i) => i.title)
  const concerns = insights
    .filter((i) => i.severity === 'alert' || i.severity === 'watch')
    .map((i) => i.title)

  return {
    sections: [
      { title: '💸 Money', lines: money },
      { title: '🪜 Goals', lines: goalLines.length ? goalLines : ['No active goals — add rungs to the ladder?'] },
      { title: '⚠️ To discuss', lines: concerns.length ? concerns : ['Nothing flagged this week.'] },
      { title: '🎉 Wins', lines: wins.length ? wins : ['Name one win from this week yourselves!'] },
      { title: '📅 Coming up', lines: ['Any events, bills or plans for next week?'] },
    ],
  }
}

export function buildMonthlyAgenda(
  inputs: InsightInputs,
  extras?: { values?: string[] }
): Agenda {
  const weekly = buildWeeklyAgenda(inputs)
  const previous = addMonths(inputs.month, -1)
  const prevTotals = monthTotals(inputs.transactions, previous)

  const stateOfLife = {
    title: '🌡️ State of our life',
    lines: [
      'Biggest win of the month?',
      'Biggest problem?',
      'Biggest risk right now?',
      'Biggest opportunity?',
      ...(extras?.values?.length
        ? [`Are we living our values? (${extras.values.join(' → ')})`]
        : []),
    ],
  }

  return {
    sections: [
      {
        title: `📊 ${monthLabel(previous)} in review`,
        lines: [
          `Income ${formatZAR(prevTotals.income)}, expenses ${formatZAR(prevTotals.expenses)}, surplus ${formatZAR(prevTotals.income - prevTotals.expenses)}`,
          'What should change next month?',
        ],
      },
      ...weekly.sections,
      stateOfLife,
      {
        title: '🎯 Next month',
        lines: ['Set 3–5 priorities below before completing the review.'],
      },
    ],
  }
}
