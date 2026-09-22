"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { defaults as defaultControls } from "ol/control/defaults";
import { fromLonLat, toLonLat } from "ol/proj";
import { buffer as bufferExtent, getCenter as getExtentCenter } from "ol/extent";
import type { Coordinate } from "ol/coordinate";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { Box, Map as MapIcon } from "lucide-react";

import LayerPanel, { LayerConfig, LayerGroupConfig } from './layer-panel'
import { createBasemapLayer, watchBasemap } from './basemap'
import FeaturePopup from './feature-popup'
import ParcelInfoModal from './parcel-info-modal'
import GusInfoModal, { type GusFeatureProps } from './gus-info-modal'
import AcquisitionInfoModal, {
  toAcquisitionFeatureProps,
  type AcquisitionFeatureProps,
} from './acquisition-info-modal'
import FullscreenButton from './fullscreen-button'
import { useFullscreen } from './use-fullscreen'
import { useParcelStatusLayers } from './use-parcel-status-layers'
import {
  fitLayerToMap,
  shouldFitOnEnable,
  layerDef,
  geoServerName,
  staticLayerStyle,
  combineCql,
  parcelStatusIdFromLayer,
  PARCEL_STATUS_DEFAULT_COLOR,
  AGREED_GROUP,
  AGREED_GROUP_ID,
  AGREED_CODE_LAYER_IDS,
  SEC_GROUP,
  SEC_GROUP_ID,
  SEC_CODE_LAYER_IDS,
  type MapLayerDef,
  type MapLayerId,
} from './layers'
import { GS_WMS, GS_WFS, wmsPostLoad, buildAcqCql, buildParcelStatusCql, buildCodeCql, gsAuthHeaders } from '@/lib/geoserver'
import { logger } from '@/lib/logger'
import { activateCesium3D, type Cesium3DHandle } from './cesium-3d'

const STATIC_LAYER_DEFS: MapLayerDef[] = [
  layerDef('au1'),
  layerDef('au2'),
  layerDef('au3'),
  layerDef('v_acquisition_plan'),
  // Нэгж талбарын ТӨЛӨВИЙН давхаргууд ЭНД БАЙХГҮЙ — `parcel_status`
  // бүртгэлээс асинхроноор ирж, доорх `layerDefs` мемод яг энэ байрлалд
  // орно. Шинэ төлөв нэмэхэд энэ файлд гар хүрэхгүй.
  // ГУС-ийн лавлах давхаргууд — жагсаалтын ЭЦЭСТ, анхнаасаа УНТРААЛТТАЙ.
  // "Шинэ зөвшилцсөн зураг" нь ӨӨРӨӨ биш, `code`-оор задарсан ДЭД
  // давхаргуудаараа орно (нэг хэсэг дор, тус тусад нь асаах боломжтой).
  ...AGREED_CODE_LAYER_IDS.map(layerDef),
  // "Хамгаалалтын зурвас" мөн адил `code`-оор задарсан дэд давхаргуудаараа орно.
  ...SEC_CODE_LAYER_IDS.map(layerDef),
]

// Төлөвийн давхаргууд нь ДИНАМИК тул тогтмол жагсаалт байхгүй — id-гаар нь
// (`v_parcel_s<N>`) танина.
const isParcelStatusLayer = (id: string) => parcelStatusIdFromLayer(id) !== null
// Нэгж талбарын давхаргад дарвал ЖИЖИГ popup биш, ДЭЛГЭРЭНГҮЙ цонх нээнэ.
const isParcelInfoLayer = (id: string) =>
  isParcelStatusLayer(id) || id === 'v_parcel_acquisition'
// ГУС-ийн дэд давхаргууд (зөвшилцсөн зураг, хамгаалалтын зурвас) — мөн
// ДЭЛГЭРЭНГҮЙ цонхтой (жижиг popup биш).
const GUS_INFO_LAYERS = new Set<string>([...AGREED_CODE_LAYER_IDS, ...SEC_CODE_LAYER_IDS])

// Хилийн давхаргууд — дарвал ЧӨЛӨӨЛӨЛТИЙН мэдээллийн цонх нээнэ.
const BOUNDARY_INFO_LAYERS: Record<string, string> = {
  v_acquisition_plan: "Төлөвлөгөөний хил",
  v_plan_acquisition: "Үндсэн төлөвлөлтийн хил",
  v_acquisition_boundary: "Чөлөөлөх бүсийн хил",
};
// Чөлөөлөлт/он/ажилтнаар ШҮҮГДДЭГ давхаргууд.
const isAcquisitionFiltered = (id: string) =>
  isParcelStatusLayer(id) || id === 'v_acquisition_plan'

// Чөлөөлөлтийн хил нь төлөвлөгөөний хилээс хуулагддаг тул давхаргын хэсэгт
// зөвхөн ТӨЛӨВЛӨГӨӨНИЙ хил үлдсэн — тэр нь анхнаасаа асаалттай.
// Засаг захиргааны хил (аймаг/сум/хороо) нь ШУУД харагдана — байршлаа
// тогтооход хэрэгтэй лавлах давхарга тул хэрэглэгч бүрд гараар асаах
// шаардлагагүй. Давхаргын самбараас унтраах боломжтой хэвээр.
// Анхнаасаа АСААЛТТАЙ давхаргууд. Төлөвийнх нь бүгд асаалттай (id-гаар танина).
const isDefaultVisible = (id: string) =>
  isParcelStatusLayer(id) ||
  id === 'au1' || id === 'au2' || id === 'au3' || id === 'v_acquisition_plan'


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
    STATIC_LAYER_DEFS.map(d => ({ id: d.id, label: d.label, color: d.color, visible: isDefaultVisible(d.id), group: d.group, hatch: d.hatch }))
  )
  const [popup,   setPopup]   = useState<PopupState | null>(null)
  // Нэгж талбарын дэлгэрэнгүй цонх — GeoServer-ийн `id` (parcel UUID) ба
  // `acquisition_id`-аар нээгдэнэ.
  const [parcelInfo, setParcelInfo] = useState<{ acquisitionId: string; parcelUuid: string } | null>(null)
  const [acqInfo, setAcqInfo] = useState<{
    acquisitionId: string
    layerLabel: string
    layerColor: string
    fallback?: AcquisitionFeatureProps
  } | null>(null)
  // ГУС-ийн давхаргын дэлгэрэнгүй — GeoServer-ийн шинжүүдээр л бүрдэнэ.
  const [gusInfo, setGusInfo] = useState<{
    layerId: string
    properties: GusFeatureProps
  } | null>(null)
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d")
  const [loading3D, setLoading3D] = useState(false)

  // Нэгж талбарын ТӨЛӨВИЙН давхаргууд — `parcel_status` бүртгэлээс (асинхрон).
  const { defs: statusLayerDefs } = useParcelStatusLayers()

  /** Тогтмол давхаргууд + бүртгэлээс ирсэн төлөвүүд (ГУС-ийн бүлгүүдийн ӨМНӨ). */
  const layerDefs = useMemo(() => {
    const cut = STATIC_LAYER_DEFS.findIndex(
      d => d.group === AGREED_GROUP_ID || d.group === SEC_GROUP_ID,
    )
    const at = cut === -1 ? STATIC_LAYER_DEFS.length : cut
    return [
      ...STATIC_LAYER_DEFS.slice(0, at),
      ...statusLayerDefs,
      ...STATIC_LAYER_DEFS.slice(at),
    ]
  }, [statusLayerDefs])

  const layerDefsRef = useRef(layerDefs)
  layerDefsRef.current = layerDefs

  // Самбарын шүүлтийн СҮҮЛИЙН утга — давхарга асаахад зумлах эсэх, хүрээг
  // ямар шүүлтээр олохыг handleToggle эндээс уншина (шүүлтийн эффект шинэчилнэ).
  const scopeRef = useRef<{ active: boolean; acqCql: string; parcelCql: string }>({
    active: false,
    acqCql: '',
    parcelCql: '',
  })

  const makeWmsLayer = useCallback((id: string, visible: boolean, cqlFilter = '') => {
    // Давхаргын өөрийн opacity-г эрхэмлэнэ (нэгж талбарууд = 1, ингэснээр
    // SLD-ийн fill-opacity нь зурган дээр яг тэр хэмжээгээрээ гарна). Заагаагүй
    // давхаргууд өмнөх шигээ 0.75.
    const def = layerDefsRef.current.find(l => l.id === id)
    // Виртуал дэд давхарга (зөвшилцсөн зургийн кодууд) нь GeoServer дээр
    // байхгүй — тэдгээрийг ЭХ давхаргын нэрээр дуудаж, өөрсдийн тогтмол
    // шүүлтийг (code=NN) дуудагчийн шүүлттэй AND-ээр нэгтгэнэ.
    const cql = combineCql(def?.cql, cqlFilter)
    return new ImageLayer({
      visible,
      opacity: def?.opacity ?? 0.75,
      zIndex: def?.zIndex ?? 0,
      source: new ImageWMS({
        url: GS_WMS,
        params: {
          LAYERS: `land:${geoServerName(id as MapLayerId)}`,
          FORMAT: 'image/png',
          TRANSPARENT: true,
          // ӨНГӨ ЭНД ИЛГЭЭХГҮЙ: `v_parcel_status` харагдац нь `color` баганаа
          // өөрөө өгдөг ба SLD түүнийг `<PropertyName>color</PropertyName>`-ээр
          // шууд уншина. Хүсэлтээр дамжуулбал дуудагч тал бүр давтан илгээх
          // үүрэгтэй болж, мартвал тэр газартаа саарал зурагдана.
          ...(cql ? { CQL_FILTER: cql } : {}),
        },
        ratio: 1,
        serverType: 'geoserver',
        imageLoadFunction: wmsPostLoad,
      }),
    })
  }, [])

  /* ── Map init (once) — base tile layer only, no WMS ── */
  useEffect(() => {
    if (!mapRef.current || olMap.current) return

    const map = new OLMap({
      target: mapRef.current,
      // OL-ийн өгөгдмөл +/- товчийг нуув — томруулах/жижигрүүлэлт нь мөчлөг
      // (scroll) болон хос товшилтоор хэвээр ажиллана.
      controls: defaultControls({ zoom: false }),
      layers: [
        // СУУРЬ зураг — тохиргооноос (Тохиргоо → Суурь зураг). Тохируулаагүй
        // бол үндсэн суурь зураг (Google хиймэл дагуул). Хаяг солиход watchBasemap нь
        // зөвхөн энэ давхаргыг сольж, зургийг дахин үүсгэхгүй.
        createBasemapLayer(),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        // maxZoom заахгүй — зумлалтын дээд хязгаар байхгүй. Суурь зургийн
        // XYZ эх сурвалж 20-д зогсох тул түүнээс цааш z20-ийн тайлууд
        // томсгож (бүдэг) харагдана, WMS давхаргууд тод хэвээр.
      }),
    })

    map.on("singleclick", async (evt) => {
      const pixelCoord = evt.coordinate as Coordinate
      const viewRes    = map.getView().getResolution() ?? 1
      const projection = map.getView().getProjection()
      const pixel      = evt.pixel as [number, number]

      const visibleIds = layerDefsRef.current
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
            const props = features[0].properties ?? {}
            const acqId = String(props.acquisition_id ?? '')
            if (isParcelInfoLayer(id)) {
              const uuid = String(props.id ?? '')
              if (acqId && uuid) {
                setParcelInfo({ acquisitionId: acqId, parcelUuid: uuid })
                break
              }
            }
            // ГУС-ийн давхарга — ЖИЖИГ popup биш, ДЭЛГЭРЭНГҮЙ цонх (шинжүүд
            // аль хэдийн ирсэн тул нэмэлт хүсэлт шаардахгүй).
            if (GUS_INFO_LAYERS.has(id)) {
              setGusInfo({ layerId: id, properties: props })
              break
            }
            if (BOUNDARY_INFO_LAYERS[id] && acqId) {
              // GeoServer-ийн шинжүүдийг ХАМТ дамжуулна: дэлгэрэнгүйг татах
              // эрхгүй үед цонх нэр/төлөв/талбайгаа эндээс харуулна.
              setAcqInfo({
                acquisitionId: acqId,
                layerLabel: BOUNDARY_INFO_LAYERS[id],
                // BOUNDARY_INFO_LAYERS нь зөвхөн ХИЛИЙН давхаргуудыг
                // агуулна (төлөвийнх биш) тул тогтмол хүснэгтээс хайна.
                layerColor: staticLayerStyle(id)?.color ?? PARCEL_STATUS_DEFAULT_COLOR,
                fallback: toAcquisitionFeatureProps(props),
              })
              break
            }
            setPopup({ layer: id, properties: props, position: { x: pixel[0], y: pixel[1] } })
            break
          }
        } catch (err) {
          logger.warn('feature click query failed', { layer: id, error: String(err) })
        }
      }
    })

    olMap.current = map
    const stopBasemapWatch = watchBasemap(map)

    return () => {
      stopBasemapWatch()
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
    scopeRef.current = { active: hasFilter, acqCql, parcelCql }

    const getCql = (id: string): string => {
      if (isParcelStatusLayer(id))
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

    const map = olMap.current

    // Тодорхойлолтод байгаа боловч зурган дээр БАЙХГҮЙ давхаргыг нэмнэ.
    // Энэ нь НЭГ УДААГИЙН үйлдэл БИШ: төлөвийн давхаргууд бүртгэлээс хожим
    // (мөн админ шинэ төлөв нэмэхэд дахин) ирдэг тул эффект ажиллах бүрд
    // шинээр ирсэнийг нь нөхнө.
    const fresh = new Set<string>()
    layerDefs.forEach(d => {
      if (wmsLayers.current[d.id]) return
      const layer = makeWmsLayer(d.id, isDefaultVisible(d.id), getCql(d.id))
      wmsLayers.current[d.id] = layer
      map.addLayer(layer)
      fresh.add(d.id)
    })
    wmsLayersAdded.current = true

    // Бүртгэлээс ХАСАГДСАН төлөвийн давхаргыг зургаас авна.
    const live = new Set<string>(layerDefs.map(d => d.id))
    Object.keys(wmsLayers.current).forEach(id => {
      if (!isParcelStatusLayer(id) || live.has(id)) return
      map.removeLayer(wmsLayers.current[id])
      delete wmsLayers.current[id]
    })

    // Шүүлт нь өөрчлөгддөг давхаргуудын CQL-ийг шинэчилнэ. Дөнгөж үүсгэсэн
    // давхаргууд аль хэдийн зөв шүүлттэй тул давхар шинэчлэхгүй.
    Object.keys(wmsLayers.current).forEach(id => {
      if (fresh.has(id)) return
      if (!isAcquisitionFiltered(id) && id !== 'au1' && id !== 'au2' && id !== 'au3') return
      // Давхаргын ТОГТМОЛ шүүлтийг (төлөвийнх `status=N`) ЗААВАЛ хамт авна —
      // эс бөгөөс энэ шинэчлэлт түүнийг дарж бичиж, төлөв бүр БҮХ нэгж
      // талбарыг зурдаг болно (өнгө нь л өөр, дээд давхарга нь бусдыг халхална).
      const def = layerDefsRef.current.find(l => l.id === id)
      const merged = combineCql(def?.cql, getCql(id))
      wmsLayers.current[id]?.getSource()?.updateParams({ CQL_FILTER: merged || undefined })
    })

    // Самбарын жагсаалтыг тодорхойлолттой тааруулна — хэрэглэгчийн асаасан/
    // унтраасан сонголтыг ХАДГАЛНА.
    setLayers(prev => {
      const seen = new Map(prev.map(l => [l.id, l]))
      const next = layerDefs.map(d => {
        const cur = seen.get(d.id)
        return {
          id: d.id,
          label: d.label,
          color: d.color,
          visible: cur ? cur.visible : isDefaultVisible(d.id),
          group: d.group,
          hatch: d.hatch,
        }
      })
      const same =
        next.length === prev.length &&
        next.every((l, i) =>
          prev[i].id === l.id &&
          prev[i].visible === l.visible &&
          prev[i].label === l.label &&
          prev[i].color === l.color)
      return same ? prev : next
    })

    // Зумлалт нь acqCql-ээс ХАМААРАХГҮЙ: шүүлтгүй (эсвэл зөвхөн он/ажилтнаар
    // шүүсэн) үед ч олдсон чөлөөлөлтүүд рүү нь ойртоно. Өмнө нь `if (acqCql)`
    // байсан тул он сонгохгүй хайхад зураг Монгол даяарын анхны харагдацдаа
    // үлддэг байв. cqlFilter хоосон бол fitLayerToMap нь бүх чөлөөлөлтийн
    // хүрээгээр (max 500 объект) багтаана.
    if (olMap.current) {
      void fitLayerToMap({
        map: olMap.current,
        wfsUrl: GS_WFS,
        // Хүрээг чөлөөлөлтийн ГЕОМЕТРЭЭР олно (v_acquisition_boundary нь
        // давхаргын жагсаалтаас хасагдсан ч GeoServer дээр хэвээр байгаа).
        // Хуучин бүртгэлд plan_geom хоосон байж болох тул geometry-г сонгов.
        layerId: 'v_acquisition_boundary',
        cqlFilter: acqCql || undefined,
        padding: [48, 48, 48, 48],
        // maxZoom заахгүй — хиймэл хязгаар (өмнө нь 16) байхгүй, олдсон
        // хэсэг рүү бүрэн ойртоно.
      })
    }
  }, [acquisitionIds, years, au1Codes, au2Codes, au3Codes, filterPending, employeeId, makeWmsLayer, layerDefs])

  /* ── Layer toggle ── */
  const handleToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l
      const next = { ...l, visible: !l.visible }
      wmsLayers.current[id]?.setVisible(next.visible)
      const def = layerDefsRef.current.find(d => d.id === id)
      // Улс даяарын давхарга руу ЗУМЛАХГҮЙ (layer-config-ийн fitOnEnable-ийг үз):
      // WFS-ээр олон МБ татаж, зэрэг явж буй API дуудлагыг timeout-д унагаадаг.
      // Самбарын шүүлтээр хязгаарлагддаг давхарга (нэгж талбарын төлөв,
      // төлөвлөгөөний хил): шүүлт идэвхтэй бол зураг аль хэдийн сонголтондоо
      // багтсан тул ДАХИН ЗУМЛАХГҮЙ. Өмнө нь зөвхөн `status=N`-ээр зумладаг
      // байсан тул сонгосон төлөвлөгөөнөөс Монгол даяар холдож, "Нэгж талбарын
      // хил" бүлгийг дарахад төлөв бүрээр ээлжлэн ойртож/холдож байв.
      const scope = scopeRef.current
      const filtered = isAcquisitionFiltered(id)
      if (next.visible && def && olMap.current && shouldFitOnEnable(id) && !(filtered && scope.active)) {
        const scopeCql = !filtered ? '' : isParcelStatusLayer(id) ? scope.parcelCql : scope.acqCql
        void fitLayerToMap({
          map: olMap.current,
          wfsUrl: GS_WFS,
          layerId: geoServerName(def.id),
          cqlFilter: combineCql(def.cql, scopeCql) || undefined,
          padding: [64, 64, 64, 64],
        })
      }
      return next
    }))
    setPopup(null)
  }, [])

  const standaloneL = layers.filter(l => !l.group)
  const groupedL    = layers.filter(l => l.group === PARCEL_GROUP.id)
  const agreedL     = layers.filter(l => l.group === AGREED_GROUP.id)
  const secL        = layers.filter(l => l.group === SEC_GROUP.id)
  const panelLayers = [...standaloneL, ...groupedL, ...agreedL, ...secL]

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-white dark:bg-[#1e1f27] ${isFullscreen ? "" : "rounded-lg"}`}
    >
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel
        layers={panelLayers}
        groups={[PARCEL_GROUP, AGREED_GROUP, SEC_GROUP]}
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
      {parcelInfo && (
        <ParcelInfoModal
          acquisitionId={parcelInfo.acquisitionId}
          parcelUuid={parcelInfo.parcelUuid}
          onClose={() => setParcelInfo(null)}
        />
      )}
      {acqInfo && (
        <AcquisitionInfoModal
          acquisitionId={acqInfo.acquisitionId}
          layerLabel={acqInfo.layerLabel}
          layerColor={acqInfo.layerColor}
          fallback={acqInfo.fallback}
          onClose={() => setAcqInfo(null)}
        />
      )}
      {gusInfo && (
        <GusInfoModal
          layerId={gusInfo.layerId}
          properties={gusInfo.properties}
          onClose={() => setGusInfo(null)}
        />
      )}
    </div>
  )
}
