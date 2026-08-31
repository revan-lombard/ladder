import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSetupStatus, type SetupStatus } from '../api/setup'
import { useHouseholdId } from '../hooks/queries'
import { useQuickAdd } from './QuickAddSheet'

/**
 * Gamified onboarding: "climb your first rung" by capturing the initial
 * data. Steps tick themselves off from real data and deep-link to where
 * each is done. Disappears once complete (dismiss stored per device).
 */

interface Step {
  id: keyof SetupStatus
  icon: string
  title: string
  hint: string
  action: { to: string } | { quickAdd: true }
}

const STEPS: Step[] = [
  { id: 'hasAccount', icon: '🏦', title: 'Add a bank account', hint: 'Settings → Accounts', action: { to: '/settings' } },
  { id: 'hasExpense', icon: '💸', title: 'Capture your first expense', hint: 'Tap + anywhere', action: { quickAdd: true } },
  { id: 'hasIncome', icon: '💰', title: 'Log your income', hint: 'Tap +, switch to Income', action: { quickAdd: true } },
  { id: 'hasBudget', icon: '📊', title: 'Set your first budget', hint: 'Pick a category, tap "set budget"', action: { to: '/budget' } },
  { id: 'hasGoal', icon: '🪜', title: 'Add rungs to your ladder', hint: 'What are you building toward?', action: { to: '/goals' } },
  { id: 'hasEmergencyGoal', icon: '🛡️', title: 'Mark your emergency fund', hint: 'Settings → Resilience', action: { to: '/settings' } },
  { id: 'hasAssetOrLiability', icon: '💎', title: 'Record what you own & owe', hint: 'Money → Net worth', action: { to: '/money?tab=networth' } },
  { id: 'hasTimeSettings', icon: '⏱️', title: 'Set your weekly time capacity', hint: 'Settings → Time capacity', action: { to: '/settings' } },
  { id: 'hasValues', icon: '💞', title: 'Rank your values together', hint: 'Settings → Our values', action: { to: '/settings' } },
  { id: 'hasMeeting', icon: '📅', title: 'Run your first weekly rebase', hint: 'Planning → Meetings', action: { to: '/planning?tab=meetings' } },
]

const DISMISS_KEY = 'ladder-setup-dismissed'

export default function SetupChecklist() {
  const navigate = useNavigate()
  const { openAdd } = useQuickAdd()
  const { data: householdId } = useHouseholdId()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  )

  const { data: status } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => getSetupStatus(householdId!),
    enabled: Boolean(householdId) && !dismissed,
    staleTime: 10_000,
  })

  if (dismissed || !status) return null

  const done = STEPS.filter((s) => status[s.id]).length
  const total = STEPS.length
  const complete = done === total
  const pct = Math.round((done / total) * 100)
  const next = STEPS.find((s) => !status[s.id])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const act = (step: Step) => {
    if ('quickAdd' in step.action) openAdd()
    else navigate(step.action.to)
  }

  if (complete) {
    return (
      <div className="rounded-2xl bg-rung/15 border border-rung/40 p-4 text-center space-y-2">
        <div className="text-4xl">🎉</div>
        <p className="font-bold">First rung climbed — LADDER is fully set up!</p>
        <p className="text-sm text-white/60">
          From here it's a rhythm: capture as you spend, rebase weekly, review monthly.
        </p>
        <button onClick={dismiss} className="rounded-xl bg-rung text-ink font-bold px-4 py-2 text-sm">
          Start climbing
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-ink-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold">🧗 Getting set up</p>
        <span className="text-sm text-white/50 tabular-nums">{done}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-rung transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      {next && (
        <button
          onClick={() => act(next)}
          className="w-full flex items-center gap-3 rounded-xl bg-rung text-ink px-3 py-3 text-left"
        >
          <span className="text-2xl">{next.icon}</span>
          <span className="flex-1">
            <span className="font-bold block">Next: {next.title}</span>
            <span className="text-xs text-ink/70">{next.hint}</span>
          </span>
          <span className="font-bold">→</span>
        </button>
      )}

      <details>
        <summary className="text-xs text-white/40 cursor-pointer">All steps</summary>
        <div className="pt-2 space-y-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => !status[s.id] && act(s)}
              disabled={status[s.id]}
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left ${
                status[s.id] ? 'text-white/30 line-through' : 'hover:bg-white/5'
              }`}
            >
              <span>{status[s.id] ? '✅' : s.icon}</span>
              {s.title}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
