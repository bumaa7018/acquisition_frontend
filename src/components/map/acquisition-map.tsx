"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { buffer as bufferExtent, getCenter as getExtentCenter } from "ol/extent";
import WKT from "ol/format/WKT";
import { Fill, Stroke, Style } from "ol/style";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { Box, Map as MapIcon } from "lucide-react";
import type { AU, BoundaryHistory } from "@/types";
import { PARCEL_STATUS_STYLES, PARCEL_STATUS_NAME_STYLES } from "@/types";
import { landApi } from "@/lib/api";
import LayerPanel, { type LayerConfig, type LayerGroupConfig } from "./layer-panel";
import FullscreenButton from "./fullscreen-button";
import { useFullscreen } from "./use-fullscreen";
import { fitLayerToMap, layerDef, type MapLayerDef } from "./layers";
import { GS_WMS, GS_WFS, wmsPostLoad, buildCodeCql } from "@/lib/geoserver";
import { activateCesium3D, type Cesium3DHandle, type Cesium3DBounds, type Cesium3DParcel } from "./cesium-3d";

const PARCEL_STATUS_NAMES = Object.keys(PARCEL_STATUS_NAME_STYLES);

// Дашбоардтай ижил: нэгж талбарыг төлөв тус бүрээр (v_parcel_s0..s5) тусад нь сонгож харна
const PARCEL_STATUS_IDS = ["v_parcel_s0", "v_parcel_s1", "v_parcel_s2", "v_parcel_s3", "v_parcel_s4", "v_parcel_s5"] as const;
const PARCEL_GROUP: LayerGroupConfig = { id: "parcel_status", label: "Нэгж талбарын хил", color: "#22c55e" };

function parcelStatusFromLayerId(id: string): number | null {
  const idx = PARCEL_STATUS_IDS.indexOf(id as (typeof PARCEL_STATUS_IDS)[number]);
  return idx === -1 ? null : idx;
}

// Polygon/MultiPolygon GeoJSON геометрийн зөвхөн ГАДНА талын (exterior) ring-үүдийг гаргаж авна
function extractExteriorRings(geometry: { type?: string; coordinates?: unknown } | undefined): [number, number][][] {
  if (!geometry?.coordinates) return [];
  if (geometry.type === "Polygon") {
    return [(geometry.coordinates as [number, number][][])[0]];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as [number, number][][][]).map((poly) => poly[0]);
  }
  return [];
}

// Cesium-ийн bbox бодохгүй тохиолдолд (WFS алдаатай) ашиглах Монгол улсын ойролцоо хязгаар
const MONGOLIA_FALLBACK_BOUNDS: Cesium3DBounds = { west: 87, south: 41, east: 120, north: 52 };

// GeoServer-ийн энэ instance GeoJSON геометрт "bbox" талбар оруулдаггүй тул coordinates-аас өөрөө тооцно
function computeBboxFromGeoJson(geometry: { coordinates?: unknown } | undefined): [number, number, number, number] | undefined {
  if (!geometry?.coordinates) return undefined;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      if (typeof node[0] === "number" && typeof node[1] === "number") {
        const [x, y] = node as [number, number];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      } else {
        node.forEach(walk);
      }
    }
  };
  walk(geometry.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : undefined;
}

type CqlKey = "acquisition" | "au1" | "au2" | "au3";

const LAYER_DEFS: (MapLayerDef & {
  defaultVisible: boolean;
  cqlKey?: CqlKey;
})[] = [
  { ...layerDef("au1"), defaultVisible: false, cqlKey: "au1" },
  { ...layerDef("au2"), defaultVisible: false, cqlKey: "au2" },
  { ...layerDef("au3"), defaultVisible: false, cqlKey: "au3" },
  { ...layerDef("v_acquisition_plan"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_acquisition_boundary"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s0"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s1"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s2"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s3"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s4"), defaultVisible: true, cqlKey: "acquisition" },
  { ...layerDef("v_parcel_s5"), defaultVisible: true, cqlKey: "acquisition" },
];

/**
 * Дроны ортофотогийн давхцуулалт. Зураг тус бүр GeoServer дээр ӨӨРИЙН
 * давхаргатай тул шүүлтүүр шаардахгүй — давхаргын нэрээрээ шууд дуудна.
 */
export type DroneOverlay = {
  id: string;
  layerName: string;
  /**
   * Зургийн WGS84 хүрээ [minX, minY, maxX, maxY] — ЗААВАЛ.
   *
   * Яагаад: мозайк нь өөр өөр CRS-тэй granule агуулах үед (HeterogeneousCRS)
   * GeoServer нь granule БАЙХГҮЙ хэсэгт тунгалаг биш ХАР пиксел буцаадаг
   * (BackgroundValues, OutputTransparentColor, FootprintBehavior аль нь ч
   * үүнийг зассангүй). Давхаргад extent тавьснаар OpenLayers зургийн ГАДНА
   * талыг хэзээ ч зурахгүй болж, газрын зураг харлахаас сэргийлнэ.
   */
  extent: [number, number, number, number];
};

// Ортофото нь вектор хилүүдийн ДООР байх ёстой (хил дарагдахгүй).
const DRONE_Z_INDEX = 5;

/**
 * WGS84 хүрээ бодит талбай эзэлж байгааг шалгана.
 *
 * Хүчингүй хүрээг OpenLayers-т өгвөл view-ийн resolution NaN болж, газрын
 * зураг ЦАГААН болоод хязгааргүй хүсэлтийн эргэлтэд ордог. Тиймээс extent
 * болон fit хоёуланд нь эндээс өнгөрсөн хүрээг л хэрэглэнэ.
 */
function isValidLonLatExtent(e: [number, number, number, number]): boolean {
  const [minX, minY, maxX, maxY] = e;
  return (
    e.every(Number.isFinite) &&
    Math.abs(minX) <= 180 &&
    Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 &&
    Math.abs(maxY) <= 90 &&
    minX < maxX &&
    minY < maxY
  );
}

interface Props {
  acquisitionId: string;
  aus?: AU[];
  /** Харагдах дроны зургууд — хоосон бол давхарга нэмэгдэхгүй */
  droneOverlays?: DroneOverlay[];
  /** [minX, minY, maxX, maxY] WGS84 — өөрчлөгдөх бүрд тэр хүрээ рүү нүүнэ */
  droneFocus?: [number, number, number, number] | null;
}

export function AcquisitionMap({
  acquisitionId,
  aus: ausProp,
  droneOverlays,
  droneFocus,
}: Props) {
  // API заримдаа aus талбарыг undefined биш null-ээр буцаадаг тул destructuring default
  // (aus = []) ажиллахгүй — 'null' үед ч тогтвортой хоосон array болгож хамгаална
  const aus = useMemo(() => ausProp ?? [], [ausProp]);
  const mapRef      = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const olMap       = useRef<OLMap | null>(null);
  const wmsLayers   = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const historyLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  // Дроны ортофото — зургийн id-аар индексжсэн ImageWMS давхаргууд
  const droneLayers = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const wktFormat   = useRef(new WKT());
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  // 3D (cesium-3d.ts): OL давхаргуудыг globe дээр давхарлана, зөвхөн хэрэглэгч сонгоход л ачаална
  const cesium3D    = useRef<Cesium3DHandle | null>(null);
  const cesium3DParcels = useRef<Cesium3DParcel[]>([]);
  const cesium3DInfo = useRef<{ center: { lon: number; lat: number }; range: number; bounds: Cesium3DBounds }>({
    center: { lon: 104.9, lat: 47.9 },
    range: 500000,
    bounds: MONGOLIA_FALLBACK_BOUNDS,
  });
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [extentReady, setExtentReady] = useState(false);
  const [loading3D, setLoading3D] = useState(false);

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      visible: d.defaultVisible,
      group: d.group,
    })),
  );
  const [visibleHistoryIds, setVisibleHistoryIds] = useState<Set<string>>(() => new Set());

  const { data: boundaryHistory = [] } = useQuery({
    queryKey: ["land-boundary-history", acquisitionId],
    queryFn: () => landApi.getBoundaryHistory(acquisitionId),
    enabled: !!acquisitionId,
  });

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  // Аймаг/сум/баг-ийн давхаргууд Монгол даяар биш, зөвхөн энэ чөлөөлөлттэй давхцаж буй
  // нэгжүүдийг л харуулна (Давхцаж буй нутаг дэвсгэр хэсгийн au1/au2/au3_code-ууд)
  const auCodes = useMemo(
    () => ({
      au1: Array.from(new Set(aus.map((a) => a.au1_code))),
      au2: Array.from(new Set(aus.map((a) => a.au2_code))),
      au3: Array.from(new Set(aus.map((a) => a.au3_code))),
    }),
    [aus],
  );
  const cqlByKey = useMemo<Record<CqlKey, string>>(
    () => ({
      acquisition: acqFilter,
      au1: buildCodeCql(auCodes.au1, "code"),
      au2: buildCodeCql(auCodes.au2, "code"),
      au3: buildCodeCql(auCodes.au3, "code"),
    }),
    [acqFilter, auCodes],
  );

  const makeHistoryLayer = useCallback((history: BoundaryHistory) => {
    const features = [];
    if (history.old_geometry_wkt) {
      const oldFeature = wktFormat.current.readFeature(history.old_geometry_wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      oldFeature.set("boundary_kind", "old");
      features.push(oldFeature);
    }
    if (history.new_geometry_wkt) {
      const newFeature = wktFormat.current.readFeature(history.new_geometry_wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      newFeature.set("boundary_kind", "new");
      features.push(newFeature);
    }

    return new VectorLayer({
      source: new VectorSource({ features }),
      zIndex: 100,
      style: (feature) => {
        const isOld = feature.get("boundary_kind") === "old";
        return new Style({
          stroke: new Stroke({
            color: isOld ? "#ef4444" : "#02c0ce",
            width: isOld ? 2 : 3,
            lineDash: isOld ? [8, 6] : undefined,
          }),
          fill: new Fill({
            color: isOld ? "rgba(239, 68, 68, 0.08)" : "rgba(2, 192, 206, 0.10)",
          }),
        });
      },
    });
  }, []);

  const toggleHistory = useCallback(
    (history: BoundaryHistory) => {
      const map = olMap.current;
      if (!map) return;

      if (historyLayers.current[history.id]) {
        map.removeLayer(historyLayers.current[history.id]);
        delete historyLayers.current[history.id];
        setVisibleHistoryIds((prev) => {
          const next = new Set(prev);
          next.delete(history.id);
          return next;
        });
        return;
      }

      const layer = makeHistoryLayer(history);
      historyLayers.current[history.id] = layer;
      map.addLayer(layer);
      setVisibleHistoryIds((prev) => new Set(prev).add(history.id));

      const extent = layer.getSource()?.getExtent();
      if (extent) {
        map.getView().fit(extent, { padding: [56, 56, 56, 56], maxZoom: 17, duration: 500 });
      }
    },
    [makeHistoryLayer],
  );

  const handleToggle = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, visible: !l.visible };

          const status = parcelStatusFromLayerId(id);
          if (status !== null) {
            // 3D идэвхтэй үед WMS раст давхаргыг Cesium-ийн 3D хашаа/шошготой давхцахаас
            // сэргийлж нуусан хэвээр байлгаад, зөвхөн Cesium-ийн entity-г (status-аар) удирдана
            if (mapMode === "2d") {
              wmsLayers.current[id]?.setVisible(next.visible);
            } else {
              cesium3D.current?.setStatusVisible(status, next.visible);
            }
            return next;
          }

          wmsLayers.current[id]?.setVisible(next.visible);
          const def = LAYER_DEFS.find((d) => d.id === id);
          if (next.visible && def && olMap.current) {
            void fitLayerToMap({
              map: olMap.current,
              wfsUrl: GS_WFS,
              layerId: def.id,
              cqlFilter: def.cqlKey ? cqlByKey[def.cqlKey] : undefined,
              padding: [56, 56, 56, 56],
              maxZoom: 17,
            });
          }
          return next;
        }),
      );
    },
    [cqlByKey, mapMode],
  );

  const handleSelectMode = useCallback(async (mode: "2d" | "3d") => {
    if (mode === "3d" && !extentReady) return;
    setMapMode(mode);

    const statusVisibility: Record<number, boolean> = {};
    PARCEL_STATUS_IDS.forEach((id, status) => {
      statusVisibility[status] = layers.find((l) => l.id === id)?.visible ?? true;
    });

    if (mode === "2d") {
      cesium3D.current?.setEnabled(false);
      PARCEL_STATUS_IDS.forEach((id, status) => {
        wmsLayers.current[id]?.setVisible(statusVisibility[status]);
      });
      return;
    }

    // 3D-д WMS раст давхаргыг (v_parcel_sX) нуугаад зөвхөн Cesium-ийн entity-г харуулна —
    // ижил төлвийн талбайг хоёр удаа (WMS + entity) давхарлан зурахаас сэргийлнэ
    PARCEL_STATUS_IDS.forEach((id) => wmsLayers.current[id]?.setVisible(false));

    if (cesium3D.current) {
      cesium3D.current.setEnabled(true);
      PARCEL_STATUS_IDS.forEach((_id, status) => cesium3D.current?.setStatusVisible(status, statusVisibility[status]));
      return;
    }
    const map = olMap.current;
    if (!map) return;
    setLoading3D(true);
    try {
      cesium3D.current = await activateCesium3D({
        map,
        ...cesium3DInfo.current,
        parcels: cesium3DParcels.current,
        statusVisibility,
      });
    } finally {
      setLoading3D(false);
    }
  }, [extentReady, layers]);

  useEffect(() => {
    if (!mapRef.current || olMap.current || !acquisitionId) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};
    LAYER_DEFS.forEach((d) => {
      const cql = d.cqlKey ? cqlByKey[d.cqlKey] : undefined;
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: 0.8,
        zIndex: d.zIndex,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${d.id}`,
            FORMAT: "image/png",
            TRANSPARENT: true,
            ...(cql ? { CQL_FILTER: cql } : {}),
          },
          ratio: 1,
          serverType: "geoserver",
          imageLoadFunction: wmsPostLoad,
        }),
      });
    });
    wmsLayers.current = wmsRecord;

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
        ...LAYER_DEFS.map((d) => wmsRecord[d.id]),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 20,
      }),
    });

    olMap.current = map;

    const params = new URLSearchParams({
      service: "WFS",
      version: "1.1.0",
      request: "GetFeature",
      typeName: "land:v_acquisition_boundary",
      CQL_FILTER: acqFilter,
      outputFormat: "application/json",
      propertyName: "geometry",
      maxFeatures: "1",
    });
    fetch(GS_WFS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
      .then((r) => r.json())
      .then((json) => {
        const geometry = json?.features?.[0]?.geometry;
        const bbox: number[] | undefined =
          geometry?.bbox ?? json?.bbox ?? computeBboxFromGeoJson(geometry);
        if (bbox?.length === 4) {
          const ext = transformExtent(bbox, "EPSG:4326", "EPSG:3857");

          // 3D (Cesium) горимд зөвхөн энэ хүрээгээр tile татаж, дэлхий даяар render хийхээс сэргийлнэ.
          // olcs "olcs_extent" property-г уншдаг тул OL-ийн бодит extent (2D зурагт нөлөөгүй) дээр нөлөөлдөггүй.
          const size = Math.max(ext[2] - ext[0], ext[3] - ext[1]);
          const paddedExt = bufferExtent(ext, size * 2);
          Object.values(wmsRecord).forEach((layer) => layer.set("olcs_extent", paddedExt));

          const [west, south] = toLonLat([paddedExt[0], paddedExt[1]]);
          const [east, north] = toLonLat([paddedExt[2], paddedExt[3]]);
          const [lon, lat] = toLonLat(getExtentCenter(ext));
          cesium3DInfo.current = {
            center: { lon, lat },
            range: Math.min(Math.max(size * 1.3, 300), 8000),
            bounds: { west, south, east, north },
          };

          map.getView().fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 500 });
        }
        setExtentReady(true);
      })
      .catch(() => { setExtentReady(true); /* Монгол улсын өргөн хязгаараар үргэлжлүүлнэ */ });

    // Тухайн чөлөөлөлтийн нэгж талбарууд — 3D-ийн хашаа/шошгонд зориулж бүх төлвийг татна
    const parcelParams = new URLSearchParams({
      service: "WFS",
      version: "1.1.0",
      request: "GetFeature",
      typeName: "land:v_parcel_acquisition",
      CQL_FILTER: acqFilter,
      outputFormat: "application/json",
      propertyName: "geometry,parcel_id,status",
    });
    fetch(`${GS_WFS}?${parcelParams.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        const cesiumParcels: Cesium3DParcel[] = [];
        (json?.features ?? []).forEach((f: { id?: string; properties?: { parcel_id?: string; status?: number }; geometry?: { type?: string; coordinates?: unknown } }) => {
          const status = f.properties?.status ?? 0;
          const style = PARCEL_STATUS_STYLES[status] ?? PARCEL_STATUS_STYLES[0];
          const statusLabel = PARCEL_STATUS_NAMES[status] ?? "";
          extractExteriorRings(f.geometry).forEach((ring, i) => {
            cesiumParcels.push({
              id: `${f.properties?.parcel_id ?? f.id ?? "parcel"}-${i}`,
              status,
              color: style.color,
              statusLabel,
              ring,
            });
          });
        });
        cesium3DParcels.current = cesiumParcels;
        cesium3D.current?.setParcels(cesiumParcels);
      })
      .catch(() => { /* нэгж талбарын 3D давхарга хоосон үлдэнэ */ });

    return () => {
      cesium3D.current?.destroy();
      cesium3D.current = null;
      map.setTarget(undefined);
      olMap.current = null;
      historyLayers.current = {};
    };
  }, [acqFilter, acquisitionId, cqlByKey]);

  // Fullscreen горим сольсны дараа OL-д контейнерийн шинэ хэмжээг мэдэгдэнэ (өөрөө анзаардаггүй)
  useEffect(() => {
    const raf = requestAnimationFrame(() => olMap.current?.updateSize());
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen]);

  // ── Дроны ортофотогийн давхаргууд ─────────────────────────────────────────
  // Сонгогдсон зураг тус бүрд ImageWMS давхарга нэмж, сонголтоос хасагдсаныг
  // устгана. Газрын зургийг бүхэлд нь дахин барихгүй — зөвхөн зөрүүг нөхнө.
  useEffect(() => {
    const map = olMap.current;
    if (!map) return;

    const wanted = droneOverlays ?? [];
    const wantedIds = new Set(wanted.map((o) => o.id));

    // Сонголтоос хасагдсаныг зурагнаас авна
    Object.entries(droneLayers.current).forEach(([id, layer]) => {
      if (wantedIds.has(id)) return;
      map.removeLayer(layer);
      delete droneLayers.current[id];
    });

    // Шинээр сонгогдсоныг нэмнэ
    wanted.forEach((overlay) => {
      if (droneLayers.current[overlay.id]) return;
      // Хүчингүй хүрээтэй давхарга нэмбэл газрын зураг эвдэрнэ — өнгөрөөнө.
      if (!isValidLonLatExtent(overlay.extent)) return;
      const layer = new ImageLayer({
        zIndex: DRONE_Z_INDEX,
        // Зөвхөн зургийн хүрээн дотор зурна (дээрх тайлбарыг үзнэ үү)
        extent: transformExtent(overlay.extent, "EPSG:4326", "EPSG:3857"),
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: overlay.layerName,
            FORMAT: "image/png",
            TRANSPARENT: true,
          },
          ratio: 1,
          serverType: "geoserver",
          imageLoadFunction: wmsPostLoad,
        }),
      });
      droneLayers.current[overlay.id] = layer;
      map.addLayer(layer);
    });
  }, [droneOverlays, extentReady]);

  // Компонент устахад дроны давхаргуудыг цэвэрлэнэ
  useEffect(
    () => () => {
      droneLayers.current = {};
    },
    [],
  );

  // "Харах"/"Зураг дээр очих" — сонгосон ортофотогийн хүрээ рүү нүүнэ.
  //
  // extentReady-г хамаарал болгосон нь санамсаргүй биш: газрын зураг ачаалахдаа
  // чөлөөлөлтийн хүрээ рүү өөрөө нүүж, ДАРАА нь extentReady=true болгодог.
  // Хэрэв хэрэглэгч тэр хооронд "Харах" дарвал дроны fit нь дарагдана — иймд
  // extentReady болмогц дахин fit хийж, дроны зураг рүү шилжсэн хэвээр байлгана.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !droneFocus) return;
    if (!isValidLonLatExtent(droneFocus)) return;
    const [minX, minY, maxX, maxY] = droneFocus;
    map.getView().fit(
      transformExtent([minX, minY, maxX, maxY], "EPSG:4326", "EPSG:3857"),
      { padding: [40, 40, 40, 40], duration: 400, maxZoom: 20 },
    );
  }, [droneFocus, extentReady]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        {boundaryHistory.length > 0 && (
          <div className="w-full lg:w-56 shrink-0">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
              Хилийн өөрчлөлт
            </p>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {boundaryHistory.map((history, index) => {
                const visible = visibleHistoryIds.has(history.id);
                return (
                  <div
                    key={history.id}
                    className="rounded-lg border border-slate-100 dark:border-[#37394d] bg-slate-50 dark:bg-[#252630] p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                          #{boundaryHistory.length - index}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(history.changed_at).toLocaleString("mn-MN")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleHistory(history)}
                        className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                          visible
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20"
                        }`}
                      >
                        {visible ? "Нуух" : "Харах"}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-0.5 w-4 border-t-2 border-dashed border-red-500" />
                        Хуучин
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-0.5 w-4 rounded bg-[#02c0ce]" />
                        Шинэ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <div
            ref={containerRef}
            className={`relative w-full overflow-hidden bg-white dark:bg-[#1e1f27] ${
              isFullscreen ? "" : "rounded-xl border border-slate-200 dark:border-[#37394d]"
            }`}
            style={isFullscreen ? undefined : { height: 480 }}
          >
            <div ref={mapRef} className="h-full w-full" />
            <LayerPanel layers={layers} groups={[PARCEL_GROUP]} onToggle={handleToggle} />
            <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
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
                disabled={loading3D || !extentReady}
                title={!extentReady ? "Байршлын мэдээлэл бэлтгэгдэж байна..." : undefined}
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
          </div>
        </div>
      </div>

      {Array.isArray(aus) && aus.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Байршил
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {aus.map((au) => (
              <div
                key={au.au3_code}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#252630] border border-slate-100 dark:border-[#37394d]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {au.au3_name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {au.au2_name} · {au.au1_name}
                    </p>
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
  );
}
