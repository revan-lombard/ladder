import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { getTimeSettings, saveTimeSettings } from '../api/time'
import {
  getLifeSettings,
  listValues,
  saveLifeSettings,
  saveValues,
  setCategoryEssential,
} from '../api/life'
import { listGoals } from '../api/goals'
import {
  useAccounts,
  useCategories,
  useCreateAccount,
  useCreateCategory,
  useHouseholdId,
  useSetAccountArchived,
  useSetCategoryArchived,
} from '../hooks/queries'
import type { Account } from '../types'

const ACCOUNT_KINDS: Account['kind'][] = ['cheque', 'savings', 'credit_card', 'cash', 'other']

export default function Settings() {
  const { session, signOut } = useAuth()

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold pt-2">Settings</h1>

      <section className="rounded-2xl bg-ink-soft p-4 space-y-1">
        <p className="text-white/40 text-xs uppercase tracking-widest">Signed in as</p>
        <p>{session?.user.email}</p>
      </section>

      <AccountsSection />
      <CategoriesSection />
      <CapacitySection />
      <ResilienceSection />
      <ValuesSection />

      <button onClick={signOut} className="w-full rounded-xl bg-white/10 py-3 font-bold">
        Sign out
      </button>
    </div>
  )
}

function ResilienceSection() {
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const { data: settings } = useQuery({
    queryKey: ['life', 'settings', householdId],
    queryFn: () => getLifeSettings(householdId!),
    enabled: Boolean(householdId),
  })
  const { data: goals } = useQuery({ queryKey: ['goals', 'list'], queryFn: listGoals })
  const { data: categories } = useCategories()

  if (!householdId || !settings) return null

  const parents = (categories ?? []).filter(
    (c) => !c.parent_id && !c.archived && c.kind === 'expense'
  )

  const pickGoal = async (goalId: string) => {
    await saveLifeSettings({ household_id: householdId, emergency_goal_id: goalId || null })
    qc.invalidateQueries({ queryKey: ['life'] })
  }

  const toggleEssential = async (id: string, essential: boolean) => {
    await setCategoryEssential(id, essential)
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Resilience</h2>
      <div className="rounded-2xl bg-ink-soft p-4 space-y-3">
        <label className="block text-sm">
          Emergency fund goal (its contributions = your cushion)
          <select
            value={settings.emergency_goal_id ?? ''}
            onChange={(e) => pickGoal(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2.5 outline-none text-white"
          >
            <option value="" className="text-ink">Not set</option>
            {(goals ?? [])
              .filter((g) => g.status !== 'archived')
              .map((g) => (
                <option key={g.id} value={g.id} className="text-ink">{g.name}</option>
              ))}
          </select>
        </label>
        <div className="text-sm space-y-1.5">
          <p>Essential spending groups (can't be cut in a crisis):</p>
          <div className="flex flex-wrap gap-1.5">
            {parents.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleEssential(p.id, !p.is_essential)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  p.is_essential ? 'bg-rung text-ink font-bold' : 'bg-white/10'
                }`}
              >
                {p.is_essential ? '⭐ ' : ''}{p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ValuesSection() {
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const { data: values } = useQuery({ queryKey: ['life', 'values'], queryFn: listValues })
  const [draft, setDraft] = useState<string | null>(null)

  if (!householdId) return null
  const shown = draft ?? (values ?? []).map((v) => v.name).join('\n')

  const save = async () => {
    if (draft === null) return
    const names = draft.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10)
    await saveValues(householdId, names)
    qc.invalidateQueries({ queryKey: ['life', 'values'] })
    setDraft(null)
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Our values</h2>
      <div className="rounded-2xl bg-ink-soft p-4 space-y-2">
        <p className="text-xs text-white/40">
          Ranked, most important first — one per line (e.g. Family, Financial
          security, Health…). Decisions and reviews check against these.
        </p>
        <textarea
          rows={5}
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'Family\nFinancial security\nHealth'}
          className="w-full rounded-xl bg-white/10 px-3 py-2.5 outline-none text-sm"
        />
        {draft !== null && (
          <button onClick={save} className="w-full rounded-xl bg-rung text-ink font-bold py-2.5">
            Save values
          </button>
        )}
      </div>
    </section>
  )
}

function CapacitySection() {
  const qc = useQueryClient()
  const { data: householdId } = useHouseholdId()
  const { data: settings } = useQuery({
    queryKey: ['time-settings', householdId],
    queryFn: () => getTimeSettings(householdId!),
    enabled: Boolean(householdId),
  })
  const save = useMutation({
    mutationFn: saveTimeSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-settings'] }),
  })
  const [hours, setHours] = useState<string | null>(null)
  const [util, setUtil] = useState<number | null>(null)

  if (!settings || !householdId) return null
  const shownHours = hours ?? String(settings.weekly_flexible_hours)
  const shownUtil = util ?? settings.utilization_pct

  const commit = () => {
    const h = Number(shownHours.replace(',', '.'))
    if (!Number.isFinite(h) || h < 0) return
    save.mutate({
      household_id: householdId,
      weekly_flexible_hours: h,
      utilization_pct: shownUtil,
    })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Time capacity</h2>
      <div className="rounded-2xl bg-ink-soft p-4 space-y-3">
        <label className="block text-sm">
          Flexible hours per week (after work, sleep, family, gym…)
          <input
            inputMode="decimal"
            value={shownHours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={commit}
            className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2.5 outline-none"
          />
        </label>
        <label className="block text-sm">
          Planned utilisation: <b>{shownUtil}%</b>{' '}
          <span className="text-white/40">({100 - shownUtil}% buffer for life happening)</span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={shownUtil}
            onChange={(e) => setUtil(Number(e.target.value))}
            onMouseUp={commit}
            onTouchEnd={commit}
            className="mt-2 w-full accent-[#34d399]"
          />
        </label>
        <p className="text-xs text-white/40">
          Project deadlines and life load are measured against this realistic
          pool — never against every technically-free hour.
        </p>
      </div>
    </section>
  )
}

function AccountsSection() {
  const { data: householdId } = useHouseholdId()
  const { data: accounts } = useAccounts()
  const createAccount = useCreateAccount()
  const setArchived = useSetAccountArchived()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Account['kind']>('cheque')

  const add = async () => {
    if (!name.trim() || !householdId) return
    await createAccount.mutateAsync({ household_id: householdId, name: name.trim(), kind })
    setName('')
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Accounts</h2>
      <div className="rounded-2xl bg-ink-soft divide-y divide-white/5 overflow-hidden">
        {(accounts ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3">
            <span className={a.archived ? 'text-white/30 line-through' : ''}>
              {a.name} <span className="text-white/30 text-xs">({a.kind.replace('_', ' ')})</span>
            </span>
            <button
              onClick={() => setArchived.mutate({ id: a.id, archived: !a.archived })}
              className="text-xs text-white/40"
            >
              {a.archived ? 'restore' : 'archive'}
            </button>
          </div>
        ))}
        {(accounts ?? []).length === 0 && (
          <p className="px-4 py-3 text-white/40 text-sm">
            No accounts yet — add your first below (e.g. "FNB Cheque").
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          placeholder="Account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 outline-none"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Account['kind'])}
          className="rounded-xl bg-white/10 px-2 py-2.5 outline-none"
        >
          {ACCOUNT_KINDS.map((k) => (
            <option key={k} value={k} className="text-ink">
              {k.replace('_', ' ')}
            </option>
          ))}
        </select>
        <button onClick={add} className="rounded-xl bg-rung text-ink font-bold px-4">
          Add
        </button>
      </div>
    </section>
  )
}

function CategoriesSection() {
  const { data: householdId } = useHouseholdId()
  const { data: categories } = useCategories()
  const createCategory = useCreateCategory()
  const setArchived = useSetCategoryArchived()
  const [parentId, setParentId] = useState('')
  const [name, setName] = useState('')

  const parents = (categories ?? []).filter((c) => !c.parent_id && !c.archived)
  const childrenOf = (id: string) => (categories ?? []).filter((c) => c.parent_id === id)

  const add = async () => {
    const parent = parents.find((p) => p.id === parentId)
    if (!name.trim() || !parent || !householdId) return
    await createCategory.mutateAsync({
      household_id: householdId,
      parent_id: parent.id,
      name: name.trim(),
      kind: parent.kind,
    })
    setName('')
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-widest text-white/50">Categories</h2>
      <div className="rounded-2xl bg-ink-soft p-4 space-y-3">
        {parents.map((p) => (
          <div key={p.id}>
            <p className="font-bold text-sm">{p.name}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {childrenOf(p.id).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setArchived.mutate({ id: c.id, archived: !c.archived })}
                  title={c.archived ? 'Tap to restore' : 'Tap to archive'}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    c.archived ? 'bg-white/5 text-white/25 line-through' : 'bg-white/10'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-xl bg-white/10 px-2 py-2.5 outline-none max-w-32"
        >
          <option value="" className="text-ink">
            Group…
          </option>
          {parents.map((p) => (
            <option key={p.id} value={p.id} className="text-ink">
              {p.name}
            </option>
          ))}
        </select>
        <input
          placeholder="New subcategory"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2.5 outline-none"
        />
        <button onClick={add} className="rounded-xl bg-rung text-ink font-bold px-4">
          Add
        </button>
      </div>
      <p className="text-xs text-white/30">Tap a category chip to archive/restore it.</p>
    </section>
  )
}
