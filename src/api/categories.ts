import { supabase } from '../lib/supabase'
import type { Category } from '../types'

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(input: {
  household_id: string
  parent_id: string | null
  name: string
  kind: Category['kind']
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('categories').update({ archived }).eq('id', id)
  if (error) throw error
}
