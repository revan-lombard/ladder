import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTransactionsBetween } from '../api/transactions'
import { listBudgetsForMonth } from '../api/budgets'
import { listContributions, listDependencies, listGoals } from '../api/goals'
import { useCategories } from '../hooks/queries'
import { runInsights, pillarStatus } from '../insights/engine'
import { monthTotals } from '../insights/helpers'
import type { Insight } from '../insights/types'
import { formatZAR, formatZARWhole } from '../lib/money'
import { addMonths, monthLabel, monthStartOf, todayISO } from '../lib/dates'

export default function Dashboard() {
  const month = monthStartOf(todayISO())

  const { data: categories } = useCategories()
  const { data: transactions } = useQuery({
    queryKey: ['transactions', 'window', month],
    queryFn: () => listTransactionsBetween(addMonths(month, -3), addMonths(month, 1)),
  })
  const { data: budgets } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => listBudgetsForMonth(month),
  })
  const { data: goals } = useQuery({ queryKey: ['goals', 'list'], queryFn: listGoals })
  const { data: contributions } = useQuery({
    queryKey: ['goals', 'contributions'],
    queryFn: listContributions,
  })
  const { data: deps } = useQuery({ queryKey: ['goals', 'deps'], queryFn: listDependencies })

  const loaded = categories && transactions && budgets && goals && contributions

  const totals = useMemo(
    () => monthTotals(transactions ?? [], month),
    [transactions, month]
  )
  const surplus = totals.income - totals.expenses
  const savingsRate = totals.income > 0 ? Math.round((surplus / totals.income) * 100) : null

  const insights = useMemo(
    () =>
      loaded
        ? runInsights({
            month,
            categories: categories!,
            transactions: transactions!,
            budgets: budgets!,
            goals: goals!,
            contributions: contributions!,
          })
        : [],
    [loaded, month, categories, transactions, budgets, goals, contributions]
  )

  const financial = pillarStatus(insights.filter((i) => i.rule !== 'goalOffTrack'))
  const goalsStatus = pillarStatus(insights.filter((i) => i.rule === 'goalOffTrack'))

  const contributedByGoal = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of contributions ?? []) {
      map.set(c.goal_id, (map.get(c.goal_id) ?? 0) + c.amount_cents)
    }
    return map
  }, [contributions])

  const goalById = new Map((goals ?? []).map((g) => [g.id, g]))
  const nextRungs = (goals ?? [])
    .filter((g) => g.status === 'active')
    .filter((g) => {
      const dep = (deps ?? []).find((d) => d.goal_id === g.id)
      return !dep || goalById.get(dep.depends_on_goal_id)?.status === 'complete'
    })
    .slice(0, 3)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">How are we doing?</h1>
          <p className="text-white/40 text-sm">{monthLabel(month)}</p>
        </div>
        <Link to="/settings" className="text-2xl" aria-label="Settings">
          ⚙️
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Income" value={formatZARWhole(totals.income)} />
        <Tile label="Expenses" value={formatZARWhole(totals.expenses)} />
        <Tile
          label="Surplus"
          value={formatZARWhole(surplus)}
          accent={surplus >= 0 ? 'text-rung' : 'text-alert'}
        />
        <Tile
          label="Savings rate"
          value={savingsRate === null ? '—' : `${savingsRate}%`}
          accent={savingsRate !== null && savingsRate < 0 ? 'text-alert' : undefined}
        />
      </div>

      <div className="rounded-2xl bg-ink-soft p-4 space-y-1.5">
        <StatusRow name="Financial" status={financial} />
        <StatusRow name="Goals" status={goalsStatus} />
        {(['Physical', 'Mental', 'Relationship', 'Career'] as const).map((p) => (
          <div key={p} className="flex justify-between text-sm">
            <span>{p}</span>
            <span className="text-white/25">coming soon</span>
          </div>
        ))}
      </div>

      {nextRungs.length > 0 && (
        <Link to="/goals" className="block rounded-2xl bg-ink-soft p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-white/40">🪜 Next rungs</p>
          {nextRungs.map((g) => {
            const contributed = contributedByGoal.get(g.id) ?? 0
            const pct = Math.min(Math.round((contributed / g.target_amount_cents) * 100), 100)
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{g.name}</span>
                  <span className="text-white/40">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-rung" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </Link>
      )}

      <section className="space-y-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
        {loaded && insights.length === 0 && (
          <div className="rounded-2xl bg-ink-soft p-4 text-center text-white/40 text-sm">
            No alerts. Insights appear here as data builds up — most rules need
            budgets, goal target dates, or 3 months of history.
          </div>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-ink-soft p-3">
      <p className="text-xs text-white/40 uppercase tracking-widest">{label}</p>
      <p className={`font-bold text-lg tabular-nums ${accent ?? ''}`}>{value}</p>
    </div>
  )
}

function StatusRow({ name, status }: { name: string; status: { emoji: string; label: string } }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{name}</span>
      <span>
        {status.emoji} {status.label}
      </span>
    </div>
  )
}

const SEVERITY_STYLE: Record<Insight['severity'], string> = {
  alert: 'border-alert/40',
  watch: 'border-warn/40',
  win: 'border-rung/40',
  info: 'border-white/10',
}

const SEVERITY_ICON: Record<Insight['severity'], string> = {
  alert: '⚠️',
  watch: '👀',
  win: '🎉',
  info: 'ℹ️',
}

function InsightCard({ insight }: { insight: Insight }) {
  const [showWhy, setShowWhy] = useState(false)
  return (
    <div className={`rounded-2xl bg-ink-soft border ${SEVERITY_STYLE[insight.severity]} p-4 space-y-1`}>
      <p className="font-bold">
        {SEVERITY_ICON[insight.severity]} {insight.title}
      </p>
      <p className="text-sm text-white/60">{insight.body}</p>
      <button onClick={() => setShowWhy(!showWhy)} className="text-xs text-white/40 underline">
        {showWhy ? 'Hide' : 'Why?'}
      </button>
      {showWhy && (
        <div className="pt-1 space-y-0.5">
          {insight.why.map((w, i) => (
            <div key={i} className="flex justify-between text-xs text-white/50">
              <span>{w.label}</span>
              <span className="tabular-nums">
                {w.valueCents !== undefined ? formatZAR(w.valueCents) : w.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
