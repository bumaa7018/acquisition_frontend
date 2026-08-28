"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { fromLonLat, toLonLat } from "ol/proj";
import { buffer as bufferExtent, getCenter as getExtentCenter } from "ol/extent";
import type { Coordinate } from "ol/coordinate";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { Box, Map as MapIcon } from "lucide-react";

import LayerPanel, { LayerConfig, LayerGroupConfig } from './layer-panel'
import FeaturePopup from './feature-popup'
import FullscreenButton from './fullscreen-button'
import { useFullscreen } from './use-fullscreen'
import { fitLayerToMap, layerDef, type MapLayerDef } from './layers'
import { GS_WMS, GS_WFS, wmsPostLoad, buildAcqCql, buildParcelStatusCql, buildCodeCql, gsAuthHeaders } from '@/lib/geoserver'
import { logger } from '@/lib/logger'
import { activateCesium3D, type Cesium3DHandle } from './cesium-3d'

const LAYER_DEFS: MapLayerDef[] = [
  layerDef('au1'),
  layerDef('au2'),
  layerDef('au3'),
  layerDef('v_acquisition_plan'),
  layerDef('v_parcel_s0'),
  layerDef('v_parcel_s1'),
  layerDef('v_parcel_s2'),
  layerDef('v_parcel_s3'),
  layerDef('v_parcel_s4'),
  layerDef('v_parcel_s5'),
]

const PARCEL_STATUS_LAYERS = ['v_parcel_s0', 'v_parcel_s1', 'v_parcel_s2', 'v_parcel_s3', 'v_parcel_s4', 'v_parcel_s5'] as const
const ACQUISITION_FILTERED_LAYERS = [...PARCEL_STATUS_LAYERS, 'v_acquisition_plan'] as const
const ACQUISITION_FILTERED_SET = new Set<string>(ACQUISITION_FILTERED_LAYERS)

// Чөлөөлөлтийн хил нь төлөвлөгөөний хилээс хуулагддаг тул давхаргын хэсэгт
// зөвхөн ТӨЛӨВЛӨГӨӨНИЙ хил үлдсэн — тэр нь анхнаасаа асаалттай.
const DEFAULT_VISIBLE = new Set<string>(['v_acquisition_plan', ...PARCEL_STATUS_LAYERS])

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


export default function MapView({ acquisitionIds, years, au1Codes, au2Codes, au3Codes, filterPending, employeeId }: MapViewProps) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const containerRef   = useRef<HTMLDivElement>(null)
  const olMap          = useRef<OLMap | null>(null)
  const wmsLayers      = useRef<Record<string, ImageLayer<ImageWMS>>>({})
  const wmsLayersAdded = useRef(false)
  // 3D (cesium-3d.ts): Байршил табтай ижил зарчим — зөвхөн хэрэглэгч сонгоход л ачаална
  const cesium3D       = useRef<Cesium3DHandle | null>(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef)

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map(d => ({ id: d.id, label: d.label, color: d.color, visible: DEFAULT_VISIBLE.has(d.id), group: d.group }))
  )
  const [popup,   setPopup]   = useState<PopupState | null>(null)
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [loading3D, setLoading3D] = useState(false)

  const makeWmsLayer = useCallback((id: string, visible: boolean, cqlFilter = '') =>
    new ImageLayer({
      visible,
      opacity: 0.75,
      zIndex: LAYER_DEFS.find(l => l.id === id)?.zIndex ?? 0,
      source: new ImageWMS({
        url: GS_WMS,
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
            ? await fetch(url, { headers: gsAuthHeaders() })
            : await fetch(url.slice(0, qIdx), {
                method: 'POST',
                headers: gsAuthHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
                body: url.slice(qIdx + 1),
              })
          const json = await res.json()
          const features: { properties: Record<string, unknown> }[] = json.features ?? []
          if (features.length > 0) {
            setPopup({ layer: id, properties: features[0].properties ?? {}, position: { x: pixel[0], y: pixel[1] } })
            break
          }
        } catch (err) {
          logger.warn('feature click query failed', { layer: id, error: String(err) })
        }
      }
    })

    olMap.current = map
    return () => {
      cesium3D.current?.destroy()
      cesium3D.current = null
      map.setTarget(undefined)
      olMap.current = null
      wmsLayers.current = {}
      wmsLayersAdded.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fullscreen горим сольсны дараа OL-д контейнерийн шинэ хэмжээг мэдэгдэнэ (өөрөө анзаардаггүй)
  useEffect(() => {
    const raf = requestAnimationFrame(() => olMap.current?.updateSize())
    return () => cancelAnimationFrame(raf)
  }, [isFullscreen])

  /* ── 3D сонголт: одоогийн 2D харагдацыг (ямар ч шүүлтүүр/зумтай байсан) камерын
     эхлэлийн байршил, хязгаар болгож Cesium-ийг идэвхжүүлнэ. Давхарга/шүүлтүүрийн
     логикт нөлөөгүй — зөвхөн харагдацын горим сольж байгаа юм. ── */
  const handleSelectMode = useCallback(async (mode: "2d" | "3d") => {
    setMapMode(mode)
    if (mode === "2d") {
      cesium3D.current?.setEnabled(false)
      return
    }
    if (cesium3D.current) {
      cesium3D.current.setEnabled(true)
      return
    }
    const map = olMap.current
    if (!map) return
    setLoading3D(true)
    try {
      const view = map.getView()
      const size = map.getSize()
      const extent3857 = size ? view.calculateExtent(size) : undefined
      if (!extent3857) return
      const extentSize = Math.max(extent3857[2] - extent3857[0], extent3857[3] - extent3857[1])
      const paddedExt = bufferExtent(extent3857, extentSize)

      // 3D (Cesium) горимд зөвхөн энэ хүрээгээр tile татаж, дэлхий даяар render хийхээс
      // сэргийлнэ. Үгүй бол olcs 11 WMS давхарга тус бүрийг whole-world tiling scheme-ээр
      // sync хийж, dev proxy-г tile хүсэлтээр дүүргэж, зэрэгцээ dashboard API дуудлагыг
      // (жишээ нь "Харах" дарахад) 30с timeout хүртэл түгжиж, /server-error рүү шидэж байсан.
      Object.values(wmsLayers.current).forEach((layer) => layer.set("olcs_extent", paddedExt))

      const [west, south] = toLonLat([paddedExt[0], paddedExt[1]])
      const [east, north] = toLonLat([paddedExt[2], paddedExt[3]])
      const [lon, lat] = toLonLat(getExtentCenter(extent3857))
      cesium3D.current = await activateCesium3D({
        map,
        center: { lon, lat },
        range: Math.min(Math.max(extentSize * 0.8, 300), 30000),
        bounds: { west, south, east, north },
      })
    } finally {
      setLoading3D(false)
    }
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
      if (id === 'v_acquisition_plan')
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
        // Хүрээг чөлөөлөлтийн ГЕОМЕТРЭЭР олно (v_acquisition_boundary нь
        // давхаргын жагсаалтаас хасагдсан ч GeoServer дээр хэвээр байгаа).
        // Хуучин бүртгэлд plan_geom хоосон байж болох тул geometry-г сонгов.
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
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-white dark:bg-[#1e1f27] ${isFullscreen ? "" : "rounded-lg"}`}
    >
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel
        layers={panelLayers}
        groups={[PARCEL_GROUP]}
        onToggle={handleToggle}
      />
      <div className="absolute top-3 left-3 z-10 flex h-9 items-center overflow-hidden rounded-lg bg-white/90 shadow-sm dark:bg-[#252630]/90">
        <button
          type="button"
          onClick={() => void handleSelectMode("2d")}
          className={`flex h-full items-center gap-1.5 px-3 text-[12px] font-semibold transition-colors ${
            mapMode === "2d"
              ? "bg-[#02c0ce] text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#2d2f3d]"
          }`}
        >
          <MapIcon className="h-4 w-4" />
          2D
        </button>
        <button
          type="button"
          onClick={() => void handleSelectMode("3d")}
          disabled={loading3D}
          className={`flex h-full items-center gap-1.5 px-3 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
            mapMode === "3d"
              ? "bg-[#02c0ce] text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#2d2f3d]"
          }`}
        >
          <Box className="h-4 w-4" />
          {loading3D ? "Ачаалж байна..." : "3D"}
        </button>
      </div>
      <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
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
