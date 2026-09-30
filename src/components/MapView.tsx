import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '@/stores/useAppStore'
import { getRegion } from '@/services/mock/regions'
import { getInfraPoints } from '@/services/mock/infrastructure'
import { GlobePlaceholder } from '@/components/GlobePlaceholder'
import { BasemapNotice } from '@/components/BasemapNotice'
import { basemapConfig } from '@/services/basemap'
import { useFlights } from '@/hooks/useFlights'
import { useStorms } from '@/hooks/useStorms'
import { classificationLabel, geometryBounds } from '@/services/stormGeometry'
import type { Flight, GeoFeatureCollection, InfraKind, Storm, StormGeometry } from '@/types'

// CARTO Dark Matter vector style (keyed; see services/basemap.ts). Without a
// key the map uses a plain background so no placeholder tiles are requested;
// data layers still render.
const BASEMAP = basemapConfig()
const MAP_STYLE: string | maplibregl.StyleSpecification =
  BASEMAP.status === 'ok'
    ? BASEMAP.styleUrl
    : { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a1626' } }] }

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

function makeStormMarker(storm: Storm, selected: boolean, onSelect: () => void) {
  const el = document.createElement('button')
  el.type = 'button'
  el.title = `${storm.name} · ${classificationLabel(storm.classification)} (NHC)`
  el.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;background:none;border:0;padding:0'
  const ring = document.createElement('span')
  ring.style.cssText = `display:block;width:14px;height:14px;border-radius:9999px;background:#0b1220;border:2px solid ${
    selected ? '#f8fafc' : '#cbd5e1'
  };${selected ? 'box-shadow:0 0 0 3px #f8fafc55;' : ''}`
  const label = document.createElement('span')
  label.textContent = `${storm.classification} ${storm.name}`
  label.style.cssText = 'white-space:nowrap;border-radius:4px;background:rgba(11,18,32,.8);padding:0 4px;font-size:10px;color:#e2e8f0'
  el.append(ring, label)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onSelect()
  })
  return new maplibregl.Marker({ element: el, anchor: 'left', offset: [-7, 0] }).setLngLat(storm.coord)
}

const EMPTY_FC: GeoFeatureCollection = { type: 'FeatureCollection', features: [] }

/** Add NHC forecast sources/layers once the style is ready. */
function ensureStormLayers(map: maplibregl.Map) {
  if (map.getSource('nhc-cone')) return
  map.addSource('nhc-cone', {
    type: 'geojson',
    data: EMPTY_FC as GeoJSON.FeatureCollection,
    attribution: 'Storm forecast: NOAA / National Hurricane Center',
  })
  map.addSource('nhc-track', { type: 'geojson', data: EMPTY_FC as GeoJSON.FeatureCollection })
  map.addLayer({ id: 'nhc-cone-fill', type: 'fill', source: 'nhc-cone', paint: { 'fill-color': '#cbd5e1', 'fill-opacity': 0.14 } })
  map.addLayer({ id: 'nhc-cone-line', type: 'line', source: 'nhc-cone', paint: { 'line-color': '#cbd5e1', 'line-opacity': 0.6, 'line-width': 1 } })
  map.addLayer({
    id: 'nhc-track-line',
    type: 'line',
    source: 'nhc-track',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#f8fafc', 'line-width': 1.5, 'line-dasharray': [3, 2] },
  })
  map.addLayer({
    id: 'nhc-track-points',
    type: 'circle',
    source: 'nhc-track',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 3.5, 'circle-color': '#0b1220', 'circle-stroke-color': '#f8fafc', 'circle-stroke-width': 1.5 },
  })
}

function setStormGeometry(map: maplibregl.Map, geometry: StormGeometry | null) {
  ensureStormLayers(map)
  ;(map.getSource('nhc-cone') as maplibregl.GeoJSONSource).setData((geometry?.cone ?? EMPTY_FC) as GeoJSON.FeatureCollection)
  ;(map.getSource('nhc-track') as maplibregl.GeoJSONSource).setData((geometry?.track ?? EMPTY_FC) as GeoJSON.FeatureCollection)
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
  const stormsOn = layerVisibility['storms'] ?? true
  const { storms, selectedStormId, geometry, toggle } = useStorms(stormsOn)

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
          style: MAP_STYLE,
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
    if (stormsOn) {
      for (const st of storms) {
        markersRef.current.push(makeStormMarker(st, st.id === selectedStormId, () => void toggle(st.id)).addTo(map))
      }
    }
  }, [regionId, layerVisibility, flights, flightsEnabled, storms, stormsOn, selectedStormId, toggle])

  // Draw the selected storm's official NHC cone + track and frame it.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const shown = stormsOn && geometry?.stormId === selectedStormId ? geometry : null
    const apply = () => {
      setStormGeometry(map, shown)
      const bounds = geometryBounds(shown)
      if (bounds) {
        map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 40, maxZoom: 9, duration: 800 })
      } else if (selectedStormId) {
        const storm = storms.find((st) => st.id === selectedStormId)
        if (storm) map.flyTo({ center: storm.coord, zoom: 6, speed: 1.4 })
      }
    }
    // 'load' fires only once; while a (vector) style is still loading, wait for
    // the next 'idle' instead so late geometry is never dropped.
    if (map.isStyleLoaded()) apply()
    else map.once('idle', apply)
    return () => {
      map.off('idle', apply)
    }
  }, [geometry, selectedStormId, stormsOn, storms])

  if (failed) return <GlobePlaceholder className={className} />

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-base-700/60 bg-base-950 ${className}`}
    >
      {/* Inline position: maplibre-gl.css (loaded with this lazy chunk) sets
          .maplibregl-map { position: relative }, which would override a class and
          collapse the map to 0 px height. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {BASEMAP.status === 'missing-key' && <BasemapNotice />}
      {flightsEnabled && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-base-900/80 px-2 py-1 text-[11px] text-slate-300">
          ✈ {flights.length} aircraft
        </div>
      )}
    </div>
  )
}
