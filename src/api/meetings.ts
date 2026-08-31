import { supabase } from '../lib/supabase'
import type { Agenda, Meeting, Task } from '../types'

export async function listMeetings(limit = 12): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Meeting[]
}

export async function createMeeting(input: {
  household_id: string
  kind: 'weekly' | 'monthly'
  meeting_date: string
  agenda: Agenda
}): Promise<Meeting> {
  const { data, error } = await supabase.from('meetings').insert(input).select().single()
  if (error) throw error
  return data as Meeting
}

export async function completeMeeting(id: string, notes: string | null): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .update({ completed_at: new Date().toISOString(), notes })
    .eq('id', id)
  if (error) throw error
}

export async function listOpenTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('priority')
    .order('created_at')
  if (error) throw error
  return data as Task[]
}

export async function createTask(input: {
  household_id: string
  meeting_id: string | null
  title: string
  priority: number
}): Promise<void> {
  const { error } = await supabase.from('tasks').insert(input)
  if (error) throw error
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      status: done ? 'done' : 'open',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}
