import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { getRegion } from '@/services/mock/regions'
import { getInfraPoints } from '@/services/mock/infrastructure'
import { useFlights } from '@/hooks/useFlights'
import { useStorms } from '@/hooks/useStorms'
import { boundsCenter, classificationLabel, coneRings, fitZoom, forecastPoints, geometryBounds, trackLines } from '@/services/stormGeometry'
import type { InfraKind, Storm } from '@/types'

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
  const stormsOn = layerVisibility['storms'] ?? true
  const { storms, selectedStormId, geometry, toggle } = useStorms(stormsOn)

  // Recentre when the active region changes.
  useEffect(() => {
    setCenter(getRegion(regionId).center)
    setZoom(9)
  }, [regionId])

  // Frame the selected storm's official forecast (or just the storm if NHC
  // published no forecast geometry).
  useEffect(() => {
    if (!selectedStormId || size.w === 0) return
    const bounds = geometryBounds(geometry)
    if (bounds) {
      setCenter(boundsCenter(bounds))
      setZoom(fitZoom(bounds, size.w, size.h, MIN_Z, 9))
    } else {
      const storm = storms.find((st) => st.id === selectedStormId)
      if (storm) {
        setCenter(storm.coord)
        setZoom(6)
      }
    }
    // Re-frame only when the selection or its geometry changes.
  }, [selectedStormId, geometry])

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
  const showForecast = stormsOn && selectedStormId !== null && geometry?.stormId === selectedStormId
  const path = (coords: number[][]) => coords.map((c) => toScreen(c[0], c[1]).join(',')).join(' ')

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

        {size.w > 0 && showForecast && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-label="NHC forecast cone and track">
            {coneRings(geometry.cone).map((ring, i) => (
              <polygon key={`c${i}`} points={path(ring)} fill="#cbd5e1" fillOpacity={0.14} stroke="#cbd5e1" strokeOpacity={0.6} strokeWidth={1} />
            ))}
            {trackLines(geometry.track).map((line, i) => (
              <polyline key={`t${i}`} points={path(line)} fill="none" stroke="#f8fafc" strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
            {forecastPoints(geometry.track).map((pt, i) => {
              const [x, y] = toScreen(pt.coord[0], pt.coord[1])
              return (
                <circle key={`p${i}`} cx={x} cy={y} r={3.5} fill="#0b1220" stroke="#f8fafc" strokeWidth={1.5}>
                  <title>{`+${pt.tau ?? '?'} h${pt.maxWindKt !== null ? ` · ${pt.maxWindKt} kt` : ''}`}</title>
                </circle>
              )
            })}
          </svg>
        )}

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
            {stormsOn &&
              storms.map((st) => (
                <StormMarker
                  key={st.id}
                  storm={st}
                  pos={toScreen(st.coord[0], st.coord[1])}
                  selected={st.id === selectedStormId}
                  onSelect={() => void toggle(st.id)}
                />
              ))}
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
        © OpenStreetMap · CARTO{stormsOn && storms.length > 0 ? ' · Storms: NOAA/NHC' : ''}
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

function StormMarker({
  storm,
  pos,
  selected,
  onSelect,
}: {
  storm: Storm
  pos: [number, number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      title={`${storm.name} · ${classificationLabel(storm.classification)} (NHC)`}
      aria-pressed={selected}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
      style={{ left: pos[0], top: pos[1] }}
    >
      <span
        className="block rounded-full border-2 bg-base-950"
        style={{ width: 14, height: 14, borderColor: selected ? '#f8fafc' : '#cbd5e1', boxShadow: selected ? '0 0 0 3px #f8fafc55' : 'none' }}
      />
      <span className="whitespace-nowrap rounded bg-base-900/80 px-1 text-[10px] text-slate-200">
        {storm.classification} {storm.name}
      </span>
    </button>
  )
}
