import { useEffect } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { WorldViewPage } from '@/features/world-view/WorldViewPage'
import { LayersPage } from '@/features/layers/LayersPage'
import { ScenariosPage } from '@/features/scenarios/ScenariosPage'
import { DataSourcesPage } from '@/features/data-sources/DataSourcesPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AboutPage } from '@/features/about/AboutPage'
import { startFeeds } from '@/services/feeds/runtime'

export function App() {
  // One scheduler keeps every live feed refreshed for the whole app.
  useEffect(() => startFeeds(), [])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="world" element={<WorldViewPage />} />
        <Route path="layers" element={<LayersPage />} />
        <Route path="scenarios" element={<ScenariosPage />} />
        <Route path="data-sources" element={<DataSourcesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="font-mono text-4xl text-signal">404</div>
      <p className="text-sm text-slate-400">That sector isn’t mapped yet.</p>
      <Link to="/" className="text-sm text-signal hover:underline">
        Return to Dashboard
      </Link>
    </div>
  )
}
