import { monthStartOf } from '../lib/dates'
import type { Transaction } from '../types'

/** Sum of expense cents per category id for one month. */
export function expensesByCategory(
  transactions: Transaction[],
  month: string
): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.category_id) continue
    if (monthStartOf(t.txn_date) !== month) continue
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents)
  }
  return map
}

/** { income, expenses } cents for one month. */
export function monthTotals(transactions: Transaction[], month: string) {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (monthStartOf(t.txn_date) !== month) continue
    if (t.kind === 'income') income += t.amount_cents
    else expenses += t.amount_cents
  }
  return { income, expenses }
}
