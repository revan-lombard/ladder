import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  completeMeeting,
  createMeeting,
  createTask,
  listMeetings,
  listOpenTasks,
  setTaskDone,
} from '../../api/meetings'
import { listTransactionsBetween } from '../../api/transactions'
import { listBudgetsForMonth } from '../../api/budgets'
import { listContributions, listGoals } from '../../api/goals'
import { listValues } from '../../api/life'
import { useCategories, useHouseholdId } from '../../hooks/queries'
import { buildWeeklyAgenda, buildMonthlyAgenda } from '../../insights/agenda'
import { addMonths, dayLabel, monthStartOf, todayISO } from '../../lib/dates'
import type { Meeting } from '../../types'

export default function MeetingsView() {
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const { data: meetings } = useQuery({ queryKey: ['meetings'], queryFn: () => listMeetings() })
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: listOpenTasks })

  const { data: categories } = useCategories()
  const month = monthStartOf(todayISO())
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
  const { data: values } = useQuery({ queryKey: ['life', 'values'], queryFn: listValues })

  const [open, setOpen] = useState<Meeting | null>(null)
  const dataReady = categories && transactions && budgets && goals && contributions

  const start = useMutation({
    mutationFn: async (kind: 'weekly' | 'monthly') => {
      if (!householdId || !dataReady) throw new Error('Still loading — try again')
      const inputs = {
        month,
        categories: categories!,
        transactions: transactions!,
        budgets: budgets!,
        goals: goals!,
        contributions: contributions!,
      }
      const agenda =
        kind === 'weekly'
          ? buildWeeklyAgenda(inputs)
          : buildMonthlyAgenda(inputs, { values: (values ?? []).map((v) => v.name) })
      return createMeeting({ household_id: householdId, kind, meeting_date: todayISO(), agenda })
    },
    onSuccess: (meeting) => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      setOpen(meeting)
    },
  })

  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const inProgress = (meetings ?? []).find((m) => !m.completed_at)

  return (
    <div className="space-y-4">
      {inProgress ? (
        <button
          onClick={() => setOpen(inProgress)}
          className="w-full rounded-2xl bg-rung text-ink font-bold p-4 text-left"
        >
          ▶ Continue the {inProgress.kind} {inProgress.kind === 'weekly' ? 'rebase' : 'review'} from{' '}
          {dayLabel(inProgress.meeting_date)}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => start.mutate('weekly')}
            disabled={start.isPending || !dataReady}
            className="rounded-2xl bg-rung text-ink font-bold p-4 disabled:opacity-50"
          >
            Start weekly rebase
          </button>
          <button
            onClick={() => start.mutate('monthly')}
            disabled={start.isPending || !dataReady}
            className="rounded-2xl bg-white/10 font-bold p-4 disabled:opacity-50"
          >
            Start monthly review
          </button>
        </div>
      )}
      {start.error && (
        <p className="text-alert text-sm text-center">
          {start.error.message.includes('duplicate')
            ? 'A meeting of that kind already exists for today — open it below.'
            : start.error.message}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-white/50">Open priorities</h2>
        <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
          {(tasks ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => toggleTask.mutate({ id: t.id, done: true })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className="h-5 w-5 rounded-full border-2 border-white/30 shrink-0" />
              {t.title}
            </button>
          ))}
          {(tasks ?? []).length === 0 && (
            <p className="px-4 py-3 text-white/40 text-sm">
              No open priorities — set them in your next meeting.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-white/50">Past meetings</h2>
        <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
          {(meetings ?? [])
            .filter((m) => m.completed_at)
            .map((m) => (
              <button
                key={m.id}
                onClick={() => setOpen(m)}
                className="w-full flex justify-between px-4 py-3 text-left text-sm"
              >
                <span>
                  {m.kind === 'weekly' ? '📅 Weekly rebase' : '📊 Monthly review'}
                </span>
                <span className="text-white/40">{m.meeting_date}</span>
              </button>
            ))}
          {(meetings ?? []).filter((m) => m.completed_at).length === 0 && (
            <p className="px-4 py-3 text-white/40 text-sm">No completed meetings yet.</p>
          )}
        </div>
      </section>

      {open && householdId && (
        <MeetingSheet
          meeting={open}
          householdId={householdId}
          onClose={() => setOpen(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['meetings'] })
            qc.invalidateQueries({ queryKey: ['tasks'] })
          }}
        />
      )}
    </div>
  )
}

function MeetingSheet({
  meeting,
  householdId,
  onClose,
  onChanged,
}: {
  meeting: Meeting
  householdId: string
  onClose: () => void
  onChanged: () => void
}) {
  const readOnly = Boolean(meeting.completed_at)
  const [priorities, setPriorities] = useState<string[]>([''])
  const [notes, setNotes] = useState(meeting.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const setPriority = (i: number, value: string) => {
    const next = [...priorities]
    next[i] = value
    // Keep one empty row at the end, max 5.
    if (i === next.length - 1 && value.trim() && next.length < 5) next.push('')
    setPriorities(next)
  }

  const finish = async () => {
    const titles = priorities.map((p) => p.trim()).filter(Boolean)
    try {
      for (let i = 0; i < titles.length; i++) {
        await createTask({
          household_id: householdId,
          meeting_id: meeting.id,
          title: titles[i],
          priority: i,
        })
      }
      await completeMeeting(meeting.id, notes.trim() || null)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl bg-ink-soft p-4 pb-8 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg">
          {meeting.kind === 'weekly' ? '📅 Weekly rebase' : '📊 Monthly review'} ·{' '}
          {meeting.meeting_date}
        </h2>

        {meeting.agenda.sections?.map((s) => (
          <section key={s.title}>
            <h3 className="font-bold text-sm pb-1">{s.title}</h3>
            <ul className="space-y-1">
              {s.lines.map((line, i) => (
                <li key={i} className="text-sm text-white/70 pl-3 border-l-2 border-white/10">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {readOnly ? (
          meeting.notes && (
            <section>
              <h3 className="font-bold text-sm pb-1">📝 Notes</h3>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{meeting.notes}</p>
            </section>
          )
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="font-bold text-sm">🎯 Priorities for the {meeting.kind === 'weekly' ? 'week' : 'month'} (3–5)</h3>
              {priorities.map((p, i) => (
                <input
                  key={i}
                  value={p}
                  placeholder={`Priority ${i + 1}`}
                  onChange={(e) => setPriority(i, e.target.value)}
                  className="w-full rounded-xl bg-white/10 px-3 py-2.5 outline-none text-sm"
                />
              ))}
            </section>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes / decisions (optional)"
              rows={2}
              className="w-full rounded-xl bg-white/10 px-3 py-2.5 outline-none text-sm"
            />
            {error && <p className="text-alert text-sm text-center">{error}</p>}
            <button onClick={finish} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
              Complete meeting
            </button>
          </>
        )}
      </div>
    </div>
  )
}
