import { describe, expect, it } from 'vitest'
import { addMonths, monthStartOf, todayISO } from './dates'

describe('dates', () => {
  it('todayISO is YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('monthStartOf', () => {
    expect(monthStartOf('2026-08-31')).toBe('2026-08-01')
  })
  it('addMonths forward and across year end', () => {
    expect(addMonths('2026-08-01', 1)).toBe('2026-09-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-08-01', 17)).toBe('2028-01-01')
  })
  it('addMonths backward across year start', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-08-01', -20)).toBe('2024-12-01')
  })
})
