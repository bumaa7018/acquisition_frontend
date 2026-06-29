"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import type ImageWrapper from "ol/Image";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import type { Coordinate } from "ol/coordinate";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";

import LayerPanel, { LayerConfig, LayerGroupConfig } from './layer-panel'
import FeaturePopup from './feature-popup'
import { fitLayerToMap, layerDef, type MapLayerDef } from './layers'

const GS_BASE = '/api/geoserver/land/wms'
const GS_WFS  = '/api/geoserver/land/ows'

function wmsPostLoad(image: ImageWrapper, src: string) {
  const qIdx = src.indexOf('?')
  const img = image.getImage() as HTMLImageElement
  if (qIdx === -1) { img.src = src; return }
  fetch(src.slice(0, qIdx), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: src.slice(qIdx + 1),
  })
    .then(r => r.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob)
      img.onload  = () => URL.revokeObjectURL(objectUrl)
      img.onerror = () => URL.revokeObjectURL(objectUrl)
      img.src = objectUrl
    })
    .catch(() => { img.src = '' })
}

const LAYER_DEFS: MapLayerDef[] = [
  layerDef('au1'),
  layerDef('au2'),
  layerDef('au3'),
  layerDef('v_acquisition_plan'),
  layerDef('v_acquisition_boundary'),
  layerDef('v_parcel_s0'),
  layerDef('v_parcel_s1'),
  layerDef('v_parcel_s2'),
  layerDef('v_parcel_s3'),
  layerDef('v_parcel_s4'),
  layerDef('v_parcel_s5'),
]

const PARCEL_STATUS_LAYERS = ['v_parcel_s0', 'v_parcel_s1', 'v_parcel_s2', 'v_parcel_s3', 'v_parcel_s4', 'v_parcel_s5'] as const
const ACQUISITION_FILTERED_LAYERS = [...PARCEL_STATUS_LAYERS, 'v_acquisition_boundary', 'v_acquisition_plan'] as const
const ACQUISITION_FILTERED_SET = new Set<string>(ACQUISITION_FILTERED_LAYERS)

const DEFAULT_VISIBLE = new Set<string>(['v_acquisition_boundary', ...PARCEL_STATUS_LAYERS])

const PARCEL_GROUP: LayerGroupConfig = {
  id: 'parcel_status',
  label: 'Нэгж талбарын хил',
  color: '#22c55e',
}

interface PopupState {
  layer: string
  properties: Record<string, unknown>
  position: { x: number; y: number }
}

interface MapViewProps {
  acquisitionIds?: string[]
  years?: number[]
  au1Codes?: string[]
  au2Codes?: string[]
  au3Codes?: string[]
  filterPending?: boolean
  employeeId?: string
}

function buildAcqCql(acquisitionIds?: string[]): string {
  if (!acquisitionIds || acquisitionIds.length === 0) return ''
  return acquisitionIds.length === 1
    ? `acquisition_id = '${acquisitionIds[0]}'`
    : `acquisition_id IN (${acquisitionIds.map(id => `'${id}'`).join(',')})`
}

function buildParcelStatusCql(acquisitionIds?: string[], years?: number[], employeeId?: string): string {
  const parts: string[] = []
  const acqPart = buildAcqCql(acquisitionIds)
  if (acqPart) parts.push(acqPart)
  if (years && years.length > 0)
    parts.push(years.length === 1 ? `status_year = ${years[0]}` : `status_year IN (${years.join(',')})`)
  if (employeeId)
    parts.push(`assignee_user_ids LIKE '%,${employeeId},%'`)
  return parts.join(' AND ')
}

function buildCodeCql(codes: string[], col: string): string {
  if (codes.length === 0) return `${col} = '__none__'`
  return codes.length === 1
    ? `${col} = '${codes[0]}'`
    : `${col} IN (${codes.map(c => `'${c}'`).join(',')})`
}

export default function MapView({ acquisitionIds, years, au1Codes, au2Codes, au3Codes, filterPending, employeeId }: MapViewProps) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const olMap          = useRef<OLMap | null>(null)
  const wmsLayers      = useRef<Record<string, ImageLayer<ImageWMS>>>({})
  const wmsLayersAdded = useRef(false)

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map(d => ({ id: d.id, label: d.label, color: d.color, visible: DEFAULT_VISIBLE.has(d.id), group: d.group }))
  )
  const [popup,   setPopup]   = useState<PopupState | null>(null)

  const makeWmsLayer = useCallback((id: string, visible: boolean, cqlFilter = '') =>
    new ImageLayer({
      visible,
      opacity: 0.75,
      zIndex: LAYER_DEFS.find(l => l.id === id)?.zIndex ?? 0,
      source: new ImageWMS({
        url: GS_BASE,
        params: {
          LAYERS: `land:${id}`,
          FORMAT: 'image/png',
          TRANSPARENT: true,
          ...(cqlFilter ? { CQL_FILTER: cqlFilter } : {}),
        },
        ratio: 1,
        serverType: 'geoserver',
        imageLoadFunction: wmsPostLoad,
      }),
    }), [])

  /* ── Map init (once) — base tile layer only, no WMS ── */
  useEffect(() => {
    if (!mapRef.current || olMap.current) return

    const map = new OLMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            urls: [
              "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            ],
            maxZoom: 20,
            crossOrigin: "anonymous",
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 18,
      }),
    })

    map.on("singleclick", async (evt) => {
      const pixelCoord = evt.coordinate as Coordinate
      const viewRes    = map.getView().getResolution() ?? 1
      const projection = map.getView().getProjection()
      const pixel      = evt.pixel as [number, number]

      const visibleIds = LAYER_DEFS
        .filter(d => wmsLayers.current[d.id]?.getVisible())
        .sort((a, b) => b.zIndex - a.zIndex)
        .map(d => d.id)

      if (!visibleIds.length) return
      setPopup(null)

      for (const id of visibleIds) {
        const lyr = wmsLayers.current[id]
        const url = lyr?.getSource()?.getFeatureInfoUrl(pixelCoord, viewRes, projection, {
          INFO_FORMAT: "application/json",
          FEATURE_COUNT: 1,
        })
        if (!url) continue
        try {
          const qIdx   = url.indexOf('?')
          const res    = qIdx === -1
            ? await fetch(url)
            : await fetch(url.slice(0, qIdx), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: url.slice(qIdx + 1),
              })
          const json = await res.json()
          const features: { properties: Record<string, unknown> }[] = json.features ?? []
          if (features.length > 0) {
            setPopup({ layer: id, properties: features[0].properties ?? {}, position: { x: pixel[0], y: pixel[1] } })
            break
          }
        } catch { /* skip layer */ }
      }
    })

    olMap.current = map
    return () => {
      map.setTarget(undefined)
      olMap.current = null
      wmsLayers.current = {}
      wmsLayersAdded.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── WMS layers: created lazily after filter is ready, updated on filter change ── */
  useEffect(() => {
    // Wait until the dashboard has finished loading so the first GeoServer request
    // already carries the correct CQL_FILTER — no all-layers flash on page open.
    if (filterPending || !olMap.current) return

    const acqCql    = buildAcqCql(acquisitionIds)
    const parcelCql = buildParcelStatusCql(acquisitionIds, years, employeeId)
    const hasFilter = !!(acquisitionIds && acquisitionIds.length > 0)

    const getCql = (id: string): string => {
      if (PARCEL_STATUS_LAYERS.includes(id as typeof PARCEL_STATUS_LAYERS[number]))
        return parcelCql
      if (id === 'v_acquisition_boundary' || id === 'v_acquisition_plan')
        return acqCql
      if (id === 'au3')
        return hasFilter && au3Codes ? buildCodeCql(au3Codes, 'code') : ''
      if (id === 'au2')
        return hasFilter && au2Codes ? buildCodeCql(au2Codes, 'code') : ''
      if (id === 'au1')
        return hasFilter && au1Codes ? buildCodeCql(au1Codes, 'code') : ''
      return ''
    }

    const DYNAMIC_LAYERS = [...ACQUISITION_FILTERED_LAYERS, 'au1', 'au2', 'au3'] as const

    if (!wmsLayersAdded.current) {
      const map = olMap.current
      const record: Record<string, ImageLayer<ImageWMS>> = {}
      LAYER_DEFS.forEach(d => {
        record[d.id] = makeWmsLayer(d.id, DEFAULT_VISIBLE.has(d.id), getCql(d.id))
        map.addLayer(record[d.id])
      })
      wmsLayers.current = record
      wmsLayersAdded.current = true
    } else {
      DYNAMIC_LAYERS.forEach(id => {
        const cql = getCql(id)
        wmsLayers.current[id]?.getSource()?.updateParams({ CQL_FILTER: cql || undefined })
      })
    }

    if (acqCql && olMap.current) {
      void fitLayerToMap({
        map: olMap.current,
        wfsUrl: GS_WFS,
        layerId: 'v_acquisition_boundary',
        cqlFilter: acqCql,
        padding: [48, 48, 48, 48],
        maxZoom: 16,
      })
    }
  }, [acquisitionIds, years, au1Codes, au2Codes, au3Codes, filterPending, employeeId, makeWmsLayer])

  /* ── Layer toggle ── */
  const handleToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      const next = { ...l, visible: !l.visible }
      wmsLayers.current[id]?.setVisible(next.visible)
      const def = LAYER_DEFS.find(d => d.id === id)
      if (next.visible && def && olMap.current) {
        void fitLayerToMap({
          map: olMap.current,
          wfsUrl: GS_WFS,
          layerId: def.id,
          padding: [64, 64, 64, 64],
          maxZoom: 17,
        })
      }
      return next
    }))
    setPopup(null)
  }, [])

  const standaloneL = layers.filter(l => !l.group)
  const groupedL    = layers.filter(l => l.group === PARCEL_GROUP.id)
  const panelLayers = [...standaloneL, ...groupedL]

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel
        layers={panelLayers}
        groups={[PARCEL_GROUP]}
        onToggle={handleToggle}
      />
      {popup && (
        <FeaturePopup
          layer={popup.layer}
          properties={popup.properties}
          position={popup.position}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}
