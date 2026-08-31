import { NavLink } from 'react-router-dom'

export const NAV_TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/money', label: 'Money', icon: '💸' },
  { to: '/budget', label: 'Budget', icon: '📊' },
  { to: '/goals', label: 'Goals', icon: '🪜' },
  { to: '/planning', label: 'Plan', icon: '📅' },
]

/** Phone navigation — replaced by the sidebar on lg screens. */
export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-ink-soft/95 backdrop-blur border-t border-white/10 pb-safe">
      <div className="max-w-lg mx-auto grid grid-cols-5">
        {NAV_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'text-rung font-bold' : 'text-white/50'
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
