import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Money from './pages/Money'
import Budget from './pages/Budget'
import Goals from './pages/Goals'
import Planning from './pages/Planning'
import Settings from './pages/Settings'
import SetupNotice from './components/SetupNotice'

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <SetupNotice />
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-white/60">
        Loading…
      </div>
    )
  }
  if (!session) return <Login />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/money" element={<Money />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
