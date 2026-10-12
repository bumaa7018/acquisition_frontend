"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { defaults as defaultControls } from "ol/control/defaults";
import { fromLonLat } from "ol/proj";
import WKT from "ol/format/WKT";
import { Fill, Stroke, Style, Text } from "ol/style";
import { createEmpty, extend, isEmpty } from "ol/extent";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import LayerPanel, { type LayerConfig } from "./layer-panel";
import { createBasemapLayer, watchBasemap } from "./basemap";
import FullscreenButton from "./fullscreen-button";
import { useFullscreen } from "./use-fullscreen";
import {
  fitLayerToMap,
  shouldFitOnEnable,
  layerDef,
  geoServerName,
  combineCql,
  AGREED_GROUP,
  AGREED_CODE_LAYER_IDS,
  SEC_GROUP,
  SEC_CODE_LAYER_IDS,
  type MapLayerDef,
} from "./layers";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";
import { PARCEL_STATUS_INITIAL_ID, getParcelStatusStyle, type ParcelOverlap } from "@/types";
import { useParcelStatusColors } from "./use-parcel-status-layers";
import { logger } from "@/lib/logger";

const WMS_LAYER_DEFS: (MapLayerDef & {
  defaultVisible: boolean;
  cqlType?: "acquisition" | "parcel";
})[] = [
  // Засаг захиргааны хил — ШУУД харагдана (лавлах давхарга).
  { ...layerDef("au1"), defaultVisible: true },
  { ...layerDef("au2"), defaultVisible: true },
  { ...layerDef("au3"), defaultVisible: true },
  { ...layerDef("v_acquisition_plan"),     defaultVisible: true,  cqlType: "acquisition" },
  // ГУС-ийн (ЛМ) лавлах давхаргууд — `data_landuse` схемээс GeoServer шууд
  // уншина. `cqlType` БАЙХГҮЙ: чөлөөлөлт/нэгж талбарын багана агуулаагүй тул
  // шүүгдэхгүй, харагдаж буй хэсгээрээ л зурагдана.
  //
  // Анхнаасаа УНТРААЛТТАЙ: тухайн нэгж талбар хамгаалалтын зурваст орсон эсэх,
  // шинэ зөвшилцсөн хүрээтэй хэрхэн харьцаж байгааг ХАРАХ ҮЕДЭЭ асаана.
  //
  // "Шинэ зөвшилцсөн зураг" нь `code` баганаар задарсан ДЭД давхаргуудаараа
  // (AGREED_CODE_LAYERS) орно — самбарт нэг хэсэг дор нэрээрээ харагдана.
  ...AGREED_CODE_LAYER_IDS.map((id) => ({ ...layerDef(id), defaultVisible: false })),
  // "Хамгаалалтын зурвас" мөн адил дэд давхаргуудаараа (SEC_CODE_LAYERS) орно.
  ...SEC_CODE_LAYER_IDS.map((id) => ({ ...layerDef(id), defaultVisible: false })),
];

const VECTOR_LAYER_DEFS: MapLayerDef[] = [
  layerDef("v_parcel_acquisition"),
  layerDef("parcel"),
];

const ALL_LAYER_DEFS = [...WMS_LAYER_DEFS, ...VECTOR_LAYER_DEFS];

/**
 * Нэгж талбарын өнгө — `parcel_status` БҮРТГЭЛЭЭС.
 *
 * OpenLayers энэ функцийг объект зурах бүрд дуудна. Бүртгэл нь асинхроноор
 * ирдэг тул тогтмолоор биш, ref-ээр уншина: өнгө ирэхэд давхаргыг дахин
 * зурахад шинэ утга шууд хэрэгжинэ. Өмнө нь код дотор хатуу бичсэн хүснэгт
 * ашигладаг байсан тул бүртгэлд өнгө солиход энэ зураг хуучин өнгөтэй хоцордог байв.
 */
const statusColorRef: { current: Map<number, string> } = { current: new Map() };

/** "Нэгж талбар" — ҮНДСЭН давхарга: бүтэн нэгж талбарын хил, зөвхөн ТОД ХӨХ хүрээ. */
export const PARCEL_OUTLINE_COLOR = "#0062ff";
/** "Чөлөөлөх талбай" — нөлөөлөлтөд өртсөн хэсгийн дүүргэлтийн тунгалаг байдал. */
export const ACQUISITION_FILL_ALPHA = 0.2;

export function parcelStatusColor(statusId: number | null | undefined): string {
  return getParcelStatusStyle(statusColorRef.current.get(statusId ?? PARCEL_STATUS_INITIAL_ID)).color;
}

/** Нөлөөлөлтөд өртсөн хэсэг — ОДООГИЙН ТӨЛӨВИЙН өнгөөр, 20% дүүргэлт. */
function acquisitionStyle(feature: { get: (k: string) => unknown }): Style {
  const color = parcelStatusColor(feature.get("status_id") as number | undefined);
  const a = Math.round(ACQUISITION_FILL_ALPHA * 255).toString(16).padStart(2, "0");
  return new Style({
    stroke: new Stroke({ color, width: 2 }),
    fill:   new Fill({ color: `${color}${a}` }),
  });
}

const VECTOR_STYLES: Record<string, Style | ((f: { get: (k: string) => unknown }) => Style)> = {
  v_parcel_acquisition: new Style({
    stroke: new Stroke({ color: PARCEL_OUTLINE_COLOR, width: 2.5 }),
  }),
  parcel: acquisitionStyle,
};
/* Нөлөөлөлтийн дүүргэлт ДООР, нэгж талбарын хөх хүрээ ДЭЭР — өртсөн хэсэг
   хилтэйгээ давхцахад ч нэгж талбарын хил үргэлж тод харагдана. */
const VECTOR_Z: Record<string, number> = { parcel: 49, v_parcel_acquisition: 50 };

/**
 * Давхардсан нэгж талбарын давхарга: нөгөө талбарын хил (тасархай улбар шар)
 * + огтлолцох хэсэг (улаан). Энэ талбар (хөх хүрээ, zIndex 50)-ын ДЭЭР зурагдана —
 * давхцах хэсэг нь энэ талбарын дотор тод харагдах ёстой.
 */
const OVERLAP_Z = 60;
const OVERLAP_PART_Z = 70;

function overlapParcelStyle(feature: { get: (k: string) => unknown }): Style {
  return new Style({
    stroke: new Stroke({ color: "#f97316", width: 2.5, lineDash: [8, 5] }),
    fill:   new Fill({ color: "rgba(249,115,22,0.15)" }),
    text: new Text({
      text: String(feature.get("code") ?? ""),
      font: "600 12px ui-monospace, monospace",
      fill: new Fill({ color: "#9a3412" }),
      stroke: new Stroke({ color: "#ffffff", width: 3 }),
      overflow: true,
    }),
  });
}

const OVERLAP_PART_STYLE = new Style({
  stroke: new Stroke({ color: "#b91c1c", width: 1.5 }),
  fill:   new Fill({ color: "rgba(220,38,38,0.7)" }),
});

interface Props {
  parcelId: string;
  acquisitionId?: string;
  geometryWkt?: string | null;
  /**
   * Нөлөөлөлтөд өртсөн (чөлөөлөгдөх) хэсгийн хил — нэгж талбар ∩ чөлөөлөлтийн
   * хил. Хоосон бол бүтэн нэгж талбарыг өртсөн гэж үзнэ.
   */
  acquisitionGeometryWkt?: string | null;
  statusId?: number | null;
  /** Энэ талбартай давхцаж буй нэгж талбарууд (геометртэй) */
  overlaps?: ParcelOverlap[];
  /** true бол `overlaps`-ийг газрын зураг дээр давхцуулж зурна */
  showOverlaps?: boolean;
  /**
   * Самбараас асаалттай давхаргууд солигдох бүрд (мөн анх) дуудагдана —
   * трас зургийн жижиг зураг дэлгэцтэй ИЖИЛ давхаргуудаар зурагдана.
   */
  onVisibleLayersChange?: (ids: string[]) => void;
}

export function ParcelMap({
  parcelId,
  acquisitionId,
  geometryWkt,
  acquisitionGeometryWkt,
  statusId,
  overlaps,
  showOverlaps = false,
  onVisibleLayersChange,
}: Props) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const olMap        = useRef<OLMap | null>(null);
  const wmsLayers    = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const vectorLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const overlapLayer     = useRef<VectorLayer<VectorSource> | null>(null);
  const overlapPartLayer = useRef<VectorLayer<VectorSource> | null>(null);

  // Төлөвийн өнгө бүртгэлээс. Ирэхэд вектор давхаргыг дахин зуруулна —
  // эс бөгөөс анхны зурагдсан өнгө нь өгөгдмөлөөрөө үлдэнэ.
  const statusColors = useParcelStatusColors();
  useEffect(() => {
    statusColorRef.current = statusColors;
    Object.values(vectorLayers.current).forEach((l) => l.changed());
    // "Чөлөөлөх талбай"-н самбарын тэмдэг — одоогийн төлөвийн өнгө
    const color = parcelStatusColor(statusId);
    setLayers((prev) => prev.map((l) => (l.id === "parcel" && l.color !== color ? { ...l, color } : l)));
  }, [statusColors, statusId]);
  const wktFormat    = useRef(new WKT());
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  const acqCql    = acquisitionId ? `acquisition_id='${acquisitionId}'` : undefined;
  const parcelCql = parcelId      ? `parcel_id='${parcelId}'`            : undefined;

  const [layers, setLayers] = useState<LayerConfig[]>(
    ALL_LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      // Самбарын тэмдэг газрын зурагтай таарна (layer-config-ийн өнгө нь
      // бусад газрын зурагт хэрэглэгддэг тул энд л дарна).
      color: d.id === "v_parcel_acquisition" ? PARCEL_OUTLINE_COLOR : d.color,
      visible: ("defaultVisible" in d ? d.defaultVisible : true) as boolean,
      group: d.group,
      hatch: d.hatch,
    })),
  );

  const onVisibleRef = useRef(onVisibleLayersChange);
  onVisibleRef.current = onVisibleLayersChange;
  const visibleKey = layers.filter((l) => l.visible).map((l) => l.id).join(",");
  useEffect(() => {
    onVisibleRef.current?.(visibleKey ? visibleKey.split(",") : []);
  }, [visibleKey]);

  const handleToggle = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, visible: !l.visible };
          if (vectorLayers.current[id]) {
            vectorLayers.current[id].setVisible(next.visible);
            return next;
          }
          wmsLayers.current[id]?.setVisible(next.visible);
          const def = WMS_LAYER_DEFS.find((d) => d.id === id);
          // Улс даяарын давхарга руу ЗУМЛАХГҮЙ (layer-config-ийн fitOnEnable-ийг үз).
          if (next.visible && def && olMap.current && shouldFitOnEnable(id)) {
            void fitLayerToMap({
              map: olMap.current,
              wfsUrl: GS_WFS,
              layerId: geoServerName(def.id),
              cqlFilter:
                combineCql(
                  def.cql,
                  def.cqlType === "acquisition" ? acqCql : def.cqlType === "parcel" ? parcelCql : undefined,
                ) || undefined,
              padding: [60, 60, 60, 60],
            });
          }
          return next;
        }),
      );
    },
    [acqCql, parcelCql],
  );

  useEffect(() => {
    if (!mapRef.current || olMap.current || !parcelId) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};
    WMS_LAYER_DEFS.forEach((d) => {
      // Дэд давхаргын тогтмол шүүлт (code=NN) + дуудагчийн шүүлт (AND).
      const cql = combineCql(
        d.cql,
        d.cqlType === "acquisition" ? acqCql : d.cqlType === "parcel" ? parcelCql : undefined,
      );
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: d.opacity ?? 0.9,
        zIndex: d.zIndex,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${geoServerName(d.id)}`,
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

    const vRecord: Record<string, VectorLayer<VectorSource>> = {};
    VECTOR_LAYER_DEFS.forEach((d) => {
      const src   = new VectorSource();
      const zIdx  = VECTOR_Z[d.id] ?? d.zIndex;
      const layer = new VectorLayer({
        source: src,
        visible: true,
        zIndex: zIdx,
        style: VECTOR_STYLES[d.id],
      });
      vRecord[d.id] = layer;
    });
    vectorLayers.current = vRecord;

    // Давхардлын давхаргууд — самбарт харагдахгүй, `showOverlaps`-оор удирдагдана.
    const ovLayer = new VectorLayer({
      source: new VectorSource(),
      visible: false,
      zIndex: OVERLAP_Z,
      style: overlapParcelStyle,
    });
    const ovPartLayer = new VectorLayer({
      source: new VectorSource(),
      visible: false,
      zIndex: OVERLAP_PART_Z,
      style: OVERLAP_PART_STYLE,
    });
    overlapLayer.current = ovLayer;
    overlapPartLayer.current = ovPartLayer;

    const map = new OLMap({
      target: mapRef.current,
      // OL-ийн өгөгдмөл +/- товчийг нуув (map-view/acquisition-map-тай ижил).
      controls: defaultControls({ zoom: false }),
      layers: [
        // СУУРЬ зураг — тохиргооноос (тохируулаагүй бол үндсэн суурь зураг).
        createBasemapLayer(),
        ...WMS_LAYER_DEFS.map((d) => wmsRecord[d.id]),
        ...VECTOR_LAYER_DEFS.map((d) => vRecord[d.id]),
        ovLayer,
        ovPartLayer,
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        // maxZoom заахгүй — зумлалтын дээд хязгаар байхгүй (суурь зураг 20-оос
        // цааш z20-ийн тайлаа томсгож харуулна).
      }),
    });

    olMap.current = map;

    const stopBasemapWatch = watchBasemap(map);

    return () => {
      stopBasemapWatch();
      map.setTarget(undefined);
      olMap.current = null;
      vectorLayers.current = {};
      overlapLayer.current = null;
      overlapPartLayer.current = null;
    };
  }, [acqCql, acquisitionId, parcelCql, parcelId]);

  useEffect(() => {
    const fmt = wktFormat.current;

    const makeFeature = (wkt: string, featureStatusId?: number | null) => {
      try {
        const feat = fmt.readFeature(wkt, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
        if (featureStatusId != null) feat.set("status_id", featureStatusId);
        return feat;
      } catch (err) {
        logger.warn("wkt parse failed", { error: String(err) });
        return null;
      }
    };

    const wkt = geometryWkt?.trim();
    // "Нэгж талбар" — бүтэн хил (хөх хүрээ)
    const parcelFeat = wkt ? makeFeature(wkt) : null;
    // "Чөлөөлөх талбай" — өртсөн хэсэг; байхгүй бол бүтэн нэгж талбар
    const acqWkt = acquisitionGeometryWkt?.trim() || wkt;
    const acqFeat = acqWkt ? makeFeature(acqWkt, statusId) : null;

    const vAllSrc = vectorLayers.current["v_parcel_acquisition"]?.getSource();
    if (vAllSrc) {
      vAllSrc.clear();
      if (parcelFeat) vAllSrc.addFeature(parcelFeat);
    }

    const vParcelSrc = vectorLayers.current["parcel"]?.getSource();
    if (vParcelSrc) {
      vParcelSrc.clear();
      if (acqFeat) vParcelSrc.addFeature(acqFeat);
    }

    if (parcelFeat && olMap.current) {
      const extent = vectorLayers.current["v_parcel_acquisition"]?.getSource()?.getExtent();
      if (extent) {
        olMap.current.getView().fit(extent, {
          padding: [60, 60, 60, 60],
          duration: 1000,
        });
      }
    }
  }, [geometryWkt, acquisitionGeometryWkt, statusId]);

  // Давхардсан нэгж талбаруудын геометрийг давхаргад ачаална. Агуулгаар нь
  // (WKT) харьцуулна — эцэг компонент рендер бүрт шинэ массив дамжуулж болно.
  const overlapKey = (overlaps ?? [])
    .map((o) => `${o.other_parcel_uuid}|${o.other_geometry_wkt ?? ""}|${o.overlap_geometry_wkt ?? ""}`)
    .join(";");
  const overlapsRef = useRef(overlaps);
  overlapsRef.current = overlaps;
  useEffect(() => {
    const ovSrc = overlapLayer.current?.getSource();
    const partSrc = overlapPartLayer.current?.getSource();
    if (!ovSrc || !partSrc) return;

    const read = (wkt?: string) => {
      const w = wkt?.trim();
      if (!w) return null;
      try {
        return wktFormat.current.readFeature(w, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
      } catch (err) {
        logger.warn("overlap wkt parse failed", { error: String(err) });
        return null;
      }
    };

    ovSrc.clear();
    partSrc.clear();
    (overlapsRef.current ?? []).forEach((o) => {
      const other = read(o.other_geometry_wkt);
      if (other) {
        other.set("code", o.other_parcel_id);
        ovSrc.addFeature(other);
      }
      const part = read(o.overlap_geometry_wkt);
      if (part) partSrc.addFeature(part);
    });
  }, [overlapKey, parcelId]);

  // Асаахад энэ талбар + давхцаж буй бүх талбарыг багтаан зумлана,
  // унтраахад энэ талбар руу буцна. Анхны ачааллын зумыг геометрийн effect хийнэ.
  const prevShowOverlaps = useRef(showOverlaps);
  useEffect(() => {
    overlapLayer.current?.setVisible(showOverlaps);
    overlapPartLayer.current?.setVisible(showOverlaps);
    if (prevShowOverlaps.current === showOverlaps) return;
    prevShowOverlaps.current = showOverlaps;

    const map = olMap.current;
    const parcelExtent = vectorLayers.current["v_parcel_acquisition"]?.getSource()?.getExtent();
    if (!map || !parcelExtent || isEmpty(parcelExtent)) return;
    const extent = extend(createEmpty(), parcelExtent);
    const ovExtent = overlapLayer.current?.getSource()?.getExtent();
    if (showOverlaps && ovExtent && !isEmpty(ovExtent)) extend(extent, ovExtent);
    map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600 });
  }, [showOverlaps]);

  // Fullscreen горим сольсны дараа OL-д контейнерийн шинэ хэмжээг мэдэгдэнэ (өөрөө анзаардаггүй)
  useEffect(() => {
    const raf = requestAnimationFrame(() => olMap.current?.updateSize());
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-white dark:bg-[#1e1f27] ${
        isFullscreen ? "" : "rounded-xl border border-slate-200 dark:border-[#37394d]"
      }`}
      style={isFullscreen ? undefined : { height: 480 }}
    >
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel layers={layers} groups={[AGREED_GROUP, SEC_GROUP]} onToggle={handleToggle} />
      <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
    </div>
  );
}
