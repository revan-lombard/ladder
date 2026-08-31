import { supabase } from '../lib/supabase'
import type { Account } from '../types'

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('archived')
    .order('name')
  if (error) throw error
  return data as Account[]
}

export async function createAccount(input: {
  household_id: string
  name: string
  kind: Account['kind']
}): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Account
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('accounts').update({ archived }).eq('id', id)
  if (error) throw error
}
