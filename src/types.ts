// Domain row shapes, mirroring supabase/migrations/001_schema.sql.
// (Generated Database types can replace these later; hand-kept for now.)

export type Visibility = 'private' | 'shared'
export type TxnKind = 'expense' | 'income'

export interface Account {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  name: string
  kind: 'cheque' | 'savings' | 'credit_card' | 'cash' | 'other'
  archived: boolean
  created_at: string
}

export interface Category {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  parent_id: string | null
  name: string
  kind: TxnKind
  pillar: string
  sort_order: number
  archived: boolean
  created_at: string
}

export interface Transaction {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  account_id: string
  category_id: string | null
  kind: TxnKind
  txn_date: string
  description: string
  amount_cents: number
  person_id: string | null
  notes: string | null
  created_at: string
}

export interface Budget {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  category_id: string
  month: string
  amount_cents: number
  created_at: string
}

export type GoalStatus = 'active' | 'complete' | 'archived'

export interface Goal {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  name: string
  target_amount_cents: number
  target_date: string | null
  ladder_position: number
  status: GoalStatus
  pillar: string
  notes: string | null
  created_at: string
}

export interface GoalContribution {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  goal_id: string
  contrib_date: string
  amount_cents: number
  note: string | null
  created_at: string
}

export interface GoalDependency {
  goal_id: string
  depends_on_goal_id: string
  household_id: string
}

export interface Meeting {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  kind: 'weekly' | 'monthly'
  meeting_date: string
  agenda: Agenda
  notes: string | null
  completed_at: string | null
  created_at: string
}

export interface Agenda {
  sections: { title: string; lines: string[] }[]
}

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled'

export interface Task {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  meeting_id: string | null
  title: string
  description: string | null
  priority: number
  due_date: string | null
  status: TaskStatus
  estimated_minutes: number | null
  actual_minutes: number | null
  project_id: string | null
  goal_id: string | null
  energy: 'low' | 'medium' | 'high' | null
  completed_at: string | null
  created_at: string
}

export type ProjectStatus = 'active' | 'complete' | 'archived'

export interface Project {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  name: string
  deadline: string | null
  estimated_minutes: number
  priority: number
  goal_id: string | null
  notes: string | null
  status: ProjectStatus
  created_at: string
}

export type EventCategory =
  | 'work'
  | 'personal'
  | 'relationship'
  | 'family'
  | 'health'
  | 'career'
  | 'business'
  | 'travel'
  | 'protected'

export interface CalendarEvent {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  title: string
  category: EventCategory
  event_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  project_id: string | null
  goal_id: string | null
  notes: string | null
  created_at: string
}

export interface TimeSettings {
  household_id: string
  weekly_flexible_hours: number
  utilization_pct: number
}

export interface TransactionInput {
  household_id: string
  account_id: string
  category_id: string | null
  kind: TxnKind
  txn_date: string
  description: string
  amount_cents: number
  person_id: string | null
  visibility: Visibility
  notes?: string | null
}
