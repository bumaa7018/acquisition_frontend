import type OLMap from "ol/Map";
import GeoJSON from 'ol/format/GeoJSON'
import { createEmpty, extend as extendExtent, isEmpty } from 'ol/extent'
import { logger } from '@/lib/logger'
import { gsAuthHeaders } from '@/lib/geoserver'
import { type MapLayerId } from './layer-config'

// Тохиргоо нь ./layer-config-т (OL-гүй, тестээр хамгаалагдсан). Дуудагчид
// өмнөх шигээ './layers'-ээс авч байгаа тул дахин экспортолно.
export {
  BASE_Z_INDEX,
  DRONE_Z_INDEX,
  MAP_LAYER_STYLES,
  layerDef,
  type MapLayerDef,
  type MapLayerId,
} from './layer-config'

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
      headers: gsAuthHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
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
