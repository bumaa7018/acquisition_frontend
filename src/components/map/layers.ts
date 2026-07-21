import type OLMap from "ol/Map";
import GeoJSON from 'ol/format/GeoJSON'
import { createEmpty, extend as extendExtent, isEmpty } from 'ol/extent'
import { logger } from '@/lib/logger'

export type MapLayerId =
  | 'au1'
  | 'au2'
  | 'au3'
  | 'v_acquisition_plan'
  | 'v_acquisition_boundary'
  | 'parcel'
  | 'building'
  | 'v_parcel_acquisition'
  | 'v_parcel_s0'
  | 'v_parcel_s1'
  | 'v_parcel_s2'
  | 'v_parcel_s3'
  | 'v_parcel_s4'
  | 'v_parcel_s5'

export type MapLayerDef = {
  id: MapLayerId
  label: string
  color: string
  zIndex: number
  group?: string
}

export const MAP_LAYER_STYLES: Record<MapLayerId, Omit<MapLayerDef, 'id'>> = {
  au1: { label: 'Аймаг/Нийслэл', color: '#6366f1', zIndex: 1 },
  au2: { label: 'Сум/Дүүрэг', color: '#8b5cf6', zIndex: 2 },
  au3: { label: 'Баг/Хороо', color: '#a78bfa', zIndex: 3 },
  v_acquisition_plan:     { label: 'Төлөвлөгөөний хил',   color: '#a855f7', zIndex: 10 },
  v_acquisition_boundary: { label: 'Чөлөөлөх бүсийн хил', color: '#3b82f6', zIndex: 20 },
  parcel:                 { label: 'Чөлөөлөх талбай',      color: '#22c55e', zIndex: 30 },
  building:               { label: 'Барилгын хил',         color: '#06b6d4', zIndex: 40 },
  v_parcel_acquisition:   { label: 'Нэгж талбар',          color: '#94a3b8', zIndex: 40 },
  v_parcel_s0: { label: 'Хүлээгдэж буй',        color: '#64748b', zIndex: 30, group: 'parcel_status' },
  v_parcel_s1: { label: 'Зөвшилцөх шатандаа',  color: '#eab308', zIndex: 31, group: 'parcel_status' },
  v_parcel_s2: { label: 'Үнэлгээ хийх',         color: '#f97316', zIndex: 32, group: 'parcel_status' },
  v_parcel_s3: { label: 'Нөлөөлөгдсөн гарсан', color: '#ec4899', zIndex: 33, group: 'parcel_status' },
  v_parcel_s4: { label: 'Татгалзсан',          color: '#ef4444', zIndex: 34, group: 'parcel_status' },
  v_parcel_s5: { label: 'Чөлөөлсөн',          color: '#22c55e', zIndex: 35, group: 'parcel_status' },
}

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] }
}

type FitLayerOptions = {
  map: OLMap
  wfsUrl: string
  layerId: MapLayerId
  cqlFilter?: string
  padding?: [number, number, number, number]
  maxZoom?: number
}

export async function fitLayerToMap({
  map,
  wfsUrl,
  layerId,
  cqlFilter,
  padding = [64, 64, 64, 64],
  maxZoom = 17,
}: FitLayerOptions) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: `land:${layerId}`,
    outputFormat: "application/json",
    propertyName: "geometry",
    maxFeatures: "500",
  })
  if (cqlFilter) params.set("CQL_FILTER", cqlFilter)

  try {
    const res = await fetch(wfsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const json = await res.json()

    const format = new GeoJSON()
    const features = format.readFeatures(json, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    })
    if (!features.length) return

    const extent = createEmpty()
    features.forEach(f => {
      const geomExtent = f.getGeometry()?.getExtent()
      if (geomExtent) extendExtent(extent, geomExtent)
    })
    if (isEmpty(extent)) return

    map.getView().fit(extent, { padding, maxZoom, duration: 1000 })
  } catch (err) {
    // Keep the current view when a layer has no feature or WFS is unavailable.
    logger.warn('map fitToLayer failed', { layerId, error: String(err) })
  }
}
