import { useEffect, useState } from 'react'
import './App.css'
import RoutesMap from './RoutesMap'

function App() {
  const [activePage, setActivePage] = useState('dashboard')
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
      .then((data) => setRoutes(data))
      .catch((error) => {
        console.error('Failed to load routes:', error)
      })
  }, [activePage])

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
              <RoutesMap />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App