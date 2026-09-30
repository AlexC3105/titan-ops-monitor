import type { ReactNode } from 'react'

/** Card / panel primitive used across screens. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-base-700/60 bg-base-850/60 backdrop-blur-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-base-700/50 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}
