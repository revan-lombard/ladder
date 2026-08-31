import { addMonths, monthLabel } from '../../lib/dates'
import { monthTotals } from '../helpers'
import type { Insight, InsightInputs } from '../types'

/**
 * Watches the income-minus-expenses surplus over the previous three COMPLETE
 * months (the current month is excluded — it is still in progress and would
 * always look like a decline). Fires 'watch' on a strict 3-month decline,
 * 'alert' when the latest complete month was negative, 'win' on a strict
 * 3-month rise with all months positive.
 */
export function surplusTrend(inputs: InsightInputs): Insight[] {
  const months = [3, 2, 1].map((n) => addMonths(inputs.month, -n))
  const totals = months.map((m) => ({ month: m, ...monthTotals(inputs.transactions, m) }))
  if (totals.some((t) => t.income === 0 && t.expenses === 0)) return [] // not enough history

  const surpluses = totals.map((t) => ({ month: t.month, surplus: t.income - t.expenses }))
  const [a, b, c] = surpluses.map((s) => s.surplus)
  const why = surpluses.map((s) => ({ label: monthLabel(s.month), valueCents: s.surplus }))

  if (c < 0) {
    return [{
      id: 'surplus:negative',
      rule: 'surplusTrend',
      severity: 'alert',
      title: 'You spent more than you earned last month',
      body: 'Last month closed with a negative surplus.',
      why,
    }]
  }
  if (a > b && b > c) {
    return [{
      id: 'surplus:declining',
      rule: 'surplusTrend',
      severity: 'watch',
      title: 'Your monthly surplus is shrinking',
      body: 'The surplus has declined three months in a row.',
      why,
    }]
  }
  if (a < b && b < c && a > 0) {
    return [{
      id: 'surplus:growing',
      rule: 'surplusTrend',
      severity: 'win',
      title: 'Your surplus is growing',
      body: 'Three consecutive months of rising surplus. Keep climbing.',
      why,
    }]
  }
  return []
}
