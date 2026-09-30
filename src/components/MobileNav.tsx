import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/routes/navigation'
import { Icon } from '@/components/Icon'

// Bottom tab bar for narrow viewports (PWA on phones). Shows the primary screens.
const PRIMARY = NAV_ITEMS.filter((i) =>
  ['/', '/world', '/scenarios', '/reports', '/settings'].includes(i.to),
)

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-base-700/60 bg-base-900/95 backdrop-blur md:hidden">
      {PRIMARY.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] ${
              isActive ? 'text-signal' : 'text-slate-400'
            }`
          }
        >
          <Icon name={item.icon} className="h-5 w-5" />
          {item.label.split(' ')[0]}
        </NavLink>
      ))}
    </nav>
  )
}
