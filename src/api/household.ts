import { supabase } from '../lib/supabase'

export async function getHouseholdId(): Promise<string> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)
  if (error) throw error
  const id = data?.[0]?.household_id
  if (!id) throw new Error('You are not a member of a household yet — run the seed script.')
  return id as string
}
