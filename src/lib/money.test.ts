import { describe, expect, it } from 'vitest'
import { formatZAR, parseAmountToCents } from './money'

describe('parseAmountToCents', () => {
  it('parses plain rands', () => {
    expect(parseAmountToCents('1234')).toBe(123400)
  })
  it('parses comma decimals (en-ZA habit)', () => {
    expect(parseAmountToCents('1234,56')).toBe(123456)
  })
  it('parses dot decimals', () => {
    expect(parseAmountToCents('1234.56')).toBe(123456)
  })
  it('parses spaces-as-thousands with comma decimal', () => {
    expect(parseAmountToCents('1 234,56')).toBe(123456)
  })
  it('parses mixed thousands and decimal separators', () => {
    expect(parseAmountToCents('1,234.56')).toBe(123456)
    expect(parseAmountToCents('1.234,56')).toBe(123456)
  })
  it('strips a leading R', () => {
    expect(parseAmountToCents('R2 000')).toBe(200000)
  })
  it('handles one decimal digit', () => {
    expect(parseAmountToCents('9,5')).toBe(950)
  })
  it('treats a 3-digit group after a separator as thousands', () => {
    expect(parseAmountToCents('1,234')).toBe(123400)
  })
  it('avoids float rounding traps', () => {
    expect(parseAmountToCents('0.29')).toBe(29)
    expect(parseAmountToCents('1.15')).toBe(115)
  })
  it('rejects junk', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('12,3,4')).toBeNull()
    expect(parseAmountToCents('-50')).toBeNull()
  })
})

describe('formatZAR', () => {
  it('formats cents in SA convention (space thousands, comma decimal)', () => {
    expect(formatZAR(123456)).toBe('R 1 234,56')
    expect(formatZAR(5)).toBe('R 0,05')
    expect(formatZAR(123456789)).toBe('R 1 234 567,89')
    expect(formatZAR(-9950)).toBe('-R 99,50')
  })
})