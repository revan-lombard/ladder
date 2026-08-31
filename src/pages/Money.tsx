import { useState } from 'react'
import TransactionsView from './money/TransactionsView'
import NetWorthView from './money/NetWorthView'

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'networth', label: 'Net worth' },
] as const

type Tab = (typeof TABS)[number]['key']

export default function Money() {
  const [tab, setTab] = useState<Tab>('transactions')

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Money</h1>
        <div className="flex rounded-lg overflow-hidden text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 font-bold ${
                tab === t.key ? 'bg-white text-ink' : 'bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'transactions' && <TransactionsView />}
      {tab === 'networth' && <NetWorthView />}
    </div>
  )
}
