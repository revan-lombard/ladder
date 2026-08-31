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
