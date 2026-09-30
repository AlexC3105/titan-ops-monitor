import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  phase,
  actions,
}: {
  title: string
  description?: string
  phase?: number
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h1>
          {phase !== undefined && (
            <span className="rounded-md border border-base-700/60 bg-base-850 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
              Phase {phase}
            </span>
          )}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
