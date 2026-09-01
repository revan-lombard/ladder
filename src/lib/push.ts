/**
 * Web push helpers. Push only works over HTTPS (or localhost) with the
 * service worker registered — and on iOS only once the PWA is installed to
 * the home screen (iOS 16.4+).
 */

const PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/** Decode a base64url string into the byte array pushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type PushSupport = 'ok' | 'needs-install' | 'unsupported'

/** Can this browser do push right now — and if not, is installing the fix? */
export function pushSupport(): PushSupport {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  if (isIOS && !installed) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return PUBLIC_KEY ? 'ok' : 'unsupported'
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('Service worker not registered — production build only.')
  return reg
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Ask permission and subscribe this device. Throws with a readable message. */
export async function subscribeToPush(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const reg = await registration()
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
  })
}

/** Unsubscribe this device; returns the endpoint that was removed. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getCurrentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}
