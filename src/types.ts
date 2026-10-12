export type Page = 'dashboard' | 'routes' | 'routes-map'

// [lon, lat]
export type LngLat = [number, number]

export type LineGeometry = {
  type: 'LineString'
  coordinates: number[][]
}

// خط بالقائمة (GET /admin/routes)
export type RouteSummary = {
  id: number
  route_name: string
  color: string
  is_active: boolean
}

// خط على الخريطة (GET /admin/routes/map)
export type MapRoute = {
  id: number
  route_name: string
  color: string
  fare: number | null
  geometry: LineGeometry
}

// اللي منبعته للحفظ والتعديل
export type RouteSavePayload = {
  route_name: string
  color: string
  fare: number
  geometry: LineGeometry
}

// نتيجة حساب المسار من BRouter
export type CalculatedRoute = {
  geometry: LineGeometry
  distance_m: number
  duration_minutes: number
}