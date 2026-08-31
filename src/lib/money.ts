/**
 * All money is integer CENTS everywhere in the app. These are the only two
 * places rands and cents convert. Never `parseFloat(x) * 100` — 0.29 * 100
 * is 28.999999999999996.
 *
 * Formatting is hand-rolled rather than Intl: en-ZA output differs between
 * ICU versions (Node CI renders "R 1,234.56", browsers "R 1 234,56"), and
 * money display must be identical on every device.
 */

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** 123456 -> 'R 1 234,56' (SA convention: space thousands, comma decimal). */
export function formatZAR(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100).toString()
  const frac = (abs % 100).toString().padStart(2, '0')
  return `${sign}R ${group(whole)},${frac}`
}

/** Compact form without cents for dashboard tiles: 'R 12 345'. */
export function formatZARWhole(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const whole = Math.round(Math.abs(cents) / 100).toString()
  return `${sign}R ${group(whole)}`
}

/**
 * Parse user input ("1 234,56", "R1234.56", "1,234.56") to integer cents.
 * en-ZA users type comma decimals; imports may use dots. Rule: the LAST
 * separator followed by 1–2 digits is the decimal point; any remaining
 * separators must delimit exact 3-digit thousands groups. Returns null
 * when invalid.
 */
export function parseAmountToCents(input: string): number | null {
  const s = input.trim().replace(/^R/i, '').replace(/[\s  ']/g, '')
  if (!s) return null

  const sep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'))
  const fracLen = sep >= 0 ? s.length - sep - 1 : 0

  let wholeRaw: string
  let frac = ''
  if (sep >= 0 && fracLen >= 1 && fracLen <= 2) {
    wholeRaw = s.slice(0, sep)
    frac = s.slice(sep + 1)
  } else {
    wholeRaw = s
  }

  // Whole part: plain digits, or valid 3-digit thousands groups.
  if (!/^\d+$/.test(wholeRaw) && !/^\d{1,3}([.,]\d{3})+$/.test(wholeRaw)) return null
  if (frac && !/^\d{1,2}$/.test(frac)) return null

  const whole = wholeRaw.replace(/[.,]/g, '')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0') || 0)
  return Number.isSafeInteger(cents) ? cents : null
}
