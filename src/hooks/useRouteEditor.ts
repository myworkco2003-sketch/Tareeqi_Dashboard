import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as maplibregl from 'maplibre-gl'
import { calculateRoute, createRoute, updateRoute } from '../api'
import { nearestIdx, sampleWaypoints } from '../lib/geo'
import { EMPTY, setSourceData } from '../map/setup'
import type { LineGeometry, LngLat, MapRoute } from '../types'

export function useRouteEditor(
  mapRef: RefObject<maplibregl.Map | null>,
  onSaved: () => Promise<void> | void,
) {
  const markersRef = useRef<maplibregl.Marker[]>([])
  const draftCoords = useRef<number[][]>([])
  const editingRef = useRef(false)
  const reqId = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busId, setBusId] = useState('')
  const [direction, setDirection] = useState('forward')
  const [isActive, setIsActive] = useState(true)
  const [distance, setDistance] = useState<number | null>(null)
  const [tripTime, setTripTime] = useState<number | null>(null)
  const [count, setCount] = useState(0)
  const [hasRoute, setHasRoute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { editingRef.current = editing }, [editing])
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
  }, [])

  const renumber = () => {
    markersRef.current.forEach((m, i) => { m.getElement().textContent = String(i + 1) })
    setCount(markersRef.current.length)
  }
  const showDraft = (geometry: LineGeometry | null) => {
    setSourceData(mapRef.current, 'draft', geometry ? { type: 'Feature', properties: {}, geometry } : EMPTY)
  }

  const requestRoute = () => {
    window.clearTimeout(timer.current)
    const id = ++reqId.current
    if (markersRef.current.length < 2) {
      draftCoords.current = []
      showDraft(null); setHasRoute(false); setBusy(false)
      setDistance(null); setTripTime(null)
      return
    }
    draftCoords.current = []
    showDraft(null); setHasRoute(false)
    setDistance(null); setTripTime(null)
    setBusy(true); setError('')
    timer.current = window.setTimeout(async () => {
      const points = markersRef.current.map((m): LngLat => {
        const p = m.getLngLat()
        return [p.lng, p.lat]
      })
      try {
        const data = await calculateRoute(points)
        if (id !== reqId.current) return
        draftCoords.current = data.geometry.coordinates
        showDraft(data.geometry)
        setDistance(data.distance)
        setTripTime(data.trip_time)
        setHasRoute(true)
      } catch (e) {
        console.error('BRouter failed:', e)
        if (id === reqId.current) setError(e instanceof Error ? e.message : 'فشل حساب المسار')
      } finally {
        if (id === reqId.current) setBusy(false)
      }
    }, 250)
  }

  const removeMarker = (marker: maplibregl.Marker) => {
    marker.remove()
    markersRef.current = markersRef.current.filter((m) => m !== marker)
    renumber(); requestRoute()
  }
  const addWaypoint = (lngLat: LngLat, index?: number, skipRequest = false) => {
    const map = mapRef.current
    if (!map) return
    const el = document.createElement('div')
    el.className = 'wp-marker'
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' }).setLngLat(lngLat).addTo(map)
    marker.on('dragend', requestRoute)
    el.addEventListener('click', (ev) => ev.stopPropagation())
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault(); ev.stopPropagation(); removeMarker(marker)
    })
    if (index === undefined) markersRef.current.push(marker)
    else markersRef.current.splice(index, 0, marker)
    renumber()
    if (!skipRequest) requestRoute()
  }
  const insertIndexFor = (p: LngLat) => {
    const coords = draftCoords.current
    if (!coords.length) return undefined
    const clickIdx = nearestIdx(coords, p)
    const wpIdx = markersRef.current.map((m) => {
      const ll = m.getLngLat()
      return nearestIdx(coords, [ll.lng, ll.lat])
    })
    const at = wpIdx.findIndex((i) => i > clickIdx)
    return at === -1 ? undefined : at
  }
  const onMapClick = (e: maplibregl.MapMouseEvent) => {
    const map = mapRef.current
    if (!map || !editingRef.current) return
    const p: LngLat = [e.lngLat.lng, e.lngLat.lat]
    const onLine = map.queryRenderedFeatures(e.point, { layers: ['draft-line'] }).length > 0
    addWaypoint(p, onLine ? insertIndexFor(p) : undefined)
  }
  const resetDraft = () => {
    window.clearTimeout(timer.current); reqId.current++
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []; renumber(); draftCoords.current = []
    showDraft(null); setHasRoute(false); setBusy(false); setError('')
    setDistance(null); setTripTime(null)
  }
  const startNew = (defaultBusId = '') => {
    resetDraft(); setEditing(true); setEditingId(null)
    setBusId(defaultBusId); setDirection('forward'); setIsActive(true)
  }
  const startEdit = (r: MapRoute) => {
    resetDraft(); setEditing(true); setEditingId(r.id)
    setBusId(String(r.bus_id)); setDirection(r.direction); setIsActive(r.is_active)
    const coords = r.geometry.coordinates
    sampleWaypoints(coords).forEach((p) => addWaypoint(p, undefined, true))
    draftCoords.current = coords; showDraft(r.geometry); setHasRoute(true)
    setDistance(r.distance); setTripTime(r.trip_time)
    const map = mapRef.current
    if (map) {
      const bounds = new maplibregl.LngLatBounds()
      coords.forEach((c) => bounds.extend([c[0], c[1]]))
      map.fitBounds(bounds, { padding: 80 })
    }
  }
  const cancel = () => { resetDraft(); setEditing(false); setEditingId(null) }
  const undo = () => {
    const last = markersRef.current[markersRef.current.length - 1]
    if (last) removeMarker(last)
  }
  const save = async () => {
    if (saving || busy || !hasRoute || draftCoords.current.length < 2) return
    if (!busId || !direction.trim() || distance == null || tripTime == null) {
      setError('اختر الباص وحدد الاتجاه وانتظر انتهاء حساب المسار')
      return
    }
    const payload = {
      bus_id: Number(busId),
      direction: direction.trim(),
      is_active: isActive,
      geometry: { type: 'LineString' as const, coordinates: draftCoords.current },
      distance,
      trip_time: tripTime,
    }
    setSaving(true); setError('')
    try {
      if (editingId !== null) await updateRoute(editingId, payload)
      else await createRoute(payload)
      await onSaved(); cancel()
    } catch (e) {
      console.error('Save failed:', e)
      setError(e instanceof Error ? e.message : 'فشل حفظ المسار')
    } finally { setSaving(false) }
  }

  return {
    editing, editingId, busId, setBusId, direction, setDirection, isActive, setIsActive,
    distance, tripTime, count, hasRoute, busy, saving, error, setError,
    startNew, startEdit, cancel, undo, save, onMapClick,
  }
}
export type RouteEditor = ReturnType<typeof useRouteEditor>
