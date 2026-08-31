import type OLMap from "ol/Map";
import { toLonLat } from "ol/proj";
import { PDFDocument } from "pdf-lib";

export interface PrintLegendItem {
  color: string;
  label: string;
  /** true бол дөрвөлжин биш ШУГАМ зурна (хилийн давхаргууд). */
  line?: boolean;
}

export interface PrintMapViewInfo {
  /** view.getResolution() — проекцын нэгж (метр, EPSG:3857) OL viewport-ийн 1 CSS px тутамд */
  resolution: number;
  /** Харагдацын төвийн өргөрөг — Web Mercator-ийн метрийн гажуудлыг засахад хэрэглэнэ */
  centerLat: number;
}

export type PrintOrientation = "landscape" | "portrait";
export type PrintPaperSize = "A4" | "A3";

// Цаасны px хэмжээ (~96dpi) — урьдчилан харах зураг болон PDF хуудас хоёул ижил
// харьцаатай байхын тулд газрын зургийн canvas-ыг эндхи хэмжээнд зурна.
// A4 210×297мм, A3 297×420мм.
const PAPER_PX: Record<PrintPaperSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A3: { width: 1123, height: 1587 },
};
// PDF-ийн цэгээр (pt) хэмжээ — 1мм = 2.8346pt
const PAPER_PT: Record<PrintPaperSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
};

function pageSizePx(
  orientation: PrintOrientation,
  paper: PrintPaperSize = "A4",
): { width: number; height: number } {
  const p = PAPER_PX[paper];
  return orientation === "landscape" ? { width: p.height, height: p.width } : { width: p.width, height: p.height };
}

// Хуудасны layout-ын тогтмолууд — composePrintPage болон
// printMapAreaSizePx хоёулаа ЭНДЭЭС уншина. Хоёр газар тусад нь бичвэл
// зурган дээрх тайралтын тооцоо чимээгүйхэн зөрнө.
const PAGE_MARGIN = 24;
// Толгой: дээр нь ЖИЖИГ байгууллагын мөр, доор нь ГАРЧИГ (олон мөр).
const PAGE_ORG_ROW_H = 20;
const PAGE_TITLE_AREA_H = PAGE_ORG_ROW_H + 52;
// Мэдээллийн КАРТ — тусдаа панель БИШ, газрын зургийн ДЭЭР хөвнө
// (таних тэмдэгтэй яг ижил цагаан дэвсгэртэй). Зургийн доод хэсэгт
// чөлөөлөлтийн хил ороогүй хоосон зай үлдээж, түүн дээр нь зурна.
const INFO_CARD_H = 126;
const CARD_INSET = 10;

/**
 * Хуудсан дээр ГАЗРЫН ЗУРАГТ оногдох талбайн хэмжээ (px).
 *
 * composePrintPage нь зургийг "cover" (Math.max) байдлаар зурж, хэтэрсэн
 * хэсгийг ТАЙРДАГ. Тиймээс дуудагч тал нь ямар харьцаатай хэсэг үлдэхийг
 * урьдчилан мэдэж, газрын зургийн харагдацаа тааруулах шаардлагатай — үгүй
 * бол чөлөөлөлтийн хил зах руугаа тасарна.
 */
export function printMapAreaSizePx(
  orientation: PrintOrientation,
  paper: PrintPaperSize = "A4",
): { width: number; height: number } {
  const { width, height } = pageSizePx(orientation, paper);
  return {
    width: width - PAGE_MARGIN * 2,
    height: height - (PAGE_MARGIN + PAGE_TITLE_AREA_H) - PAGE_MARGIN,
  };
}

/**
 * Мэдээллийн карт эзлэх ДООД ЗУРВАС (px, хуудасны нэгжээр).
 *
 * Дуудагч тал нь чөлөөлөлтийн хилийг зөвхөн ДЭЭД хэсэгт багтаах ёстой —
 * доод зурвас нь хилгүй хоосон газрын зураг байж, түүн дээр карт хөвнө.
 */
export function printInfoBandPx(): number {
  return INFO_CARD_H + CARD_INSET * 2;
}

/**
 * Зураг (лого) ачаална. Ачаалагдаагүй зургийг canvas-д зурвал хоосон гарах тул
 * composePrintPage-ийн ӨМНӨ дуудаж, үр дүнг нь дамжуулна. Алдаа гарвал null —
 * лого байхгүй ч хуудас хэвлэгдэнэ.
 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Хуудсан дээр харуулах мэдээлэл. Бүгд заавал биш — байхгүй бол мөр нь алгасагдана. */
export interface PrintInfo {
  planCode?: string;
  planName?: string;
  /** Чөлөөлөлтийн хилийн талбай (м²) */
  acquisitionAreaM2?: number;
  /** Нэгж талбаруудын чөлөөлөх талбайн НИЙЛБЭР (м²) */
  parcelsAreaM2?: number;
  orgName?: string;
  logo?: HTMLImageElement | null;
  /** Ерөнхий ангилалд холбогдсон хэлтэс */
  departmentName?: string;
  departmentCode?: string;
  /** Чөлөөлөлтийн ЯВЦ — төлөвийн нэр (Шинэ / Хээрийн судалгаа / ...) */
  statusName?: string;
  /** Гүйцэтгэлийн хувь (0-100) */
  progressPercent?: number;
  /** Гүйцэтгэлийн pie — нэгж талбарын төлөв тус бүрээр */
  progressBreakdown?: { color: string; label: string; count: number }[];
  /** Хариуцсан мэргэжилтнүүдийн овог нэр */
  specialists?: string[];
}

// Хэвлэсэн огноо — "2026.09.01" (тэгээр гүйцээсэн, монгол бичиглэл).
function formatDateDots(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())}`;
}

/** м² → уншихад тохиромжтой (га эсвэл м²). */
function areaText(m2?: number): string {
  if (m2 == null || !Number.isFinite(m2) || m2 <= 0) return "—";
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(2)} га` : `${Math.round(m2).toLocaleString()} м²`;
}

/** ЗҮГ ЧИГИЙН тэмдэг — газрын зургийн баруун дээд буланд. */
function drawNorthArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Хойд зүг — бараан гурвалжин; урд зүг — цайвар
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.62);
  ctx.lineTo(cx + r * 0.3, cy + r * 0.2);
  ctx.lineTo(cx, cy + r * 0.05);
  ctx.closePath();
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.62);
  ctx.lineTo(cx - r * 0.3, cy + r * 0.2);
  ctx.lineTo(cx, cy + r * 0.05);
  ctx.closePath();
  ctx.fillStyle = "#94a3b8";
  ctx.fill();

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", cx, cy + r * 0.55);
  ctx.restore();
}

/** Гүйцэтгэлийн PIE — нэгж талбарын төлөв тус бүрээр өнгөөр хуваана. */
function drawProgressPie(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  slices: { color: string; count: number }[],
): void {
  const total = slices.reduce((sum, sl) => sum + sl.count, 0);
  ctx.save();
  if (total <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
  } else {
    let start = -Math.PI / 2;
    slices.forEach((sl) => {
      if (sl.count <= 0) return;
      const angle = (sl.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = sl.color;
      ctx.fill();
      start += angle;
    });
  }
  // Donut нүх — дунд нь хувь бичихэд уншигдахуйц болно
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/**
 * Идэвхтэй харагдацын resolution болон төвийн өргөргийг унших — масштаб
 * тооцоолоход хэрэглэгдэнэ. rendercomplete хүлээх шаардлагагүй тул captureMapCanvas-аас
 * өмнө ч дараа ч дуудаж болно.
 */
export function getMapViewInfo(map: OLMap): PrintMapViewInfo | null {
  const view = map.getView();
  const resolution = view.getResolution();
  const center = view.getCenter();
  if (resolution == null || !center) return null;
  const [, centerLat] = toLonLat(center);
  return { resolution, centerLat };
}

// Масштабын харьцааг "цэвэрхэн" тоо болгож дугуйлна (жиш: 1834 → 1800), учир нь
// PDF/preview дээр 1:1,834.27 гэх мэт хэт нарийвчлалтай тоо мэргэжлийн бус харагдана.
function roundScaleDenominator(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  let step: number;
  if (value < 200) step = 5;
  else if (value < 1000) step = 10;
  else if (value < 5000) step = 50;
  else if (value < 20000) step = 100;
  else if (value < 100000) step = 500;
  else step = 1000;
  return Math.round(value / step) * step;
}

/**
 * OL-ийн view resolution (проекцын нэгж/px)-ээс хэвлэх хуудсан дээрх бодит масштабыг
 * тооцоолно. Web Mercator (EPSG:3857) метр нь өргөрөгөөс хамааран газрын бодит зайг
 * илүү үзүүлдэг тул cos(lat)-аар засна. mapCanvas болон А4 хуудас хоёул нэг ижил
 * "96dpi CSS px" конвенцоор хэмжигдсэн тул шууд харьцуулж болно.
 */
function computeScaleDenominator(viewInfo: PrintMapViewInfo, coverScale: number): number {
  const groundMetersPerOLpx = viewInfo.resolution * Math.cos((viewInfo.centerLat * Math.PI) / 180);
  const mmPerPagePx = 25.4 / 96;
  const groundMetersPerPagePx = groundMetersPerOLpx / coverScale;
  const denominator = (groundMetersPerPagePx / mmPerPagePx) * 1000;
  return roundScaleDenominator(denominator);
}

/** Текстийг өгөгдсөн өргөнд багтаах мөрүүд болгож таслана (үгээр). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/** Урт текстийг өргөнд багтаахаар тайрч "…" залгана (шахаж гажуудуулахгүй). */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

/**
 * ГАРЧГИЙН байрлуулалт — фонтын хэмжээг багасгаж, шаардвал ОЛОН МӨР болгоно.
 *
 * ЯАГААД: чөлөөлөлтийн нэр урт байдаг (жиш: "Сонгинохайрхан дүүргийн 5 дугаар
 * хороо «Ханын материал орчмын гэр хорооллын газрыг орон сууцжуулах дахин
 * төлөвлөлтийн ажил»"). Өмнө нь ганц мөрөнд `fillText(..., maxWidth)`-аар
 * шахдаг байсан тул үсэг нарийсаж уншигдахгүй болдог байв.
 *
 * Гарчгийн блокийн ӨНДӨР нь тогтмол (PAGE_TITLE_AREA_H) — тиймээс хуудасны
 * бусад хэсгийн байрлал (газрын зураг, инфо панель) гарчгаас хамаарч хөвөхгүй.
 */
function layoutTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxSize = 20,
  minSize = 11,
): { lines: string[]; fontSize: number; lineHeight: number } {
  for (let size = maxSize; size >= minSize; size -= 1) {
    ctx.font = `bold ${size}px sans-serif`;
    const lineHeight = Math.round(size * 1.25);
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length * lineHeight <= maxHeight) return { lines, fontSize: size, lineHeight };
  }
  // Хамгийн жижиг хэмжээгээр ч багтаагүй — багтах мөрийг нь авч, сүүлчийнхийг тайрна.
  ctx.font = `bold ${minSize}px sans-serif`;
  const lineHeight = Math.round(minSize * 1.25);
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const all = wrapText(ctx, text, maxWidth);
  const lines = all.slice(0, maxLines);
  if (all.length > maxLines) lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${all[maxLines].slice(0, 12)}`, maxWidth);
  return { lines, fontSize: minSize, lineHeight };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * OpenLayers Canvas renderer-ийн идэвхтэй харагдацыг нэг canvas зураг болгон нэгтгэнэ.
 * rendercomplete хүлээх шаардлагатай тул Promise буцаана.
 */
export function captureMapCanvas(map: OLMap): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    map.once("rendercomplete", () => {
      const size = map.getSize();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!size || !ctx) {
        resolve(null);
        return;
      }
      canvas.width = size[0];
      canvas.height = size[1];

      Array.from(
        map.getViewport().querySelectorAll<HTMLCanvasElement>(".ol-layer canvas, canvas.ol-layer"),
      ).forEach((layerCanvas) => {
        if (layerCanvas.width === 0) return;
        const parent = layerCanvas.parentElement;
        const opacityStr = parent?.style.opacity || layerCanvas.style.opacity;
        ctx.globalAlpha = opacityStr === "" ? 1 : Number(opacityStr);

        const match = layerCanvas.style.transform.match(/^matrix\(([^)]*)\)$/);
        if (match) {
          const [a, b, c, d, e, f] = match[1].split(",").map(Number);
          ctx.setTransform(a, b, c, d, e, f);
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.drawImage(layerCanvas, 0, 0);
      });
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resolve(canvas);
    });
    map.renderSync();
  });
}

/**
 * Гарчиг, газрын зураг, таних тэмдэг (легенд)-ийг А4 харьцаатай нэг хуудсан зураг болгож
 * зурна — энэ нь урьдчилан харах модал болон PDF-д адилхан ашиглагдана.
 */
export interface ComposePageOptions {
  title: string;
  orientation: PrintOrientation;
  paper?: PrintPaperSize;
  legend?: PrintLegendItem[];
  viewInfo?: PrintMapViewInfo | null;
  info?: PrintInfo;
}

export function composePrintPage(
  mapCanvas: HTMLCanvasElement,
  opts: ComposePageOptions,
): HTMLCanvasElement {
  const {
    title,
    orientation,
    paper = "A4",
    legend = [],
    viewInfo = null,
    info = {},
  } = opts;
  const { width, height } = pageSizePx(orientation, paper);
  const page = document.createElement("canvas");
  page.width = width;
  page.height = height;
  const ctx = page.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const margin = PAGE_MARGIN;
  const titleAreaH = PAGE_TITLE_AREA_H;

  /* ── ТОЛГОЙ ────────────────────────────────────────────────────────
     Дээд мөр: ЖИЖИГ лого + байгууллагын нэр (голлуулсан).
     Доор нь: ГАРЧИГ — хуудасны БҮТЭН өргөнөөр, шаардвал олон мөрөөр.
     Байгууллага гарчгийн хажууд БИШ дээр байгаа тул гарчиг бүтэн зайг эзэлнэ. */
  const orgRowY = margin + PAGE_ORG_ROW_H / 2;
  if (info.orgName || info.logo) {
    const orgText = (info.orgName ?? "").toUpperCase();
    ctx.font = "bold 9.5px sans-serif";
    const textW = orgText ? ctx.measureText(orgText).width : 0;
    const logoH = info.logo ? PAGE_ORG_ROW_H - 4 : 0;
    const logoW = info.logo ? (info.logo.width / info.logo.height) * logoH || logoH : 0;
    const gap = info.logo && orgText ? 6 : 0;
    // ЗҮҮН тийш шахна (өмнө нь голлуулсан байсан).
    let x = margin;
    void textW;
    if (info.logo) {
      ctx.drawImage(info.logo, x, orgRowY - logoH / 2, logoW, logoH);
      x += logoW + gap;
    }
    if (orgText) {
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
  const titleH = titleAreaH - PAGE_ORG_ROW_H;
  const titleMaxWidth = width - margin * 2 - 16;
  const { lines: titleLines, fontSize: titleFontSize, lineHeight: titleLineH } = layoutTitle(
    ctx,
    title.toUpperCase(),
    titleMaxWidth,
    titleH - 6,
  );
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  const titleBlockH = titleLines.length * titleLineH;
  const titleStartY = titleTop + (titleH - titleBlockH) / 2 + titleLineH / 2;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, width / 2, titleStartY + i * titleLineH);
  });

  const mapAreaX = margin;
  const mapAreaY = margin + titleAreaH;
  const mapAreaW = width - margin * 2;
  const mapAreaH = height - mapAreaY - margin;

  // "cover" байдлаар зурна — mapArea-г бүхэлд нь дүүргэж, хэтэрсэн хэсгийг тайрна
  // (Math.min биш Math.max), учир нь зурган дээрх шиг газрын зураг хуудсыг бүрэн дүүргэсэн
  // харагдацтай байх ёстой, хоосон захтай "contain" биш.
  const coverScale = Math.max(mapAreaW / mapCanvas.width, mapAreaH / mapCanvas.height);
  const drawW = mapCanvas.width * coverScale;
  const drawH = mapCanvas.height * coverScale;
  const drawX = mapAreaX + (mapAreaW - drawW) / 2;
  const drawY = mapAreaY + (mapAreaH - drawH) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapAreaX, mapAreaY, mapAreaW, mapAreaH);
  ctx.clip();
  ctx.drawImage(mapCanvas, drawX, drawY, drawW, drawH);
  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapAreaX + 0.5, mapAreaY + 0.5, mapAreaW, mapAreaH);

  // Таних тэмдэг ба мэдээллийн карт хоёр НЭГ доод зурваст зэрэгцэнэ.
  const cardBottom = mapAreaY + mapAreaH - CARD_INSET;
  let legendRight = mapAreaX + CARD_INSET;
  if (legend.length) {
    /* ӨНДӨР нь мэдээллийн карттай ЯГ ИЖИЛ (INFO_CARD_H) — хоёр карт нэг
       шугамд эгнэнэ. Элемент олон бол мөрийг ЖИЖИГРҮҮЛЭХГҮЙ, оронд нь
       ХОЁР БАГАНА болгоно (жижиг үсэг цаасан дээр уншигдахгүй). */
    const legendH = INFO_CARD_H;
    const headerH = 26;
    const rowH = 15;
    const maxRows = Math.max(1, Math.floor((legendH - headerH - 6) / rowH));
    const cols = Math.min(2, Math.ceil(legend.length / maxRows));
    const perCol = Math.ceil(legend.length / cols);

    ctx.font = "bold 11px sans-serif";
    const titleTextWidth = ctx.measureText("Таних тэмдэг").width;
    ctx.font = "10px sans-serif";
    const maxRowTextWidth = Math.max(...legend.map((item) => ctx.measureText(item.label).width));
    const colW = Math.max(140, maxRowTextWidth + 34);
    const legendW = Math.max(titleTextWidth + 20, colW * cols + 10);
    const legendX = mapAreaX + CARD_INSET;
    const legendY = cardBottom - legendH;
    legendRight = legendX + legendW + CARD_INSET;

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, legendX, legendY, legendW, legendH, 6);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Таних тэмдэг", legendX + 10, legendY + 8);

    ctx.font = "10px sans-serif";
    legend.forEach((item, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = legendX + 10 + col * colW;
      const swatchY = legendY + headerH + row * rowH + rowH / 2;
      if (item.line) {
        // Хилийн давхарга — ШУГАМААР (хэвлэхэд дүүргэлт байхгүй тул
        // дөрвөлжин тэмдэг нь бодит харагдацтай таарахгүй).
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, swatchY);
        ctx.lineTo(x + 14, swatchY);
        ctx.stroke();
      } else {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, swatchY - 5, 14, 10);
      }
      ctx.fillStyle = "#334155";
      ctx.textBaseline = "middle";
      ctx.fillText(ellipsize(ctx, item.label, colW - 24), x + 18, swatchY);
      ctx.textBaseline = "top";
    });
  }

  // ЗҮГ ЧИГИЙН тэмдэг — газрын зургийн баруун дээд булан
  drawNorthArrow(ctx, mapAreaX + mapAreaW - 32, mapAreaY + 32, 20);

  /* ── МЭДЭЭЛЛИЙН КАРТ ───────────────────────────────────────────────
     Таних тэмдэгтэй ЯГ ИЖИЛ хэлбэр (цагаан дэвсгэр, ижил хүрээ) —
     газрын зургийн ДЭЭР хөвнө. Чөлөөлөлтийн хилийг дуудагч тал нь
     доод зурваст оруулахгүй байрлуулдаг тул энэ карт хилийг халхлахгүй. */
  const infoX = legendRight;
  const infoW = mapAreaX + mapAreaW - CARD_INSET - infoX;
  const infoY = cardBottom - INFO_CARD_H;

  if (infoW > 200) {
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, infoX, infoY, infoW, INFO_CARD_H, 6);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Гарчиг — таних тэмдэгтэй ижил хэлбэр
    ctx.fillStyle = "#334155";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Дэлгэрэнгүй мэдээлэл", infoX + 12, infoY + 8);

    const padX = 12;
    const rowH = 17;
    const pieBoxW = 108;
    const colW = (infoW - padX * 2 - pieBoxW) / 2;
    const col1X = infoX + padX;
    const col2X = col1X + colW;
    const pieCx = col2X + colW + pieBoxW / 2;

    const drawRow = (x: number, y: number, label: string, value: string, maxW: number) => {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "9.5px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(label, x, y);
      const labelW = Math.min(ctx.measureText(label).width + 5, maxW * 0.6);
      ctx.font = "bold 10.5px sans-serif";
      ctx.fillStyle = "#1e293b";
      // fillText-ийн maxWidth нь текстийг ШАХДАГ тул оронд нь тайрч "…" залгана.
      ctx.fillText(ellipsize(ctx, value || "—", maxW - labelW), x + labelW, y);
    };

    let y = infoY + 34;
    drawRow(col1X, y, "Төлөвлөлтийн дугаар:", info.planCode || "—", colW - 8); y += rowH;
    drawRow(col1X, y, "Төлөвлөлтийн нэр:", info.planName || "—", colW - 8); y += rowH;
    drawRow(col1X, y, "Чөлөөлөх талбай:", areaText(info.acquisitionAreaM2), colW - 8); y += rowH;
    drawRow(col1X, y, "Нэгж талбаруудын нийт талбай:", areaText(info.parcelsAreaM2), colW - 8); y += rowH;
    if (viewInfo) {
      const denominator = computeScaleDenominator(viewInfo, coverScale);
      if (denominator > 0) drawRow(col1X, y, "Масштаб:", `1:${denominator.toLocaleString("en-US")}`, colW - 8);
    }

    y = infoY + 34;
    const dept = [info.departmentCode, info.departmentName].filter(Boolean).join(" · ");
    drawRow(col2X, y, "Хэлтэс:", dept || "—", colW - 8); y += rowH;
    drawRow(col2X, y, "Явц:", info.statusName || "—", colW - 8); y += rowH;
    drawRow(col2X, y, "Хариуцсан:", (info.specialists ?? []).join(", ") || "—", colW - 8); y += rowH;
    drawRow(col2X, y, "Огноо:", formatDateDots(new Date()), colW - 8);

    const pieCy = infoY + 30 + (INFO_CARD_H - 30) / 2 - 6;
    const pieR = Math.min(32, INFO_CARD_H / 2 - 16);
    drawProgressPie(ctx, pieCx, pieCy, pieR, info.progressBreakdown ?? []);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0acf97";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`${Math.round(info.progressPercent ?? 0)}%`, pieCx, pieCy);
    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.fillText("Гүйцэтгэл", pieCx, infoY + INFO_CARD_H - 11);
  }

  return page;
}

/**
 * Урьдчилан бэлдсэн хуудасны canvas-ыг A4 хэмжээтэй PDF болгож татаж авна.
 */
export async function downloadCanvasAsPdf(
  canvas: HTMLCanvasElement,
  orientation: PrintOrientation,
  fileName = "gazriin-zurag",
  paper: PrintPaperSize = "A4",
): Promise<void> {
  const pngBytes = await fetch(canvas.toDataURL("image/png")).then((r) => r.arrayBuffer());

  const pt = PAPER_PT[paper];
  const pageSize = orientation === "landscape" ? { width: pt.height, height: pt.width } : pt;

  const pdfDoc = await PDFDocument.create();
  const png = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  page.drawImage(png, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
