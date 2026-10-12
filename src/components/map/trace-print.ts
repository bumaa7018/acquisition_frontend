import WKT from "ol/format/WKT";
import type Geometry from "ol/geom/Geometry";
import type Polygon from "ol/geom/Polygon";
import type MultiPolygon from "ol/geom/MultiPolygon";
import type GeometryCollection from "ol/geom/GeometryCollection";
import {
  CARD_INSET,
  INFO_CARD_H,
  PAGE_MARGIN,
  PAGE_ORG_ROW_H,
  PAGE_TITLE_AREA_H,
  areaText,
  computeScaleDenominator,
  drawNorthArrow,
  drawRoundedRect,
  ellipsize,
  formatDateDots,
  layoutTitle,
  pageSizePx,
  printScaleFor,
  type PrintMapViewInfo,
  type PrintOrientation,
  type PrintPaperSize,
} from "./print-map";

/* ══════════════════════════════════════════════════════════════════
   НЭГЖ ТАЛБАРЫН "ТРАС ЗУРАГ"

   Хуудасны бүтэц (НГЗБА-ийн трас зургийн загвараар):
     • Толгой — байгууллага + гарчиг ("Ажлын зураг"-тай ижил).
     • ГОЛ зураг — чөлөөлөлтийн ерөнхий тойм (хил, нэгж талбарын төлөв,
       засаг захиргааны хил — хэрэглэгч сонгоно). Энэ нэгж талбарын байршлыг
       улаан цагирагаар заана.
     • ЖИЖИГ зураг (дээд буланд) — нэгж талбарын хил ойроос, "Байршил"
       хэсгийн газрын зурагт одоо харагдаж буй давхаргуудаар.
     • Таних тэмдэг + нэгж талбарын мэдээлэл — доод зурваст ("Ажлын
       зураг"-тай ижил хэлбэрийн хөвөгч картууд).
     • Хойд зүг, масштабын шугам, координатын систем.

   Суурь нь ХИЙМЭЛ ДАГУУЛЫН зураг. Дроны (өндөр нягтаршилтай) зураг
   АШИГЛАХГҮЙ — трас зурагт сонголт ч байхгүй. Давхаргууд нь
   print-map.ts-ийн renderPrintMapCanvas-аар (XYZ + WMS + клиент вектор)
   зурагдана.
   ══════════════════════════════════════════════════════════════════ */

export type TraceInsetCorner = "top-left" | "top-right";

/** Таних тэмдгийн дүрс — газрын зураг дээрх зурагдсан хэлбэртэйгээ таарна. */
export type TraceLegendSymbol = "fill" | "line" | "outline" | "dash" | "ring";

export interface TraceLegendItem {
  color: string;
  label: string;
  symbol: TraceLegendSymbol;
  /** outline/dash-ийн дотор дүүргэлт (rgba) */
  fill?: string;
}

/** Нэгж талбарын мэдээлэл. Байхгүй утга "—" болно. */
export interface TraceInfo {
  orgName?: string;
  logo?: HTMLImageElement | null;
  parcelCode?: string;
  location?: string;
  address?: string;
  landuse?: string;
  rightType?: string;
  areaM2?: number;
  acquisitionAreaM2?: number;
  statusName?: string;
  planCode?: string;
}

/** Хуудас дээрх тэгш өнцөгт (px, 96dpi CSS нэгж). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LEGEND_HEADER_H = 16;
const LEGEND_ROW_H = 10;
/** Нэг баганад багтаах мөр — түүнээс олон бол багана нэмнэ (≤3). */
const LEGEND_MAX_ROWS = 6;
const INFO_HEADER_H = 21;
const INFO_ROW_H = 10.5;
/** infoRows()-ийн мөрийн тоо — картын өндрийг урьдчилан бодоход хэрэгтэй. */
const INFO_ROW_COUNT = 12;
/** Жижиг зургийн хүрээ (цагаан зах) */
const INSET_FRAME = 3;

const CRS_LABEL = "WGS 84 / Pseudo-Mercator (EPSG:3857)";

/* ── Геометр ─────────────────────────────────────────────────────── */

function geometryPolygons(g: Geometry): number[][][][] {
  const t = g.getType();
  if (t === "Polygon") return [(g as Polygon).getCoordinates()];
  if (t === "MultiPolygon") return (g as MultiPolygon).getCoordinates();
  if (t === "GeometryCollection") {
    return (g as GeometryCollection)
      .getGeometries()
      .reduce<number[][][][]>((acc, sub) => acc.concat(geometryPolygons(sub)), []);
  }
  return [];
}

/** WKT (EPSG:4326) → олон өнцөгтүүд (EPSG:3857). Уншигдахгүй бол хоосон. */
export function wktToPolygons(wkt?: string | null): number[][][][] {
  const w = wkt?.trim();
  if (!w) return [];
  try {
    const g = new WKT().readGeometry(w, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
    return geometryPolygons(g);
  } catch {
    return [];
  }
}

export function polygonsExtent(polys: number[][][][]): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach((p) =>
    p.forEach((ring) =>
      ring.forEach(([x, y]) => {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }),
    ),
  );
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/* ── Хуудасны байрлал ────────────────────────────────────────────── */

let measureCanvas: HTMLCanvasElement | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d")!;
}

interface CardLayout {
  legendW: number;
  legendCols: number;
  perCol: number;
  colW: number;
  infoCols: number;
  cardH: number;
}

/**
 * Доод зурвасын картуудын хэмжээ. Таних тэмдгийн элементийн тоо, шошгын
 * уртаас хамаарна — тиймээс газрын зургийн харагдацыг тооцохоос ӨМНӨ
 * (traceLayout) ба хуудсыг зурахдаа (composeTracePage) ИЖИЛ функцээр бодно.
 */
function cardLayout(ctx: CanvasRenderingContext2D, mapAreaW: number, legend: TraceLegendItem[]): CardLayout {
  const n = legend.length;
  let legendCols = 0, perCol = 0, colW = 0, legendW = 0;
  if (n) {
    legendCols = 1;
    while (legendCols < 3 && Math.ceil(n / legendCols) > LEGEND_MAX_ROWS) legendCols += 1;
    perCol = Math.ceil(n / legendCols);
    ctx.font = "7px sans-serif";
    const maxText = Math.max(...legend.map((i) => ctx.measureText(i.label).width));
    // Таних тэмдэг нь зурвасын тал хүртэл л эзэлнэ — үлдсэн нь мэдээллийн картад.
    const maxColW = (mapAreaW * 0.45 - 6) / legendCols;
    colW = Math.max(80, Math.min(170, maxColW, maxText + 21));
    ctx.font = "bold 8px sans-serif";
    legendW = Math.max(ctx.measureText("Таних тэмдэг").width + 16, colW * legendCols + 6);
  }
  const infoW = mapAreaW - CARD_INSET * 2 - (n ? legendW + CARD_INSET : 0);
  const infoCols = infoW >= 430 ? 3 : 2;
  const infoRows = Math.ceil(INFO_ROW_COUNT / infoCols);
  const cardH = Math.max(
    INFO_CARD_H,
    INFO_HEADER_H + infoRows * INFO_ROW_H,
    LEGEND_HEADER_H + perCol * LEGEND_ROW_H + 6,
  );
  return { legendW, legendCols, perCol, colW, infoCols, cardH };
}

export interface TraceLayout {
  page: { width: number; height: number };
  /** Газрын зургийн талбай (хуудасны px) */
  mapArea: Rect;
  /** Доод зурвас — таних тэмдэг + мэдээллийн карт (хуудасны px) */
  bandH: number;
  /** Жижиг зураг — mapArea-ийн ДОТООД координатаар (хүрээгүй) */
  inset: Rect;
  cards: CardLayout;
}

export function traceLayout(
  orientation: PrintOrientation,
  paper: PrintPaperSize,
  legend: TraceLegendItem[],
  corner: TraceInsetCorner,
): TraceLayout {
  const page = pageSizePx(orientation, paper);
  const mapArea: Rect = {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN + PAGE_TITLE_AREA_H,
    w: page.width - PAGE_MARGIN * 2,
    h: page.height - (PAGE_MARGIN + PAGE_TITLE_AREA_H) - PAGE_MARGIN,
  };
  const cards = cardLayout(measureCtx(), mapArea.w, legend);
  // Загвар зураг шиг босоо хуудсанд өргөний ~42%, хэвтээд ~30%.
  const w = Math.round(mapArea.w * (orientation === "portrait" ? 0.42 : 0.3));
  const h = Math.round(w * 0.75);
  const pad = CARD_INSET + INSET_FRAME;
  const inset: Rect = { x: corner === "top-left" ? pad : mapArea.w - pad - w, y: pad, w, h };
  return { page, mapArea, bandH: cards.cardH + CARD_INSET * 2, inset, cards };
}

/**
 * ГОЛ зургийн харагдац: `extent`-ийг жижиг зураг болон доод зурвастай
 * ДАВХАРДУУЛАХГҮЙГЭЭР багтаана.
 *
 * Хоёр хувилбар бодно — (A) жижиг зургийн ДООД хэсэг (бүтэн өргөнөөр),
 * (B) жижиг зургийн ХАЖУУ хэсэг (бүтэн өндрөөр) — аль том масштаб
 * (бага resolution) өгөхийг нь сонгоно. Чөлөөлөлтийн хил ихэвчлэн
 * урт/нарийн (гол, зам) тул хэлбэрээсээ хамааран аль нэг нь илүү тохирно.
 *
 * `resolution` өгвөл (хэрэглэгч масштаб сонгосон) багтаахгүй, тэр
 * нягтаршлаар сонгосон хэсгийн ТӨВД extent-ийн төвийг тавина. Ингэхэд
 * `keep` цэг (нэгж талбар) тэр хэсгээс гарах бол түүнийг төвд тавина —
 * томруулсан масштабтай ч нэгж талбар зургаас ХЭЗЭЭ Ч алга болохгүй.
 */
export function fitTraceMainView(o: {
  extent: [number, number, number, number];
  canvasW: number;
  canvasH: number;
  layout: TraceLayout;
  corner: TraceInsetCorner;
  pad?: number;
  resolution?: number | null;
  keep?: [number, number] | null;
}): { view: [number, number, number, number]; resolution: number } {
  const { extent: ext, canvasW, canvasH, layout, corner, pad = 1.08, resolution: fixedRes, keep } = o;
  const k = canvasW / layout.mapArea.w;
  const band = layout.bandH * k;
  const gap = (CARD_INSET + INSET_FRAME) * k;
  const ins = {
    x: layout.inset.x * k,
    y: layout.inset.y * k,
    w: layout.inset.w * k,
    h: layout.inset.h * k,
  };
  const extW = Math.max(1, ext[2] - ext[0]);
  const extH = Math.max(1, ext[3] - ext[1]);

  const below = { x: 0, y: ins.y + ins.h + gap, w: canvasW, h: canvasH - band - (ins.y + ins.h + gap) };
  const besideX = corner === "top-left" ? ins.x + ins.w + gap : 0;
  const beside = { x: besideX, y: 0, w: canvasW - ins.w - ins.x - gap, h: canvasH - band };

  let best: { r: Rect; res: number } | null = null;
  [below, beside].forEach((r) => {
    if (r.w <= 10 || r.h <= 10) return;
    const res = Math.max((extW * pad) / r.w, (extH * pad) / r.h);
    if (!best || res < best.res) best = { r, res };
  });
  // Хэт жижиг хуудас — зурвасаас дээш бүтэн талбайгаар (ховор).
  const chosen: { r: Rect; res: number } = best ?? {
    r: { x: 0, y: 0, w: canvasW, h: Math.max(10, canvasH - band) },
    res: Math.max((extW * pad) / canvasW, (extH * pad) / Math.max(10, canvasH - band)),
  };

  const res = fixedRes && fixedRes > 0 ? fixedRes : chosen.res;
  const r = chosen.r;
  const rcx = r.x + r.w / 2;
  const rcy = r.y + r.h / 2;
  let cx = (ext[0] + ext[2]) / 2;
  let cy = (ext[1] + ext[3]) / 2;
  if (fixedRes && keep) {
    const px = rcx + (keep[0] - cx) / res;
    const py = rcy - (keep[1] - cy) / res;
    const mx = r.w * 0.05;
    const my = r.h * 0.05;
    if (px < r.x + mx || px > r.x + r.w - mx || py < r.y + my || py > r.y + r.h - my) {
      [cx, cy] = keep;
    }
  }
  const left = cx - rcx * res;
  const top = cy + rcy * res;
  return {
    view: [left, top - canvasH * res, left + canvasW * res, top],
    resolution: res,
  };
}

/**
 * Масштабын хуваарь (1:N) → EPSG:3857 нягтаршил (нэгж / canvas px).
 * print-map.ts-ийн computeScaleDenominator-ийн УРВУУ: хуудас нь 96dpi-ийн
 * CSS px-ээр, `pagePxPerCanvasPx` нь газрын зургийн canvas хуудсанд хэр
 * жижгэрч тавигдахыг заана; Web Mercator-ийн гажуудлыг cos(өргөрөг)-өөр засна.
 */
export function resolutionForScale(denominator: number, pagePxPerCanvasPx: number, lat: number): number {
  const groundMetersPerPagePx = (denominator * (25.4 / 96)) / 1000;
  return (groundMetersPerPagePx * pagePxPerCanvasPx) / Math.cos((lat * Math.PI) / 180);
}

/* ── Зурах туслахууд ─────────────────────────────────────────────── */

function niceLength(target: number): number {
  const p = 10 ** Math.floor(Math.log10(target));
  const f = target / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

/** Масштабын ШУГАМ (0 — L/2 — L) + координатын систем. Баруун доод буланг өгнө. */
function drawScaleBar(ctx: CanvasRenderingContext2D, right: number, bottom: number, metersPerPx: number): void {
  if (!Number.isFinite(metersPerPx) || metersPerPx <= 0) return;
  const L = niceLength(metersPerPx * 110);
  const barW = L / metersPerPx;
  const km = L >= 1000;
  const fmt = (m: number) => (km ? `${+(m / 1000).toFixed(2)}` : `${Math.round(m)}`);

  ctx.font = "6px sans-serif";
  const crsW = ctx.measureText(CRS_LABEL).width;
  const w = Math.max(barW + 30, crsW + 14);
  const h = 32;
  const x = right - w;
  const y = bottom - h;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  drawRoundedRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  const bx = x + (w - barW) / 2 - 6;
  const by = y + 13;
  const seg = barW / 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1e293b" : "#ffffff";
    ctx.fillRect(bx + i * seg, by, seg, 3.5);
  }
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(bx, by, barW, 3.5);

  ctx.fillStyle = "#1e293b";
  ctx.font = "6.2px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("0", bx, by - 1.5);
  ctx.fillText(fmt(L / 2), bx + barW / 2, by - 1.5);
  ctx.fillText(fmt(L), bx + barW, by - 1.5);
  ctx.textAlign = "left";
  ctx.fillText(km ? "км" : "м", bx + barW + 4, by + 4);

  ctx.fillStyle = "#64748b";
  ctx.font = "6px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(CRS_LABEL, x + w / 2, by + 7);
  ctx.restore();
}

function drawLegendSymbol(ctx: CanvasRenderingContext2D, item: TraceLegendItem, x: number, cy: number): void {
  ctx.save();
  switch (item.symbol) {
    case "line":
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + 9, cy);
      ctx.stroke();
      break;
    case "ring":
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + 4.5, cy, 3.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "outline":
    case "dash":
      if (item.fill) {
        ctx.fillStyle = item.fill;
        ctx.fillRect(x, cy - 3, 9, 6);
      }
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.2;
      if (item.symbol === "dash") ctx.setLineDash([2, 1.2]);
      ctx.strokeRect(x + 0.5, cy - 2.5, 8, 5);
      break;
    default:
      ctx.fillStyle = item.color;
      ctx.fillRect(x, cy - 3, 9, 6);
  }
  ctx.restore();
}

function infoRows(info: TraceInfo, mainScale: string, insetScale: string): [string, string][] {
  const rows: [string, string][] = [
    ["Нэгж талбарын дугаар:", info.parcelCode || "—"],
    ["Байршил:", info.location || "—"],
    ["Хаяг:", info.address || "—"],
    ["Газрын зориулалт:", info.landuse || "—"],
    ["Эрхийн төрөл:", info.rightType || "—"],
    ["Нийт талбай:", areaText(info.areaM2)],
    ["Чөлөөлөгдөх талбай:", areaText(info.acquisitionAreaM2)],
    ["Төлөв:", info.statusName || "—"],
    ["Төлөвлөлтийн дугаар:", info.planCode || "—"],
    ["Масштаб:", mainScale],
    ["Жижиг зургийн масштаб:", insetScale],
    ["Огноо:", formatDateDots(new Date())],
  ];
  return rows.slice(0, INFO_ROW_COUNT);
}

/* ── Хуудас ──────────────────────────────────────────────────────── */

export interface TraceComposeOptions {
  title: string;
  orientation: PrintOrientation;
  paper: PrintPaperSize;
  corner: TraceInsetCorner;
  legend: TraceLegendItem[];
  info: TraceInfo;
  main: HTMLCanvasElement;
  mainView: PrintMapViewInfo;
  /** Нэгж талбарын төв — ГОЛ зургийн canvas-ын px-ээр (байршлын цагираг) */
  focus?: [number, number] | null;
  inset?: HTMLCanvasElement | null;
  insetView?: PrintMapViewInfo | null;
  /** Хэрэглэгчийн СОНГОСОН ерөнхий тоймын масштаб (1:N) — өгвөл тооцоолсныг дугуйлахгүй, яг үүнийг бичнэ */
  mainScale?: number | null;
}

const scaleLabel = (den: number) => `1:${den.toLocaleString("en-US")}`;

export function composeTracePage(o: TraceComposeOptions): HTMLCanvasElement {
  const { title, orientation, paper, corner, legend, info, main, mainView, focus, inset, insetView, mainScale } = o;
  const layout = traceLayout(orientation, paper, legend, corner);
  const { width, height } = layout.page;
  const S = printScaleFor(paper);
  const page = document.createElement("canvas");
  page.width = Math.round(width * S);
  page.height = Math.round(height * S);
  const ctx = page.getContext("2d")!;
  ctx.scale(S, S);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  /* ── ТОЛГОЙ — "Ажлын зураг"-тай ижил ───────────────────────────── */
  const margin = PAGE_MARGIN;
  const orgRowY = margin + PAGE_ORG_ROW_H / 2;
  if (info.orgName || info.logo) {
    const orgText = (info.orgName ?? "").toUpperCase();
    const logoH = info.logo ? PAGE_ORG_ROW_H - 4 : 0;
    const logoW = info.logo ? (info.logo.width / info.logo.height) * logoH || logoH : 0;
    let x = margin;
    if (info.logo) {
      ctx.drawImage(info.logo, x, orgRowY - logoH / 2, logoW, logoH);
      x += logoW + (orgText ? 6 : 0);
    }
    if (orgText) {
      ctx.font = "bold 9.5px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(orgText, x, orgRowY);
    }
  }
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleTop = margin + PAGE_ORG_ROW_H;
  const titleH = PAGE_TITLE_AREA_H - PAGE_ORG_ROW_H;
  const t = layoutTitle(ctx, title.toUpperCase(), width - margin * 2 - 16, titleH - 6);
  ctx.font = `bold ${t.fontSize}px sans-serif`;
  const titleStartY = titleTop + (titleH - t.lines.length * t.lineHeight) / 2 + t.lineHeight / 2;
  t.lines.forEach((line, i) => ctx.fillText(line, width / 2, titleStartY + i * t.lineHeight));

  /* ── ГОЛ ЗУРАГ ─────────────────────────────────────────────────── */
  const A = layout.mapArea;
  // Canvas нь талбайн ЯГ харьцаатай үүсдэг тул "cover" нь тайралтгүй.
  const coverScale = Math.max(A.w / main.width, A.h / main.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(A.x, A.y, A.w, A.h);
  ctx.clip();
  ctx.drawImage(main, A.x, A.y, main.width * coverScale, main.height * coverScale);
  ctx.restore();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(A.x + 0.5, A.y + 0.5, A.w, A.h);

  const I: Rect = { x: A.x + layout.inset.x, y: A.y + layout.inset.y, w: layout.inset.w, h: layout.inset.h };

  /* ── БАЙРШЛЫН ЗААГЧ — цагираг + жижиг зураг руу холбох шугам ──── */
  if (focus) {
    const fx = A.x + focus[0] * coverScale;
    const fy = A.y + focus[1] * coverScale;
    const inside = (px: number, py: number, r: Rect) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    if (inside(fx, fy, A) && !inside(fx, fy, I)) {
      const R = 11;
      // Жижиг зургийн ХАМГИЙН ОЙР доод булангаас
      const corners: [number, number][] = [
        [I.x, I.y + I.h + INSET_FRAME],
        [I.x + I.w, I.y + I.h + INSET_FRAME],
      ];
      const [lx, ly] = corners.sort(
        (a, b) => Math.hypot(a[0] - fx, a[1] - fy) - Math.hypot(b[0] - fx, b[1] - fy),
      )[0];
      const d = Math.hypot(fx - lx, fy - ly);
      ctx.save();
      if (d > R + 4) {
        const ex = fx - ((fx - lx) / d) * R;
        const ey = fy - ((fy - ly) / d) * R;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = "#dc2626";
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(fx, fy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#dc2626";
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── ЖИЖИГ ЗУРАГ ───────────────────────────────────────────────── */
  let insetScaleText = "—";
  if (inset) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(I.x - INSET_FRAME, I.y - INSET_FRAME, I.w + INSET_FRAME * 2, I.h + INSET_FRAME * 2);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.strokeRect(I.x - INSET_FRAME + 0.5, I.y - INSET_FRAME + 0.5, I.w + INSET_FRAME * 2 - 1, I.h + INSET_FRAME * 2 - 1);
    ctx.beginPath();
    ctx.rect(I.x, I.y, I.w, I.h);
    ctx.clip();
    const s = Math.max(I.w / inset.width, I.h / inset.height);
    ctx.drawImage(inset, I.x, I.y, inset.width * s, inset.height * s);
    ctx.restore();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(I.x + 0.5, I.y + 0.5, I.w - 1, I.h - 1);

    const den = insetView ? computeScaleDenominator(insetView, I.w / inset.width) : 0;
    if (den > 0) insetScaleText = scaleLabel(den);

    // Тайлбар — "Нэгж талбар №…" ба масштаб
    const caption = info.parcelCode ? `Нэгж талбар № ${info.parcelCode}` : "Нэгж талбар";
    ctx.font = "bold 7.5px sans-serif";
    const cw = ctx.measureText(caption).width + 10;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, I.x + 5, I.y + 5, cw, 13, 3);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(caption, I.x + 10, I.y + 11.5);
    if (insetScaleText !== "—") {
      ctx.font = "6.5px sans-serif";
      const sw = ctx.measureText(insetScaleText).width + 8;
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      drawRoundedRect(ctx, I.x + I.w - sw - 5, I.y + I.h - 15, sw, 10, 3);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.textAlign = "center";
      ctx.fillText(insetScaleText, I.x + I.w - sw / 2 - 5, I.y + I.h - 10);
    }
  }

  // ХОЙД ЗҮГ — жижиг зургийн ЭСРЭГ дээд буланд
  drawNorthArrow(ctx, corner === "top-left" ? A.x + A.w - 32 : A.x + 32, A.y + 32, 20);

  /* ── ДООД ЗУРВАС: таних тэмдэг + мэдээлэл ("Ажлын зураг"-тай ижил) ── */
  const C = layout.cards;
  const cardH = C.cardH;
  const cardBottom = A.y + A.h - CARD_INSET;
  const cardY = cardBottom - cardH;

  const groundPerPagePx = (mainView.resolution * Math.cos((mainView.centerLat * Math.PI) / 180)) / coverScale;
  drawScaleBar(ctx, A.x + A.w - CARD_INSET, cardY - 6, groundPerPagePx);

  let legendRight = A.x + CARD_INSET;
  if (legend.length) {
    const lx = A.x + CARD_INSET;
    legendRight = lx + C.legendW + CARD_INSET;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, lx, cardY, C.legendW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#334155";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Таних тэмдэг", lx + 6, cardY + 5);
    ctx.font = "7px sans-serif";
    legend.forEach((item, i) => {
      const col = Math.floor(i / C.perCol);
      const row = i % C.perCol;
      const x = lx + 6 + col * C.colW;
      const cy = cardY + LEGEND_HEADER_H + row * LEGEND_ROW_H + LEGEND_ROW_H / 2;
      drawLegendSymbol(ctx, item, x, cy);
      ctx.fillStyle = "#334155";
      ctx.font = "7px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ellipsize(ctx, item.label, C.colW - 16), x + 12, cy);
    });
  }

  const infoX = legendRight;
  const infoW = A.x + A.w - CARD_INSET - infoX;
  if (infoW > 160) {
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, infoX, cardY, infoW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#334155";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Нэгж талбарын мэдээлэл", infoX + 8, cardY + 5);

    const den = mainScale || computeScaleDenominator(mainView, coverScale);
    const rows = infoRows(info, den > 0 ? scaleLabel(den) : "—", insetScaleText);
    const padX = 8;
    const colW = (infoW - padX * 2) / C.infoCols;
    const perCol = Math.ceil(rows.length / C.infoCols);
    rows.forEach(([label, value], i) => {
      const x = infoX + padX + Math.floor(i / perCol) * colW;
      const y = cardY + INFO_HEADER_H + (i % perCol) * INFO_ROW_H;
      const maxW = colW - 8;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "6.8px sans-serif";
      ctx.fillStyle = "#64748b";
      // Шошгыг заавал тайрна — урт шошго утгатайгаа давхарлахгүй
      const labelText = ellipsize(ctx, label, maxW * 0.62);
      ctx.fillText(labelText, x, y);
      const labelW = ctx.measureText(labelText).width + 3;
      ctx.font = "bold 7.6px sans-serif";
      ctx.fillStyle = "#1e293b";
      ctx.fillText(ellipsize(ctx, value || "—", maxW - labelW), x + labelW, y);
    });
  }

  return page;
}
