import { addMonths } from '../../lib/dates'
import { formatZAR } from '../../lib/money'
import { expensesByCategory } from '../helpers'
import type { Insight, InsightInputs } from '../types'

const THRESHOLD_PCT = 25
const MIN_DIFF_CENTS = 20_000 // ignore noise under R200

/**
 * Category spend more than 25% (and R200) above its trailing 3-month
 * average. Requires a full 3 months of history — fewer months must NOT
 * fake an average.
 */
export function aboveAverage(inputs: InsightInputs): Insight[] {
  const current = expensesByCategory(inputs.transactions, inputs.month)
  const prior = [1, 2, 3].map((n) =>
    expensesByCategory(inputs.transactions, addMonths(inputs.month, -n))
  )
  const out: Insight[] = []

  for (const [categoryId, actual] of current) {
    const history = prior.map((m) => m.get(categoryId) ?? 0)
    if (history.some((v) => v === 0)) continue // incomplete history — stay silent
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / 3)
    const diff = actual - avg
    if (diff < MIN_DIFF_CENTS) continue
    const pct = Math.round((diff / avg) * 100)
    if (pct < THRESHOLD_PCT) continue

    const category = inputs.categories.find((c) => c.id === categoryId)
    out.push({
      id: `above-average:${categoryId}`,
      rule: 'aboveAverage',
      severity: 'watch',
      title: `${category?.name ?? 'A category'} is ${pct}% above its average`,
      body: `${formatZAR(actual)} this month vs a 3-month average of ${formatZAR(avg)}.`,
      why: [
        { label: 'This month', valueCents: actual },
        { label: '3-month average', valueCents: avg },
        { label: 'Difference', valueCents: diff },
        { label: 'Threshold', value: `${THRESHOLD_PCT}% and ${formatZAR(MIN_DIFF_CENTS)}` },
      ],
    })
  }
  return out
}
