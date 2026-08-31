import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveAsset,
  archiveLiability,
  getLifeSettings,
  listAssets,
  listLiabilities,
  listSnapshots,
  recordSnapshot,
  upsertAsset,
  upsertLiability,
} from '../../api/life'
import { listContributions, listGoals } from '../../api/goals'
import { countTransactions, listTransactionsBetween } from '../../api/transactions'
import { useCategories, useHouseholdId } from '../../hooks/queries'
import { achievements, netWorth, resilience } from '../../life/engine'
import { formatZAR, formatZARWhole, parseAmountToCents } from '../../lib/money'
import { addMonths, monthStartOf, todayISO } from '../../lib/dates'
import type { Asset, Liability } from '../../types'

const ASSET_KINDS: Asset['kind'][] = [
  'cash', 'investment', 'retirement', 'vehicle', 'property', 'business', 'other',
]
const LIABILITY_KINDS: Liability['kind'][] = [
  'home_loan', 'vehicle_finance', 'credit_card', 'personal_loan', 'store_account', 'other',
]

export default function NetWorthView() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['life'] })
  const { data: householdId } = useHouseholdId()
  const month = monthStartOf(todayISO())

  const { data: assets } = useQuery({ queryKey: ['life', 'assets'], queryFn: listAssets })
  const { data: liabilities } = useQuery({ queryKey: ['life', 'liabilities'], queryFn: listLiabilities })
  const { data: snapshots } = useQuery({ queryKey: ['life', 'snapshots'], queryFn: listSnapshots })
  const { data: categories } = useCategories()
  const { data: transactions } = useQuery({
    queryKey: ['transactions', 'window', month],
    queryFn: () => listTransactionsBetween(addMonths(month, -3), addMonths(month, 1)),
  })
  const { data: goals } = useQuery({ queryKey: ['goals', 'list'], queryFn: listGoals })
  const { data: contributions } = useQuery({
    queryKey: ['goals', 'contributions'],
    queryFn: listContributions,
  })
  const { data: lifeSettings } = useQuery({
    queryKey: ['life', 'settings', householdId],
    queryFn: () => getLifeSettings(householdId!),
    enabled: Boolean(householdId),
  })

  const nw = netWorth(assets ?? [], liabilities ?? [])
  const hasData = (assets ?? []).length > 0 || (liabilities ?? []).length > 0

  const emergencyGoal = (goals ?? []).find((g) => g.id === lifeSettings?.emergency_goal_id)
  const res =
    categories && transactions
      ? resilience({
          transactions,
          categories,
          currentMonth: month,
          emergencyGoalContributions: (contributions ?? []).filter(
            (c) => c.goal_id === lifeSettings?.emergency_goal_id
          ),
          liabilities: liabilities ?? [],
        })
      : null

  const snap = useMutation({
    mutationFn: () =>
      recordSnapshot({
        household_id: householdId!,
        snap_date: todayISO(),
        assets_cents: nw.assetsCents,
        liabilities_cents: nw.liabilitiesCents,
      }),
    onSuccess: invalidate,
  })

  return (
    <div className="space-y-4">
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
      <div className="rounded-2xl bg-ink-soft p-4 text-center space-y-1">
        <p className="text-xs uppercase tracking-widest text-white/40">Net worth</p>
        <p className={`text-3xl font-extrabold tabular-nums ${nw.netCents < 0 ? 'text-alert' : ''}`}>
          {hasData ? formatZARWhole(nw.netCents) : '—'}
        </p>
        {hasData && (
          <p className="text-xs text-white/40">
            {formatZARWhole(nw.assetsCents)} assets − {formatZARWhole(nw.liabilitiesCents)} debt
          </p>
        )}
        {hasData && (
          <button
            onClick={() => snap.mutate()}
            disabled={snap.isPending}
            className="text-xs bg-white/10 rounded-lg px-3 py-1.5 font-bold mt-1"
          >
            📌 Record snapshot
          </button>
        )}
      </div>

      {res && (
        <div className="rounded-2xl bg-ink-soft p-4 space-y-2">
          <p className="text-xs uppercase tracking-widest text-white/40">Resilience</p>
          <ResilienceRow
            label="Emergency cover"
            value={
              res.emergencyMonths !== null
                ? `${res.emergencyMonths} months of essentials`
                : emergencyGoal
                  ? 'needs 1+ complete month of data'
                  : 'pick an emergency goal in Settings'
            }
            good={res.emergencyMonths !== null && res.emergencyMonths >= 3}
          />
          <ResilienceRow
            label="Income dependency"
            value={
              res.incomeDependencyPct !== null
                ? `${res.incomeDependencyPct}% from one person`
                : 'no income history yet'
            }
            good={res.incomeDependencyPct !== null && res.incomeDependencyPct <= 60}
          />
          <ResilienceRow
            label="Debt load"
            value={res.debtLoadPct !== null ? `${res.debtLoadPct}% of income` : 'no data yet'}
            good={res.debtLoadPct !== null && res.debtLoadPct <= 30}
          />
          <ResilienceRow
            label="Monthly flexibility"
            value={
              res.monthlyFlexibilityCents !== null
                ? `${formatZARWhole(res.monthlyFlexibilityCents)} after essentials`
                : 'no data yet'
            }
            good={res.monthlyFlexibilityCents !== null && res.monthlyFlexibilityCents > 0}
          />
          <p className="text-xs text-white/30">
            Based on complete-month averages. Essentials = categories marked ⭐ in Settings.
          </p>
        </div>
      )}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
      <ItemsSection
        title="Assets"
        items={(assets ?? []).filter((a) => !a.archived)}
        kinds={ASSET_KINDS}
        householdId={householdId}
        onSave={(input) => upsertAsset(input as Parameters<typeof upsertAsset>[0]).then(invalidate)}
        onArchive={(id) => archiveAsset(id).then(invalidate)}
        valueKey="current_value_cents"
      />
      <ItemsSection
        title="Liabilities"
        items={(liabilities ?? []).filter((l) => !l.archived)}
        kinds={LIABILITY_KINDS}
        householdId={householdId}
        onSave={(input) =>
          upsertLiability({
            ...(input as Parameters<typeof upsertLiability>[0]),
            balance_cents: (input as { current_value_cents: number }).current_value_cents,
            monthly_payment_cents: null,
          }).then(invalidate)
        }
        onArchive={(id) => archiveLiability(id).then(invalidate)}
        valueKey="balance_cents"
      />
      </div>

      <AchievementsSection
        contributions={contributions ?? []}
        completedGoalCount={(goals ?? []).filter((g) => g.status === 'complete').length}
        netCents={hasData ? nw.netCents : null}
        hasNetWorthData={hasData}
        emergencyMonths={res?.emergencyMonths ?? null}
      />

      {(snapshots ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-white/50">History</h2>
          <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
            {(snapshots ?? []).map((s) => (
              <div key={s.id} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-white/50">{s.snap_date}</span>
                <span className="font-bold tabular-nums">
                  {formatZARWhole(s.assets_cents - s.liabilities_cents)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AchievementsSection({
  contributions,
  completedGoalCount,
  netCents,
  hasNetWorthData,
  emergencyMonths,
}: {
  contributions: Parameters<typeof achievements>[0]['contributions']
  completedGoalCount: number
  netCents: number | null
  hasNetWorthData: boolean
  emergencyMonths: number | null
}) {
  const { data: txnCount } = useQuery({
    queryKey: ['transactions', 'count'],
    queryFn: countTransactions,
  })

  const list = achievements({
    // Only the count matters for these rules; fake the array length.
    transactions: Array.from({ length: txnCount ?? 0 }) as never[],
    contributions,
    completedGoalCount,
    netCents,
    hasNetWorthData,
    emergencyMonths,
  })

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Milestones</h2>
      <div className="rounded-2xl bg-ink-soft p-4 flex flex-wrap gap-1.5">
        {list.map((a) => (
          <span
            key={a.id}
            className={`rounded-full px-2.5 py-1 text-xs ${
              a.earned ? 'bg-rung/20 text-rung font-bold' : 'bg-white/5 text-white/25'
            }`}
          >
            {a.earned ? '🏅 ' : '○ '}
            {a.title}
          </span>
        ))}
      </div>
    </section>
  )
}

function ResilienceRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className={good ? 'text-rung' : 'text-white/60'}>
        {good ? '🟢 ' : ''}
        {value}
      </span>
    </div>
  )
}

interface Item {
  id: string
  name: string
  kind: string
}

function ItemsSection<T extends Item>({
  title,
  items,
  kinds,
  householdId,
  onSave,
  onArchive,
  valueKey,
}: {
  title: string
  items: T[]
  kinds: string[]
  householdId: string | undefined
  onSave: (input: Record<string, unknown>) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  valueKey: string
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState(kinds[0])
  const [value, setValue] = useState('')

  const add = async () => {
    const cents = parseAmountToCents(value)
    if (!name.trim() || cents === null || !householdId) return
    await onSave({
      household_id: householdId,
      name: name.trim(),
      kind,
      current_value_cents: cents,
    })
    setName('')
    setValue('')
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">{title}</h2>
      <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>
              {item.name}{' '}
              <span className="text-white/30 text-xs">({item.kind.replace('_', ' ')})</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-bold tabular-nums">
                {formatZAR((item as Record<string, never>)[valueKey])}
              </span>
              <button onClick={() => onArchive(item.id)} className="text-xs text-white/30">
                remove
              </button>
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-4 py-3 text-white/40 text-sm">None recorded yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 outline-none text-sm" />
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="rounded-xl bg-white/10 px-2 py-2.5 outline-none text-sm max-w-28">
          {kinds.map((k) => (
            <option key={k} value={k} className="text-ink">{k.replace('_', ' ')}</option>
          ))}
        </select>
        <input inputMode="decimal" placeholder="R" value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-xl bg-white/10 px-2 py-2.5 outline-none text-sm" />
        <button onClick={add} className="rounded-xl bg-rung text-ink font-bold px-3 text-sm">
          Add
        </button>
      </div>
    </section>
  )
}
