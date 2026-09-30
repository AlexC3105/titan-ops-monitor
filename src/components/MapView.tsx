import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '@/stores/useAppStore'
import { getRegion } from '@/services/mock/regions'
import { getInfraPoints } from '@/services/mock/infrastructure'
import { GlobePlaceholder } from '@/components/GlobePlaceholder'
import { useFlights } from '@/hooks/useFlights'
import type { Flight, InfraKind } from '@/types'

// Free, key-less dark raster basemap (CARTO). Vector styles / MapTiler can swap
// in later behind the same component.
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0a1626' } },
    { id: 'carto', type: 'raster', source: 'carto' },
  ],
}

const INFRA_COLOR: Record<InfraKind, string> = {
  port: '#fbbf24',
  bridge: '#38bdf8',
  hospital: '#fb7185',
  airport: '#a78bfa',
  shelter: '#34d399',
  power: '#facc15',
}

function makeMarker(coord: [number, number], color: string, size: number, label: string) {
  const el = document.createElement('div')
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.borderRadius = '9999px'
  el.style.background = color
  el.style.boxShadow = `0 0 0 4px ${color}33`
  el.style.cursor = 'pointer'
  return new maplibregl.Marker({ element: el })
    .setLngLat(coord)
    .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(label))
}

function makePlaneMarker(f: Flight) {
  const el = document.createElement('div')
  el.style.width = '16px'
  el.style.height = '16px'
  el.style.cursor = 'pointer'
  const color = f.onGround ? '#64748b' : '#38bdf8'
  el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" style="transform:rotate(${Math.round(
    f.track,
  )}deg)" fill="${color}"><path d="M12 2l7 19-7-4-7 4z"/></svg>`
  const alt = f.altitude != null ? `${Math.round(f.altitude)} m` : f.onGround ? 'on ground' : '—'
  return new maplibregl.Marker({ element: el })
    .setLngLat(f.coord)
    .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setText(`${f.callsign} · ${alt}`))
}

/**
 * Interactive map (MapLibre GL). Selected via RegionMap when map mode is
 * 'interactive'. Centers on the active region, flies on region change, and
 * renders infrastructure + flight layers. Falls back to the placeholder if
 * WebGL is unavailable.
 */
export function MapView({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const teardownRef = useRef<number | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [failed, setFailed] = useState(false)
  const { regionId, layerVisibility } = useAppStore()
  const flightsEnabled = Boolean(layerVisibility['flights'])
  const { flights } = useFlights(regionId, flightsEnabled)

  // Create the map once and keep it alive across React StrictMode's dev
  // double-invoke and Fast Refresh; teardown is deferred so an immediate
  // remount reuses the existing map.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (teardownRef.current !== null) {
      clearTimeout(teardownRef.current)
      teardownRef.current = null
    }

    if (!mapRef.current) {
      try {
        const map = new maplibregl.Map({
          container,
          style: BASEMAP_STYLE,
          center: getRegion(useAppStore.getState().regionId).center,
          zoom: 9,
          attributionControl: { compact: true },
          // Helps some macOS/ANGLE setups composite the WebGL frame to screen.
          canvasContextAttributes: { preserveDrawingBuffer: true },
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        map.once('load', () => map.resize())
        const ro = new ResizeObserver(() => map.resize())
        ro.observe(container)
        roRef.current = ro
        mapRef.current = map
      } catch {
        setFailed(true)
      }
    } else {
      mapRef.current.resize()
    }

    return () => {
      teardownRef.current = window.setTimeout(() => {
        roRef.current?.disconnect()
        roRef.current = null
        mapRef.current?.remove()
        mapRef.current = null
        teardownRef.current = null
      }, 150)
    }
  }, [])

  // Fly to active region.
  useEffect(() => {
    mapRef.current?.flyTo({ center: getRegion(regionId).center, zoom: 9, speed: 1.4 })
  }, [regionId])

  // Sync markers with region + layer toggles.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const region = getRegion(regionId)
    markersRef.current.push(makeMarker(region.center, '#38bdf8', 16, region.name).addTo(map))

    if (layerVisibility['infrastructure']) {
      for (const p of getInfraPoints(regionId)) {
        markersRef.current.push(
          makeMarker(p.coord, INFRA_COLOR[p.kind], 11, `${p.name} · ${p.kind}`).addTo(map),
        )
      }
    }

    if (flightsEnabled) {
      for (const f of flights) {
        markersRef.current.push(makePlaneMarker(f).addTo(map))
      }
    }
  }, [regionId, layerVisibility, flights, flightsEnabled])

  if (failed) return <GlobePlaceholder className={className} />

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-base-700/60 bg-base-950 ${className}`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {flightsEnabled && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-base-900/80 px-2 py-1 text-[11px] text-slate-300">
          ✈ {flights.length} aircraft
        </div>
      )}
    </div>
  )
}
