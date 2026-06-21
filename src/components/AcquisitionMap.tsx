'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import OLMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import ImageWMS from 'ol/source/ImageWMS'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, transformExtent } from 'ol/proj'
import 'ol/ol.css'
import type { AU } from '@/types'
import LayerPanel, { type LayerConfig } from './map/layer-panel'

const GS_WMS = '/geoserver/land/wms'
const GS_WFS = '/geoserver/land/ows'

const LAYER_DEFS: { id: string; label: string; color: string; defaultVisible: boolean; filtered?: boolean }[] = [
  { id: 'v_acquisition_plan',     label: 'Төлөвлөгөөний хил', color: '#ef4444', defaultVisible: true },
  { id: 'v_acquisition_boundary', label: 'Чөлөөлөлтийн хил',  color: '#f59e0b', defaultVisible: true, filtered: true },
  { id: 'au1',                    label: 'Аймаг',             color: '#6366f1', defaultVisible: false },
  { id: 'au2',                    label: 'Сум',               color: '#8b5cf6', defaultVisible: false },
  { id: 'au3',                    label: 'Баг',               color: '#a78bfa', defaultVisible: true },
  { id: 'parcel',                 label: 'Нэгж талбар',       color: '#22c55e', defaultVisible: false },
]

interface Props {
  acquisitionId: string
  aus?: AU[]
}

export function AcquisitionMap({ acquisitionId, aus = [] }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const olMap       = useRef<OLMap | null>(null)
  const wmsLayers   = useRef<Record<string, ImageLayer<ImageWMS>>>({})

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
    if (!mapRef.current || olMap.current || !acquisitionId) return

    const acqFilter = `acquisition_id='${acquisitionId}'`
    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {}

    LAYER_DEFS.forEach(d => {
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: 0.8,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${d.id}`,
            FORMAT: 'image/png',
            TRANSPARENT: true,
            ...(d.filtered ? { CQL_FILTER: acqFilter } : {}),
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

    // Fit view via WFS bbox
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'land:v_acquisition_boundary',
      CQL_FILTER: acqFilter,
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
          map.getView().fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17 })
        }
      })
      .catch(() => {/* keep default view */})

    return () => {
      map.setTarget(undefined)
      olMap.current = null
    }
  }, [acquisitionId])

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 min-h-0">
        <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
          style={{ height: 480 }}>
          <div ref={mapRef} className="h-full w-full" />
          <LayerPanel layers={layers} onToggle={handleToggle} />
        </div>
      </div>

      {aus.length > 0 && (
        <div className="w-full lg:w-64 shrink-0">
          <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Давхцаж буй нутаг дэвсгэр
          </p>
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {aus.map(au => (
              <div key={au.au3_code} className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#252630] border border-slate-100 dark:border-[#37394d]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">{au.au3_name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{au.au2_name} · {au.au1_name}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#1e1f27] px-1.5 py-0.5 rounded">
                    {au.au3_code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
