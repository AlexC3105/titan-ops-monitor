import type { IconName } from '@/components/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Roadmap phase that introduces real functionality here. */
  phase: number
}

// Single source of truth for sidebar + routing order.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', phase: 0 },
  { to: '/world', label: 'World View', icon: 'world', phase: 1 },
  { to: '/layers', label: 'Layers', icon: 'layers', phase: 1 },
  { to: '/scenarios', label: 'Scenarios', icon: 'scenarios', phase: 3 },
  { to: '/data-sources', label: 'Data Sources', icon: 'sources', phase: 1 },
  { to: '/reports', label: 'Reports', icon: 'reports', phase: 3 },
  { to: '/settings', label: 'Settings', icon: 'settings', phase: 0 },
  { to: '/about', label: 'About', icon: 'about', phase: 0 },
]
