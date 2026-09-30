// Shown by both renderers when no CARTO basemap key is configured.
export function BasemapNotice() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit max-w-[90%] rounded-md border border-base-700/60 bg-base-900/90 px-3 py-1.5 text-center text-[11px] text-slate-300">
      Basemap not configured — set <span className="font-mono">VITE_CARTO_BASEMAP_KEY</span> (see README). Data layers still work.
    </div>
  )
}
