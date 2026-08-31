// The insights engine is PURE: no supabase, no react. Pages hand it plain
// arrays; it returns findings. Every insight MUST carry its `why` numbers —
// the UI renders them, so a rule cannot ship without evidence (brief §55).

import type { Budget, Category, Goal, GoalContribution, Transaction } from '../types'

export type Severity = 'win' | 'info' | 'watch' | 'alert'

export interface WhyLine {
  label: string
  /** Cents when the evidence is money; plain string otherwise. */
  valueCents?: number
  value?: string
}

export interface Insight {
  id: string
  rule: string
  severity: Severity
  title: string
  body: string
  why: WhyLine[]
}

export interface InsightInputs {
  /** Current month, 'YYYY-MM-01'. */
  month: string
  categories: Category[]
  /** Transactions covering month-3 .. month inclusive. */
  transactions: Transaction[]
  /** Current month's budgets. */
  budgets: Budget[]
  goals: Goal[]
  contributions: GoalContribution[]
}
