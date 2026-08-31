import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEvent,
  deleteEvent,
  getTimeSettings,
  listAllTasks,
  listEvents,
  listProjects,
  setTaskStatus,
} from '../../api/time'
import { useHouseholdId } from '../../hooks/queries'
import { formatMinutes, lifeLoad, LOAD_DISPLAY, projectRisks, RISK_DISPLAY } from '../../time/engine'
import { addDays, dayLabel, todayISO } from '../../lib/dates'
import type { CalendarEvent, EventCategory, Visibility } from '../../types'

const CATEGORY_ICON: Record<EventCategory, string> = {
  work: '💼',
  personal: '👤',
  relationship: '💞',
  family: '👨‍👩‍👧',
  health: '🏋️',
  career: '📈',
  business: '🏢',
  travel: '✈️',
  protected: '🛡️',
}

export default function TodayView() {
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const today = todayISO()
  const weekEnd = addDays(today, 7)

  const { data: events } = useQuery({
    queryKey: ['events', today, weekEnd],
    queryFn: () => listEvents(today, weekEnd),
  })
  const { data: tasks } = useQuery({ queryKey: ['tasks', 'all'], queryFn: listAllTasks })
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const { data: settings } = useQuery({
    queryKey: ['time-settings', householdId],
    queryFn: () => getTimeSettings(householdId!),
    enabled: Boolean(householdId),
  })

  const [adding, setAdding] = useState(false)

  const removeEvent = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
  const closeTask = useMutation({
    mutationFn: (id: string) => setTaskStatus(id, 'done'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const todayEvents = (events ?? []).filter((e) => e.event_date === today)
  const upcoming = (events ?? []).filter((e) => e.event_date > today)

  const priorities = (tasks ?? [])
    .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .filter((t) => t.priority <= 1 || (t.due_date && t.due_date <= weekEnd))
    .slice(0, 5)

  const load =
    settings && projects && tasks
      ? lifeLoad(projects, tasks, today, settings.weekly_flexible_hours, settings.utilization_pct)
      : null

  const risks =
    settings && projects && tasks
      ? projectRisks(projects, tasks, today, settings.weekly_flexible_hours, settings.utilization_pct)
      : []
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]))
  const deadlines = risks
    .filter((r) => r.daysRemaining !== null && r.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining! - b.daysRemaining!)

  return (
    <div className="space-y-4">
      {load && (
        <div className="rounded-2xl bg-ink-soft p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Life load (4 weeks)</p>
            <p className="font-bold">
              {LOAD_DISPLAY[load.load].emoji} {LOAD_DISPLAY[load.load].label}
            </p>
          </div>
          <p className="text-sm text-white/50 text-right">
            {formatMinutes(load.requiredMinutes)} committed
            <br />
            {formatMinutes(load.usableMinutes)} realistically usable
          </p>
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-widest text-white/50">Today · {dayLabel(today)}</h2>
          <button onClick={() => setAdding(true)} className="text-xs font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
            + Event
          </button>
        </div>
        <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
          {todayEvents.map((e) => (
            <EventRow key={e.id} event={e} onDelete={() => removeEvent.mutate(e.id)} />
          ))}
          {todayEvents.length === 0 && (
            <p className="px-4 py-3 text-white/40 text-sm">Nothing scheduled today.</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-white/50">Priorities</h2>
        <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
          {priorities.map((t) => (
            <button
              key={t.id}
              onClick={() => closeTask.mutate(t.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm"
            >
              <span className="h-5 w-5 rounded-full border-2 border-white/30 shrink-0" />
              <span className="flex-1">
                {t.priority === 0 && '🔴 '}
                {t.priority === 1 && '🟡 '}
                {t.title}
              </span>
              {t.due_date && <span className="text-xs text-white/40">{t.due_date.slice(5)}</span>}
            </button>
          ))}
          {priorities.length === 0 && (
            <p className="px-4 py-3 text-white/40 text-sm">No pressing priorities. 🎉</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-white/50">Next 7 days</h2>
        <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
          {upcoming.map((e) => (
            <div key={e.id} className="flex justify-between px-4 py-2.5 text-sm">
              <span>
                {CATEGORY_ICON[e.category]} {e.title}
                {e.visibility === 'private' && ' 🔒'}
              </span>
              <span className="text-white/40">{dayLabel(e.event_date)}</span>
            </div>
          ))}
          {deadlines.map((r) => {
            const p = projectById.get(r.projectId)
            if (!p?.deadline) return null
            return (
              <div key={r.projectId} className="flex justify-between px-4 py-2.5 text-sm">
                <span>
                  {RISK_DISPLAY[r.risk].emoji} {p.name} deadline
                </span>
                <span className="text-white/40">
                  {r.daysRemaining === 0 ? 'today' : `${r.daysRemaining}d`}
                </span>
              </div>
            )
          })}
          {upcoming.length === 0 && deadlines.length === 0 && (
            <p className="px-4 py-3 text-white/40 text-sm">A quiet week ahead.</p>
          )}
        </div>
      </section>

      {adding && householdId && (
        <AddEventSheet householdId={householdId} onClose={() => setAdding(false)} />
      )}
    </div>
  )
}

function EventRow({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  const time = event.all_day
    ? 'All day'
    : `${event.start_time?.slice(0, 5) ?? ''}${event.end_time ? `–${event.end_time.slice(0, 5)}` : ''}`
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm">
          {CATEGORY_ICON[event.category]} {event.title}
          {event.visibility === 'private' && ' 🔒'}
        </p>
        <p className="text-xs text-white/40">{time}</p>
      </div>
      <button onClick={onDelete} className="text-xs text-white/30">
        remove
      </button>
    </div>
  )
}

function AddEventSheet({ householdId, onClose }: { householdId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<EventCategory>('personal')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('shared')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!title.trim()) return setError('Give the event a title')
    try {
      await createEvent({
        household_id: householdId,
        title: title.trim(),
        category,
        event_date: date,
        start_time: start || null,
        end_time: end || null,
        all_day: !start,
        visibility,
      })
      qc.invalidateQueries({ queryKey: ['events'] })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl bg-ink-soft p-4 pb-8 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg">New event</h2>
        <input
          autoFocus
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_ICON) as EventCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                category === c ? 'bg-rung text-ink font-bold' : 'bg-white/10'
              }`}
            >
              {CATEGORY_ICON[c]} {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-white/10 px-2 py-3 outline-none text-sm" />
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="rounded-xl bg-white/10 px-2 py-3 outline-none text-sm" placeholder="Start" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl bg-white/10 px-2 py-3 outline-none text-sm" placeholder="End" />
        </div>
        <button
          onClick={() => setVisibility(visibility === 'shared' ? 'private' : 'shared')}
          className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-left"
        >
          {visibility === 'shared' ? '👥 Shared' : '🔒 Private'}
          <span className="text-white/40"> · tap to change</span>
        </button>
        {error && <p className="text-alert text-sm text-center">{error}</p>}
        <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
          Add event
        </button>
      </div>
    </div>
  )
}
