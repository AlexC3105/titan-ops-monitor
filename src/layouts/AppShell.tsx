import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { MobileNav } from '@/components/MobileNav'

/** App shell: persistent sidebar (desktop) + top bar + routed content. */
export function AppShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-base-950 text-slate-200">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 pb-20 pt-5 md:pb-6 md:px-6">
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
