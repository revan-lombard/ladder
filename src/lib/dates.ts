/**
 * Date-only values travel as 'YYYY-MM-DD' strings end-to-end. String math
 * only — `new Date('2026-08-31')` parses as UTC midnight and shifts a day
 * in some renderings. Months are represented by their first day.
 */

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** '2026-08-31' -> '2026-08-01' */
export function monthStartOf(dateISO: string): string {
  return dateISO.slice(0, 7) + '-01'
}

/** '2026-08-01' + 1 -> '2026-09-01'; handles year wrap and negatives. */
export function addMonths(monthISO: string, n: number): string {
  const year = Number(monthISO.slice(0, 4))
  const month = Number(monthISO.slice(5, 7)) - 1 + n
  const y = year + Math.floor(month / 12)
  const m = ((month % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, '0')}-01`
}

/** '2026-08-01' -> 'August 2026' */
export function monthLabel(monthISO: string): string {
  const y = Number(monthISO.slice(0, 4))
  const m = Number(monthISO.slice(5, 7))
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  })
}

/** '2026-08-31' -> 'Sun 31 Aug' for transaction day headers. */
export function dayLabel(dateISO: string): string {
  const y = Number(dateISO.slice(0, 4))
  const m = Number(dateISO.slice(5, 7))
  const d = Number(dateISO.slice(8, 10))
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
