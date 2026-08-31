import type { ReactNode } from 'react'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { QuickAddProvider } from '../QuickAddSheet'

/**
 * Authed chrome. Phones: content + QuickAdd FAB + bottom tab bar.
 * Desktop (lg+): fixed sidebar, wider content, no bottom bar.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <QuickAddProvider>
      <div className="min-h-full">
        <Sidebar />
        <main className="pb-24 lg:pb-10 lg:pl-60">{children}</main>
        <BottomNav />
      </div>
    </QuickAddProvider>
  )
}
