import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listBudgetsForMonth, upsertBudget, copyBudgets } from '../api/budgets'
import { useCategories, useHouseholdId, useTransactions } from '../hooks/queries'
import MonthPicker from '../components/ui/MonthPicker'
import { formatZAR, parseAmountToCents } from '../lib/money'
import { addMonths, monthLabel, monthStartOf, todayISO } from '../lib/dates'
import type { Category } from '../types'

export default function Budget() {
  const [month, setMonth] = useState(() => monthStartOf(todayISO()))
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const { data: categories } = useCategories()
  const { data: txns } = useTransactions(month)
  const { data: budgets } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => listBudgetsForMonth(month),
  })

  const saveBudget = useMutation({
    mutationFn: upsertBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
  const copyLast = useMutation({
    mutationFn: () => copyBudgets(addMonths(month, -1), month),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  // Actual spend per subcategory (expenses only) for the month.
  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txns ?? []) {
      if (t.kind !== 'expense' || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents)
    }
    return map
  }, [txns])

  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of budgets ?? []) map.set(b.category_id, b.amount_cents)
    return map
  }, [budgets])

  const parents = (categories ?? []).filter(
    (c) => !c.parent_id && !c.archived && c.kind === 'expense'
  )
  const childrenOf = (id: string) =>
    (categories ?? []).filter((c) => c.parent_id === id && !c.archived)

  const totals = useMemo(() => {
    let budget = 0
    let actual = 0
    for (const p of parents) {
      for (const c of childrenOf(p.id)) {
        budget += budgetByCategory.get(c.id) ?? 0
        actual += actualByCategory.get(c.id) ?? 0
      }
    }
    return { budget, actual }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, budgetByCategory, actualByCategory])

  return (
    <div className="max-w-lg lg:max-w-5xl mx-auto p-4 lg:p-8 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl lg:text-2xl font-bold">Budget</h1>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <div className="rounded-2xl bg-ink-soft p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Month total</p>
          <p className="font-bold">
            {formatZAR(totals.actual)}{' '}
            <span className="text-white/40 font-normal">of {formatZAR(totals.budget)}</span>
          </p>
        </div>
        {(budgets ?? []).length === 0 && (
          <button
            onClick={() => copyLast.mutate()}
            disabled={copyLast.isPending}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold"
          >
            Copy {monthLabel(addMonths(month, -1)).split(' ')[0]}
          </button>
        )}
      </div>

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
        {parents.map((parent) => (
          <ParentGroup
            key={parent.id}
            parent={parent}
            categories={childrenOf(parent.id)}
            budgetByCategory={budgetByCategory}
            actualByCategory={actualByCategory}
            onSetBudget={(categoryId, cents) =>
              householdId &&
              saveBudget.mutate({
                household_id: householdId,
                category_id: categoryId,
                month,
                amount_cents: cents,
              })
            }
          />
        ))}
      </div>
    </div>
  )
}

function ParentGroup({
  parent,
  categories,
  budgetByCategory,
  actualByCategory,
  onSetBudget,
}: {
  parent: Category
  categories: Category[]
  budgetByCategory: Map<string, number>
  actualByCategory: Map<string, number>
  onSetBudget: (categoryId: string, cents: number) => void
}) {
  const parentBudget = categories.reduce((s, c) => s + (budgetByCategory.get(c.id) ?? 0), 0)
  const parentActual = categories.reduce((s, c) => s + (actualByCategory.get(c.id) ?? 0), 0)
  // Hide untouched groups behind a tap so the page stays scannable.
  const [open, setOpen] = useState(parentBudget > 0 || parentActual > 0)

  return (
    <section className="rounded-2xl bg-ink-soft overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="font-bold">{parent.name}</span>
        <span className="text-sm tabular-nums">
          <span className={parentBudget > 0 && parentActual > parentBudget ? 'text-alert font-bold' : ''}>
            {formatZAR(parentActual)}
          </span>
          <span className="text-white/40"> / {formatZAR(parentBudget)}</span>
        </span>
      </button>
      {open && (
        <div className="divide-y divide-white/5 border-t border-white/5">
          {categories.map((c) => (
            <BudgetRow
              key={c.id}
              category={c}
              budget={budgetByCategory.get(c.id) ?? 0}
              actual={actualByCategory.get(c.id) ?? 0}
              onSet={(cents) => onSetBudget(c.id, cents)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BudgetRow({
  category,
  budget,
  actual,
  onSet,
}: {
  category: Category
  budget: number
  actual: number
  onSet: (cents: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const over = budget > 0 && actual > budget
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0

  const commit = () => {
    const cents = parseAmountToCents(draft)
    if (cents !== null) onSet(cents)
    setEditing(false)
  }

  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{category.name}</span>
        <span className="tabular-nums">
          <span className={over ? 'text-alert font-bold' : ''}>{formatZAR(actual)}</span>
          {editing ? (
            <input
              autoFocus
              inputMode="decimal"
              defaultValue={budget ? (budget / 100).toFixed(2).replace('.', ',') : ''}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              className="ml-2 w-24 rounded bg-white/10 px-2 py-0.5 text-right outline-none focus:ring-1 ring-rung"
            />
          ) : (
            <button onClick={() => { setDraft(''); setEditing(true) }} className="text-white/40">
              {' '}/ {budget > 0 ? formatZAR(budget) : 'set budget'}
            </button>
          )}
        </span>
      </div>
      {budget > 0 && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${over ? 'bg-alert' : 'bg-rung'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {over && (
        <p className="text-xs text-alert">
          {formatZAR(actual - budget)} over ({Math.round(((actual - budget) / budget) * 100)}%)
        </p>
      )}
    </div>
  )
}
