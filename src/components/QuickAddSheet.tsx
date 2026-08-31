import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useHouseholdId,
  useUpdateTransaction,
} from '../hooks/queries'
import { parseAmountToCents, formatZAR } from '../lib/money'
import { todayISO } from '../lib/dates'
import type { Transaction, TxnKind, Visibility } from '../types'

/**
 * The ≤3-tap quick-add: FAB → amount (keypad focused, everything defaulted)
 * → category chip → Save. Also serves as the edit sheet when opened with a
 * transaction. Defaults remembered per device in localStorage.
 */

interface QuickAddContextValue {
  openAdd: () => void
  openEdit: (txn: Transaction) => void
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null)

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext)
  if (!ctx) throw new Error('useQuickAdd must be used inside QuickAddProvider')
  return ctx
}

const LS_ACCOUNT = 'ladder-last-account'
const LS_RECENT_CATS = 'ladder-recent-categories'

function recentCategoryIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_RECENT_CATS) ?? '[]')
  } catch {
    return []
  }
}

function rememberCategory(id: string) {
  const next = [id, ...recentCategoryIds().filter((c) => c !== id)].slice(0, 6)
  localStorage.setItem(LS_RECENT_CATS, JSON.stringify(next))
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const openAdd = () => {
    setEditing(null)
    setVisible(true)
  }
  const openEdit = (txn: Transaction) => {
    setEditing(txn)
    setVisible(true)
  }

  return (
    <QuickAddContext.Provider value={{ openAdd, openEdit }}>
      {children}
      <button
        onClick={openAdd}
        aria-label="Add transaction"
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-40 h-14 w-14 rounded-full bg-rung text-ink text-3xl font-bold shadow-lg active:scale-95 hover:scale-105 transition"
      >
        +
      </button>
      {visible && <Sheet editing={editing} onClose={() => setVisible(false)} />}
    </QuickAddContext.Provider>
  )
}

function Sheet({ editing, onClose }: { editing: Transaction | null; onClose: () => void }) {
  const { session } = useAuth()
  const { data: householdId } = useHouseholdId()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()

  const activeAccounts = (accounts ?? []).filter((a) => !a.archived)

  const [kind, setKind] = useState<TxnKind>(editing?.kind ?? 'expense')
  const [amount, setAmount] = useState(
    editing ? (editing.amount_cents / 100).toFixed(2).replace('.', ',') : ''
  )
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [accountId, setAccountId] = useState<string>(
    editing?.account_id ?? localStorage.getItem(LS_ACCOUNT) ?? ''
  )
  const [date, setDate] = useState(editing?.txn_date ?? todayISO())
  const [description, setDescription] = useState(editing?.description ?? '')
  const [visibility, setVisibility] = useState<Visibility>(editing?.visibility ?? 'shared')
  const [error, setError] = useState<string | null>(null)

  // Default account: last used, else first active.
  useEffect(() => {
    if (!accountId && activeAccounts.length > 0) setAccountId(activeAccounts[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const pickable = useMemo(
    () => (categories ?? []).filter((c) => !c.archived && c.parent_id && c.kind === kind),
    [categories, kind]
  )
  const recents = useMemo(() => {
    const ids = recentCategoryIds()
    return ids
      .map((id) => pickable.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
  }, [pickable])

  const categoryName = (id: string | null) =>
    (categories ?? []).find((c) => c.id === id)?.name ?? ''

  const save = async () => {
    const cents = parseAmountToCents(amount)
    if (!cents) return setError('Enter a valid amount')
    if (!accountId) return setError('Pick an account (add one under Settings)')
    if (!categoryId) return setError('Pick a category')
    if (!householdId) return setError('No household found')

    const payload = {
      household_id: householdId,
      account_id: accountId,
      category_id: categoryId,
      kind,
      txn_date: date,
      description: description.trim() || categoryName(categoryId),
      amount_cents: cents,
      person_id: session?.user.id ?? null,
      visibility,
    }

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload })
      } else {
        await create.mutateAsync(payload)
        localStorage.setItem(LS_ACCOUNT, accountId)
        rememberCategory(categoryId)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const del = async () => {
    if (!editing) return
    if (!confirm(`Delete "${editing.description}" (${formatZAR(editing.amount_cents)})?`)) return
    await remove.mutateAsync(editing.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-ink-soft p-4 pb-8 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">{editing ? 'Edit' : 'Add'}</h2>
          <div className="flex rounded-lg overflow-hidden text-sm font-bold">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k)
                  setCategoryId(null)
                }}
                className={`px-4 py-1.5 ${
                  kind === k ? (k === 'income' ? 'bg-rung text-ink' : 'bg-alert text-ink') : 'bg-white/10'
                }`}
              >
                {k === 'expense' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>
        </div>

        <input
          autoFocus={!editing}
          inputMode="decimal"
          placeholder="R 0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl bg-white/10 px-4 py-4 text-3xl font-bold text-center outline-none focus:ring-2 ring-rung/60"
        />

        {recents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recents.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  categoryId === c.id ? 'bg-rung text-ink' : 'bg-white/10'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <select
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none"
        >
          <option value="" className="text-ink">
            Category…
          </option>
          {(categories ?? [])
            .filter((p) => !p.parent_id && !p.archived && p.kind === kind)
            .map((parent) => (
              <optgroup key={parent.id} label={parent.name} className="text-ink">
                {pickable
                  .filter((c) => c.parent_id === parent.id)
                  .map((c) => (
                    <option key={c.id} value={c.id} className="text-ink">
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-xl bg-white/10 px-3 py-3 outline-none"
          >
            {activeAccounts.length === 0 && (
              <option value="" className="text-ink">
                No accounts yet
              </option>
            )}
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id} className="text-ink">
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-white/10 px-3 py-3 outline-none"
          />
        </div>

        <input
          placeholder="Description (optional — defaults to category)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none"
        />

        <button
          onClick={() => setVisibility(visibility === 'shared' ? 'private' : 'shared')}
          className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-left"
        >
          {visibility === 'shared' ? '👥 Shared — both of you see this' : '🔒 Private — only you see this'}
          <span className="text-white/40"> · tap to change</span>
        </button>

        {error && <p className="text-alert text-sm text-center">{error}</p>}

        <button
          onClick={save}
          disabled={create.isPending || update.isPending}
          className="w-full rounded-xl bg-rung text-ink font-bold py-3.5 text-lg disabled:opacity-50"
        >
          {editing ? 'Save changes' : 'Save'}
        </button>

        {editing && (
          <button onClick={del} className="w-full rounded-xl bg-alert/20 text-alert font-bold py-2.5">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
