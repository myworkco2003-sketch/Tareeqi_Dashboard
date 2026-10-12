import { useCallback, useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import baseStyle from './assets/style.json'

const API = 'http://127.0.0.1:8000'
const HEADERS = { 'Content-Type': 'application/json' }

type LngLat = [number, number]
type RouteItem = {
  id: number
  route_name: string
  color: string
  fare?: number | null
  geometry: { type: 'LineString'; coordinates: number[][] }
}

const EMPTY = { type: 'FeatureCollection' as const, features: [] }

// منجهّز الستايل: الخطوط من الفرونت، وكل خط بيتحوّل لـ Noto Sans
const buildStyle = (): maplibregl.StyleSpecification => {
  const style = structuredClone(baseStyle) as unknown as maplibregl.StyleSpecification

  style.glyphs = `${window.location.origin}/fonts/{fontstack}/{range}.pbf`

  style.layers.forEach((layer) => {
    const layout = (layer as unknown as { layout?: Record<string, unknown> }).layout
    const fonts = layout?.['text-font'] as string[] | undefined
    if (layout && fonts) {
      layout['text-font'] = [
        fonts.join(' ').includes('Bold') ? 'Noto Sans Bold' : 'Noto Sans Regular',
      ]
    }
  })

  return style
}

// أقرب نقطة من الخط لنقطة معينة (نستخدمها لإدراج نقطة بنص الخط)
const nearestIdx = (coords: number[][], p: LngLat) => {
  let best = 0
  let bestD = Infinity
  coords.forEach((c, i) => {
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

// إذا الخط القديم ما إله waypoints محفوظة، منأخد عينة من الخط
// ناخد نقاط تحكم موزعة على طول الخط (تقريباً كل كيلومتر، وبحد أقصى 15 نقطة)
const sampleWaypoints = (coords: number[][], stepMeters = 1000, max = 15): LngLat[] => {
  const dist = (a: number[], b: number[]) => {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b[1] - a[1])
    const dLon = toRad(b[0] - a[0])
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  let total = 0
  for (let i = 1; i < coords.length; i++) total += dist(coords[i - 1], coords[i])

  const step = Math.max(stepMeters, total / (max - 1))
  const first = coords[0]
  const last = coords[coords.length - 1]
  const out: LngLat[] = [[first[0], first[1]]]

  let acc = 0
  for (let i = 1; i < coords.length - 1; i++) {
    acc += dist(coords[i - 1], coords[i])
    if (acc >= step) {
      out.push([coords[i][0], coords[i][1]])
      acc = 0
    }
  }

  out.push([last[0], last[1]])
  return out
}

export default function RoutesMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const draftCoords = useRef<number[][]>([])
  const editingRef = useRef(false)
  const reqId = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const [ready, setReady] = useState(false)
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [editing, setEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [fare, setFare] = useState('')
  const [count, setCount] = useState(0)
  const [hasRoute, setHasRoute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/routes/map`)
      setRoutes(await res.json())
    } catch (e) {
      console.error('Failed to load map routes:', e)
    }
  }, [])

  const renumber = () => {
    markersRef.current.forEach((m, i) => {
      m.getElement().textContent = String(i + 1)
    })
    setCount(markersRef.current.length)
  }

  // حساب المسار من BRouter (عن طريق الباك إند) وعرضه كخط مؤقت
  const requestRoute = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const src = mapRef.current?.getSource('draft') as maplibregl.GeoJSONSource | undefined
      const pts = markersRef.current.map((m) => m.getLngLat())

      if (pts.length < 2) {
        reqId.current++
        draftCoords.current = []
        src?.setData(EMPTY)
        setHasRoute(false)
        setBusy(false)
        return
      }

      const id = ++reqId.current
      setBusy(true)
      setError('')
      try {
        const res = await fetch(`${API}/admin/routes/brouter-waypoints`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            route_name: 'draft',
            waypoints: pts.map((p) => ({ lon: p.lng, lat: p.lat })),
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.detail ?? `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (id !== reqId.current) return // جاء طلب أحدث، تجاهل هاد
        draftCoords.current = data.geometry.coordinates
        src?.setData({
          type: 'Feature',
          properties: {},
          geometry: data.geometry,
        })
        setHasRoute(true)
      } catch (e) {
        console.error('BRouter failed:', e)
        if (id === reqId.current) {
          setError(e instanceof Error ? e.message : 'فشل حساب المسار')
        }
      } finally {
        if (id === reqId.current) setBusy(false)
      }
    }, 250)
  }

  const removeMarker = (marker: maplibregl.Marker) => {
    marker.remove()
    markersRef.current = markersRef.current.filter((m) => m !== marker)
    renumber()
    requestRoute()
  }

  const addWaypoint = (lngLat: LngLat, index?: number, skipRequest = false) => {
    const map = mapRef.current
    if (!map) return

    const el = document.createElement('div')
    el.className = 'wp-marker'

    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
      .setLngLat(lngLat)
      .addTo(map)

    marker.on('dragend', requestRoute)
    el.addEventListener('click', (ev) => ev.stopPropagation())
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      removeMarker(marker)
    })

    if (index === undefined) markersRef.current.push(marker)
    else markersRef.current.splice(index, 0, marker)

    renumber()
    if (!skipRequest) requestRoute()
  }

  // مكان إدراج نقطة جديدة لما المستخدم يضغط على الخط
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

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    renumber()
  }

  const resetDraft = () => {
    window.clearTimeout(timer.current)
    reqId.current++
    clearMarkers()
    draftCoords.current = []
    ;(mapRef.current?.getSource('draft') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY)
    setHasRoute(false)
    setBusy(false)
    setError('')
  }

  const startNew = () => {
    resetDraft()
    setEditing(true)
    setEditingId(null)
    setName('')
    setColor('#2563eb')
    setFare('')
  }

  const startEdit = (r: RouteItem) => {
    resetDraft()
    setEditing(true)
    setEditingId(r.id)
    setName(r.route_name)
    setColor(r.color)
    setFare(r.fare != null ? String(r.fare) : '')

    const coords = r.geometry.coordinates
    sampleWaypoints(coords).forEach((p) => addWaypoint(p, undefined, true))

    // منعرض الخط القديم متل ما هو، ومنحسبه من جديد بس إذا المستخدم غيّر شي
    draftCoords.current = coords
    ;(mapRef.current?.getSource('draft') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: r.geometry,
    })
    setHasRoute(true)

    const map = mapRef.current
    if (map) {
      const b = new maplibregl.LngLatBounds()
      coords.forEach((c) => b.extend([c[0], c[1]]))
      map.fitBounds(b, { padding: 80 })
    }
  }

  const cancel = () => {
    resetDraft()
    setEditing(false)
    setEditingId(null)
  }

  const undo = () => {
    const last = markersRef.current[markersRef.current.length - 1]
    if (last) removeMarker(last)
  }

  const save = async () => {
    const payload = {
      route_name: name.trim(),
      color,
      fare: Number(fare),
      geometry: { type: 'LineString', coordinates: draftCoords.current },
    }

    try {
      const res = await fetch(
        editingId ? `${API}/admin/routes/${editingId}` : `${API}/admin/routes`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: HEADERS,
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) throw new Error(await res.text())
      await loadRoutes()
      cancel()
    } catch (e) {
      console.error('Save failed:', e)
      setError('فشل حفظ الخط')
    }
  }

  const remove = async (r: RouteItem) => {
    if (!window.confirm(`حذف ${r.route_name}؟`)) return
    try {
      const res = await fetch(`${API}/admin/routes/${r.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await loadRoutes()
    } catch (e) {
      console.error('Delete failed:', e)
      setError('فشل حذف الخط')
    }
  }

  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  // إنشاء الخريطة مرة وحدة فقط
  useEffect(() => {
    if (!mapEl.current) return

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: buildStyle(),
      center: [36.2913, 33.5138],
      zoom: 12,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-left')
    // أيقونة شفافة لأي أيقونة ناقصة بالـ sprite (بتمنع التحذيرات)
    map.on('styleimagemissing', (e) => {
      if (map.hasImage(e.id)) return
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
    })

    map.on('load', () => {
      // كل الخطوط المحفوظة
      map.addSource('routes', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.6 },
      })
      map.addLayer({
        id: 'routes-label',
        type: 'symbol',
        source: 'routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 500,
          'text-field': ['get', 'route_name'],
          'text-size': 12,
          'text-font': ['Noto Sans Bold'],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      })

      // الخط المؤقت أثناء الرسم/التعديل
      map.addSource('draft', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 6 },
      })

      setReady(true)
    })

    map.on('click', (e) => {
      if (!editingRef.current) return
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat]
      const onLine = map.queryRenderedFeatures(e.point, { layers: ['draft-line'] }).length > 0
      addWaypoint(p, onLine ? insertIndexFor(p) : undefined)
    })

    map.on('mouseenter', 'draft-line', () => {
      if (editingRef.current) map.getCanvas().style.cursor = 'copy'
    })
    map.on('mouseleave', 'draft-line', () => {
      map.getCanvas().style.cursor = ''
    })

    loadRoutes()

    return () => {
      window.clearTimeout(timer.current)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحديث الخطوط المعروضة (بدون الخط اللي عم نعدله)
  useEffect(() => {
    const src = mapRef.current?.getSource('routes') as maplibregl.GeoJSONSource | undefined
    if (!ready || !src) return
    src.setData({
      type: 'FeatureCollection',
      features: routes
        .filter((r) => r.id !== editingId)
        .map((r) => ({
          type: 'Feature' as const,
          properties: { id: r.id, route_name: r.route_name, color: r.color },
          geometry: r.geometry,
        })),
    })
  }, [routes, editingId, ready])

  return (
    <div className="routes-editor">
      <div ref={mapEl} className="routes-editor-map" />

      <aside className="routes-editor-side">
        {!editing ? (
          <>
            <button type="button" onClick={startNew}>
              + إضافة خط جديد
            </button>

            {routes.map((r) => (
              <div key={r.id} className="route-item">
                <span className="route-color" style={{ backgroundColor: r.color }} />
                <span>{r.route_name}</span>
                <button type="button" onClick={() => startEdit(r)}>
                  تعديل
                </button>
                <button type="button" onClick={() => remove(r)}>
                  حذف
                </button>
              </div>
            ))}
          </>
        ) : (
          <>
            <h3>{editingId ? 'تعديل الخط' : 'خط جديد'}</h3>

            <label>
              اسم الخط
              <input
                type="text"
                value={name}
                placeholder="مثال: خط 19"
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label>
              اللون
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>

            <label>
              الأجرة
              <input
                type="number"
                min="0"
                value={fare}
                placeholder="مثال: 500"
                onChange={(e) => setFare(e.target.value)}
              />
            </label>

            <p className="routes-editor-hint">
              اضغط على الخريطة لإضافة نقطة، اسحب النقطة لتغييرها، كليك يمين لحذفها،
              واضغط على الخط لإدراج نقطة بالنص.
            </p>

            {busy && <small>جاري حساب المسار…</small>}
            {error && <small className="routes-editor-error">{error}</small>}

            <button type="button" onClick={undo} disabled={count === 0}>
              تراجع
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!hasRoute || busy || !name.trim() || fare === '' || Number(fare) < 0}
            >
              حفظ
            </button>
            <button type="button" onClick={cancel}>
              إلغاء
            </button>
          </>
        )}
      </aside>
    </div>
  )
}