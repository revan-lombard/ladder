import type { ReactNode } from 'react'
import BottomNav from './BottomNav'
import { QuickAddProvider } from '../QuickAddSheet'

/** Authed chrome: content area + QuickAdd FAB + bottom tab bar. */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <QuickAddProvider>
      <div className="min-h-full flex flex-col">
        <main className="flex-1 pb-24">{children}</main>
        <BottomNav />
      </div>
    </QuickAddProvider>
  )
}
