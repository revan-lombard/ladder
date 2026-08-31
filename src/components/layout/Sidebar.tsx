import { NavLink } from 'react-router-dom'
import { NAV_TABS } from './BottomNav'
import { useAuth } from '../../hooks/useAuth'

/** Desktop navigation — hidden on phones, where BottomNav takes over. */
export default function Sidebar() {
  const { session, signOut } = useAuth()

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-ink-soft/60 border-r border-white/10 p-4">
      <div className="flex items-center gap-2 px-2 pb-6 pt-2">
        <span className="text-3xl">🪜</span>
        <div>
          <p className="font-extrabold tracking-tight leading-tight">LADDER</p>
          <p className="text-[10px] text-white/40 leading-tight">One rung at a time</p>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {[...NAV_TABS, { to: '/settings', label: 'Settings', icon: '⚙️' }].map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                isActive ? 'bg-white/10 text-rung' : 'text-white/60 hover:bg-white/5'
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label === 'Plan' ? 'Planning' : t.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-3 px-2 space-y-2">
        <p className="text-xs text-white/40 truncate">{session?.user.email}</p>
        <button onClick={signOut} className="text-xs text-white/50 hover:text-white">
          Sign out
        </button>
      </div>
    </aside>
  )
}
