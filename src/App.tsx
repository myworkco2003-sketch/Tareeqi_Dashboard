import { useEffect, useRef, useState } from 'react'
import './App.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [mapRoutes, setMapRoutes] = useState<any[]>([])
  const [showAddRoute, setShowAddRoute] = useState(false)
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [isDrawingRoute, setIsDrawingRoute] = useState(false)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const [brouterRoute, setBrouterRoute] = useState<any | null>(null)

  
  const calculateBrouterRoute = async () => {
    if (waypoints.length < 2) {
      alert('حدد نقطتين على الأقل على الخريطة أولاً')
      return
    }

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/admin/routes/brouter-waypoints',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route_name: 'مسار تجريبي',
            waypoints: waypoints.map(([lon, lat]) => ({
              lon,
              lat,
            })),
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }

      const result = await response.json()
      console.log('BRouter route result:', result)
      setBrouterRoute(result)
    } catch (error) {
      console.error('BRouter route calculation failed:', error)
      alert('فشل حساب المسار. راجع Console لمعرفة السبب.')
    }
  }


  useEffect(() => {
    const handleBrouterMessage = (event: MessageEvent) => {
      console.log('TareeqI: message received:', event.origin, event.data)

      if (event.data?.type !== 'TAREEQI_ROUTE_RESULT') return

      console.log(
        'TareeqI: Route received in Dashboard:',
        event.data.route
      )

      setBrouterRoute(event.data.route)
    }

    window.addEventListener('message', handleBrouterMessage)

    return () => {
      window.removeEventListener('message', handleBrouterMessage)
    }
  }, [])

  useEffect(() => {
    if (!mapContainer.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: '/src/assets/style.json',
      center: [36.2913, 33.5138],
      zoom: 12,
    })
    mapInstance.current = map

    map.on('click', (e) => {
      if (!isDrawingRoute) return

      const point: [number, number] = [
        e.lngLat.lng,
        e.lngLat.lat,
      ]

      setWaypoints((current) => [...current, point])
    })

    map.on('load', () => {
      if (!mapRoutes.length) return

      mapRoutes.forEach((route) => {
        const sourceId = `route-${route.id}`
        const layerId = `route-line-${route.id}`

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: route.geometry,
            properties: {
              route_name: route.route_name,
            },
          },
        })

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': route.color,
            'line-width': 7,
            'line-opacity': 0.6,
          },
        })

        map.addLayer({
          id: `route-label-${route.id}`,
          type: 'symbol',
          source: sourceId,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 500,
            'text-field': route.route_name,
            'text-size': 12,
            'text-font': ['Noto Sans Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': route.color,
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        })
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 10,
        })

        map.on('mouseenter', `route-line-${route.id}`, () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', `route-line-${route.id}`, () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
        })

        map.on('mousemove', `route-line-${route.id}`, (e) => {
          popup
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: bold;
                color: ${route.color};
                padding: 2px 4px;
              ">
                ${route.route_name}
              </div>
            `)
            .addTo(map)
        })
      })
    })

    return () => {
      mapInstance.current = null
      map.remove()
    }
  }, [activePage, mapRoutes, isDrawingRoute])

  useEffect(() => {
    const map = mapInstance.current

    if (!map) return
    if (!isDrawingRoute) return

    const markers: maplibregl.Marker[] = []

    waypoints.forEach((point, index) => {
      const element = document.createElement('div')

      element.style.width = '28px'
      element.style.height = '28px'
      element.style.borderRadius = '50%'
      element.style.background = '#2563EB'
      element.style.border = '3px solid white'
      element.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
      element.style.display = 'flex'
      element.style.alignItems = 'center'
      element.style.justifyContent = 'center'
      element.style.color = 'white'
      element.style.fontSize = '12px'
      element.style.fontWeight = 'bold'

      element.textContent = String(index + 1)

      const marker = new maplibregl.Marker({
        element,
        anchor: 'center',
      })
        .setLngLat(point)
        .addTo(map)

      markers.push(marker)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [waypoints, isDrawingRoute])

  useEffect(() => {
    if (activePage !== 'routes-map') return

    fetch('http://127.0.0.1:8000/admin/routes/map')
      .then((res) => res.json())
      .then((data) => {
        console.log('MAP ROUTES:', data)
        setMapRoutes(data)
      })
      .catch((error) => {
        console.error('Failed to load map routes:', error)
      })
  }, [activePage])
  const [routes, setRoutes] = useState<
    {
      id: number
      route_name: string
      color: string
      is_active: boolean
    }[]
  >([])

  useEffect(() => {
    fetch('http://127.0.0.1:8000/admin/routes')
      .then((response) => response.json())
      .then((data) => {
        setRoutes(data)
      })
      .catch((error) => {
        console.error('Failed to load routes:', error)
      })
  }, [])
  return (
    <div dir="rtl" className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">ط</div>

          <div>
            <h2>طريقي</h2>
            <span>نظام النقل العام</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActivePage('dashboard')}
          >
            <span>▦</span>
            لوحة التحكم
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === 'routes' ? 'active' : ''}`}
            onClick={() => setActivePage('routes')}
          >
            <span>🚌</span>
            خطوط النقل
          </button>

          <button
            type="button"
            className={`nav-item ${activePage === 'routes-map' ? 'active' : ''}`}
            onClick={() => setActivePage('routes-map')}
          >
            <span>🗺</span>
            المسارات
          </button>

          <button type="button" className="nav-item">
            <span>💰</span>
            الأجور
          </button>

          <button type="button" className="nav-item">
            <span>⚙</span>
            الإعدادات
          </button>
        </nav>

        <div className="sidebar-footer">
          لوحة إدارة النقل
          <small>الإصدار 1.0</small>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>لوحة التحكم</h1>
            <p>إدارة ومتابعة نظام النقل العام</p>
          </div>

          <div className="dashboard-user">
            <span className="user-icon">م</span>

            <div>
              <strong>مسؤول النظام</strong>
              <small>مدير النظام</small>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          {activePage === 'dashboard' && (
            <section className="welcome-card">
              <h2>مرحباً بك في نظام طريقي</h2>

              <p>
                من هنا يمكنك إدارة خطوط النقل العام، المسارات، والأجور
                ومتابعة بيانات النظام.
              </p>
            </section>
          )}

            {activePage === 'routes' && (
              <section className="routes-section">
                <h2>خطوط النقل ({routes.length})</h2>

                {routes.map((route) => (
                  <div key={route.id} className="route-item">
                    <span
                      className="route-color"
                      style={{ backgroundColor: route.color }}
                    />

                    <span>{route.route_name}</span>

                    <span>
                      {route.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>
                ))}
              </section>
            )}
          {activePage === 'routes-map' && (
            <section className="welcome-card">
              <h2>المسارات</h2>

              <p>
                من هنا يمكنك استعراض وإدارة مسارات خطوط النقل على الخريطة.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowAddRoute(true)
                  setIsDrawingRoute(true)
                  setWaypoints([])
                }}
              >
                + إضافة خط جديد
              </button>

              <button
                type="button"
                onClick={calculateBrouterRoute}
                disabled={waypoints.length < 2}
              >
                احسب المسار التجريبي
              </button>
              <div
                ref={mapContainer}
                className="routes-map-container"
              />
              {showAddRoute && (
                <div>
                  <iframe
                    src="http://localhost:8080"
                    title="BRouter-Web"
                    style={{
                      width: '100%',
                      height: '700px',
                      border: '1px solid #ddd',
                      borderRadius: '12px',
                    }}
                  />
                  <h3>إضافة خط جديد</h3>

                  <label>
                    اسم الخط
                    <input
                      type="text"
                      placeholder="مثال: خط 19"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowAddRoute(false)}
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App