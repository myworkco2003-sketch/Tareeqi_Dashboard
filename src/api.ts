import { API_URL } from './config'
import type { Bus, BusSavePayload, CalculatedRoute, LngLat, MapRoute, RouteSavePayload, RouteSummary } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join('، ')
      : detail
    throw new Error(typeof message === 'string' && message ? message : `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const getBuses = () => request<Bus[]>('/admin/buses')
export const createBus = (payload: BusSavePayload) =>
  request<Bus>('/admin/buses', { method: 'POST', body: JSON.stringify(payload) })
export const updateBus = (id: number, payload: Partial<BusSavePayload>) =>
  request<Bus>(`/admin/buses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const getRoutes = () => request<RouteSummary[]>('/admin/routes')
export const getMapRoutes = async (): Promise<MapRoute[]> => {
  const routes = await request<RouteSummary[]>('/admin/routes/map')
  return routes.map((route) => ({ ...route, geometry: route.line_string }))
}

export const calculateRoute = (points: LngLat[]) =>
  request<CalculatedRoute>('/admin/routes/preview', {
    method: 'POST',
    body: JSON.stringify({ waypoints: points.map(([lon, lat]) => ({ lon, lat })) }),
  })

export const createRoute = (payload: RouteSavePayload) =>
  request<RouteSummary>('/admin/routes', { method: 'POST', body: JSON.stringify(payload) })
export const updateRoute = (id: number, payload: RouteSavePayload) =>
  request<RouteSummary>(`/admin/routes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
export const deleteRoute = (id: number) =>
  request<{ id: number; is_active: boolean }>(`/admin/routes/${id}`, { method: 'DELETE' })
