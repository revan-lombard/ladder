import { supabase } from '../lib/supabase'
import { addMonths } from '../lib/dates'
import type { Transaction, TransactionInput } from '../types'

/** All of a month's transactions, newest first. monthISO = 'YYYY-MM-01'. */
export async function listTransactionsForMonth(monthISO: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('txn_date', monthISO)
    .lt('txn_date', addMonths(monthISO, 1))
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Transaction[]
}

/** Transactions from fromMonth (inclusive) to toMonthExclusive. */
export async function listTransactionsBetween(
  fromMonth: string,
  toMonthExclusive: string
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('txn_date', fromMonth)
    .lt('txn_date', toMonthExclusive)
    .order('txn_date', { ascending: false })
  if (error) throw error
  return data as Transaction[]
}

export async function countTransactions(): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Transaction
}

export async function updateTransaction(
  id: string,
  patch: Partial<TransactionInput>
): Promise<void> {
  const { error } = await supabase.from('transactions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
