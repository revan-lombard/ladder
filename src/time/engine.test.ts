import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  formatMinutes,
  lifeLoad,
  projectRisks,
  remainingMinutes,
  usableMinutesUntil,
} from './engine'
import type { Project, Task } from '../types'

const base = {
  household_id: 'hh',
  owner_id: 'me',
  visibility: 'shared' as const,
  created_at: '2026-01-01T00:00:00Z',
}

let seq = 0
function project(name: string, deadline: string | null, estimatedMinutes = 0): Project {
  return {
    ...base,
    id: `p-${++seq}`,
    name,
    deadline,
    estimated_minutes: estimatedMinutes,
    priority: 2,
    goal_id: null,
    notes: null,
    status: 'active',
  }
}

function task(projectId: string, status: Task['status'], estimatedMinutes: number | null): Task {
  return {
    ...base,
    id: `t-${++seq}`,
    meeting_id: null,
    title: 'task',
    description: null,
    priority: 2,
    due_date: null,
    status,
    estimated_minutes: estimatedMinutes,
    actual_minutes: null,
    project_id: projectId,
    goal_id: null,
    energy: null,
    completed_at: null,
  }
}

const TODAY = '2026-09-01'

describe('daysUntil / usableMinutesUntil', () => {
  it('counts whole days', () => {
    expect(daysUntil(TODAY, '2026-09-08')).toBe(7)
    expect(daysUntil(TODAY, TODAY)).toBe(0)
    expect(daysUntil(TODAY, '2026-08-31')).toBe(-1)
  })
  it('applies the utilisation buffer', () => {
    // 7 days incl today = 8/7 weeks... today counts: 8 days -> 8/7 * 20h * 80% = ~1097m
    expect(usableMinutesUntil(TODAY, '2026-09-08', 20, 80)).toBe(
      Math.round((8 / 7) * 20 * 60 * 0.8)
    )
    expect(usableMinutesUntil(TODAY, '2026-08-25', 20, 80)).toBe(0)
  })
})

describe('remainingMinutes', () => {
  it('sums open task estimates when any task has one', () => {
    const p = project('Site', '2026-09-17', 1200)
    const tasks = [
      task(p.id, 'done', 120),
      task(p.id, 'open', 180),
      task(p.id, 'in_progress', 60),
      task(p.id, 'blocked', 30),
      task(p.id, 'cancelled', 999),
    ]
    expect(remainingMinutes(p, tasks)).toBe(270)
  })
  it('falls back to the project estimate without task estimates', () => {
    const p = project('Site', '2026-09-17', 1200)
    expect(remainingMinutes(p, [task(p.id, 'open', null)])).toBe(1200)
  })
  it('is zero when every task is closed (fallback must not resurrect work)', () => {
    const p = project('Site', '2026-09-17', 1200)
    expect(remainingMinutes(p, [task(p.id, 'done', null)])).toBe(0)
  })
})

describe('projectRisks', () => {
  it('flags a cumulative shortfall across competing deadlines (brief §26)', () => {
    // 20h/wk at 100% => capacity to Sep 8 (8 days) = 1371m, to Sep 15 (15 days) = 2571m.
    const a = project('A', '2026-09-08', 720) // 12h
    const b = project('B', '2026-09-15', 1500) // 25h; cumulative 37h > 42.85h? 2220 < 2571 ok
    const c = project('C', '2026-09-15', 900) // +15h => cumulative 52h = 3120 > 2571 SHORTFALL
    const risks = projectRisks([a, b, c], [], TODAY, 20, 100)
    const byId = new Map(risks.map((r) => [r.projectId, r]))
    expect(byId.get(a.id)!.risk).toBe('on_track')
    expect(byId.get(c.id)!.risk).toBe('critical')
    expect(byId.get(c.id)!.shortfallMinutes).toBeGreaterThan(0)
  })

  it('marks at_risk when slack is under 25%', () => {
    // Capacity to Sep 8 = 1371m at 100%; 1100m required -> slack ~20%.
    const p = project('Tight', '2026-09-08', 1100)
    const [r] = projectRisks([p], [], TODAY, 20, 100)
    expect(r.risk).toBe('at_risk')
  })

  it('marks overdue when the deadline passed with work remaining', () => {
    const p = project('Late', '2026-08-25', 300)
    const [r] = projectRisks([p], [], TODAY, 20, 80)
    expect(r.risk).toBe('overdue')
  })

  it('deadline-less projects are on_track and excluded from cumulative pressure', () => {
    const someday = project('Someday', null, 6000)
    const soon = project('Soon', '2026-09-08', 300)
    const risks = projectRisks([someday, soon], [], TODAY, 20, 80)
    expect(risks.find((r) => r.projectId === someday.id)!.risk).toBe('on_track')
    expect(risks.find((r) => r.projectId === soon.id)!.cumulativeRequiredMinutes).toBe(300)
  })

  it('ignores complete/archived projects', () => {
    const p = { ...project('Done', '2026-09-08', 600), status: 'complete' as const }
    expect(projectRisks([p], [], TODAY, 20, 80)).toHaveLength(0)
  })
})

describe('lifeLoad', () => {
  it('is light with little work', () => {
    const p = project('Small', '2026-09-10', 300)
    expect(lifeLoad([p], [], TODAY, 20, 80).load).toBe('light')
  })
  it('is overloaded when required exceeds usable capacity', () => {
    // 4 weeks at 20h × 80% = 3840m usable; 4500m required.
    const p = project('Huge', '2026-09-20', 4500)
    const result = lifeLoad([p], [], TODAY, 20, 80)
    expect(result.load).toBe('overloaded')
    expect(result.pct).toBeGreaterThanOrEqual(110)
  })
  it('includes undated projects in the load (they still consume life)', () => {
    const p = project('Undated', null, 4500)
    expect(lifeLoad([p], [], TODAY, 20, 80).load).toBe('overloaded')
  })
})

describe('formatMinutes', () => {
  it('formats h/m', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(135)).toBe('2h 15m')
  })
})
