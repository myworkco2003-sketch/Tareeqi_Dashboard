export type Page = 'dashboard' | 'routes' | 'routes-map'
export type LngLat = [number, number]
export type LineGeometry = { type: 'LineString'; coordinates: number[][] }

export type Bus = {
  id: number
  name: string
  color: string | null
  old_price: number | null
  new_price: number | null
  is_active: boolean
}
export type BusSavePayload = Omit<Bus, 'id'>

export type RouteSummary = {
  id: number
  bus_id: number
  bus: Bus
  version: number
  line_string: LineGeometry
  distance: number | null
  trip_time: number | null
  direction: string
  start_point: { type: 'Point'; coordinates: LngLat } | null
  end_point: { type: 'Point'; coordinates: LngLat } | null
  is_active: boolean
}
export type MapRoute = RouteSummary & { geometry: LineGeometry }
export type RouteSavePayload = {
  bus_id: number
  direction: string
  is_active: boolean
  geometry: LineGeometry
  distance: number
  trip_time: number
}
export type CalculatedRoute = {
  geometry: LineGeometry
  distance: number
  trip_time: number
  duration_seconds?: number
  duration_minutes?: number
}
