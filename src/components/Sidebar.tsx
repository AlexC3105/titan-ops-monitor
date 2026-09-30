import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/routes/navigation'
import { Icon } from '@/components/Icon'
import { useAppStore } from '@/stores/useAppStore'

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-base-700/60 bg-base-900/80 md:flex ${
        collapsed ? 'w-16' : 'w-60'
      } transition-[width] duration-200`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-base-700/60 px-4">
        <img src="/icon.svg" alt="" className="h-7 w-7" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-slate-100">TITAN</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Twin Network</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={item.label}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-signal/10 text-signal'
                  : 'text-slate-400 hover:bg-base-800/60 hover:text-slate-100'
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-base-700/60 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
          Probabilistic analysis — not deterministic prediction.
        </div>
      )}
    </aside>
  )
}
