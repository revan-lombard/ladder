import { useState } from 'react'
import TodayView from './planning/TodayView'
import ProjectsView from './planning/ProjectsView'
import MeetingsView from './planning/MeetingsView'
import DecisionsView from './planning/DecisionsView'

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'projects', label: 'Projects' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'decisions', label: 'Decisions' },
] as const

type Tab = (typeof TABS)[number]['key']

export default function Planning() {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <header className="space-y-2 pt-2">
        <h1 className="text-xl font-bold">Planning</h1>
        <div className="grid grid-cols-4 rounded-lg overflow-hidden text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-1.5 font-bold ${
                tab === t.key ? 'bg-white text-ink' : 'bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'today' && <TodayView />}
      {tab === 'projects' && <ProjectsView />}
      {tab === 'meetings' && <MeetingsView />}
      {tab === 'decisions' && <DecisionsView />}
    </div>
  )
}
