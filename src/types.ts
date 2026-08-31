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

export interface Task {
  id: string
  household_id: string
  owner_id: string
  visibility: Visibility
  meeting_id: string | null
  title: string
  priority: number
  due_date: string | null
  status: 'open' | 'done'
  completed_at: string | null
  created_at: string
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
