import { describe, expect, it } from 'vitest'
import { overspend } from './rules/overspend'
import { aboveAverage } from './rules/aboveAverage'
import { surplusTrend } from './rules/surplusTrend'
import { goalOffTrack } from './rules/goalOffTrack'
import { runInsights } from './engine'
import { budget, cat, contrib, goal, inputs, txn } from './fixtures'

const M = '2026-08-01'

describe('overspend', () => {
  const groceries = cat('Groceries')

  it('fires when actual exceeds budget, with the evidence', () => {
    const result = overspend(
      inputs({
        categories: [groceries],
        budgets: [budget(M, groceries.id, 100_000)],
        transactions: [txn('2026-08-10', 40_000, groceries.id), txn('2026-08-20', 70_000, groceries.id)],
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('alert')
    expect(result[0].why.find((w) => w.label === 'Over by')?.valueCents).toBe(10_000)
  })

  it('does NOT fire exactly on budget (boundary)', () => {
    const result = overspend(
      inputs({
        categories: [groceries],
        budgets: [budget(M, groceries.id, 100_000)],
        transactions: [txn('2026-08-10', 100_000, groceries.id)],
      })
    )
    expect(result).toHaveLength(0)
  })

  it('ignores income and other months', () => {
    const result = overspend(
      inputs({
        categories: [groceries],
        budgets: [budget(M, groceries.id, 100_000)],
        transactions: [
          txn('2026-07-10', 999_999, groceries.id), // previous month
          txn('2026-08-10', 999_999, groceries.id, 'income'), // income
        ],
      })
    )
    expect(result).toHaveLength(0)
  })
})

describe('aboveAverage', () => {
  const rest = cat('Restaurants')
  const history = [
    txn('2026-05-10', 100_000, rest.id),
    txn('2026-06-10', 100_000, rest.id),
    txn('2026-07-10', 100_000, rest.id),
  ]

  it('fires at 31% above a full 3-month average', () => {
    const result = aboveAverage(
      inputs({ categories: [rest], transactions: [...history, txn('2026-08-10', 131_000, rest.id)] })
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('watch')
    expect(result[0].title).toContain('31%')
  })

  it('does not fire at 24% (below threshold)', () => {
    const result = aboveAverage(
      inputs({ categories: [rest], transactions: [...history, txn('2026-08-10', 124_000, rest.id)] })
    )
    expect(result).toHaveLength(0)
  })

  it('stays silent with only 2 months of history (must not fake an average)', () => {
    const result = aboveAverage(
      inputs({
        categories: [rest],
        transactions: [
          txn('2026-06-10', 100_000, rest.id),
          txn('2026-07-10', 100_000, rest.id),
          txn('2026-08-10', 200_000, rest.id),
        ],
      })
    )
    expect(result).toHaveLength(0)
  })

  it('ignores small absolute differences even at high percentages', () => {
    const small = [
      txn('2026-05-10', 10_000, rest.id),
      txn('2026-06-10', 10_000, rest.id),
      txn('2026-07-10', 10_000, rest.id),
      txn('2026-08-10', 15_000, rest.id), // +50% but only R50
    ]
    expect(aboveAverage(inputs({ categories: [rest], transactions: small }))).toHaveLength(0)
  })
})

describe('surplusTrend', () => {
  const salary = cat('Salary', 'income')
  const spend = cat('Stuff')
  const month = (m: string, incomeC: number, expenseC: number) => [
    txn(`${m.slice(0, 8)}01`, incomeC, salary.id, 'income'),
    txn(`${m.slice(0, 8)}15`, expenseC, spend.id),
  ]

  it('flags a strict 3-month decline (excluding the in-progress month)', () => {
    const result = surplusTrend(
      inputs({
        transactions: [
          ...month('2026-05-01', 300_000, 100_000), // surplus 2000
          ...month('2026-06-01', 300_000, 150_000), // surplus 1500
          ...month('2026-07-01', 300_000, 200_000), // surplus 1000
        ],
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('watch')
  })

  it('alerts when last month was negative', () => {
    const result = surplusTrend(
      inputs({
        transactions: [
          ...month('2026-05-01', 300_000, 100_000),
          ...month('2026-06-01', 300_000, 150_000),
          ...month('2026-07-01', 300_000, 350_000), // negative
        ],
      })
    )
    expect(result[0].severity).toBe('alert')
  })

  it('celebrates a strict rise', () => {
    const result = surplusTrend(
      inputs({
        transactions: [
          ...month('2026-05-01', 300_000, 200_000),
          ...month('2026-06-01', 300_000, 150_000),
          ...month('2026-07-01', 300_000, 100_000),
        ],
      })
    )
    expect(result[0].severity).toBe('win')
  })

  it('stays silent without 3 complete months', () => {
    const result = surplusTrend(
      inputs({ transactions: [...month('2026-06-01', 300_000, 150_000), ...month('2026-07-01', 300_000, 200_000)] })
    )
    expect(result).toHaveLength(0)
  })
})

describe('goalOffTrack', () => {
  it('fires when required pace exceeds recent pace by >10%', () => {
    const g = goal('House deposit', 1_200_000, '2026-12-01') // 4 months from Aug
    // Remaining 1,200,000 - 300,000 = 900,000 over 4 months = 225,000/mo required.
    // Recent pace: 100,000/mo average.
    const result = goalOffTrack(
      inputs({
        goals: [g],
        contributions: [
          contrib(g.id, '2026-05-15', 100_000),
          contrib(g.id, '2026-06-15', 100_000),
          contrib(g.id, '2026-07-15', 100_000),
        ],
      })
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('watch')
    expect(result[0].why.find((w) => w.label === 'Required per month')?.valueCents).toBe(225_000)
  })

  it('does not fire when the pace is sufficient', () => {
    const g = goal('Holiday', 400_000, '2026-12-01')
    const result = goalOffTrack(
      inputs({
        goals: [g],
        contributions: [
          contrib(g.id, '2026-05-15', 100_000),
          contrib(g.id, '2026-06-15', 100_000),
          contrib(g.id, '2026-07-15', 100_000),
        ],
      })
    )
    // Remaining 100,000 over 4 months = 25,000/mo vs pace 100,000/mo.
    expect(result).toHaveLength(0)
  })

  it('alerts when the target date has passed with money outstanding', () => {
    const g = goal('Wedding', 500_000, '2026-08-01')
    const result = goalOffTrack(inputs({ goals: [g], contributions: [] }))
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('alert')
  })

  it('ignores complete, archived and dateless goals', () => {
    const done = goal('Done', 100_000, '2026-12-01', 'complete')
    const dateless = goal('Someday', 100_000, null)
    expect(goalOffTrack(inputs({ goals: [done, dateless] }))).toHaveLength(0)
  })
})

describe('runInsights ordering', () => {
  it('sorts alerts before watches before wins', () => {
    const groceries = cat('Groceries')
    const g = goal('Wedding', 500_000, '2026-08-01') // overdue -> alert
    const result = runInsights(
      inputs({
        categories: [groceries],
        budgets: [budget(M, groceries.id, 10_000)],
        transactions: [txn('2026-08-10', 20_000, groceries.id)],
        goals: [g],
      })
    )
    expect(result.length).toBeGreaterThanOrEqual(2)
    const severities = result.map((i) => i.severity)
    expect([...severities].sort((a, b) => severities.indexOf(a) - severities.indexOf(b))).toEqual(severities)
  })
})
