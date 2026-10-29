"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toLonLat, transformExtent } from "ol/proj";
import { ImageIcon, Loader2, Printer, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { documentTypeApi, parcelApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { shouldUseProfessionalOrgApi } from "@/lib/role-utils";
import { getApiError } from "@/lib/utils";
import { GS_WFS, gsAuthHeaders } from "@/lib/geoserver";
import { getParcelStatusStyle, type Document, type ParcelOverlap } from "@/types";
import {
  layerDef,
  geoServerName,
  combineCql,
  parcelStatusIdFromLayer,
  AGREED_CODE_LAYER_IDS,
  SEC_CODE_LAYER_IDS,
  type MapLayerId,
} from "./layers";
import { useParcelStatusColors, useParcelStatusLayers } from "./use-parcel-status-layers";
import { ACQUISITION_FILL_ALPHA, PARCEL_OUTLINE_COLOR } from "./parcel-map";
import {
  PRINT_BOUNDARY_IDS,
  PRINT_STYLES,
  PARCEL_STATUS_PRINT_STYLE,
  PRINT_SATELLITE_URLS,
  PRINT_SATELLITE_MAX_ZOOM,
} from "./print-layers";
import {
  canvasToPdfBlob,
  downloadBlob,
  loadImage,
  printScaleFor,
  renderPrintMapCanvas,
  type PrintLayerSpec,
  type PrintMapViewInfo,
  type PrintOrientation,
  type PrintPaperSize,
} from "./print-map";
import {
  composeTracePage,
  fitTraceMainView,
  polygonsExtent,
  resolutionForScale,
  traceLayout,
  wktToPolygons,
  type TraceInfo,
  type TraceInsetCorner,
  type TraceLegendItem,
} from "./trace-print";

/**
 * Нэгж талбарын "Трас зураг" — хэвлэх цонх.
 *
 * "Ажлын зураг" (print-map-dialog)-тай ИЖИЛ урсгал: тохиргоо → "Зураг үүсгэх"
 * → урьдчилан харах (хэвлэгдэх ЯГ тэр зураг) → "Хэвлэх". Ялгаа нь:
 *   • ГОЛ зураг — чөлөөлөлтийн ерөнхий тойм; давхаргыг энд сонгоно.
 *   • ЖИЖИГ зураг — нэгж талбарын хил ойроос, "Байршил" хэсгийн газрын
 *     зурагт одоо АСААЛТТАЙ давхаргуудаар (`insetLayers`).
 *   • Суурь нь хиймэл дагуулын зураг; дроны зураг АШИГЛАХГҮЙ.
 *   • "Хэвлэх" нь PDF татахаас гадна нэгж талбарын «Трас зураг»
 *     (topographic_map) хавсралтыг ДАРЖ бичнэ (байхгүй бол үүсгэнэ).
 */

/** Backend-ийн document_type.type — seed_main.go: 'Трас зураг' */
const TRACE_DOC_TYPE = "topographic_map";
/** Хавсралтын хэмжээг (backend 20MB) багасгах JPEG чанар */
const PDF_JPEG_QUALITY = 0.88;
/** print-map-dialog-тай ижил: браузерын canvas / GeoServer-ийн бодит хязгаар */
const MAP_W_MAX = 4700;

/**
 * "Байршил" газрын зурагтай (parcel-map.tsx) ИЖИЛ дүрслэл:
 *   • Нэгж талбар — бүтэн хил, зөвхөн ТОД ХӨХ хүрээ.
 *   • Чөлөөлөх талбай — нөлөөлөлтөд өртсөн хэсэг, ТӨЛӨВИЙН өнгөөр, 20%
 *     дүүргэлт: доорх хиймэл дагуулын зураг (барилга, хашаа) харагдана.
 */
const PARCEL_FILL_ALPHA = ACQUISITION_FILL_ALPHA;
/**
 * Чөлөөлөлтийн нэгж талбаруудын WMS давхаргын тунгалаг байдал — хэвлэх SLD
 * (parcel_status_print) дүүргэлтээ 40%-иар зурдаг тул 0.5 × 40% = 20%.
 */
const STATUS_WMS_OPACITY = PARCEL_FILL_ALPHA / 0.4;
/** Хүрээний цагаан хүрээ — бараан хиймэл дагуулын зураг дээр ялгарна */
const HALO = "rgba(255,255,255,0.85)";
const LOCATOR_RED = "#dc2626";
const OVERLAP_ORANGE = "#f97316";
const OVERLAP_FILL = "rgba(249,115,22,0.15)";
const OVERLAP_PART_FILL = "rgba(220,38,38,0.7)";

/** ParcelMap-аас төлөв ирээгүй үеийн өгөгдмөл (ParcelMap-ийн defaultVisible) */
const DEFAULT_INSET_LAYERS = ["au1", "au2", "au3", "v_acquisition_plan", "v_parcel_acquisition", "parcel"];
/** ParcelMap дээрх WMS давхаргууд — жижиг зурагт GeoServer-ээс татна */
const INSET_WMS_IDS = new Set<string>([
  "au1",
  "au2",
  "au3",
  "v_acquisition_plan",
  ...AGREED_CODE_LAYER_IDS,
  ...SEC_CODE_LAYER_IDS,
]);
/** Бүртгэлээс бус, тогтмол тодорхойлолттой давхаргын id */
type StaticLayerId = Parameters<typeof layerDef>[0];
const SUB_LAYER_IDS = new Set<string>([...AGREED_CODE_LAYER_IDS, ...SEC_CODE_LAYER_IDS]);

/**
 * Санал болгох гарчиг: "<Чөлөөлөлтийн нэр>-ны ажлын нөлөөлөлтөд өртсөн
 * <дугаар> дугаартай нэгж талбарын трас зураг". Хэрэглэгч засаж болно.
 */
function defaultTraceTitle(acquisitionName: string | undefined, parcelCode: string): string {
  const name = (acquisitionName ?? "").trim().replace(/[.\s]+$/, "");
  const parcelPart = parcelCode
    ? `${parcelCode} дугаартай нэгж талбарын трас зураг`
    : "нэгж талбарын трас зураг";
  return name ? `${name}-ны ажлын нөлөөлөлтөд өртсөн ${parcelPart}` : `Нөлөөлөлтөд өртсөн ${parcelPart}`;
}

/** #rrggbb + тунгалаг байдал → #rrggbbaa */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/** Кадастр/трасын түгээмэл масштабууд (1:N) */
const SCALE_PRESETS = [500, 1000, 2000, 2500, 5000, 10000, 25000, 50000, 100000];
const SCALE_MIN = 100;
const SCALE_MAX = 1_000_000;

/**
 * Масштаб сонгох талбар: "Автомат" (null — багтаана), бэлэн утгууд, эсвэл
 * гараар (1:N). Гараар бичихэд товч дарах бүрд WMS дахин татахгүйн тулд
 * blur/Enter дээр л хэрэгжинэ.
 */
function ScaleField({
  label,
  value,
  onChange,
  className,
  labelClassName,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  className: string;
  labelClassName: string;
}) {
  const isPreset = value == null || SCALE_PRESETS.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  const commit = () => {
    if (!draft.trim()) return; // хоосон — өмнөх утга хэвээр
    const n = Math.round(Number(draft.replace(/[\s,]/g, "")));
    if (Number.isFinite(n) && n >= SCALE_MIN && n <= SCALE_MAX) onChange(n);
    else {
      toast.error(`Масштаб 1:${SCALE_MIN.toLocaleString("en-US")} – 1:${SCALE_MAX.toLocaleString("en-US")} хооронд байна`);
      setDraft(value != null ? String(value) : "");
    }
  };

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <div className="flex items-center gap-1.5">
        <select
          value={custom ? "custom" : value == null ? "auto" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") {
              setCustom(true);
              setDraft(value != null ? String(value) : "");
              return;
            }
            setCustom(false);
            onChange(v === "auto" ? null : Number(v));
          }}
          className={className}
        >
          <option value="auto">Автомат</option>
          {SCALE_PRESETS.map((d) => (
            <option key={d} value={d}>
              1:{d.toLocaleString("en-US")}
            </option>
          ))}
          <option value="custom">Гараар...</option>
        </select>
        {custom && (
          <div className="flex items-center gap-1 text-[12px] text-slate-500">
            1:
            <input
              autoFocus
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="3000"
              className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export interface TraceParcelSubject {
  /** Нэгж талбарын UUID (хавсралтын API) */
  uuid: string;
  /** Нэгж талбарын дугаар */
  code: string;
  geometryWkt?: string | null;
  /** Нөлөөлөлтөд өртсөн хэсэг (нэгж талбар ∩ чөлөөлөлтийн хил); хоосон бол бүтэн талбар */
  acquisitionGeometryWkt?: string | null;
  statusId?: number | null;
  statusName?: string;
  areaM2?: number;
  acquisitionAreaM2?: number;
  location?: string;
  address?: string;
  landuse?: string;
  rightType?: string;
}

/** Зураг боловсруулах тохиргоо — ноорог ба хэрэгжсэн хоёул ийм хэлбэртэй. */
interface TraceSettings {
  title: string;
  paper: PrintPaperSize;
  orientation: PrintOrientation;
  corner: TraceInsetCorner;
  mainScale: number | null;
  hiddenLayers: Set<string>;
}

interface RenderResult {
  main: HTMLCanvasElement;
  mainView: PrintMapViewInfo;
  focus: [number, number] | null;
  inset: HTMLCanvasElement | null;
  insetView: PrintMapViewInfo | null;
}

export default function TracePrintDialog({
  acquisitionId,
  acquisitionName,
  planCode,
  parcel: parcelProp,
  insetLayers,
  overlaps: overlapsProp,
  showOverlaps = false,
  canSave,
  onClose,
}: {
  acquisitionId: string;
  acquisitionName?: string;
  planCode?: string;
  parcel: TraceParcelSubject;
  /** "Байршил" газрын зурагт одоо асаалттай давхаргууд (null = өгөгдмөл) */
  insetLayers?: string[] | null;
  overlaps?: ParcelOverlap[];
  showOverlaps?: boolean;
  /** false бол зөвхөн PDF татна — хавсралтад хадгалахгүй (түгжигдсэн г.м) */
  canSave: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const useProfApi = shouldUseProfessionalOrgApi();
  const logoRef = useRef<HTMLImageElement | null>(null);
  const renderRef = useRef<RenderResult | null>(null);
  const { defs: statusLayerDefs } = useParcelStatusLayers();
  const statusColors = useParcelStatusColors();

  const [paper, setPaper] = useState<PrintPaperSize>("A4");
  // Загвар трас зураг БОСОО
  const [orientation, setOrientation] = useState<PrintOrientation>("portrait");
  const [corner, setCorner] = useState<TraceInsetCorner>("top-left");
  // Ерөнхий тоймын масштаб (1:N) — null бол АВТОМАТ (чөлөөлөлтийг багтаана).
  // Жижиг зураг нь үргэлж нэгж талбарыг багтаана (тохируулахгүй).
  const [mainScale, setMainScale] = useState<number | null>(null);
  const [title, setTitle] = useState(() => defaultTraceTitle(acquisitionName, parcelProp.code));
  /* ТОХИРГОО: ноорог vs хэрэгжсэн (print-map-dialog-тай ижил). Гарчиг,
     цаас, чиглэл, жижиг зургийн байрлал, масштаб, давхарга — БҮГД ноорог;
     өөрчлөхөд зураг шинэчлэгдэхгүй. Зөвхөн "Зураг үүсгэх"/"Шинээр үүсгэх"
     дарахад `applied` болж боловсруулагдана. PDF-ийн цаас/чиглэл ч `applied`-аас. */
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => new Set());
  const [applied, setApplied] = useState<TraceSettings | null>(null);
  const started = applied !== null;
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [extent, setExtent] = useState<[number, number, number, number] | null>(null);
  const [extentLoaded, setExtentLoaded] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<number, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const acqFilter = `acquisition_id='${acquisitionId}'`;
  /* Дуудагч рендер бүрд шинэ объект/массив дамжуулж болно — АГУУЛГААР нь
     мемолно. Эс бөгөөс rebuild-ийн identity рендер бүрд солигдож, зураг
     тасралтгүй дахин зурагдана. */
  const parcelKey = JSON.stringify(parcelProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parcel = useMemo(() => parcelProp, [parcelKey]);
  const overlapKey = (overlapsProp ?? [])
    .map((o) => `${o.other_parcel_uuid}|${o.other_geometry_wkt ?? ""}|${o.overlap_geometry_wkt ?? ""}`)
    .join(";");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overlaps = useMemo(() => overlapsProp ?? [], [overlapKey]);
  const insetKey = (insetLayers ?? DEFAULT_INSET_LAYERS).join(",");
  const insetSet = useMemo(() => new Set(insetKey.split(",").filter(Boolean)), [insetKey]);

  const parcelPolys = useMemo(() => wktToPolygons(parcel.geometryWkt), [parcel.geometryWkt]);
  // Өртсөн хэсэг — байхгүй/уншигдахгүй бол бүтэн нэгж талбар ("Байршил" зурагтай ижил)
  const acqPolys = useMemo(() => {
    const p = wktToPolygons(parcel.acquisitionGeometryWkt);
    return p.length ? p : parcelPolys;
  }, [parcel.acquisitionGeometryWkt, parcelPolys]);
  const parcelExt = useMemo(() => polygonsExtent(parcelPolys), [parcelPolys]);
  const statusColor = getParcelStatusStyle(
    parcel.statusId != null ? statusColors.get(parcel.statusId) : undefined,
  ).color;

  useEffect(() => {
    void loadImage("/logo.png").then((img) => {
      logoRef.current = img;
    });
  }, []);

  /* ── Чөлөөлөлтийн хүрээ ба төлөв тус бүрийн тоо (WFS) ─────────── */
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
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const walk = (n: unknown): void => {
          if (!Array.isArray(n)) return;
          if (typeof n[0] === "number" && typeof n[1] === "number") {
            const [x, y] = n as [number, number];
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          } else n.forEach(walk);
        };
        walk(json?.features?.[0]?.geometry?.coordinates);
        if (Number.isFinite(minX)) {
          setExtent(transformExtent([minX, minY, maxX, maxY], "EPSG:4326", "EPSG:3857") as [number, number, number, number]);
        }
      })
      .catch(() => {})
      // Хилгүй чөлөөлөлт ч хэвлэгдэнэ — нэгж талбарын эргэн тойронд
      .finally(() => setExtentLoaded(true));

    const pp = new URLSearchParams({
      service: "WFS", version: "1.1.0", request: "GetFeature",
      typeName: "land:v_parcel_acquisition", CQL_FILTER: acqFilter,
      outputFormat: "application/json", propertyName: "parcel_id,status",
    });
    void fetch(`${GS_WFS}?${pp.toString()}`, { headers: gsAuthHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const counts: Record<number, number> = {};
        (json?.features ?? []).forEach((f: { properties?: { status?: number } }) => {
          const st = f.properties?.status ?? 0;
          counts[st] = (counts[st] ?? 0) + 1;
        });
        setStatusCounts(counts);
      })
      .catch(() => {})
      .finally(() => setCountsLoaded(true));
  }, [acqFilter]);

  /* ── Гол зургийн давхаргын чипүүд (print-map-dialog-тай ижил) ──── */
  const layerChips = useMemo(() => {
    const counted = Object.keys(statusCounts).length > 0;
    return [
      ...statusLayerDefs
        .filter((d) => !counted || (statusCounts[parcelStatusIdFromLayer(d.id) ?? -1] ?? 0) > 0)
        .map((d) => ({ id: d.id as string, color: d.color, label: d.label })),
      ...PRINT_BOUNDARY_IDS.map((id) => {
        const def = layerDef(id);
        return { id: id as string, color: def.color, label: def.label };
      }),
    ];
  }, [statusCounts, statusLayerDefs]);

  const toggleLayer = (id: string) =>
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // forEach — tsconfig-т `target` заагаагүй (ES5) тул Set-ийг for-of хийж болохгүй.
  const sameSet = (a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    let same = true;
    a.forEach((v) => {
      if (!b.has(v)) same = false;
    });
    return same;
  };
  // Газрын зургийг ДАХИН ТАТАХ шаардлагатай өөрчлөлт үү (гарчгаас бусад)
  const sameMapSettings = (a: TraceSettings, b: TraceSettings) =>
    a.paper === b.paper &&
    a.orientation === b.orientation &&
    a.corner === b.corner &&
    a.mainScale === b.mainScale &&
    sameSet(a.hiddenLayers, b.hiddenLayers);
  const draft: TraceSettings = { title, paper, orientation, corner, mainScale, hiddenLayers };
  const dirty = !!applied && (applied.title !== draft.title || !sameMapSettings(applied, draft));
  const highlight = dirty || !started;
  /* Тоолол ирэхээс ӨМНӨ үүсгэвэл таних тэмдэг дутуу гарна — дараа нь
     автоматаар дахин зурахгүй тул товчийг хүлээлгэнэ. */
  const dataReady = extentLoaded && countsLoaded;

  /* ── Таних тэмдэг: гол + жижиг зургийн ХОЁУЛАНГИЙН давхаргууд ─── */
  const buildLegend = (hidden: Set<string>): TraceLegendItem[] => {
    const items: TraceLegendItem[] = [];
    const seen = new Set<string>();
    const push = (key: string, item: TraceLegendItem) => {
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    // Энэ нэгж талбар (хөх хүрээ) + өртсөн хэсэг (төлөвийн өнгө) —
    // гол зурагт ҮРГЭЛЖ, байршлын цагирагтай.
    push("parcel-outline", {
      symbol: "outline",
      color: PARCEL_OUTLINE_COLOR,
      label: parcel.code ? `${layerDef("v_parcel_acquisition").label} №${parcel.code}` : layerDef("v_parcel_acquisition").label,
    });
    push("parcel-acquisition", {
      symbol: "outline",
      color: statusColor,
      fill: withAlpha(statusColor, PARCEL_FILL_ALPHA),
      label: [layerDef("parcel").label, parcel.statusName].filter(Boolean).join(" — "),
    });
    push("locator", { symbol: "ring", color: LOCATOR_RED, label: "Нэгж талбарын байршил" });

    // Гол зураг — чөлөөлөлтийн нэгж талбарууд төлөвөөр (тоотой)
    statusLayerDefs.forEach((d) => {
      const sid = parcelStatusIdFromLayer(d.id) ?? -1;
      const n = statusCounts[sid] ?? 0;
      if (n <= 0 || hidden.has(d.id)) return;
      push(`status:${sid}`, {
        symbol: "outline",
        color: d.color,
        fill: withAlpha(d.color, PARCEL_FILL_ALPHA),
        label: `${d.label} (${n})`,
      });
    });

    // Хилүүд — гол зурагт сонгосон ЭСВЭЛ жижиг зурагт асаалттай
    PRINT_BOUNDARY_IDS.forEach((id) => {
      if (hidden.has(id) && !insetSet.has(id)) return;
      const def = layerDef(id);
      push(id, { symbol: "line", color: def.color, label: def.label });
    });

    // ГУС-ийн лавлах дэд давхаргууд — жижиг зурагт асаалттай бол
    insetSet.forEach((id) => {
      if (!SUB_LAYER_IDS.has(id)) return;
      const def = layerDef(id as StaticLayerId);
      push(id, { symbol: "fill", color: def.color, label: def.label });
    });

    if (showOverlaps && overlaps.length > 0) {
      push("overlap", { symbol: "dash", color: OVERLAP_ORANGE, fill: OVERLAP_FILL, label: "Давхцаж буй нэгж талбар" });
      push("overlap-part", { symbol: "fill", color: LOCATOR_RED, label: "Давхцах хэсэг" });
    }
    return items;
  };

  // Лого (ref) нь хуудас бүрдүүлэх үед нэмэгдэнэ — тэр үед ачаалагдсан байна
  const info = useMemo<TraceInfo>(
    () => ({
      orgName: "Нийслэлийн газар зохион байгуулалтын алба",
      parcelCode: parcel.code,
      location: parcel.location,
      address: parcel.address,
      landuse: parcel.landuse,
      rightType: parcel.rightType,
      areaM2: parcel.areaM2,
      acquisitionAreaM2: parcel.acquisitionAreaM2,
      statusName: parcel.statusName,
      planCode,
    }),
    [parcel, planCode],
  );

  /* ── Зураг авч, хуудас бүрдүүлэх ─────────────────────────────── */
  const rebuild = async (cfg: TraceSettings) => {
    if (!parcelExt) return;
    setBusy(true);
    setError(null);
    const { orientation, paper, corner, mainScale } = cfg;
    const legend = buildLegend(cfg.hiddenLayers);
    try {
      const layout = traceLayout(orientation, paper, legend, corner);
      const S = printScaleFor(paper);
      const mapW = Math.min(MAP_W_MAX, Math.round(layout.mapArea.w * S));
      const mapH = Math.round((mapW * layout.mapArea.h) / layout.mapArea.w);
      const kMain = mapW / layout.mapArea.w; // canvas px / хуудасны px

      // Гол зургийн хүрээ = чөлөөлөлтийн хил ∪ нэгж талбар. Хил байхгүй бол
      // нэгж талбарын эргэн тойрон (≥ 600м).
      let mainExt: [number, number, number, number];
      if (extent) {
        mainExt = [
          Math.min(extent[0], parcelExt[0]),
          Math.min(extent[1], parcelExt[1]),
          Math.max(extent[2], parcelExt[2]),
          Math.max(extent[3], parcelExt[3]),
        ];
      } else {
        const cx = (parcelExt[0] + parcelExt[2]) / 2;
        const cy = (parcelExt[1] + parcelExt[3]) / 2;
        const half = Math.max(300, (parcelExt[2] - parcelExt[0]) * 3, (parcelExt[3] - parcelExt[1]) * 3);
        mainExt = [cx - half, cy - half, cx + half, cy + half];
      }
      const pcx = (parcelExt[0] + parcelExt[2]) / 2;
      const pcy = (parcelExt[1] + parcelExt[3]) / 2;
      const parcelLat = toLonLat([pcx, pcy])[1];
      const { view, resolution } = fitTraceMainView({
        extent: mainExt,
        canvasW: mapW,
        canvasH: mapH,
        layout,
        corner,
        // Хэрэглэгчийн масштаб — нэгж талбар зургаас гарахгүй байхаар төвлөрнө
        resolution: mainScale ? resolutionForScale(mainScale, 1 / kMain, parcelLat) : null,
        keep: [pcx, pcy],
      });
      const mainView: PrintMapViewInfo = {
        resolution,
        centerLat: toLonLat([(view[0] + view[2]) / 2, (view[1] + view[3]) / 2])[1],
      };

      const satellite: PrintLayerSpec = {
        kind: "xyz",
        urls: PRINT_SATELLITE_URLS,
        maxZoom: PRINT_SATELLITE_MAX_ZOOM,
        crossOrigin: "anonymous",
      };

      /* ГОЛ: хиймэл дагуул → хил/төлөвийн WMS → энэ нэгж талбар (төлөвийн өнгө) */
      const mainLayers: PrintLayerSpec[] = [satellite];
      [
        ...PRINT_BOUNDARY_IDS.map((id) => ({ id: id as string, def: layerDef(id) })),
        ...statusLayerDefs.map((d) => ({ id: d.id as string, def: d })),
      ]
        .filter(({ id }) => !cfg.hiddenLayers.has(id))
        .sort((x, y) => x.def.zIndex - y.def.zIndex)
        .forEach(({ id, def }) => {
          const isStatus = parcelStatusIdFromLayer(id) !== null;
          mainLayers.push({
            kind: "wms",
            layer: `land:${geoServerName(id as MapLayerId)}`,
            styles: isStatus ? PARCEL_STATUS_PRINT_STYLE : PRINT_STYLES[id],
            cql: id.startsWith("au") ? undefined : combineCql(def.cql, acqFilter) || undefined,
            // Нэгж талбарууд 20% дүүргэлттэй — суурь зураг харагдана
            opacity: isStatus ? STATUS_WMS_OPACITY : def.opacity ?? 0.9,
            required: id === "v_acquisition_plan" || isStatus,
          });
        });
      mainLayers.push(...acquisitionSpecs(1.6 * kMain), ...outlineSpecs(2 * kMain));

      const focus: [number, number] = [(pcx - view[0]) / resolution, (view[3] - pcy) / resolution];

      /* ЖИЖИГ: нэгж талбар ойроос, "Байршил" зурагт асаалттай давхаргуудаар */
      const iw = Math.round(layout.inset.w * S);
      const ih = Math.round(layout.inset.h * S);
      const pw = parcelExt[2] - parcelExt[0];
      const ph = parcelExt[3] - parcelExt[1];
      // Хөрш талбарууд харагдахуйц зай үлдээнэ; жижиг талбарыг хэт томсгохгүй (≥150м)
      const ires = Math.max((pw * 2.4) / iw, (ph * 2.4) / ih, 150 / iw);
      const iview: [number, number, number, number] = [
        pcx - (ires * iw) / 2,
        pcy - (ires * ih) / 2,
        pcx + (ires * iw) / 2,
        pcy + (ires * ih) / 2,
      ];
      const insetView: PrintMapViewInfo = { resolution: ires, centerLat: parcelLat };
      const insetSpecs: PrintLayerSpec[] = [satellite];
      Array.from(INSET_WMS_IDS)
        .filter((id) => insetSet.has(id))
        .map((id) => ({ id, def: layerDef(id as StaticLayerId) }))
        .sort((x, y) => x.def.zIndex - y.def.zIndex)
        .forEach(({ id, def }) => {
          insetSpecs.push({
            kind: "wms",
            layer: `land:${geoServerName(id as MapLayerId)}`,
            styles: PRINT_STYLES[id],
            cql: combineCql(def.cql, id === "v_acquisition_plan" ? acqFilter : undefined) || undefined,
            opacity: def.opacity ?? 0.9,
          });
        });
      // "Байршил" зурагт асаалттай давхаргуудаар: өртсөн хэсэг ДООР, хөх хил ДЭЭР
      if (insetSet.has("parcel")) insetSpecs.push(...acquisitionSpecs(1.8 * S));
      if (insetSet.has("v_parcel_acquisition")) insetSpecs.push(...outlineSpecs(2.4 * S));
      if (showOverlaps) {
        overlaps.forEach((ov) => {
          const other = wktToPolygons(ov.other_geometry_wkt);
          if (other.length) {
            insetSpecs.push({
              kind: "vector",
              polygons: other,
              stroke: OVERLAP_ORANGE,
              strokeWidth: 1.8 * S,
              dash: [5 * S, 3.5 * S],
              fill: OVERLAP_FILL,
            });
          }
          const part = wktToPolygons(ov.overlap_geometry_wkt);
          if (part.length) {
            insetSpecs.push({ kind: "vector", polygons: part, stroke: "#b91c1c", strokeWidth: 1 * S, fill: OVERLAP_PART_FILL });
          }
        });
      }

      const [main, inset] = await Promise.all([
        renderPrintMapCanvas({ extent: view, width: mapW, height: mapH, layers: mainLayers }),
        renderPrintMapCanvas({ extent: iview, width: iw, height: ih, layers: insetSpecs }),
      ]);
      const result: RenderResult = { main, mainView, focus, inset, insetView };
      renderRef.current = result;
      compose(result, cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Чөлөөлөх талбай (өртсөн хэсэг) — ТӨЛӨВИЙН өнгийн хүрээ, 20% дүүргэлт. */
  const acquisitionSpecs = (strokeWidth: number): PrintLayerSpec[] => [
    {
      kind: "vector",
      polygons: acqPolys,
      stroke: statusColor,
      strokeWidth,
      fill: withAlpha(statusColor, PARCEL_FILL_ALPHA),
    },
  ];
  /** Нэгж талбар — цагаан хүрээн дээр ТОД ХӨХ хил (дүүргэлтгүй). */
  const outlineSpecs = (strokeWidth: number): PrintLayerSpec[] => [
    { kind: "vector", polygons: parcelPolys, stroke: HALO, strokeWidth: strokeWidth * 1.9 },
    { kind: "vector", polygons: parcelPolys, stroke: PARCEL_OUTLINE_COLOR, strokeWidth },
  ];

  const compose = (r: RenderResult, cfg: TraceSettings) => {
    const page = composeTracePage({
      title: cfg.title,
      orientation: cfg.orientation,
      paper: cfg.paper,
      corner: cfg.corner,
      legend: buildLegend(cfg.hiddenLayers),
      info: { ...info, logo: logoRef.current },
      mainScale: cfg.mainScale,
      ...r,
    });
    setPageCanvas(page);
    setDataUrl(page.toDataURL("image/png"));
  };

  /* ЗУРАГ ЗӨВХӨН ЭНД боловсруулагдана — "Зураг үүсгэх"/"Шинээр үүсгэх" товч.
     Зөвхөн гарчиг өөрчлөгдсөн бол газрын зургийг ДАХИН ТАТАХГҮЙ — хадгалсан
     зургууд дээрээ хуудсыг л дахин бүрдүүлнэ. */
  const generate = () => {
    const next: TraceSettings = { ...draft, hiddenLayers: new Set(hiddenLayers) };
    const prev = applied;
    setApplied(next);
    if (prev && renderRef.current && !error && sameMapSettings(prev, next)) compose(renderRef.current, next);
    else void rebuild(next);
  };

  /* ── ХЭВЛЭХ: PDF татах + «Трас зураг» хавсралтыг дарж бичих ───── */
  const print = async () => {
    if (!pageCanvas || !applied) return;
    setSaving(true);
    try {
      // Цаас/чиглэл — зураг ЯГ ямар тохиргоогоор бүтсэнээс (ноорогоос биш)
      const blob = await canvasToPdfBlob(pageCanvas, applied.orientation, applied.paper, PDF_JPEG_QUALITY);
      const fileName = `tras_zurag_${(parcel.code || "parcel").replace(/[^\w-]+/g, "_")}.pdf`;
      downloadBlob(blob, fileName);
      if (!canSave) {
        toast.info("Нэгж талбар түгжигдсэн тул трас зураг хавсралтад хадгалагдсангүй");
        return;
      }

      const types = await queryClient.fetchQuery({
        queryKey: ["document-types", "parcel"],
        queryFn: () => documentTypeApi.list("parcel"),
      });
      const docType = types.find((t) => t.type === TRACE_DOC_TYPE);
      if (!docType) {
        toast.error("«Трас зураг» хавсралтын төрөл бүртгэгдээгүй тул хадгалагдсангүй");
        return;
      }

      const svc = useProfApi
        ? {
            list: (id: string) => profApi.profListParcelDocuments(id),
            upload: (id: string, f: File) => profApi.profUploadParcelDocument(id, f, docType.id, docType.name),
            remove: (id: string, docId: string) => profApi.profDeleteParcelDocument(id, docId),
          }
        : {
            list: (id: string) => parcelApi.listDocuments(id),
            upload: (id: string, f: File) => parcelApi.uploadDocument(id, f, docType.id, docType.name),
            remove: (id: string, docId: string) => parcelApi.deleteDocument(id, docId).then(() => undefined),
          };

      // ДАРЖ БИЧИХ: эхлээд шинийг хадгалж, амжилттай бол хуучныг устгана —
      // эсрэг дараалалд upload унавал хавсралтгүй үлдэнэ. ГУС-аас татсан
      // (source_doc_id) файлд хүрэхгүй.
      const docs: Document[] = await svc.list(parcel.uuid);
      const old = docs.filter((d) => d.document_type_id === docType.id && !d.source_doc_id);
      await svc.upload(parcel.uuid, new File([blob], fileName, { type: "application/pdf" }));
      const results = await Promise.allSettled(old.map((d) => svc.remove(parcel.uuid, d.id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      await queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcel.uuid] });

      toast.success(old.length ? "Трас зураг шинэчлэгдэж, хавсралтыг дарж бичлээ" : "Трас зураг хавсралтад хадгалагдлаа");
      if (failed) toast.warning(`Хуучин ${failed} трас зураг устгагдсангүй — «Баримт бичиг» хэсгээс шалгана уу`);
    } catch (e) {
      toast.error(getApiError(e, "Трас зураг хадгалахад алдаа гарлаа"));
    } finally {
      setSaving(false);
    }
  };

  const selectCls =
    "h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-200";
  const labelCls = "mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400";
  const noGeometry = !parcelExt;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-[#37394d]">
          <p className="text-[14px] font-bold text-slate-800 dark:text-white">
            Трас зураг{parcel.code ? ` — № ${parcel.code}` : ""}
          </p>
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
              <label className={labelCls}>Гарчиг</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Гарчиг оруулах..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-200"
              />
            </div>
            <div>
              <label className={labelCls}>Цаас</label>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PrintPaperSize)} className={selectCls}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Чиглэл</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as PrintOrientation)}
                className={selectCls}
              >
                <option value="portrait">Босоо</option>
                <option value="landscape">Хэвтээ</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Жижиг зураг</label>
              <select
                value={corner}
                onChange={(e) => setCorner(e.target.value as TraceInsetCorner)}
                className={selectCls}
              >
                <option value="top-left">Зүүн дээд</option>
                <option value="top-right">Баруун дээд</option>
              </select>
            </div>
            <ScaleField
              label="Ерөнхий тоймын масштаб"
              value={mainScale}
              onChange={setMainScale}
              className={selectCls}
              labelClassName={labelCls}
            />
          </div>

          {/* ГОЛ зургийн давхарга — чагтлаагүй нь зураг дээр ч, таних тэмдэг дээр ч гарахгүй */}
          <div>
            <label className={labelCls}>Ерөнхий тоймын давхарга</label>
            <div className="flex max-h-20 flex-wrap gap-2 overflow-y-auto">
              {layerChips.map((chip) => {
                const on = !hiddenLayers.has(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => toggleLayer(chip.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      on
                        ? "border-[#02c0ce] bg-[#02c0ce]/10 text-slate-700 dark:text-slate-200"
                        : "border-slate-200 text-slate-400 line-through hover:bg-slate-50 dark:border-[#37394d] dark:text-slate-500 dark:hover:bg-[#252630]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: chip.color, opacity: on ? 1 : 0.3 }}
                    />
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              Жижиг зураг нь «Байршил» хэсгийн газрын зурагт одоо асаалттай давхаргуудаар зурагдана.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            {started && dirty && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Сонголт өөрчлөгдсөн — зургийг шинэчилнэ үү
              </span>
            )}
            {noGeometry && (
              <span className="text-[11px] text-red-500">Нэгж талбарын хил (геометр) байхгүй тул зураг үүсгэх боломжгүй</span>
            )}
            {!noGeometry && !dataReady && (
              <span className="text-[11px] text-slate-400">Чөлөөлөлтийн мэдээлэл ачаалж байна...</span>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={busy || noGeometry || !dataReady}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                highlight
                  ? "border-[#02c0ce] bg-[#02c0ce] text-white hover:bg-[#02aab6]"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#37394d] dark:text-slate-300 dark:hover:bg-[#252630]"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              {started ? "Шинээр үүсгэх" : "Зураг үүсгэх"}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-[#15161c]">
          {/* Урьдчилан харах нь ХЭВЛЭГДЭХ ЯГ ТЭР зураг */}
          {dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="Трас зураг"
              className="max-h-full max-w-full rounded object-contain shadow"
              style={{ opacity: busy ? 0.35 : 1 }}
            />
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-[12px]">Газрын зураг бэлдэж байна...</span>
            </div>
          )}
          {!started && !busy && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-400 dark:text-slate-500">
              <ImageIcon className="h-8 w-8" />
              <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                Трас зураг бэлдээгүй байна
              </p>
              <p className="max-w-sm text-[11px]">
                Цаас, чиглэл, давхаргаа сонгоод <strong>&laquo;Зураг үүсгэх&raquo;</strong> дарна уу.
              </p>
            </div>
          )}
          {!busy && error && (
            <div className="absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/40 dark:bg-red-500/10">
              <p className="text-[12.5px] font-semibold text-red-600 dark:text-red-400">
                Газрын зургийн давхарга ачаалагдсангүй
              </p>
              <p className="max-w-lg break-words text-[11px] text-red-500/90 dark:text-red-300/80">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-[#37394d]">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {canSave
              ? "Хэвлэхэд PDF татагдаж, нэгж талбарын «Трас зураг» хавсралтыг дарж бичнэ."
              : "Нэгж талбар түгжигдсэн — зөвхөн PDF татна, хавсралтад хадгалахгүй."}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-[12.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#252630]"
            >
              Хаах
            </button>
            <button
              onClick={() => void print()}
              disabled={!dataUrl || busy || saving}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#02aab6] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Хэвлэх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
