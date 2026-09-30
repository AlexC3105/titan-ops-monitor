import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { getRegion } from '@/services/mock/regions'
import { getInfraPoints } from '@/services/mock/infrastructure'
import { useFlights } from '@/hooks/useFlights'
import type { InfraKind } from '@/types'

// Non-WebGL map: CARTO raster tiles as <img> + DOM markers, with pan and zoom.
// Works on any browser regardless of GPU/WebGL support (the compatibility
// renderer). Same imagery as the MapLibre map.

const INFRA_COLOR: Record<InfraKind, string> = {
  port: '#fbbf24',
  bridge: '#38bdf8',
  hospital: '#fb7185',
  airport: '#a78bfa',
  shelter: '#34d399',
  power: '#facc15',
}

const TILE = 256
const MIN_Z = 4
const MAX_Z = 15
const SUBS = ['a', 'b', 'c', 'd']

function project(lon: number, lat: number, worldSize: number): [number, number] {
  const x = ((lon + 180) / 360) * worldSize
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldSize
  return [x, y]
}

function unproject(x: number, y: number, worldSize: number): [number, number] {
  const lon = (x / worldSize) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldSize)))
  return [lon, (latRad * 180) / Math.PI]
}

export function StaticMap({ className = '' }: { className?: string }) {
  const { regionId, layerVisibility } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(9)
  const [center, setCenter] = useState<[number, number]>(() => getRegion(regionId).center)
  const { flights } = useFlights(regionId, Boolean(layerVisibility['flights']))

  // Recentre when the active region changes.
  useEffect(() => {
    setCenter(getRegion(regionId).center)
    setZoom(9)
  }, [regionId])

  // Track container size.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const worldSize = 2 ** zoom * TILE
  const n = 2 ** zoom
  const [cx, cy] = project(center[0], center[1], worldSize)
  const originX = cx - size.w / 2
  const originY = cy - size.h / 2
  const toScreen = (lon: number, lat: number): [number, number] => {
    const [x, y] = project(lon, lat, worldSize)
    return [x - originX, y - originY]
  }

  const tiles: { key: string; src: string; left: number; top: number }[] = []
  if (size.w > 0 && size.h > 0) {
    const minTx = Math.floor(originX / TILE)
    const maxTx = Math.floor((originX + size.w) / TILE)
    const minTy = Math.floor(originY / TILE)
    const maxTy = Math.floor((originY + size.h) / TILE)
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (ty < 0 || ty >= n) continue
        const wx = ((tx % n) + n) % n
        const sub = SUBS[Math.abs(tx + ty) % SUBS.length]
        tiles.push({
          key: `${tx}_${ty}`,
          src: `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${wx}/${ty}.png`,
          left: tx * TILE - originX,
          top: ty * TILE - originY,
        })
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current = { x: e.clientX, y: e.clientY }
    setCenter(unproject(cx - dx, cy - dy, worldSize))
  }
  function onPointerUp() {
    dragRef.current = null
  }

  const region = getRegion(regionId)
  const infra = layerVisibility['infrastructure'] ? getInfraPoints(regionId) : []
  const showFlights = Boolean(layerVisibility['flights'])

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-base-700/60 bg-base-950 ${className}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
          />
        ))}

        {size.w > 0 && (
          <>
            <Dot pos={toScreen(region.center[0], region.center[1])} color="#38bdf8" size={16} ring title={region.name} />
            {infra.map((p) => {
              const s = toScreen(p.coord[0], p.coord[1])
              return <Dot key={p.id} pos={s} color={INFRA_COLOR[p.kind]} size={11} title={`${p.name} · ${p.kind}`} />
            })}
            {showFlights &&
              flights.map((f) => {
                const s = toScreen(f.coord[0], f.coord[1])
                return <Plane key={f.id} pos={s} track={f.track} onGround={f.onGround} title={f.callsign} />
              })}
          </>
        )}
      </div>

      <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-md border border-base-700/60 bg-base-850 font-mono">
        <button
          onClick={() => setZoom((z) => Math.min(MAX_Z, z + 1))}
          className="px-2.5 py-1 text-slate-200 hover:bg-base-800"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(MIN_Z, z - 1))}
          className="border-t border-base-700/60 px-2.5 py-1 text-slate-200 hover:bg-base-800"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {showFlights && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-base-900/80 px-2 py-1 text-[11px] text-slate-300">
          ✈ {flights.length} aircraft
        </div>
      )}

      <div className="pointer-events-none absolute bottom-1 right-1 z-10 rounded bg-base-900/70 px-1.5 py-0.5 text-[9px] text-slate-500">
        © OpenStreetMap · CARTO
      </div>
    </div>
  )
}

function Dot({
  pos,
  color,
  size,
  title,
  ring,
}: {
  pos: [number, number]
  color: string
  size: number
  title: string
  ring?: boolean
}) {
  return (
    <div
      title={title}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: pos[0],
        top: pos[1],
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 ${ring ? 4 : 3}px ${color}33`,
      }}
    />
  )
}

function Plane({
  pos,
  track,
  onGround,
  title,
}: {
  pos: [number, number]
  track: number
  onGround: boolean
  title: string
}) {
  return (
    <div
      title={title}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: pos[0], top: pos[1] }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        style={{ transform: `rotate(${Math.round(track)}deg)` }}
        fill={onGround ? '#64748b' : '#38bdf8'}
      >
        <path d="M12 2l7 19-7-4-7 4z" />
      </svg>
    </div>
  )
}
