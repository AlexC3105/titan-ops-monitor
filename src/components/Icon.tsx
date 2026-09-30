// Minimal inline icon set (stroke-based, 24×24). Keeps the app dependency-free.
export type IconName =
  | 'dashboard'
  | 'world'
  | 'layers'
  | 'scenarios'
  | 'sources'
  | 'reports'
  | 'settings'
  | 'about'
  | 'menu'
  | 'pin'
  | 'pulse'

const PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z',
  world: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  scenarios: 'M4 5h16M4 12h10M4 19h7M17 14l4 4-4 4',
  sources: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  reports: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 22h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  about: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  pin: 'M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
}

export function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
