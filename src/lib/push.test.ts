import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './push'

const toBase64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('urlBase64ToUint8Array', () => {
  it('decodes plain base64url', () => {
    // 'hello' → aGVsbG8
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111])
  })

  it('handles url-safe characters and missing padding', () => {
    const bytes = new Uint8Array([251, 239, 190, 63, 62])
    const b64url = toBase64url(bytes)
    expect(b64url).toMatch(/[-_]/) // exercise the -/_ replacement path
    expect(Array.from(urlBase64ToUint8Array(b64url))).toEqual(Array.from(bytes))
  })

  it('round-trips a realistic 65-byte VAPID public key', () => {
    const key = new Uint8Array(65).map((_, i) => (i * 37) % 256)
    expect(Array.from(urlBase64ToUint8Array(toBase64url(key)))).toEqual(Array.from(key))
  })
})
