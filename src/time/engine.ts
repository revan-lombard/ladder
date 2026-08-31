// Time & Commitments engine — PURE, like src/insights. Deterministic
// capacity and deadline-risk math; the UI and (later) AI only explain it.
//
// Core principle (brief §16–17): never plan at 100%. Usable capacity =
// weekly flexible hours × utilisation %, and deadline risk is CUMULATIVE:
// a project competes for capacity with every project due before it
// (earliest-deadline-first feasibility, brief §26).

import type { Project, Task } from '../types'

export type RiskLevel = 'on_track' | 'at_risk' | 'critical' | 'overdue'
export type LifeLoad = 'light' | 'normal' | 'busy' | 'heavy' | 'overloaded'

export interface ProjectRisk {
  projectId: string
  risk: RiskLevel
  remainingMinutes: number
  /** Usable capacity between today and the deadline (utilisation applied). */
  availableMinutes: number
  /** This project's work + all work due on or before its deadline. */
  cumulativeRequiredMinutes: number
  shortfallMinutes: number
  daysRemaining: number | null
}

const OPEN_STATUSES = new Set(['open', 'in_progress', 'blocked'])

/**
 * Remaining work for a project: the sum of open tasks' estimates when any
 * exist, else the project-level fallback estimate. Done/cancelled tasks
 * never count; unestimated open tasks count 0 (honest, if incomplete).
 */
export function remainingMinutes(project: Project, tasks: Task[]): number {
  const own = tasks.filter((t) => t.project_id === project.id)
  const hasEstimates = own.some((t) => t.estimated_minutes !== null)
  if (hasEstimates) {
    return own
      .filter((t) => OPEN_STATUSES.has(t.status))
      .reduce((s, t) => s + (t.estimated_minutes ?? 0), 0)
  }
  if (own.length > 0 && own.every((t) => !OPEN_STATUSES.has(t.status))) return 0
  return project.estimated_minutes
}

/** Whole days from today until dateISO (0 = due today, negative = past). */
export function daysUntil(todayISO: string, dateISO: string): number {
  const toUTC = (iso: string) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return Math.round((toUTC(dateISO) - toUTC(todayISO)) / 86_400_000)
}

/** Usable minutes between today and a deadline (inclusive of today). */
export function usableMinutesUntil(
  todayISO: string,
  deadlineISO: string,
  weeklyFlexibleHours: number,
  utilizationPct: number
): number {
  const days = daysUntil(todayISO, deadlineISO) + 1 // today still counts
  if (days <= 0) return 0
  return Math.round(((days / 7) * weeklyFlexibleHours * 60 * utilizationPct) / 100)
}

/**
 * Deadline risk for every active project. Cumulative: sort by deadline,
 * carry the running total of required work, and compare against capacity
 * to each deadline. Deadline-less projects can only ever be 'on_track'.
 */
export function projectRisks(
  projects: Project[],
  tasks: Task[],
  todayISO: string,
  weeklyFlexibleHours: number,
  utilizationPct: number
): ProjectRisk[] {
  const active = projects.filter((p) => p.status === 'active')
  const withDeadline = active
    .filter((p) => p.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
  const without = active.filter((p) => !p.deadline)

  const out: ProjectRisk[] = []
  let running = 0

  for (const p of withDeadline) {
    const remaining = remainingMinutes(p, tasks)
    running += remaining
    const available = usableMinutesUntil(
      todayISO,
      p.deadline!,
      weeklyFlexibleHours,
      utilizationPct
    )
    const days = daysUntil(todayISO, p.deadline!)
    const shortfall = Math.max(running - available, 0)

    let risk: RiskLevel
    if (days < 0 && remaining > 0) risk = 'overdue'
    else if (shortfall > 0) risk = 'critical'
    else if (available > 0 && (available - running) / available < 0.25) risk = 'at_risk'
    else risk = 'on_track'

    out.push({
      projectId: p.id,
      risk,
      remainingMinutes: remaining,
      availableMinutes: available,
      cumulativeRequiredMinutes: running,
      shortfallMinutes: shortfall,
      daysRemaining: days,
    })
  }

  for (const p of without) {
    out.push({
      projectId: p.id,
      risk: 'on_track',
      remainingMinutes: remainingMinutes(p, tasks),
      availableMinutes: 0,
      cumulativeRequiredMinutes: 0,
      shortfallMinutes: 0,
      daysRemaining: null,
    })
  }
  return out
}

/**
 * Life load: all active-project work due (or undated) within the next 28
 * days versus usable capacity over those 28 days.
 */
export function lifeLoad(
  projects: Project[],
  tasks: Task[],
  todayISO: string,
  weeklyFlexibleHours: number,
  utilizationPct: number
): { load: LifeLoad; requiredMinutes: number; usableMinutes: number; pct: number } {
  const horizonMinutes = Math.round((4 * weeklyFlexibleHours * 60 * utilizationPct) / 100)
  const required = projects
    .filter((p) => p.status === 'active')
    .filter((p) => !p.deadline || daysUntil(todayISO, p.deadline) <= 28)
    .reduce((s, p) => s + remainingMinutes(p, tasks), 0)

  const pct = horizonMinutes > 0 ? Math.round((required / horizonMinutes) * 100) : 0
  const load: LifeLoad =
    pct < 40 ? 'light' : pct < 70 ? 'normal' : pct < 90 ? 'busy' : pct < 110 ? 'heavy' : 'overloaded'

  return { load, requiredMinutes: required, usableMinutes: horizonMinutes, pct }
}

export const LOAD_DISPLAY: Record<LifeLoad, { emoji: string; label: string }> = {
  light: { emoji: '🟢', label: 'Light' },
  normal: { emoji: '🟢', label: 'Normal' },
  busy: { emoji: '🟡', label: 'Busy' },
  heavy: { emoji: '🟠', label: 'Heavy' },
  overloaded: { emoji: '🔴', label: 'Overloaded' },
}

export const RISK_DISPLAY: Record<RiskLevel, { emoji: string; label: string }> = {
  on_track: { emoji: '🟢', label: 'On track' },
  at_risk: { emoji: '🟡', label: 'At risk' },
  critical: { emoji: '🔴', label: 'Critical' },
  overdue: { emoji: '🔴', label: 'Overdue' },
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
