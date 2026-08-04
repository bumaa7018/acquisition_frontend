import type ExcelJSType from "exceljs";
import {
  COLUMN_COUNT,
  COLUMN_WIDTHS,
  HEADER_HEIGHTS,
  HEADER_MERGES,
  HEADER_TEXTS,
  PAGE_SETUP,
  SHEET_NAME,
  SHEET_VIEWS,
  STYLES,
  type CellStyleSpec,
} from "./gchh2-spec.ts";

// ГЧХ АЖЛЫН МЭДЭЭ — Excel үүсгэгч.
//
// ЗАГВАР ФАЙЛ УНШИХГҮЙ: бүтэц нь `gchh2-spec.ts`-д код хэлбэрээр байгаа ба
// workbook-ыг эндээс шинээр угсарна. Иймд `public/reports/*.xlsx` нь runtime-ийн
// хамаарал БИШ (тэр хавтас хэрэглэгчийн эзэмшилд).
//
// Загварын бүтэц (мөр 1-3 гарчиг, 4-өөс өгөгдөл):
//   A  Хариуцах хэлтэс      (бүх өгөгдлийн мөрөөр нэгтгэсэн, 90° эргүүлсэн)
//   B  Ерөнхий ангилал      (ангилал тус бүрээр нэгтгэсэн, 90°)
//   C  Дэд ангилал          (дэд ангилал тус бүрээр нэгтгэсэн)
//   D  Дүүрэг хороо   E  Ажлын нэр   F  Хариуцсан мэргэжилтэн
//   G  Нэгж талбарын тоо    H  Талбайн хэмжээ /га/
//   I..BA  чөлөөлөлтийн статусын задаргаа — ЗАГВАРТ ХООСОН (гараар бөглөдөг
//          хэлбэр) тул мөн хоосон, зөвхөн стильтэй үлдэнэ.
//   BB Ажлын хувь           (загварт зөвхөн нийт дүнгийн мөрд томъёо)

/** Нэгж талбарын тоо + талбай (га) — 2 баганатай хэмжигдэхүүн */
export interface CountArea {
  count: number;
  areaHa: number;
}

/** Нэгж талбар + талбай + мөнгөн дүн (тэрбум ₮) — 3 баганатай хэмжигдэхүүн */
export interface CountAreaMoney extends CountArea {
  /** тэрбум төгрөг */
  moneyBn: number;
}

/**
 * Чөлөөлөлтийн задаргаа — загварын "N оноос өмнө чөлөөлсөн" ба "N онд
 * чөлөөлсөн" блокуудын 5 дэд хэмжигдэхүүн + нийт.
 */
export interface ReleaseBreakdown {
  /** Дүйцүүлж чөлөөлсөн (зөвхөн газраар нөхсөн) */
  landSwap: CountArea;
  /** Нөлөөллөөс гаргасан */
  removed: CountArea;
  /** Газар эзэмших, ашиглах эрхийг цуцалсан — ӨГӨГДӨЛ БАЙХГҮЙ (хоосон) */
  revoked: CountArea;
  /** Нөхөх олговор олгосон (зөвхөн мөнгө) */
  cash: CountAreaMoney;
  /** Дүйцүүлж газар олгосон + нөхөх олговор олгосон (хоёулаа) */
  both: CountAreaMoney;
  /** Нийт чөлөөлсөн */
  total: CountAreaMoney;
}

/** Ажил (нэг чөлөөлөлт) — загварын нэг мөр */
export interface Gchh2Work {
  /** D — Дүүрэг хороо */
  district: string;
  /** E — Ажлын нэр */
  name: string;
  /** F — Хариуцсан мэргэжилтэн */
  specialist: string;
  /** G — Нэгж талбарын тоо */
  parcelCount: number | null;
  /** H — Талбайн хэмжээ, га */
  areaHa: number | null;
  /** I..X — сонгосон оноос ӨМНӨ чөлөөлсөн */
  before?: ReleaseBreakdown;
  /** U — Үндэслэл (захирамж) */
  basis?: string;
  /** AA..AO — сонгосон ОНД чөлөөлсөн */
  current?: ReleaseBreakdown;
  /** Y,Z — тухайн онд ЧӨЛӨӨЛӨХ (төлөвлөгөө: онд чөлөөлсөн + хараахан чөлөөлөөгүй) */
  plannedCurrent?: CountArea;
  /** AP..AR — Чөлөөлөх шатандаа */
  inProgress?: CountAreaMoney;
  /** AS..AU — Чөлөөлөөгүй: хөрөнгийн үнэлгээ хийгдсэн */
  notReleasedValued?: CountAreaMoney;
  /** AV..AX — Чөлөөлөөгүй: хөрөнгийн үнэлгээ хийгдээгүй */
  notReleasedUnvalued?: CountAreaMoney;
  /** AY..BA — Нийт чөлөөлөөгүй */
  notReleasedTotal?: CountAreaMoney;
  /** BB — Ажлын хувь (0..1) */
  progressPct?: number | null;
}

export interface Gchh2SubCategory {
  name: string;
  works: Gchh2Work[];
}

export interface Gchh2GeneralCategory {
  name: string;
  subs: Gchh2SubCategory[];
}

export interface Gchh2Report {
  /** A — Хариуцах хэлтэс */
  department: string;
  categories: Gchh2GeneralCategory[];
  /**
   * Тайлангийн ХУВААХ ОН. Загварт "2025 оноос өмнө"/"2026 онд" гэж хатуу
   * бичигдсэн байсныг сонгосон шүүлтийн оноор ХӨДӨЛГӨӨНТЭЙ болгов:
   *   I..X   — `<pivotYear> оноос өмнө чөлөөлсөн`  (status_date-ийн он < pivotYear)
   *   AA..AO — `<pivotYear> онд чөлөөлсөн`         (status_date-ийн он = pivotYear)
   * Заагаагүй бол загварын он хэвээр үлдэнэ.
   */
  pivotYear?: number;
}

/**
 * "Нийт N ..." шошгонд ангиллын нэрийг загварын бичлэгийн хэлбэрт оруулна.
 * Загварт ангиллын нэр нь дэд ангилалд ЖИЖИГ үсгээр ("Авто зам" → "авто зам"),
 * ерөнхий ангилал нь БҮТЭН ТОМ үсгээр хадгалагддаг ч шошгонд жижгээр бичигддэг
 * ("АВТО ЗАМ, ЗАМЫН БАЙГУУЛАМЖ" → "авто зам, замын байгууламж").
 */
function labelName(name: string): string {
  if (!name) return "";
  // Бүтэн том үсгээр бичсэн бол бүхэлд нь жижиг болгоно, үгүй бол зөвхөн эхний үсэг
  const isAllCaps =
    name === name.toLocaleUpperCase("mn") &&
    name.toLocaleLowerCase("mn") !== name.toLocaleUpperCase("mn");
  return isAllCaps
    ? name.toLocaleLowerCase("mn")
    : name.charAt(0).toLocaleLowerCase("mn") + name.slice(1);
}

/** SUM-ийн хүрээ — нэг мөр бол загварын адил `SUM(G41)` хэлбэртэй. */
function sumRange(col: string, from: number, to: number): string {
  return from === to ? `SUM(${col}${from})` : `SUM(${col}${from}:${col}${to})`;
}

/** Excel баганын дугаарыг (1-based) A1 хэлбэрийн үсэг болгоно. */
export function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Спекийн стилийг exceljs-ийн cell дээр тавина. */
function applyStyle(cell: ExcelJSType.Cell, s: CellStyleSpec): void {
  cell.font = {
    name: "Arial",
    family: 2,
    size: s.font.size ?? 11,
    bold: s.font.bold ?? false,
    ...(s.font.color ? { color: { argb: s.font.color } } : {}),
  };
  if (s.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: s.fill },
    };
  }
  if (s.align) {
    cell.alignment = s.align as Partial<ExcelJSType.Alignment>;
  }
  if (s.numFmt) cell.numFmt = s.numFmt;
  if (s.border) {
    const [t, l, b, r] = s.border;
    const e = (v: string | null) =>
      v ? ({ style: v } as Partial<ExcelJSType.Border>) : undefined;
    cell.border = {
      ...(e(t) ? { top: e(t) as ExcelJSType.Border } : {}),
      ...(e(l) ? { left: e(l) as ExcelJSType.Border } : {}),
      ...(e(b) ? { bottom: e(b) as ExcelJSType.Border } : {}),
      ...(e(r) ? { right: e(r) as ExcelJSType.Border } : {}),
    };
  }
}

/**
 * ОНУУДЫН ЗАДАРГААНЫ баганууд — I..AO (9..41):
 *   I..X   "<он> оноос өмнө чөлөөлсөн" (+ U Үндэслэл, V..X Нийт чөлөөлсөн)
 *   Y..Z   "<он> онд чөлөөлөх"
 *   AA..AO "<он> онд чөлөөлсөн"
 *
 * Загварт эдгээр нь өнгөт дэвсгэртэй боловч ХЭРЭГЛЭГЧИЙН ХҮСЭЛТЭЭР өнгө
 * тавихгүй — текст, хүрээ, форматыг хэвээр үлдээж зөвхөн fill-ийг хасна.
 */
const NO_FILL_COLS = new Set(Array.from({ length: 33 }, (_, i) => 9 + i)); // 9..41

/** Мөрийн бүх 54 баганад тухайн төрлийн стилийг тавина. */
function styleRow(
  ws: ExcelJSType.Worksheet,
  rowNo: number,
  specs: CellStyleSpec[],
): void {
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    const s = specs[c - 1];
    applyStyle(
      ws.getCell(rowNo, c),
      NO_FILL_COLS.has(c) && s.fill ? { ...s, fill: undefined } : s,
    );
  }
}

/**
 * Нэгтгэсэн (merge) хүрээний ГАДНА КОНТУРЫГ зөв болгоно.
 *
 * ЯАГААД ХЭРЭГТЭЙ: exceljs-д нэгтгэсэн хүрээний бүх нүд НЭГ стилийг хуваалцдаг
 * (slave-д өөр border тавих боломжгүй) — харин загварт нүд тус бүр өөрийн
 * border-тай. Excel нь merge-ийн ДОТООД шугамыг зурдаггүй, зөвхөн периметрийг
 * гадна талын нүднүүдээс авдаг. Иймд master-т периметрийн нийлбэрийг тавихад
 * дүрслэл загвартай ЯГ ижил болно:
 *   top    ← зүүн-дээд нүд      left  ← зүүн-дээд нүд
 *   right  ← баруун-дээд нүд    bottom ← зүүн-доод нүд
 */
function fixMergeBorder(
  ws: ExcelJSType.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  styleAt: (r: number, c: number) => CellStyleSpec,
): void {
  const b = (s: CellStyleSpec) => s.border ?? [null, null, null, null];
  const top = b(styleAt(r1, c1))[0];
  const left = b(styleAt(r1, c1))[1];
  const bottom = b(styleAt(r2, c1))[2];
  const right = b(styleAt(r1, c2))[3];
  const e = (v: BorderLike) => (v ? ({ style: v } as ExcelJSType.Border) : undefined);
  const master = ws.getCell(r1, c1);
  master.border = {
    ...(e(top) ? { top: e(top) } : {}),
    ...(e(left) ? { left: e(left) } : {}),
    ...(e(bottom) ? { bottom: e(bottom) } : {}),
    ...(e(right) ? { right: e(right) } : {}),
  };
}

type BorderLike = string | null | undefined;

/** "I1:T1" → {r1,c1,r2,c2} */
function parseRange(range: string): { r1: number; c1: number; r2: number; c2: number } {
  const [a, b] = range.split(":");
  const p = (addr: string) => {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) throw new Error(`Буруу хаяг: ${addr}`);
    let c = 0;
    for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c, r: Number(m[2]) };
  };
  const A = p(a);
  const B = p(b ?? a);
  return { r1: A.r, c1: A.c, r2: B.r, c2: B.c };
}

// ── Чөлөөлөлтийн задаргааны баганын зураглал ──────────────────────────────
// Загварын гарчигтай нэг нэгээр тохирно (1-based Excel баганын дугаар).
const COL = {
  // "<он> оноос өмнө чөлөөлсөн"
  beforeLandSwap: 9, // I,J   Дүйцүүлж чөлөөлсөн
  beforeRemoved: 11, // K,L   Нөлөөллөөс гаргасан
  beforeRevoked: 13, // M,N   Эрхийг цуцалсан (өгөгдөл байхгүй)
  beforeCash: 15, // O,P,Q Нөхөх олговор олгосон
  beforeBoth: 18, // R,S,T Дүйцүүлж + нөхөх олговор
  basis: 21, // U     Үндэслэл
  beforeTotal: 22, // V,W,X Нийт чөлөөлсөн
  plannedCurrent: 25, // Y,Z  "<он> онд чөлөөлөх" (төлөвлөгөө)
  // "<он> онд чөлөөлсөн"
  curLandSwap: 27, // AA,AB
  curRemoved: 29, // AC,AD
  curRevoked: 31, // AE,AF (өгөгдөл байхгүй)
  curCash: 33, // AG,AH,AI
  curBoth: 36, // AJ,AK,AL
  curTotal: 39, // AM,AN,AO
  inProgress: 42, // AP,AQ,AR Чөлөөлөх шатандаа
  notValued: 45, // AS,AT,AU Чөлөөлөөгүй / үнэлгээ хийгдсэн
  notUnvalued: 48, // AV,AW,AX Чөлөөлөөгүй / үнэлгээ хийгдээгүй
  notTotal: 51, // AY,AZ,BA Нийт чөлөөлөөгүй
  progressPct: 54, // BB    Ажлын хувь
} as const;

/** count/area (2 багана) бичнэ. 0 бол хоосон үлдээнэ (загварын харагдац). */
function putCA(ws: ExcelJSType.Worksheet, row: number, col: number, v?: CountArea): void {
  if (!v) return;
  if (v.count) ws.getCell(row, col).value = v.count;
  if (v.areaHa) ws.getCell(row, col + 1).value = v.areaHa;
}

/** count/area/money (3 багана) бичнэ. */
function putCAM(
  ws: ExcelJSType.Worksheet,
  row: number,
  col: number,
  v?: CountAreaMoney,
): void {
  if (!v) return;
  putCA(ws, row, col, v);
  if (v.moneyBn) ws.getCell(row, col + 2).value = v.moneyBn;
}

/** Нэг ажлын мөрд I..BB баганын задаргааг бичнэ. */
function writeReleaseColumns(
  ws: ExcelJSType.Worksheet,
  row: number,
  w: Gchh2Work,
): void {
  if (w.before) {
    putCA(ws, row, COL.beforeLandSwap, w.before.landSwap);
    putCA(ws, row, COL.beforeRemoved, w.before.removed);
    putCA(ws, row, COL.beforeRevoked, w.before.revoked);
    putCAM(ws, row, COL.beforeCash, w.before.cash);
    putCAM(ws, row, COL.beforeBoth, w.before.both);
    putCAM(ws, row, COL.beforeTotal, w.before.total);
  }
  if (w.basis) ws.getCell(row, COL.basis).value = w.basis;
  putCA(ws, row, COL.plannedCurrent, w.plannedCurrent);
  if (w.current) {
    putCA(ws, row, COL.curLandSwap, w.current.landSwap);
    putCA(ws, row, COL.curRemoved, w.current.removed);
    putCA(ws, row, COL.curRevoked, w.current.revoked);
    putCAM(ws, row, COL.curCash, w.current.cash);
    putCAM(ws, row, COL.curBoth, w.current.both);
    putCAM(ws, row, COL.curTotal, w.current.total);
  }
  putCAM(ws, row, COL.inProgress, w.inProgress);
  putCAM(ws, row, COL.notValued, w.notReleasedValued);
  putCAM(ws, row, COL.notUnvalued, w.notReleasedUnvalued);
  putCAM(ws, row, COL.notTotal, w.notReleasedTotal);
  if (w.progressPct != null) ws.getCell(row, COL.progressPct).value = w.progressPct;
}

/**
 * Нийт мөрүүдэд (дэд ангилал / ангилал / бүх дүн) томъёо тавих багануудын
 * жагсаалт. Загварт хоосон байсан ч бид өгөгдөл бичдэг болсон тул нийлбэр
 * ЗААВАЛ хэрэгтэй. U (Үндэслэл, текст) орохгүй.
 */
const AGG_COLS: number[] = [
  7,
  8, // G,H
  ...Array.from({ length: 12 }, (_, i) => 9 + i), // I..T
  ...Array.from({ length: 32 }, (_, i) => 22 + i), // V..BA
  54, // BB — Ажлын хувь (нийлбэр биш ДУНДАЖ)
];

/**
 * ГЧХ-2 тайланг шинээр угсарч xlsx буфер буцаана.
 *
 * `ExcelJS`-ийг дуудагч нь дамжуулна (route дээр dynamic import хийдэг —
 * exceljs нь serverComponentsExternalPackages-д бүртгэлтэй).
 */
export async function buildGchh2Workbook(
  ExcelJS: typeof ExcelJSType,
  report: Gchh2Report,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME, {
    pageSetup: PAGE_SETUP as Partial<ExcelJSType.PageSetup>,
    views: SHEET_VIEWS as ExcelJSType.WorksheetView[],
  });

  // ── Багана өргөн ────────────────────────────────────────────────────────
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    const w = COLUMN_WIDTHS[c - 1];
    if (w != null) ws.getColumn(c).width = w;
  }

  // Мөр → стилийн массивын бүртгэл. Merge-ийн периметрийг тооцоолоход
  // "тухайн мөр/баганын стиль" хэрэгтэй тул хөтөлнө.
  const rowStyles = new Map<number, CellStyleSpec[]>();
  const styleAt = (r: number, c: number): CellStyleSpec =>
    (rowStyles.get(r) ?? STYLES.data)[c - 1];

  // ── Гарчиг (1-3 мөр) ────────────────────────────────────────────────────
  // pivotYear өгсөн бол гарчигт хатуу бичигдсэн оныг (2025/2026) орлуулна.
  const retitle = (s: string): string =>
    report.pivotYear ? s.replace(/20\d\d/g, String(report.pivotYear)) : s;

  for (let r = 1; r <= 3; r++) {
    const texts = HEADER_TEXTS[r - 1];
    for (let c = 1; c <= COLUMN_COUNT; c++) {
      if (texts[c - 1]) ws.getCell(r, c).value = retitle(texts[c - 1]);
    }
    const specs = r === 1 ? STYLES.h1 : r === 2 ? STYLES.h2 : STYLES.h3;
    rowStyles.set(r, specs);
    styleRow(ws, r, specs);
    const h = HEADER_HEIGHTS[r - 1];
    if (h != null) ws.getRow(r).height = h;
  }
  for (const m of HEADER_MERGES) {
    ws.mergeCells(m);
    const { r1, c1, r2, c2 } = parseRange(m);
    fixMergeBorder(ws, r1, c1, r2, c2, styleAt);
  }

  // ── Өгөгдөл ─────────────────────────────────────────────────────────────
  const DATA_START = 4;
  let row = DATA_START;
  const catTotalRows: number[] = [];

  for (const cat of report.categories) {
    const catStart = row;
    const subTotalRows: number[] = [];
    let catWorkCount = 0;

    for (const sub of cat.subs) {
      const subStart = row;

      for (const w of sub.works) {
        rowStyles.set(row, STYLES.data);
        styleRow(ws, row, STYLES.data);
        ws.getCell(row, 4).value = w.district;
        ws.getCell(row, 5).value = w.name;
        ws.getCell(row, 6).value = w.specialist;
        if (w.parcelCount != null) ws.getCell(row, 7).value = w.parcelCount;
        if (w.areaHa != null) ws.getCell(row, 8).value = w.areaHa;
        writeReleaseColumns(ws, row, w);
        row++;
      }

      // Дэд ангиллын нийт мөр — загварын адил D:F нэгтгэж "Нийт N <нэр>"
      const subEnd = row - 1;
      rowStyles.set(row, STYLES.sub);
      styleRow(ws, row, STYLES.sub);
      ws.getCell(row, 4).value = `Нийт ${sub.works.length} ${labelName(sub.name)}`;
      if (sub.works.length > 0) {
        for (const c of AGG_COLS) {
          const L = colLetter(c);
          ws.getCell(row, c).value =
            c === COL.progressPct
              ? // Ажлын хувь — нийлбэр биш ДУНДАЖ
                { formula: `IFERROR(AVERAGE(${L}${subStart}:${L}${subEnd}),0)` }
              : { formula: sumRange(L, subStart, subEnd) };
        }
      }
      ws.mergeCells(`D${row}:F${row}`);
      fixMergeBorder(ws, row, 4, row, 6, styleAt);
      // C баганыг дэд ангиллын өгөгдөл + нийт мөрөөр нэгтгэнэ
      ws.getCell(subStart, 3).value = sub.name;
      if (row > subStart) {
        ws.mergeCells(`C${subStart}:C${row}`);
        fixMergeBorder(ws, subStart, 3, row, 3, styleAt);
      }
      subTotalRows.push(row);
      catWorkCount += sub.works.length;
      row++;
    }

    // Ерөнхий ангиллын нийт мөр — C:F нэгтгэнэ
    rowStyles.set(row, STYLES.cat);
    styleRow(ws, row, STYLES.cat);
    ws.getCell(row, 3).value = `Нийт ${catWorkCount} ${labelName(cat.name)}`;
    if (subTotalRows.length > 0) {
      for (const c of AGG_COLS) {
        const L = colLetter(c);
        ws.getCell(row, c).value =
          c === COL.progressPct
            ? {
                formula: `IFERROR(AVERAGE(${subTotalRows.map((r) => `${L}${r}`).join(",")}),0)`,
              }
            : { formula: `+${subTotalRows.map((r) => `${L}${r}`).join("+")}` };
      }
    }
    ws.mergeCells(`C${row}:F${row}`);
    fixMergeBorder(ws, row, 3, row, 6, styleAt);
    // B баганыг ангиллын бүх мөрөөр нэгтгэнэ
    ws.getCell(catStart, 2).value = cat.name;
    if (row > catStart) {
      ws.mergeCells(`B${catStart}:B${row}`);
      fixMergeBorder(ws, catStart, 2, row, 2, styleAt);
    }
    catTotalRows.push(row);
    row++;
  }

  // ── Бүх дүн ─────────────────────────────────────────────────────────────
  const grandRow = row;
  rowStyles.set(grandRow, STYLES.grand);
  styleRow(ws, grandRow, STYLES.grand);
  const totalWorks = report.categories.reduce(
    (n, c) => n + c.subs.reduce((m, s) => m + s.works.length, 0),
    0,
  );
  ws.getCell(grandRow, 2).value = `Нийт ${totalWorks} ажил`;
  ws.mergeCells(`B${grandRow}:F${grandRow}`);
  fixMergeBorder(ws, grandRow, 2, grandRow, 6, styleAt);
  if (catTotalRows.length > 0) {
    for (const c of AGG_COLS) {
      if (c === COL.progressPct) continue;
      const L = colLetter(c);
      ws.getCell(grandRow, c).value = {
        formula: `+${catTotalRows.map((r) => `${L}${r}`).join("+")}`,
      };
    }
    // BB (Ажлын хувь) — загварын адил ангиллын дүнгүүдийн ДУНДАЖ
    ws.getCell(grandRow, 54).value = {
      formula: `(${catTotalRows.map((r) => `BB${r}`).join("+")})/${catTotalRows.length}`,
    };
  }

  // A багана — хэлтсийн нэр, бүх өгөгдлийн мөрөөр нэгтгэнэ
  ws.getCell(DATA_START, 1).value = report.department;
  if (grandRow > DATA_START) {
    ws.mergeCells(`A${DATA_START}:A${grandRow}`);
    fixMergeBorder(ws, DATA_START, 1, grandRow, 1, styleAt);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
