import { API_URL } from './config'
import type {
  CalculatedRoute,
  LngLat,
  MapRoute,
  RouteSavePayload,
  RouteSummary,
} from './types'

// كل طلبات الباك إند بتمر من هون، وبترمي Error برسالة واضحة إذا فشل الطلب
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

export const getRoutes = () => request<RouteSummary[]>('/admin/routes')

export const getMapRoutes = () => request<MapRoute[]>('/admin/routes/map')

export const calculateRoute = (points: LngLat[]) =>
  request<CalculatedRoute>('/admin/routes/brouter-waypoints', {
    method: 'POST',
    body: JSON.stringify({
      route_name: 'draft',
      waypoints: points.map(([lon, lat]) => ({ lon, lat })),
    }),
  })

export const createRoute = (payload: RouteSavePayload) =>
  request<{ id: number }>('/admin/routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateRoute = (id: number, payload: RouteSavePayload) =>
  request<{ id: number }>(`/admin/routes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteRoute = (id: number) =>
  request<{ id: number; deleted: boolean }>(`/admin/routes/${id}`, {
    method: 'DELETE',
  })