"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { Download, Loader2, X } from "lucide-react";
import { landApi, departmentApi } from "@/lib/api";
import { PARCEL_STATUS_STYLES, PARCEL_STATUS_NAME_STYLES, STATUS_LABELS } from "@/types";
import type { DroneImage } from "@/types";
import { GS_WMS, GS_WFS, wmsPostLoad, gsAuthHeaders, droneTileUrl, GS_GWC_MAX_ZOOM } from "@/lib/geoserver";
import { BASE_Z_INDEX, DRONE_Z_INDEX, layerDef, type MapLayerId } from "./layers";
import {
  captureMapCanvas,
  composePrintPage,
  downloadCanvasAsPdf,
  getMapViewInfo,
  printMapAreaSizePx,
  printInfoBandPx,
  loadImage,
  type PrintOrientation,
  type PrintPaperSize,
  type PrintInfo,
  type PrintLegendItem,
} from "./print-map";

/**
 * "Ажлын зураг" — ДАШБОАРДААС хэвлэх цонх.
 *
 * ЯАГААД ӨӨРИЙН ГАЗРЫН ЗУРАГТАЙ: дашбоардын зураг нь шүүлтэд тохирсон БҮХ
 * чөлөөлөлтийг нэг CQL-ээр харуулдаг ба хэмжээ нь хуудасны харьцаанаас өөр.
 * Түүнийг нэг чөлөөлөлт рүү шүүж, дараа нь буцаах нь эмзэг (алдаа гарвал
 * хэрэглэгчийн харж байсан зураг эвдэрнэ). Энд цонх нээгдэхэд ТУСДАА зураг
 * үүсч, хаагдахад устдаг — дашбоард огт хөндөгдөхгүй, хуудас ч солигдохгүй.
 *
 * Зургийн хэмжээг хуудасны зургийн талбайн ХАРЬЦААГААР үүсгэдэг тул
 * composePrintPage-ийн "cover" тайралт юу ч огтолдоггүй.
 */

const PARCEL_STATUS_IDS = ["v_parcel_s0", "v_parcel_s1", "v_parcel_s2", "v_parcel_s3", "v_parcel_s4", "v_parcel_s5"] as const;
const PARCEL_STATUS_NAMES = Object.keys(PARCEL_STATUS_NAME_STYLES);
const BOUNDARY_IDS = ["v_acquisition_plan", "v_plan_acquisition", "au1", "au2", "au3"] as const;

// Хэвлэхэд зориулсан style-ууд (GeoServer дээр make config-оор ачаалагдана)
const PRINT_STYLES: Record<string, string> = {
  v_acquisition_plan: "acquisition_plan_print",
  v_plan_acquisition: "plan_acquisition_print",
  v_parcel_s0: "parcel_s0_print",
  v_parcel_s1: "parcel_s1_print",
  v_parcel_s2: "parcel_s2_print",
  v_parcel_s3: "parcel_s3_print",
  v_parcel_s4: "parcel_s4_print",
  v_parcel_s5: "parcel_s5_print",
};

/** Хэвлэх зургийн ӨРГӨН (px). Өндөр нь хуудасны харьцаагаар бодогдоно. */
const MAP_W = 1200;

function droneBounds(img: DroneImage): [number, number, number, number] | null {
  const { min_x: a, min_y: b, max_x: c, max_y: d } = img;
  if (a == null || b == null || c == null || d == null) return null;
  const e = [a, b, c, d] as [number, number, number, number];
  if (!e.every(Number.isFinite)) return null;
  if (Math.abs(a) > 180 || Math.abs(c) > 180 || Math.abs(b) > 90 || Math.abs(d) > 90) return null;
  if (a >= c || b >= d) return null;
  return e;
}

export default function PrintMapDialog({
  acquisitionId,
  acquisitionName,
  onClose,
}: {
  acquisitionId: string;
  acquisitionName?: string;
  onClose: () => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const wmsLayers = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const droneLayers = useRef<Record<string, TileLayer<XYZ>>>({});
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const extentRef = useRef<[number, number, number, number] | null>(null);

  const [paper, setPaper] = useState<PrintPaperSize>("A4");
  const [orientation, setOrientation] = useState<PrintOrientation>("landscape");
  const [title, setTitle] = useState(acquisitionName?.trim() || "Чөлөөлөлтийн байршил");
  const [selectedDrones, setSelectedDrones] = useState<Set<string>>(() => new Set());
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(true);

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  /* ── Өгөгдөл ─────────────────────────────────────────────────── */
  const { data: acq } = useQuery({
    queryKey: ["land", acquisitionId],
    queryFn: () => landApi.getById(acquisitionId),
    staleTime: 60_000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "options"],
    queryFn: () => departmentApi.list({ page_size: 200 }).then((r) => r.data ?? []),
    staleTime: 5 * 60_000,
  });
  const { data: droneImages = [] } = useQuery({
    queryKey: ["drone-images", acquisitionId],
    queryFn: () => landApi.listDroneImages(acquisitionId),
    staleTime: 60_000,
  });

  // Хүрээ мэдэгдэж буй, GeoServer-т нийтлэгдсэн зургууд л сонгогдоно
  const usableDrones = useMemo(
    () => droneImages.filter((img) => !!img.layer_name && !!droneBounds(img)),
    [droneImages],
  );

  const [statusCounts, setStatusCounts] = useState<Record<number, number>>({});
  const [parcelsAreaM2, setParcelsAreaM2] = useState(0);

  useEffect(() => {
    void loadImage("/org-logo.svg").then((img) => {
      logoRef.current = img;
    });
  }, []);

  /* ── Хүрээ ба нэгж талбарын тоо/талбай (WFS) ─────────────────── */
  useEffect(() => {
    const p = new URLSearchParams({
      service: "WFS", version: "1.1.0", request: "GetFeature",
      typeName: "land:v_acquisition_boundary", CQL_FILTER: acqFilter,
      outputFormat: "application/json", propertyName: "geometry", maxFeatures: "1",
    });
    void fetch(GS_WFS, {
      method: "POST",
      headers: gsAuthHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: p.toString(),
    })
      .then((r) => r.json())
      .then((json) => {
        const geom = json?.features?.[0]?.geometry;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const walk = (n: unknown): void => {
          if (!Array.isArray(n)) return;
          if (typeof n[0] === "number" && typeof n[1] === "number") {
            const [x, y] = n as [number, number];
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          } else n.forEach(walk);
        };
        walk(geom?.coordinates);
        if (Number.isFinite(minX)) {
          extentRef.current = transformExtent([minX, minY, maxX, maxY], "EPSG:4326", "EPSG:3857") as [number, number, number, number];
        }
      })
      .catch(() => {});

    const pp = new URLSearchParams({
      service: "WFS", version: "1.1.0", request: "GetFeature",
      typeName: "land:v_parcel_acquisition", CQL_FILTER: acqFilter,
      outputFormat: "application/json", propertyName: "parcel_id,status,acquisition_area_m2",
    });
    void fetch(`${GS_WFS}?${pp.toString()}`, { headers: gsAuthHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const counts: Record<number, number> = {};
        let sum = 0;
        (json?.features ?? []).forEach((f: { properties?: { status?: number; acquisition_area_m2?: number } }) => {
          const st = f.properties?.status ?? 0;
          counts[st] = (counts[st] ?? 0) + 1;
          sum += Number(f.properties?.acquisition_area_m2 ?? 0) || 0;
        });
        setStatusCounts(counts);
        setParcelsAreaM2(sum);
      })
      .catch(() => {});
  }, [acqFilter]);

  /* ── Газрын зураг (нэг удаа) ─────────────────────────────────── */
  useEffect(() => {
    if (!mapDivRef.current || olMap.current) return;

    const record: Record<string, ImageLayer<ImageWMS>> = {};
    ([...BOUNDARY_IDS, ...PARCEL_STATUS_IDS] as MapLayerId[]).forEach((id) => {
      const def = layerDef(id);
      const cql = id.startsWith("au") ? "" : acqFilter;
      record[id] = new ImageLayer({
        zIndex: def.zIndex,
        opacity: def.opacity ?? 0.9,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${id}`,
            FORMAT: "image/png",
            TRANSPARENT: true,
            // Энэ зураг ЗӨВХӨН хэвлэхэд зориулагдсан тул шууд хэвлэхийн style
            ...(PRINT_STYLES[id] ? { STYLES: PRINT_STYLES[id] } : {}),
            ...(cql ? { CQL_FILTER: cql } : {}),
          },
          ratio: 1,
          serverType: "geoserver",
          imageLoadFunction: wmsPostLoad,
        }),
      });
    });
    wmsLayers.current = record;

    olMap.current = new OLMap({
      target: mapDivRef.current,
      controls: [],
      interactions: [],
      layers: [
        new TileLayer({
          zIndex: BASE_Z_INDEX,
          source: new XYZ({
            urls: [0, 1, 2, 3].map((i) => `https://mt${i}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`),
            maxZoom: 20,
            crossOrigin: "anonymous",
          }),
        }),
        ...Object.values(record),
      ],
      view: new View({ center: fromLonLat([104.9, 47.9]), zoom: 5, minZoom: 4 }),
    });

    return () => {
      olMap.current?.setTarget(undefined);
      olMap.current = null;
      wmsLayers.current = {};
      droneLayers.current = {};
    };
  }, [acqFilter]);

  /* ── Дроны давхаргууд — сонголтын дагуу ──────────────────────── */
  useEffect(() => {
    const map = olMap.current;
    if (!map) return;
    Object.entries(droneLayers.current).forEach(([id, layer]) => {
      if (selectedDrones.has(id)) return;
      map.removeLayer(layer);
      delete droneLayers.current[id];
    });
    usableDrones.forEach((img) => {
      if (!selectedDrones.has(img.id) || droneLayers.current[img.id]) return;
      const b = droneBounds(img);
      if (!b) return;
      const layer = new TileLayer({
        zIndex: DRONE_Z_INDEX,
        extent: transformExtent(b, "EPSG:4326", "EPSG:3857"),
        source: new XYZ({ url: droneTileUrl(acquisitionId, img.id), maxZoom: GS_GWC_MAX_ZOOM }),
      });
      droneLayers.current[img.id] = layer;
      map.addLayer(layer);
    });
  }, [selectedDrones, usableDrones, acquisitionId]);

  /* ── Зураг авч, хуудас бүрдүүлэх ─────────────────────────────── */
  const legend = useMemo<PrintLegendItem[]>(
    () => [
      ...PARCEL_STATUS_IDS.map((_, status) => status)
        .filter((status) => (statusCounts[status] ?? 0) > 0)
        .map((status) => ({
          color: PARCEL_STATUS_STYLES[status].color,
          label: `${PARCEL_STATUS_NAMES[status]} (${statusCounts[status]})`,
        })),
      ...BOUNDARY_IDS.map((id) => {
        const def = layerDef(id);
        return { color: def.color, label: def.label, line: true };
      }),
    ],
    [statusCounts],
  );

  const info = useMemo<PrintInfo>(() => {
    const cat = categories.find((c) => c.id === acq?.general_category_id);
    const dept = departments.find((d) => String(d.id) === String(cat?.department_id ?? ""));
    return {
      planCode: acq?.plan_code,
      planName: acq?.plan_name,
      acquisitionAreaM2: acq?.area_m2,
      parcelsAreaM2,
      orgName: "Нийслэлийн газрын алба",
      logo: logoRef.current,
      departmentName: dept?.name,
      departmentCode: dept?.code,
      statusName: acq ? STATUS_LABELS[acq.status] : undefined,
      progressPercent: acq?.progress_percent ?? 0,
      progressBreakdown: PARCEL_STATUS_IDS.map((_, status) => ({
        color: PARCEL_STATUS_STYLES[status].color,
        label: PARCEL_STATUS_NAMES[status],
        count: statusCounts[status] ?? 0,
      })).filter((sl) => sl.count > 0),
      specialists: (acq?.assigned_users ?? []).map((u) => u.user_name).filter(Boolean),
    };
  }, [acq, categories, departments, parcelsAreaM2, statusCounts]);

  // Зургийн ӨНДӨР — хуудасны зургийн талбайн харьцаагаар (тайралт үүсэхгүй)
  const area = printMapAreaSizePx(orientation, paper);
  const mapH = Math.round((MAP_W * area.height) / area.width);

  const rebuild = useCallback(async () => {
    const map = olMap.current;
    const ext = extentRef.current;
    if (!map || !ext) return;
    setBusy(true);
    map.updateSize();

    // Хилийг ДЭЭД хэсэгт: доод зурвасыг таних тэмдэг/мэдээллийн карт эзэлнэ.
    const a = printMapAreaSizePx(orientation, paper);
    const cover = a.width / MAP_W; // өргөн/өндөр ижил харьцаатай тул нэг утга
    const band = printInfoBandPx() / cover;
    const usableH = Math.max(mapH * 0.35, mapH - band);
    const PAD = 1.06;
    const resolution = Math.max(((ext[2] - ext[0]) * PAD) / MAP_W, ((ext[3] - ext[1]) * PAD) / usableH);
    map.getView().setResolution(resolution);
    map.getView().setCenter([(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2 - (band / 2) * resolution]);

    const viewInfo = getMapViewInfo(map);
    const canvas = await captureMapCanvas(map);
    if (!canvas) {
      setBusy(false);
      return;
    }
    mapCanvasRef.current = canvas;
    const page = composePrintPage(canvas, { title, orientation, paper, legend, viewInfo, info });
    setPageCanvas(page);
    setDataUrl(page.toDataURL("image/png"));
    setBusy(false);
  }, [orientation, paper, title, legend, info, mapH]);

  // Хүрээ/сонголт/цаас өөрчлөгдөх бүрд дахин зурна (гарчиг УДААН биш —
  // доорх тусдаа effect нь зөвхөн хуудсыг дахин бүрдүүлнэ).
  useEffect(() => {
    const t = setTimeout(() => void rebuild(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation, paper, selectedDrones, statusCounts, acq, mapH]);

  // Гарчиг солиход зургийг ДАХИН АВАХГҮЙ — хадгалсан canvas дээрээ дахин зурна
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const page = composePrintPage(canvas, { title, orientation, paper, legend, info });
    setPageCanvas(page);
    setDataUrl(page.toDataURL("image/png"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const download = () => {
    if (!pageCanvas) return;
    const name = title.trim().replace(/\s+/g, "_").slice(0, 80) || "gazriin_zurag";
    void downloadCanvasAsPdf(pageCanvas, orientation, name, paper);
  };

  const selectCls =
    "h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-200";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Зураг авах ҮЛ ҮЗЭГДЭХ газрын зураг. display:none БОЛОХГҮЙ —
          OpenLayers хэмжээгүй контейнерт рендер хийхгүй. */}
      <div
        ref={mapDivRef}
        style={{ position: "fixed", left: -99999, top: 0, width: MAP_W, height: mapH }}
        aria-hidden
      />

      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-[#37394d]">
          <p className="text-[14px] font-bold text-slate-800 dark:text-white">Ажлын зураг</p>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 px-5 py-3 dark:border-[#37394d]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Гарчиг</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Гарчиг оруулах..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Цаас</label>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PrintPaperSize)} className={selectCls}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Чиглэл</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as PrintOrientation)}
                className={selectCls}
              >
                <option value="landscape">Хэвтээ</option>
                <option value="portrait">Босоо</option>
              </select>
            </div>
          </div>

          {usableDrones.length > 0 && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Дроны зураг ({usableDrones.length})
              </label>
              <div className="flex max-h-20 flex-wrap gap-2 overflow-y-auto">
                {usableDrones.map((img) => {
                  const on = selectedDrones.has(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() =>
                        setSelectedDrones((prev) => {
                          const next = new Set(prev);
                          if (next.has(img.id)) next.delete(img.id);
                          else next.add(img.id);
                          return next;
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        on
                          ? "border-[#02c0ce] bg-[#02c0ce]/10 text-[#02c0ce]"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-[#37394d] dark:text-slate-400 dark:hover:bg-[#252630]"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {img.original_name || img.file_name || img.id.slice(0, 8)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-[#15161c]">
          {busy || !dataUrl ? (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-[12px]">Бэлтгэж байна...</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Ажлын зураг" className="h-auto w-full rounded shadow" />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-[#37394d]">
          <button
            onClick={onClose}
            className="h-9 rounded-lg px-4 text-[12.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#252630]"
          >
            Хаах
          </button>
          <button
            onClick={download}
            disabled={!dataUrl || busy}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#02aab6] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Татах
          </button>
        </div>
      </div>
    </div>
  );
}
