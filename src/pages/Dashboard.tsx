import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { session } = useAuth()
  const firstName = session?.user.email?.split('@')[0] ?? ''

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">How are we doing?</h1>
          <p className="text-white/40 text-sm">Signed in as {firstName}</p>
        </div>
        <Link to="/settings" className="text-2xl" aria-label="Settings">
          ⚙️
        </Link>
      </header>

      <div className="rounded-2xl bg-ink-soft p-6 text-center text-white/50">
        The dashboard comes alive in M6 — summary numbers, pillar statuses and
        insight cards will appear here as the money, budget and goal modules land.
      </div>
    </div>
  )
}
