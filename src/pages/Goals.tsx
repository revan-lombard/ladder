import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addContribution,
  createGoal,
  listContributions,
  listDependencies,
  listGoals,
  setDependency,
  setGoalStatus,
  swapPositions,
  updateGoal,
} from '../api/goals'
import { useHouseholdId } from '../hooks/queries'
import { formatZAR, formatZARWhole, parseAmountToCents } from '../lib/money'
import { todayISO } from '../lib/dates'
import type { Goal } from '../types'

export default function Goals() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['goals'] })
  const { data: householdId } = useHouseholdId()

  const { data: goals } = useQuery({ queryKey: ['goals', 'list'], queryFn: listGoals })
  const { data: contribs } = useQuery({
    queryKey: ['goals', 'contributions'],
    queryFn: listContributions,
  })
  const { data: deps } = useQuery({ queryKey: ['goals', 'deps'], queryFn: listDependencies })

  const [detail, setDetail] = useState<Goal | null>(null)
  const [adding, setAdding] = useState(false)

  const contributedByGoal = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of contribs ?? []) {
      map.set(c.goal_id, (map.get(c.goal_id) ?? 0) + c.amount_cents)
    }
    return map
  }, [contribs])

  const goalById = new Map((goals ?? []).map((g) => [g.id, g]))
  const isLocked = (goal: Goal) => {
    const dep = (deps ?? []).find((d) => d.goal_id === goal.id)
    if (!dep) return false
    const prereq = goalById.get(dep.depends_on_goal_id)
    return prereq ? prereq.status !== 'complete' : false
  }
  const prereqName = (goal: Goal) => {
    const dep = (deps ?? []).find((d) => d.goal_id === goal.id)
    return dep ? goalById.get(dep.depends_on_goal_id)?.name : undefined
  }

  const ladder = (goals ?? []).filter((g) => g.status !== 'archived')

  const reorder = useMutation({
    mutationFn: ({ a, b }: { a: Goal; b: Goal }) => swapPositions(a, b),
    onSuccess: invalidate,
  })

  const move = (index: number, dir: -1 | 1) => {
    const other = ladder[index + dir]
    if (other) reorder.mutate({ a: ladder[index], b: other })
  }

  return (
    <div className="max-w-lg lg:max-w-2xl mx-auto p-4 lg:p-8 space-y-3">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl lg:text-2xl font-bold">🪜 The Ladder</h1>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold"
        >
          + Goal
        </button>
      </header>

      {ladder.length === 0 && (
        <div className="rounded-2xl bg-ink-soft p-8 text-center text-white/50">
          Define the rungs of your ladder — the milestones between here and the
          life you want. Start with the foundations (emergency fund first?).
        </div>
      )}

      {ladder.map((goal, i) => {
        const contributed = contributedByGoal.get(goal.id) ?? 0
        const pct = Math.min(Math.round((contributed / goal.target_amount_cents) * 100), 100)
        const locked = isLocked(goal)
        const complete = goal.status === 'complete'
        return (
          <button
            key={goal.id}
            onClick={() => setDetail(goal)}
            className={`w-full text-left rounded-2xl p-4 space-y-2 ${
              complete ? 'bg-rung-dark/30' : 'bg-ink-soft'
            } ${locked ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">
                {complete ? '✅ ' : locked ? '🔒 ' : ''}
                {goal.name}
              </span>
              <span className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span
                  role="button"
                  onClick={() => move(i, -1)}
                  className="h-7 w-7 rounded bg-white/10 text-center leading-7 text-xs"
                >
                  ↑
                </span>
                <span
                  role="button"
                  onClick={() => move(i, 1)}
                  className="h-7 w-7 rounded bg-white/10 text-center leading-7 text-xs"
                >
                  ↓
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full ${complete ? 'bg-rung' : locked ? 'bg-white/30' : 'bg-rung'}`}
                style={{ width: `${complete ? 100 : pct}%` }}
              />
            </div>
            <p className="text-xs text-white/50">
              {formatZARWhole(contributed)} of {formatZARWhole(goal.target_amount_cents)} ({pct}%)
              {goal.target_date && ` · by ${goal.target_date}`}
              {locked && ` · unlocks after "${prereqName(goal)}"`}
            </p>
          </button>
        )
      })}

      {adding && householdId && (
        <GoalForm
          householdId={householdId}
          nextPosition={(ladder[ladder.length - 1]?.ladder_position ?? 0) + 1}
          onClose={() => setAdding(false)}
          onSaved={invalidate}
        />
      )}

      {detail && householdId && (
        <GoalDetail
          goal={goalById.get(detail.id) ?? detail}
          householdId={householdId}
          contributed={contributedByGoal.get(detail.id) ?? 0}
          allGoals={ladder}
          deps={deps ?? []}
          onClose={() => setDetail(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  )
}

function GoalForm({
  householdId,
  nextPosition,
  onClose,
  onSaved,
}: {
  householdId: string
  nextPosition: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const cents = parseAmountToCents(target)
    if (!name.trim()) return setError('Give the goal a name')
    if (!cents) return setError('Enter a valid target amount')
    try {
      await createGoal({
        household_id: householdId,
        name: name.trim(),
        target_amount_cents: cents,
        target_date: date || null,
        ladder_position: nextPosition,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <Modal onClose={onClose} title="New rung">
      <input
        autoFocus
        placeholder="Goal name (e.g. Emergency Fund)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none"
      />
      <input
        inputMode="decimal"
        placeholder="Target amount (R)"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none"
      />
      <label className="block text-xs text-white/40">
        Target date (optional)
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-white"
        />
      </label>
      {error && <p className="text-alert text-sm text-center">{error}</p>}
      <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
        Add to the ladder
      </button>
    </Modal>
  )
}

function GoalDetail({
  goal,
  householdId,
  contributed,
  allGoals,
  deps,
  onClose,
  onChanged,
}: {
  goal: Goal
  householdId: string
  contributed: number
  allGoals: Goal[]
  deps: { goal_id: string; depends_on_goal_id: string }[]
  onClose: () => void
  onChanged: () => void
}) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const currentDep = deps.find((d) => d.goal_id === goal.id)?.depends_on_goal_id ?? ''

  const contribute = async () => {
    const cents = parseAmountToCents(amount)
    if (!cents) return setError('Enter a valid amount')
    try {
      await addContribution({
        household_id: householdId,
        goal_id: goal.id,
        contrib_date: todayISO(),
        amount_cents: cents,
      })
      setAmount('')
      setError(null)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const changeDep = async (dependsOn: string) => {
    try {
      await setDependency(
        householdId,
        goal.id,
        dependsOn || null,
        deps.map((d) => ({ ...d, household_id: householdId }))
      )
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const toggleComplete = async () => {
    await setGoalStatus(goal.id, goal.status === 'complete' ? 'active' : 'complete')
    onChanged()
  }

  const archive = async () => {
    if (!confirm(`Remove "${goal.name}" from the ladder?`)) return
    await updateGoal(goal.id, { status: 'archived' })
    onChanged()
    onClose()
  }

  return (
    <Modal onClose={onClose} title={goal.name}>
      <p className="text-center text-2xl font-bold">
        {formatZAR(contributed)}{' '}
        <span className="text-white/40 text-base font-normal">
          of {formatZAR(goal.target_amount_cents)}
        </span>
      </p>

      {goal.status !== 'complete' && (
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            placeholder="Contribute (R)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl bg-white/10 px-3 py-3 outline-none"
          />
          <button onClick={contribute} className="rounded-xl bg-rung text-ink font-bold px-4">
            Add
          </button>
        </div>
      )}

      <label className="block text-xs text-white/40">
        Locked until this goal completes
        <select
          value={currentDep}
          onChange={(e) => changeDep(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-white"
        >
          <option value="" className="text-ink">
            No prerequisite
          </option>
          {allGoals
            .filter((g) => g.id !== goal.id)
            .map((g) => (
              <option key={g.id} value={g.id} className="text-ink">
                {g.name}
              </option>
            ))}
        </select>
      </label>

      {error && <p className="text-alert text-sm text-center">{error}</p>}

      <button
        onClick={toggleComplete}
        className={`w-full rounded-xl font-bold py-3 ${
          goal.status === 'complete' ? 'bg-white/10' : 'bg-rung text-ink'
        }`}
      >
        {goal.status === 'complete' ? 'Reopen goal' : '✅ Mark complete'}
      </button>
      <button onClick={archive} className="w-full rounded-xl bg-alert/20 text-alert py-2.5 text-sm">
        Remove from ladder
      </button>
    </Modal>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-ink-soft p-4 pb-8 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg">{title}</h2>
        {children}
      </div>
    </div>
  )
}
