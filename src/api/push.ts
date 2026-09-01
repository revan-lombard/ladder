import { supabase } from '../lib/supabase'
import type { PushSubscriptionRow } from '../types'

/** Persist this device's push subscription (idempotent per endpoint). */
export async function savePushSubscription(input: {
  household_id: string
  endpoint: string
  p256dh: string
  auth: string
  device_label: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(input, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

/** This user's registered devices (RLS: owner-only). */
export async function listPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .order('created_at')
  if (error) throw error
  return data as PushSubscriptionRow[]
}

/** Ask the Edge Function to ping only the caller's devices. */
export async function sendTestNotification(): Promise<{ sent: number; of: number }> {
  const { data, error } = await supabase.functions.invoke('send-reminders', {
    body: { test: true },
  })
  if (error) throw error
  return data as { sent: number; of: number }
}
