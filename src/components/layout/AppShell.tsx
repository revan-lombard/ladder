import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

/** Authed chrome: content area + bottom tab bar. The QuickAdd FAB joins in M3. */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
