import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCategories, useTransactions } from '../hooks/queries'
import { useQuickAdd } from '../components/QuickAddSheet'
import MonthPicker from '../components/ui/MonthPicker'
import { formatZAR } from '../lib/money'
import { dayLabel, monthLabel, monthStartOf, todayISO } from '../lib/dates'
import type { Transaction } from '../types'

export default function Money() {
  const [month, setMonth] = useState(() => monthStartOf(todayISO()))
  const { data: txns, isLoading } = useTransactions(month)
  const { data: categories } = useCategories()
  const { openEdit } = useQuickAdd()
  const { session } = useAuth()

  const categoryName = (id: string | null) =>
    categories?.find((c) => c.id === id)?.name ?? 'Uncategorised'

  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of txns ?? []) {
      const list = groups.get(t.txn_date) ?? []
      list.push(t)
      groups.set(t.txn_date, list)
    }
    return [...groups.entries()]
  }, [txns])

  const totals = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const t of txns ?? []) {
      if (t.kind === 'income') income += t.amount_cents
      else expenses += t.amount_cents
    }
    return { income, expenses }
  }, [txns])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Money</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-ink-soft p-3">
          <p className="text-xs text-white/40 uppercase tracking-widest">In</p>
          <p className="font-bold text-rung">{formatZAR(totals.income)}</p>
        </div>
        <div className="rounded-xl bg-ink-soft p-3">
          <p className="text-xs text-white/40 uppercase tracking-widest">Out</p>
          <p className="font-bold">{formatZAR(totals.expenses)}</p>
        </div>
      </div>

      {isLoading && <p className="text-center text-white/40 py-8">Loading…</p>}

      {!isLoading && byDay.length === 0 && (
        <div className="rounded-2xl bg-ink-soft p-8 text-center text-white/50">
          Nothing recorded for {monthLabel(month)} yet.
          <br />
          Tap <b className="text-rung">+</b> to add the first one.
        </div>
      )}

      {byDay.map(([day, list]) => (
        <section key={day}>
          <h2 className="text-xs uppercase tracking-widest text-white/40 pb-1">
            {dayLabel(day)}
          </h2>
          <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    {t.visibility === 'private' && '🔒 '}
                    {t.description}
                  </p>
                  <p className="text-xs text-white/40">
                    {categoryName(t.category_id)}
                    {t.owner_id !== session?.user.id && ' · partner'}
                  </p>
                </div>
                <span
                  className={`font-bold tabular-nums shrink-0 pl-3 ${
                    t.kind === 'income' ? 'text-rung' : ''
                  }`}
                >
                  {t.kind === 'income' ? '+' : ''}
                  {formatZAR(t.amount_cents)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
