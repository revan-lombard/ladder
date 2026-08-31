import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProject,
  createProjectTask,
  getTimeSettings,
  listAllTasks,
  listProjects,
  setTaskStatus,
  updateProject,
} from '../../api/time'
import { useHouseholdId } from '../../hooks/queries'
import {
  formatMinutes,
  projectRisks,
  remainingMinutes,
  RISK_DISPLAY,
  type ProjectRisk,
} from '../../time/engine'
import { todayISO } from '../../lib/dates'
import type { Project, Task, TaskStatus } from '../../types'

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  open: 'in_progress',
  in_progress: 'done',
  blocked: 'in_progress',
  done: 'open',
  cancelled: 'open',
}

const STATUS_ICON: Record<TaskStatus, string> = {
  open: '⚪',
  in_progress: '🔵',
  blocked: '🟠',
  done: '✅',
  cancelled: '✖️',
}

export default function ProjectsView() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }
  const { data: householdId } = useHouseholdId()
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const { data: tasks } = useQuery({ queryKey: ['tasks', 'all'], queryFn: listAllTasks })
  const { data: settings } = useQuery({
    queryKey: ['time-settings', householdId],
    queryFn: () => getTimeSettings(householdId!),
    enabled: Boolean(householdId),
  })

  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const risks =
    settings && projects && tasks
      ? projectRisks(projects, tasks, todayISO(), settings.weekly_flexible_hours, settings.utilization_pct)
      : []
  const riskById = new Map(risks.map((r) => [r.projectId, r]))

  const active = (projects ?? []).filter((p) => p.status === 'active')
  const complete = (projects ?? []).filter((p) => p.status === 'complete')
  const openProject = (projects ?? []).find((p) => p.id === openId)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="text-xs font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
          + Project
        </button>
      </div>

      {active.length === 0 && (
        <div className="rounded-2xl bg-ink-soft p-8 text-center text-white/50">
          Projects are commitments with deadlines — a client website, the
          kitchen tea, a portfolio. LADDER checks them against your realistic
          capacity.
        </div>
      )}

      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      {active.map((p) => {
        const risk = riskById.get(p.id)
        return (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className="w-full text-left rounded-2xl bg-ink-soft p-4 space-y-1"
          >
            <div className="flex justify-between">
              <span className="font-bold">{p.name}</span>
              {risk && (
                <span className="text-sm">
                  {RISK_DISPLAY[risk.risk].emoji} {RISK_DISPLAY[risk.risk].label}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">
              {risk && `${formatMinutes(risk.remainingMinutes)} remaining`}
              {p.deadline && risk?.daysRemaining !== null && risk !== undefined && (
                <> · due {p.deadline} ({risk.daysRemaining}d)</>
              )}
              {risk && risk.shortfallMinutes > 0 && (
                <span className="text-alert font-bold">
                  {' '}
                  · short {formatMinutes(risk.shortfallMinutes)}
                </span>
              )}
            </p>
          </button>
        )
      })}
      </div>

      {complete.length > 0 && (
        <p className="text-xs text-white/30 text-center">
          {complete.length} completed project{complete.length > 1 ? 's' : ''}
        </p>
      )}

      {adding && householdId && (
        <NewProjectSheet
          householdId={householdId}
          onClose={() => setAdding(false)}
          onSaved={invalidate}
        />
      )}

      {openProject && householdId && (
        <ProjectSheet
          project={openProject}
          tasks={(tasks ?? []).filter((t) => t.project_id === openProject.id)}
          risk={riskById.get(openProject.id)}
          householdId={householdId}
          onClose={() => setOpenId(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  )
}

function NewProjectSheet({
  householdId,
  onClose,
  onSaved,
}: {
  householdId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [hours, setHours] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) return setError('Give the project a name')
    const estimated = hours ? Math.round(Number(hours.replace(',', '.')) * 60) : 0
    if (hours && (!Number.isFinite(estimated) || estimated < 0)) return setError('Invalid hours')
    try {
      await createProject({
        household_id: householdId,
        name: name.trim(),
        deadline: deadline || null,
        estimated_minutes: estimated,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <Sheet onClose={onClose} title="New project">
      <input autoFocus placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none" />
      <label className="block text-xs text-white/40">
        Deadline (optional)
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded-xl bg-white/10 px-3 py-3 outline-none text-white" />
      </label>
      <input inputMode="decimal" placeholder="Estimated hours (used until tasks have estimates)"
        value={hours} onChange={(e) => setHours(e.target.value)}
        className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none" />
      {error && <p className="text-alert text-sm text-center">{error}</p>}
      <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-3">
        Create project
      </button>
    </Sheet>
  )
}

function ProjectSheet({
  project,
  tasks,
  risk,
  householdId,
  onClose,
  onChanged,
}: {
  project: Project
  tasks: Task[]
  risk: ProjectRisk | undefined
  householdId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cycle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      setTaskStatus(id, NEXT_STATUS[status]),
    onSuccess: onChanged,
  })

  const addTask = async () => {
    if (!title.trim()) return
    const minutes = estimate ? Math.round(Number(estimate.replace(',', '.')) * 60) : null
    if (estimate && (!Number.isFinite(minutes!) || minutes! <= 0)) return setError('Invalid hours')
    try {
      await createProjectTask({
        household_id: householdId,
        project_id: project.id,
        title: title.trim(),
        estimated_minutes: minutes,
      })
      setTitle('')
      setEstimate('')
      setError(null)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const toggleComplete = async () => {
    await updateProject(project.id, {
      status: project.status === 'complete' ? 'active' : 'complete',
    })
    onChanged()
    onClose()
  }

  const remaining = remainingMinutes(project, tasks)

  return (
    <Sheet onClose={onClose} title={project.name}>
      <div className="rounded-xl bg-white/5 p-3 text-sm space-y-0.5">
        {risk && (
          <p>
            {RISK_DISPLAY[risk.risk].emoji} {RISK_DISPLAY[risk.risk].label}
            {risk.shortfallMinutes > 0 &&
              ` — ${formatMinutes(risk.shortfallMinutes)} more work than realistic capacity before the deadline`}
          </p>
        )}
        <p className="text-white/50">
          {formatMinutes(remaining)} remaining
          {project.deadline && ` · due ${project.deadline}`}
          {risk && risk.daysRemaining !== null && ` · capacity till then ${formatMinutes(risk.availableMinutes)}`}
        </p>
      </div>

      <div className="space-y-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => cycle.mutate({ id: t.id, status: t.status })}
            title="Tap to advance status"
            className="w-full flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm text-left"
          >
            <span className={t.status === 'done' ? 'line-through text-white/40' : ''}>
              {STATUS_ICON[t.status]} {t.title}
            </span>
            {t.estimated_minutes && (
              <span className="text-xs text-white/40">{formatMinutes(t.estimated_minutes)}</span>
            )}
          </button>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-white/40">
            No tasks yet — add them below with hour estimates for accurate risk.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <input placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 outline-none text-sm" />
        <input inputMode="decimal" placeholder="hrs" value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          className="w-16 rounded-xl bg-white/10 px-2 py-2.5 outline-none text-sm text-center" />
        <button onClick={addTask} className="rounded-xl bg-rung text-ink font-bold px-3 text-sm">
          Add
        </button>
      </div>
      {error && <p className="text-alert text-sm text-center">{error}</p>}
      <p className="text-xs text-white/30">Tap a task to advance it: ⚪ open → 🔵 in progress → ✅ done.</p>

      <button
        onClick={toggleComplete}
        className={`w-full rounded-xl font-bold py-3 ${
          project.status === 'complete' ? 'bg-white/10' : 'bg-rung text-ink'
        }`}
      >
        {project.status === 'complete' ? 'Reopen project' : '✅ Mark project complete'}
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-ink-soft p-4 pb-8 space-y-3 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-lg">{title}</h2>
        {children}
      </div>
    </div>
  )
}
