import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createDecision, listDecisions, reviewDecision } from '../../api/life'
import { useHouseholdId } from '../../hooks/queries'
import { todayISO } from '../../lib/dates'
import type { Decision } from '../../types'

/**
 * Decision log (brief §29–30): record major household decisions with their
 * reasoning, then answer honestly at review time whether they worked.
 */
export default function DecisionsView() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['decisions'] })
  const { data: householdId } = useHouseholdId()
  const { data: decisions } = useQuery({ queryKey: ['decisions'], queryFn: listDecisions })

  const [adding, setAdding] = useState(false)
  const [reviewing, setReviewing] = useState<Decision | null>(null)

  const today = todayISO()
  const dueForReview = (d: Decision) =>
    d.status === 'active' && d.review_date !== null && d.review_date <= today

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="text-xs font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
          + Decision
        </button>
      </div>

      {(decisions ?? []).length === 0 && (
        <div className="rounded-2xl bg-ink-soft p-8 text-center text-white/50">
          Record the big calls — "delay the house purchase", "take the new job" —
          with your reasoning. LADDER will ask later whether they worked.
        </div>
      )}

      {(decisions ?? []).map((d) => (
        <button
          key={d.id}
          onClick={() => dueForReview(d) && setReviewing(d)}
          className={`w-full text-left rounded-2xl bg-ink-soft p-4 space-y-1 ${
            dueForReview(d) ? 'border border-warn/50' : ''
          }`}
        >
          <div className="flex justify-between gap-2">
            <span className="font-bold">{d.title}</span>
            <span className="text-xs text-white/40 shrink-0">{d.decided_on}</span>
          </div>
          {d.reason && <p className="text-sm text-white/50">{d.reason}</p>}
          {dueForReview(d) && (
            <p className="text-sm text-warn font-bold">⏰ Due for review — did it work? Tap to answer.</p>
          )}
          {d.status === 'reviewed' && d.actual_outcome && (
            <p className="text-sm text-rung">✅ Reviewed: {d.actual_outcome}</p>
          )}
          {d.status === 'active' && d.review_date && !dueForReview(d) && (
            <p className="text-xs text-white/30">Review on {d.review_date}</p>
          )}
        </button>
      ))}

      {adding && householdId && (
        <AddDecisionSheet
          householdId={householdId}
          onClose={() => setAdding(false)}
          onSaved={invalidate}
        />
      )}

      {reviewing && (
        <ReviewSheet
          decision={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  )
}

function AddDecisionSheet({
  householdId,
  onClose,
  onSaved,
}: {
  householdId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [alternatives, setAlternatives] = useState('')
  const [expected, setExpected] = useState('')
  const [review, setReview] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!title.trim()) return setError('What was decided?')
    try {
      await createDecision({
        household_id: householdId,
        title: title.trim(),
        reason: reason.trim() || null,
        alternatives: alternatives.trim() || null,
        expected_outcome: expected.trim() || null,
        decided_on: todayISO(),
        review_date: review || null,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <Sheet title="Record a decision" onClose={onClose}>
      <input autoFocus placeholder="What did we decide?" value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none" />
      <input placeholder="Why? (the reasoning)" value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-sm" />
      <input placeholder="Alternatives we considered (optional)" value={alternatives}
        onChange={(e) => setAlternatives(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-sm" />
      <input placeholder="What we expect to happen (optional)" value={expected}
        onChange={(e) => setExpected(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-sm" />
      <label className="block text-xs text-white/40">
        Review date — when should we check whether it worked?
        <input type="date" value={review} onChange={(e) => setReview(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-white" />
      </label>
      {error && <p className="text-alert text-sm text-center">{error}</p>}
      <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
        Log decision
      </button>
    </Sheet>
  )
}

function ReviewSheet({
  decision,
  onClose,
  onSaved,
}: {
  decision: Decision
  onClose: () => void
  onSaved: () => void
}) {
  const [outcome, setOutcome] = useState('')
  const save = async () => {
    if (!outcome.trim()) return
    await reviewDecision(decision.id, outcome.trim())
    onSaved()
    onClose()
  }
  return (
    <Sheet title={`Review: ${decision.title}`} onClose={onClose}>
      {decision.expected_outcome && (
        <p className="text-sm text-white/50">Expected: {decision.expected_outcome}</p>
      )}
      <textarea
        autoFocus
        placeholder="What actually happened? Was it the right call?"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        rows={3}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-sm"
      />
      <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
        Save review
      </button>
    </Sheet>
  )
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl bg-ink-soft p-4 pb-8 space-y-3 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg">{title}</h2>
        {children}
      </div>
    </div>
  )
}
