import { useEffect, useState } from 'react'
import { getRoutes } from '../api'
import type { RouteSummary } from '../types'

export default function RoutesListPage() {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    getRoutes().then(setRoutes).catch((e) => {
      console.error('Failed to load routes:', e)
      setError(e instanceof Error ? e.message : 'تعذر تحميل المسارات')
    })
  }, [])

  return (
    <section className="routes-section">
      <h2>مسارات النقل ({routes.length})</h2>
      {error && <p className="routes-editor-error">{error}</p>}
      {routes.map((route) => (
        <div key={route.id} className="route-item">
          <span className="route-color" style={{ backgroundColor: route.bus.color ?? '#888' }} />
          <span>{route.bus.name} — {route.direction} (الإصدار {route.version})</span>
          <span>{route.is_active ? 'نشط' : 'غير نشط'}</span>
          <span>{route.distance == null ? 'المسافة غير محددة' : `${(route.distance / 1000).toFixed(2)} كم`}</span>
          <span>{route.trip_time == null ? 'الزمن غير محدد' : `${route.trip_time} دقيقة`}</span>
        </div>
      ))}
    </section>
  )
}
