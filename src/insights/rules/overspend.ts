import { formatZAR } from '../../lib/money'
import { expensesByCategory } from '../helpers'
import type { Insight, InsightInputs } from '../types'

/** A category's month-to-date spend exceeds its budget. Exactly on budget does NOT fire. */
export function overspend(inputs: InsightInputs): Insight[] {
  const actuals = expensesByCategory(inputs.transactions, inputs.month)
  const out: Insight[] = []

  for (const budget of inputs.budgets) {
    if (budget.amount_cents <= 0) continue
    const actual = actuals.get(budget.category_id) ?? 0
    if (actual <= budget.amount_cents) continue

    const category = inputs.categories.find((c) => c.id === budget.category_id)
    const over = actual - budget.amount_cents
    const pct = Math.round((over / budget.amount_cents) * 100)

    out.push({
      id: `overspend:${budget.category_id}`,
      rule: 'overspend',
      severity: 'alert',
      title: `${category?.name ?? 'A category'} is over budget`,
      body: `${formatZAR(over)} (${pct}%) over this month's budget.`,
      why: [
        { label: 'Budget', valueCents: budget.amount_cents },
        { label: 'Spent so far', valueCents: actual },
        { label: 'Over by', valueCents: over },
      ],
    })
  }
  return out
}
