"use client";
import { useEffect, useRef, useState } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import WKT from "ol/format/WKT";
import { fromLonLat } from "ol/proj";
import { createEmpty, extend as extendExtent, isEmpty as isEmptyExtent } from "ol/extent";
import { Fill, Stroke, Style, Text } from "ol/style";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { MapPinOff } from "lucide-react";
import { createBasemapLayer, watchBasemap } from "./basemap";
import { logger } from "@/lib/logger";

export type PreviewGeometry = {
  /** WGS84 (EPSG:4326) WKT. Хоосон/танигдахгүй бол чимээгүй алгасагдана. */
  wkt?: string | null;
  color: string;
  label?: string;
  /** Тасархай зураас — ихэвчлэн ХУУЧИН/харьцуулах хилд. */
  dashed?: boolean;
  /** Дүүргэлттэй эсэх (доор орших хилийг бүрхэхээс сэргийлж анхдагчаар үгүй). */
  filled?: boolean;
  /** Зураг ДЭЭР геометрийн голд бичих текст (ж: нэгж талбарын дугаар). */
  text?: string;
  /** Зураасны зузаан (анхдагч 3.5). */
  width?: number;
};

/**
 * WKT геометрийг ЖИЖИГ газрын зураг дээр зурж харуулах компонент.
 *
 * Хаана хэрэглэгддэг: төлөвлөгөө хайж олоход түүний хилийг ХАРУУЛАХ
 * (чөлөөлөлт үүсгэх ба хил солих хоёулаа). Давхарга сонгох, хэвлэх, 3D зэрэг
 * хэрэггүй тул `map-view`/`acquisition-map`-ыг дахин хэрэглэсэнгүй — эдгээр нь
 * GeoServer-ийн WMS давхаргууд ба чөлөөлөлтийн ID шаарддаг.
 */
export default function GeometryPreviewMap({
  geometries,
  height = 200,
  emptyText = "Хил байхгүй тул зураг дээр харуулах боломжгүй",
}: {
  geometries: PreviewGeometry[];
  height?: number;
  emptyText?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const vectorLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const wktFormat = useRef(new WKT());
  const [drawn, setDrawn] = useState<number | null>(null);

  // Зөвхөн WKT-ийн утга (болон хэлбэр) өөрчлөгдөхөд дахин зурна — эцэг
  // компонент дахин render хийх бүрд массив шинээр үүсдэг тул түлхүүрээр
  // харьцуулна.
  const key = geometries
    .map(
      (g) =>
        `${g.color}|${g.dashed ? "d" : ""}|${g.filled ? "f" : ""}|${g.width ?? ""}|${g.text ?? ""}|${g.wkt ?? ""}`,
    )
    .join("~");

  /* ── Зураг үүсгэх (нэг удаа) ── */
  useEffect(() => {
    if (!mapRef.current || olMap.current) return;

    const layer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 10,
      style: (feature) => {
        const color = (feature.get("color") as string) ?? "#ff7a00";
        const text = feature.get("text") as string | undefined;
        return new Style({
          stroke: new Stroke({
            color,
            width: (feature.get("width") as number | undefined) ?? 3.5,
            lineDash: feature.get("dashed") ? [8, 6] : undefined,
          }),
          fill: feature.get("filled") ? new Fill({ color: `${color}33` }) : undefined,
          text: text
            ? new Text({
                text,
                font: "600 11px Inter, system-ui, sans-serif",
                fill: new Fill({ color }),
                stroke: new Stroke({ color: "#ffffff", width: 3 }),
                // Жижиг талбар дээр ч дугаар харагдах ёстой.
                overflow: true,
              })
            : undefined,
        });
      },
    });
    vectorLayer.current = layer;

    olMap.current = new OLMap({
      target: mapRef.current,
      layers: [
        // СУУРЬ зураг — тохиргооноос (тохируулаагүй бол үндсэн суурь зураг).
        createBasemapLayer(),
        layer,
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        // maxZoom заахгүй — зумлалтын дээд хязгаар байхгүй.
      }),
      controls: [],
    });

    const map = olMap.current;
    const stopBasemapWatch = watchBasemap(map);

    return () => {
      stopBasemapWatch();
      map.setTarget(undefined);
      olMap.current = null;
      vectorLayer.current = null;
    };
  }, []);

  /* ── Геометр солигдоход дахин зурж, хүрээ рүү нүүх ── */
  useEffect(() => {
    const map = olMap.current;
    const layer = vectorLayer.current;
    if (!map || !layer) return;

    const source = layer.getSource();
    if (!source) return;
    source.clear();

    const extent = createEmpty();
    let count = 0;
    for (const geom of geometries) {
      const wkt = geom.wkt?.trim();
      if (!wkt) continue;
      try {
        const feature = wktFormat.current.readFeature(wkt, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
        feature.set("color", geom.color);
        feature.set("dashed", !!geom.dashed);
        feature.set("filled", !!geom.filled);
        feature.set("text", geom.text);
        feature.set("width", geom.width);
        source.addFeature(feature);
        const featureExtent = feature.getGeometry()?.getExtent();
        if (featureExtent) extendExtent(extent, featureExtent);
        count++;
      } catch (err) {
        // Танигдахгүй WKT нь зургийг бүхэлд нь унагах ёсгүй.
        logger.warn("geometry preview: WKT уншиж чадсангүй", { error: String(err) });
      }
    }
    setDrawn(count);

    if (count > 0 && !isEmptyExtent(extent)) {
      map.getView().fit(extent, { padding: [24, 24, 24, 24], duration: 300 });
    }
    // Контейнерийн хэмжээ (модал дотор нээгдэх, эсвэл хэсэг өргөжих) хожуу
    // тодорхойлогддог тул OL-д дахин мэдэгдэнэ.
    requestAnimationFrame(() => map.updateSize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Олон геометр нэг тайлбартай байж болно (ж: хилээс гарах бүх нэгж талбар) —
  // тайлбарт нэг л удаа гарна.
  const legend = geometries.filter(
    (g, i, all) =>
      g.label &&
      g.wkt?.trim() &&
      all.findIndex((o) => o.label === g.label && o.color === g.color && o.wkt?.trim()) === i,
  );

  return (
    <div className="space-y-1.5">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-slate-200 dark:border-[#37394d] bg-slate-50 dark:bg-[#252630]"
        style={{ height }}
      >
        <div ref={mapRef} className="h-full w-full" />
        {drawn === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-50/95 dark:bg-[#252630]/95 px-3 text-center">
            <MapPinOff className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{emptyText}</p>
          </div>
        )}
      </div>
      {legend.length > 0 && drawn !== 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((g) => (
            <span
              key={`${g.color}-${g.label}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
            >
              <span
                className="h-0.5 w-4 rounded"
                style={
                  g.dashed
                    ? { borderTop: `2px dashed ${g.color}`, height: 0 }
                    : { background: g.color, height: 2 }
                }
              />
              {g.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
