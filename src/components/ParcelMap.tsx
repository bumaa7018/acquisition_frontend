'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import OLMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import ImageWMS from 'ol/source/ImageWMS'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, transformExtent } from 'ol/proj'
import 'ol/ol.css'
import LayerPanel, { type LayerConfig } from './map/layer-panel'

const GS_WMS = '/geoserver/land/wms'
const GS_WFS = '/geoserver/land/ows'

const LAYER_DEFS: { id: string; label: string; color: string; defaultVisible: boolean; filter?: 'parcel' | 'acquisition' }[] = [
  { id: 'v_acquisition_plan',     label: 'Төлөвлөгөөний хил', color: '#ef4444', defaultVisible: true },
  { id: 'v_acquisition_boundary', label: 'Чөлөөлөлтийн хил',  color: '#f59e0b', defaultVisible: true, filter: 'acquisition' },
  { id: 'au1',                    label: 'Аймаг',             color: '#6366f1', defaultVisible: false },
  { id: 'au2',                    label: 'Сум',               color: '#8b5cf6', defaultVisible: false },
  { id: 'au3',                    label: 'Баг',               color: '#a78bfa', defaultVisible: true },
  { id: 'parcel',                 label: 'Нэгж талбар',       color: '#22c55e', defaultVisible: true, filter: 'parcel' },
]

interface Props {
  parcelId: string
  acquisitionId?: string
}

export function ParcelMap({ parcelId, acquisitionId }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const olMap     = useRef<OLMap | null>(null)
  const wmsLayers = useRef<Record<string, ImageLayer<ImageWMS>>>({})

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map(d => ({ id: d.id, label: d.label, color: d.color, visible: d.defaultVisible }))
  )

  const handleToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      const next = { ...l, visible: !l.visible }
      wmsLayers.current[id]?.setVisible(next.visible)
      return next
    }))
  }, [])

  useEffect(() => {
    if (!mapRef.current || olMap.current || !parcelId) return

    const parcelFilter = `parcel_id='${parcelId}'`
    const acquisitionFilter = acquisitionId ? `acquisition_id='${acquisitionId}'` : undefined
    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {}

    LAYER_DEFS.forEach(d => {
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: 0.85,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${d.id}`,
            FORMAT: 'image/png',
            TRANSPARENT: true,
            ...(d.filter === 'parcel' ? { CQL_FILTER: parcelFilter } : {}),
            ...(d.filter === 'acquisition' && acquisitionFilter ? { CQL_FILTER: acquisitionFilter } : {}),
          },
          ratio: 1,
          serverType: 'geoserver',
        }),
      })
    })
    wmsLayers.current = wmsRecord

    const map = new OLMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            urls: [
              'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
              'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
              'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
              'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            ],
            maxZoom: 20,
            crossOrigin: 'anonymous',
          }),
        }),
        ...LAYER_DEFS.map(d => wmsRecord[d.id]),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 20,
      }),
    })

    olMap.current = map

    // Fit to the parcel's bbox via WFS
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'land:parcel',
      CQL_FILTER: parcelFilter,
      outputFormat: 'application/json',
      propertyName: 'geom',
      maxFeatures: '1',
    })
    fetch(`${GS_WFS}?${params}`)
      .then(r => r.json())
      .then(json => {
        const bbox: number[] | undefined =
          json?.features?.[0]?.geometry?.bbox ?? json?.bbox
        if (bbox?.length === 4) {
          const ext = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857')
          map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 18 })
        }
      })
      .catch(() => {/* keep default view */})

    return () => {
      map.setTarget(undefined)
      olMap.current = null
    }
  }, [parcelId, acquisitionId])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
      style={{ height: 480 }}>
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel layers={layers} onToggle={handleToggle} />
    </div>
  )
}
