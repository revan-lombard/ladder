import { overspend } from './rules/overspend'
import { aboveAverage } from './rules/aboveAverage'
import { surplusTrend } from './rules/surplusTrend'
import { goalOffTrack } from './rules/goalOffTrack'
import type { Insight, InsightInputs, Severity } from './types'

const ORDER: Record<Severity, number> = { alert: 0, watch: 1, win: 2, info: 3 }

export function runInsights(inputs: InsightInputs): Insight[] {
  return [
    ...overspend(inputs),
    ...aboveAverage(inputs),
    ...surplusTrend(inputs),
    ...goalOffTrack(inputs),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}

/** Worst severity → pillar status chip. */
export function pillarStatus(insights: Insight[]): { emoji: string; label: string } {
  if (insights.some((i) => i.severity === 'alert')) return { emoji: '🔴', label: 'Problem' }
  if (insights.some((i) => i.severity === 'watch')) return { emoji: '🟡', label: 'Watch' }
  return { emoji: '🟢', label: 'Healthy' }
}
