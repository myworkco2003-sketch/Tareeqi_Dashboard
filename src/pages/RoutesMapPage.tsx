import { useCallback, useEffect, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { deleteRoute, getBuses, getMapRoutes } from '../api'
import RoutesPanel from '../components/RoutesPanel'
import { useRouteEditor } from '../hooks/useRouteEditor'
import { useRoutesMap } from '../hooks/useRoutesMap'
import { setSourceData } from '../map/setup'
import type { Bus, MapRoute } from '../types'

export default function RoutesMapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [routes, setRoutes] = useState<MapRoute[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const loadRoutes = useCallback(async () => { setRoutes(await getMapRoutes()) }, [])
  const loadBuses = useCallback(async () => { setBuses(await getBuses()) }, [])
  const editor = useRouteEditor(mapRef, loadRoutes)
  const { mapEl, ready } = useRoutesMap(mapRef, editor.onMapClick)
  const { setError } = editor

  useEffect(() => {
    loadRoutes().catch((e) => { console.error('Failed to load routes:', e); setError('تعذر تحميل المسارات') })
    loadBuses().catch((e) => { console.error('Failed to load buses:', e); setError('تعذر تحميل الباصات') })
  }, [loadRoutes, loadBuses, setError])

  useEffect(() => {
    if (!ready) return
    setSourceData(mapRef.current, 'routes', {
      type: 'FeatureCollection',
      features: routes.filter((r) => r.id !== editor.editingId).map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id, route_name: `${r.bus.name} — ${r.direction}`, color: r.bus.color ?? '#2563eb' },
        geometry: r.geometry,
      })),
    })
  }, [routes, editor.editingId, ready])

  const handleDelete = async (route: MapRoute) => {
    if (!window.confirm(`تعطيل مسار ${route.bus.name} — ${route.direction}؟`)) return
    try { await deleteRoute(route.id); await loadRoutes(); setError('') }
    catch (e) { console.error('Deactivate failed:', e); setError(e instanceof Error ? e.message : 'فشل تعطيل المسار') }
  }

  return (
    <section className="welcome-card">
      <h2>إدارة خطوط ومسارات النقل</h2>
      <div className="routes-editor">
        <div ref={mapEl} className="routes-editor-map" />
        <RoutesPanel routes={routes} buses={buses} editor={editor} onDelete={handleDelete} onBusesChanged={loadBuses} />
      </div>
    </section>
  )
}
