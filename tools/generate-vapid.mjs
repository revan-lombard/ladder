/**
 * Generate a VAPID key pair for web push. Run once:
 *
 *   node tools/generate-vapid.mjs
 *
 * Writes .env.vapid.local (gitignored via .env.*) containing:
 *   - VITE_VAPID_PUBLIC_KEY  → .env.local + the deploy workflow (public by design)
 *   - VAPID_KEYS             → Supabase Edge Function secret (KEEP PRIVATE)
 *
 * Only the public key is printed; the private key never touches stdout.
 */
import { webcrypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
)
const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey)

// applicationServerKey wants the raw uncompressed EC point: 0x04 || x || y.
const rawPublic = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]).toString('base64url')

const lines = [
  `VITE_VAPID_PUBLIC_KEY=${rawPublic}`,
  `VAPID_KEYS=${JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk })}`,
  '',
]
writeFileSync(new URL('../.env.vapid.local', import.meta.url), lines.join('\n'))

console.log('Public key (safe to commit):')
console.log(`  VITE_VAPID_PUBLIC_KEY=${rawPublic}`)
console.log('\nPrivate pair written to .env.vapid.local — set its VAPID_KEYS value')
console.log('as a secret on the send-reminders Edge Function. Never commit it.')
