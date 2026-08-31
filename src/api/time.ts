import { supabase } from '../lib/supabase'
import type { CalendarEvent, Project, Task, TaskStatus, TimeSettings } from '../types'

/* ------------------------------------------------------------- projects */

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .neq('status', 'archived')
    .order('deadline', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Project[]
}

export async function createProject(input: {
  household_id: string
  name: string
  deadline: string | null
  estimated_minutes: number
  goal_id?: string | null
}): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(input).select().single()
  if (error) throw error
  return data as Project
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'deadline' | 'estimated_minutes' | 'priority' | 'goal_id' | 'notes' | 'status'>>
): Promise<void> {
  const { error } = await supabase.from('projects').update(patch).eq('id', id)
  if (error) throw error
}

/* --------------------------------------------------------------- events */

export async function listEvents(fromDate: string, toDate: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', fromDate)
    .lte('event_date', toDate)
    .order('event_date')
    .order('start_time', { nullsFirst: true })
  if (error) throw error
  return data as CalendarEvent[]
}

export async function createEvent(input: {
  household_id: string
  title: string
  category: CalendarEvent['category']
  event_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  visibility: CalendarEvent['visibility']
  project_id?: string | null
}): Promise<void> {
  const { error } = await supabase.from('events').insert(input)
  if (error) throw error
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- tasks */

export async function listAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .not('status', 'in', '("cancelled")')
    .order('priority')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Task[]
}

export async function createProjectTask(input: {
  household_id: string
  project_id: string
  title: string
  estimated_minutes: number | null
  priority?: number
  due_date?: string | null
}): Promise<void> {
  const { error } = await supabase.from('tasks').insert(input)
  if (error) throw error
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

/* -------------------------------------------------------- time settings */

export async function getTimeSettings(householdId: string): Promise<TimeSettings> {
  const { data, error } = await supabase
    .from('time_settings')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle()
  if (error) throw error
  // Defaults until the household saves its own numbers.
  return (
    (data as TimeSettings | null) ?? {
      household_id: householdId,
      weekly_flexible_hours: 20,
      utilization_pct: 80,
    }
  )
}

export async function saveTimeSettings(settings: TimeSettings): Promise<void> {
  const { error } = await supabase
    .from('time_settings')
    .upsert(settings, { onConflict: 'household_id' })
  if (error) throw error
}
