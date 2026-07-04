// Excel-ээс 4 бүлэг өгөгдөл (газар, хөрөнгө, барилгын өртөг, зардал) задлах цөм логик.
// xlsx-аас хамааралгүй — sheet бүрийг мөр×баганын матриц (Grid) болгож дамжуулна.
// Ингэснээр node орчинд (React-гүй) шууд тестлэгдэнэ.

import { normalizeKey, normalizeText, parseNumber } from "./normalize.ts";
import { bestMatch, similarity } from "./fuzzy.ts";
import { detectKind, isLand } from "./kind.ts";
import type {
  AssetKind,
  ParsedAsset,
  ParsedBuildingCost,
  ParsedBuildingItem,
  ParsedClearance,
  ParsedLand,
  ParsedOrg,
  ParsedValuation,
} from "./types.ts";

export type Cell = string | number | null | undefined;
export type Grid = Cell[][];
export type Workbook = Record<string, Grid>;

// Логик sheet нэр → тааруулах target бичвэр(үүд).
const SHEET_TARGETS: Record<string, string[]> = {
  landInfo: ["газрын мэдээлэл", "өмчилсөн газарын мэдээлэл"],
  propertyDesc: ["хөрөнгийн тодорхойлолт", "үнэлж буй хөрөнгүүдийн танилцуулга"],
  buildingCost: ["барилга өртгийн хандлага", "хувийн сууц"],
  landValuation: ["газрын үнэлгээ"],
  otherAssets: ["бусад хөрөнгө"],
  clearance: ["түр сууршуулах", "газар чөлөөлөх зардал"],
  summary: ["нэгтгэл шинэ", "нэгтгэл"],
};

function text(c: Cell): string {
  return c == null ? "" : String(c);
}

function rowText(row: Grid[number]): string {
  return row.map(text).join(" ");
}

/** Тухайн мөрөн доторх хамгийн баруун талын тоон утга. */
function lastNumber(row: Grid[number]): number | null {
  for (let i = row.length - 1; i >= 0; i--) {
    const n = parseNumber(row[i]);
    if (n != null) return n;
  }
  return null;
}

/** Түлхүүр үг(үүд) агуулсан эхний мөрийн индексийг олно. */
function findRowIndex(grid: Grid, ...keywords: string[]): number {
  const keys = keywords.map(normalizeKey);
  return grid.findIndex((row) => {
    const rk = normalizeKey(rowText(row));
    return keys.some((k) => k && rk.includes(k));
  });
}

/** Excel workbook-ийн sheet нэрсээс логик нэр бүрийг fuzzy тааруулна. */
export function mapSheets(names: string[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const [logical, targets] of Object.entries(SHEET_TARGETS)) {
    let picked: string | null = null;
    let bestScore = 0;
    for (const target of targets) {
      const m = bestMatch(target, names, 0.75);
      if (m && m.score > bestScore) {
        bestScore = m.score;
        picked = m.value;
      }
    }
    map[logical] = picked;
  }
  return map;
}

// Байгууллагын sheet-ийн түлхүүр→талбар зураглал (col0 = түлхүүр, дараагийн нүд = утга).
const ORG_KEYS = [
  "гүйцэтгэгч",
  "улсын бүртгэлийн дугаар",
  "регистрийн дугаар",
  "захирал",
  "тусгай зөвшөөрөл",
  "байгууллагын хаяг",
  "байгууллагын утас",
];

/** Тухайн sheet нь "түлхүүр | утга" бүтэцтэй байгууллагын мэдээлэл мөн эсэхийг оноогоор шалгах. */
function orgSheetScore(g: Grid): number {
  let score = 0;
  for (const key of ORG_KEYS) {
    const nk = normalizeKey(key);
    const hit = g.some((row) => {
      const c0 = normalizeKey(text(row[0]));
      return c0.includes(nk) && c0.length <= nk.length + 12 && text(row[1]).trim() !== "";
    });
    if (hit) score++;
  }
  return score;
}

/** Үнэлгээний байгууллагын мэдээлэл (түлхүүр→утга хосуудтай sheet). */
export function extractOrg(wb: Workbook, names: string[]): ParsedOrg {
  // "түлхүүр | утга" бүтэцтэй sheet-ийг оноогоор нь сонгоно (ихэвчлэн "Sheet1").
  let orgName: string | null = null;
  let best = 0;
  for (const n of names) {
    const s = orgSheetScore(wb[n]);
    if (s > best) {
      best = s;
      orgName = n;
    }
  }
  const g = orgName && best >= 2 ? wb[orgName] : [];
  const val = (...kw: string[]): string => {
    const keys = kw.map(normalizeKey);
    const row = g.find((r) => {
      const c0 = normalizeKey(text(r[0]));
      return keys.some((k) => k && c0.includes(k) && c0.length <= k.length + 20);
    });
    if (!row) return "";
    for (let c = 1; c < row.length; c++) {
      if (text(row[c]).trim()) return text(row[c]).trim();
    }
    return "";
  };
  return {
    name: val("гүйцэтгэгч"),
    stateRegNo: val("улсын бүртгэлийн дугаар"),
    regNo: val("регистрийн дугаар"),
    director: val("захирал"),
    license: val("тусгай зөвшөөрөл"),
    address: val("байгууллагын хаяг"),
    contact: val("байгууллагын утас"),
  };
}

/** Газрын мэдээлэл + газрын үнэлгээ + тодорхойлолтоос land мэдээлэл цуглуулах. */
export function extractLand(
  wb: Workbook,
  sheetMap: Record<string, string | null>,
): ParsedLand {
  const land: ParsedLand = {
    ownerName: "",
    certNo: "",
    parcelNo: "",
    affectedAreaM2: null,
    basePriceM2: null,
    totalValue: null,
    description: "",
  };

  // ── газрын үнэлгээ: суурь үнэ, талбай, нийт үнэ ──
  const gv = sheetMap.landValuation ? wb[sheetMap.landValuation] : null;
  if (gv) {
    const priceIdx = findRowIndex(gv, "захирамж");
    if (priceIdx >= 0) land.basePriceM2 = lastNumber(gv[priceIdx]);
    const totalIdx = findRowIndex(gv, "газрын үнэ");
    if (totalIdx >= 0) land.totalValue = lastNumber(gv[totalIdx]);
    // талбай: "газар ... хэмжээ" мөрийн тоон утга
    const areaIdx = gv.findIndex((row) => {
      const rk = normalizeKey(rowText(row));
      return rk.includes("газар") && rk.includes("хэмжээ");
    });
    if (areaIdx >= 0) land.affectedAreaM2 = lastNumber(gv[areaIdx]);
  }

  // ── газрын мэдээлэл: өмчлөгч, чөлөөлөлтөнд өртсөн талбай ──
  const gi = sheetMap.landInfo ? wb[sheetMap.landInfo] : null;
  if (gi) {
    // Толгойн доорх эхний өгөгдлийн мөр (col0 нь тоо)
    const dataRow = gi.find((row) => parseNumber(row[0]) != null && text(row[1]).trim());
    if (dataRow) {
      land.ownerName = text(dataRow[1]).trim();
      if (land.affectedAreaM2 == null) {
        // "Газар чөлөөлөлтөнд өртөж хасагдах талбай" баганаас
        for (let c = 3; c < dataRow.length; c++) {
          const n = parseNumber(dataRow[c]);
          if (n != null) {
            land.affectedAreaM2 = n;
            break;
          }
        }
      }
    }
  }

  // ── хөрөнгийн тодорхойлолт: "Газар" мөрийн тодорхойлолт + гэрчилгээ/нэгж талбар ──
  const pd = sheetMap.propertyDesc ? wb[sheetMap.propertyDesc] : null;
  if (pd) {
    const c = detectPropDescCols(pd);
    const landRow = pd.find((row) => {
      if (parseNumber(row[c.seq]) == null) return false;
      const tk = c.type >= 0 ? typeToKind(text(row[c.type])) : null;
      return tk === "land" || isLand(text(row[c.name]));
    });
    if (landRow) {
      const desc = text(landRow[c.desc] ?? landRow[landRow.length - 1]).trim();
      land.description = desc;
      const cert = desc.match(/[А-ЯӨҮ]-\d{6,}/);
      if (cert) land.certNo = cert[0];
      const parcel = desc.match(/\b\d{11,}\b/);
      if (parcel) land.parcelNo = parcel[0];
      if (land.affectedAreaM2 == null) land.affectedAreaM2 = parseNumber(landRow[c.qty]);
    }
  }

  // Дутуу утгыг нөхөж тооцоолол хийх
  if (land.basePriceM2 == null && land.totalValue != null && land.affectedAreaM2) {
    land.basePriceM2 = land.totalValue / land.affectedAreaM2;
  }
  if (land.totalValue == null && land.basePriceM2 != null && land.affectedAreaM2 != null) {
    land.totalValue = land.basePriceM2 * land.affectedAreaM2;
  }
  return land;
}

// Хөрөнгийн төрлийн текстээс kind тодорхойлох ("Үл хөдлөх"/"Эд хөрөнгө"/"Газар").
function typeToKind(t: string): "real_state" | "property" | "land" | null {
  const k = normalizeKey(t);
  if (!k) return null;
  if (k.includes("газар")) return "land";
  if (k.includes("үлхөдлөх") || k === "үхх") return "real_state";
  if (k.includes("эдхөрөнгө") || k === "эх") return "property";
  return null;
}

interface PropDescCols {
  headerIdx: number;
  seq: number;
  name: number;
  type: number; // -1 = байхгүй (хуучин формат)
  unit: number;
  qty: number;
  desc: number;
}

/**
 * "Хөрөнгийн тодорхойлолт" хүснэгтийн баганын байрлалыг ТОЛГОЙГООР нь тодорхойлно.
 * Загвар өөрчлөгдөж "Хөрөнгийн төрөл" багана нэмэгдсэн тул бэхлэсэн индекс ашиглахгүй.
 */
function detectPropDescCols(grid: Grid): PropDescCols {
  const headerIdx = grid.findIndex((row) => {
    const rk = normalizeKey(rowText(row));
    return rk.includes("хөрөнгийннэр") || rk.includes("талбайнхэмжээ") || (rk.includes("төрөл") && rk.includes("хэмжээ"));
  });
  const cols: PropDescCols = { headerIdx, seq: 0, name: 1, type: -1, unit: 2, qty: 3, desc: 4 };
  if (headerIdx < 0) return cols;
  const h = grid[headerIdx];
  for (let i = 0; i < h.length; i++) {
    const k = normalizeKey(h[i]);
    if (!k) continue;
    if (k.includes("төрөл")) cols.type = i;
    else if (k.includes("тодорхойл")) cols.desc = i;
    else if (k.includes("нэр")) cols.name = i;
    else if (k.includes("хэмжих") || k.includes("хэмжиг")) cols.unit = i;
    else if (k.includes("талбай") || k.includes("хэмжээ")) cols.qty = i;
  }
  return cols;
}

/**
 * Барилга өртгийн хандлагын sheet-ээс барилга бүрийн (багана бүрийн) өртгийн задаргаа.
 * Загвар нь барилга бүрийг ХОЙШ БАГАНА болгон нэмдэг (Байшин-1, Байшин-2 ...).
 */
export function extractBuildingCosts(grid: Grid | null): ParsedBuildingCost[] {
  if (!grid) return [];
  const headerIdx = findRowIndex(grid, "үзүүлэлт");
  if (headerIdx < 0) return [];
  const header = grid[headerIdx];
  let unitCol = header.findIndex((c) => {
    const k = normalizeKey(c);
    return k.includes("хэмжих") || k.includes("хэмжиг");
  });
  if (unitCol < 0) unitCol = 4;
  // Хэмжих нэгжийн баганаас хойших хоосон бус толгойтой баганууд = барилгууд
  const buildingCols: { col: number; name: string }[] = [];
  for (let c = unitCol + 1; c < header.length; c++) {
    const nm = text(header[c]).replace(/\s+/g, " ").trim();
    if (nm) buildingCols.push({ col: c, name: nm });
  }
  if (buildingCols.length === 0) return [];

  // Толгойн доорх БҮХ өгөгдлийн мөрийг ерөнхийгөөр цуглуулна (тодорхой түлхүүр үгэнд
  // тулгуурлахгүй тул шинэ мөр нэмэгдэхэд тэсвэртэй). Шошго = нэгж баганаас өмнөх
  // хамгийн тодорхой текст нүд; нэгж = хэмжих нэгжийн багана.
  const dataRows: { label: string; group: string; unit: string; isCoeff: boolean; rowIdx: number }[] = [];
  let carryGroup = ""; // merge хийсэн бүлгийн толгойг дараагийн дэд мөрүүдэд дамжуулна
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    // Нэгж баганаас өмнөх бүх тодорхой (тоон биш) текст нүдийг баганын индекстэй нь цуглуулна
    const cells: { c: number; t: string }[] = [];
    for (let c = 0; c < unitCol; c++) {
      const t = text(row[c]).trim();
      if (!t || parseNumber(t) != null) continue;
      if (normalizeKey(t) === "коэф") continue;
      cells.push({ c, t: t.replace(/\s+/g, " ").trim() });
    }
    const unit = text(row[unitCol]).replace(/\s+/g, " ").trim();
    // Аль нэг барилгын багана хоосон биш (тоо ЭСВЭЛ текст) бол уншина — тоогоор хязгаарлахгүй.
    const hasContent = buildingCols.some(({ col }) => text(row[col]).trim() !== "");
    if (!cells.length || !hasContent) continue; // зөвхөн шошго/агуулгагүй мөрийг алгасна

    let group = "";
    let label = "";
    if (cells.length >= 2) {
      // Тэр мөрөнд бүлэг ба дэд шошго хоёулаа байна (жишээ: "Итгэлцүүр" | "Үнийн өсөлт")
      group = cells[0].t;
      label = cells[cells.length - 1].t;
      carryGroup = group;
    } else {
      const only = cells[0];
      if (only.c >= 2 && carryGroup) {
        // Эхний багана хоосон (merge үргэлжлэл) — өмнөх бүлэгт хамаарна
        group = carryGroup;
        label = only.t;
      } else {
        // Бие даасан мөр — бүлгийг тэглэнэ
        label = only.t;
        carryGroup = "";
      }
    }
    dataRows.push({ label, group, unit, isCoeff: normalizeKey(unit).includes("коэф"), rowIdx: i });
  }

  return buildingCols.map(({ col, name }) => {
    const items: ParsedBuildingItem[] = dataRows.map((dr) => ({
      label: dr.label,
      group: dr.group,
      unit: dr.unit,
      value: parseNumber(grid[dr.rowIdx][col]),
      raw: text(grid[dr.rowIdx][col]).replace(/\s+/g, " ").trim(),
    }));
    const findVal = (...kw: string[]): number | null => {
      const keys = kw.map(normalizeKey);
      const it = items.find((x) => keys.some((k) => normalizeKey(x.label).includes(k)));
      return it ? it.value : null;
    };
    return {
      name,
      items,
      unitCostM2: findVal("төсөвт өртөг", "жишиг нэгж"),
      areaM2: findVal("нийт талбай") ?? findVal("барилгын талбай"),
      replacementCost: findVal("нөхөн орлуулах"),
      coefficients: dataRows
        .map((dr, idx) => ({ dr, value: items[idx].value }))
        .filter((x) => x.dr.isCoeff && x.value != null)
        .map((x) => ({ label: x.dr.label, value: x.value as number })),
    } as ParsedBuildingCost;
  });
}

interface PriceRow {
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

// Үнэ-төрлийн (Бусад хөрөнгө / зардал) хүснэгтийн баганыг ТОЛГОЙГООР нь илрүүлнэ —
// багана нэмэгдэх/солигдоход тэсвэртэй. Толгой олдохгүй бол тогтмол индексээр (fallback).
interface PriceCols {
  headerIdx: number;
  seq: number;
  name: number;
  unit: number;
  qty: number;
  unitPrice: number;
  total: number;
}
function detectPriceCols(grid: Grid, startIdx = 0): PriceCols {
  let headerIdx = -1;
  for (let i = startIdx; i < grid.length; i++) {
    const rk = normalizeKey(rowText(grid[i]));
    if ((rk.includes("нэр") || rk.includes("зардал")) && rk.includes("үнэ")) {
      headerIdx = i;
      break;
    }
  }
  const cols: PriceCols = { headerIdx, seq: 0, name: 1, unit: 2, qty: 3, unitPrice: 4, total: 5 };
  if (headerIdx < 0) return cols;
  grid[headerIdx].forEach((cell, i) => {
    const k = normalizeKey(cell);
    if (!k) return;
    if (k.includes("нийт") && k.includes("үнэ")) cols.total = i;
    else if (k.includes("нэгж") && k.includes("үнэ")) cols.unitPrice = i;
    else if (k.includes("хэмжих") || k.includes("хэмжиг")) cols.unit = i;
    else if (k.includes("чадал") || k.includes("тоо")) cols.qty = i;
    else if (k.includes("нэр") || k.includes("зардал")) cols.name = i;
  });
  return cols;
}

/** "Бусад хөрөнгө" хүснэгтээс нэр→үнэ мэдээлэл (багана толгойгоор илрүүлж). */
function extractOtherAssets(grid: Grid | null): PriceRow[] {
  if (!grid) return [];
  const rows: PriceRow[] = [];
  const cols = detectPriceCols(grid);
  const start = cols.headerIdx >= 0 ? cols.headerIdx + 1 : 1;
  for (let i = start; i < grid.length; i++) {
    const row = grid[i];
    const name = text(row[cols.name]).trim();
    if (!name) continue;
    // Өгөгдлийн мөр: дугаартай ЭСВЭЛ ямар нэг үнэ/тоо бүхий (толгой/гарчгийг алгасна)
    const numeric =
      parseNumber(row[cols.seq]) != null ||
      parseNumber(row[cols.unitPrice]) != null ||
      parseNumber(row[cols.total]) != null;
    if (!numeric) continue;
    rows.push({
      name,
      unit: text(row[cols.unit]).trim(),
      quantity: parseNumber(row[cols.qty]),
      unitPrice: parseNumber(row[cols.unitPrice]),
      totalPrice: parseNumber(row[cols.total]),
    });
  }
  return rows;
}

/** Хөрөнгийн тодорхойлолт + бусад хөрөнгө + барилгын өртгийг нэгтгэн хөрөнгийн жагсаалт үүсгэх. */
export function extractAssets(
  wb: Workbook,
  sheetMap: Record<string, string | null>,
): ParsedAsset[] {
  const pd = sheetMap.propertyDesc ? wb[sheetMap.propertyDesc] : null;
  if (!pd) return [];
  const priceRows = extractOtherAssets(sheetMap.otherAssets ? wb[sheetMap.otherAssets] : null);
  const priceNames = priceRows.map((p) => p.name);
  const buildings = extractBuildingCosts(sheetMap.buildingCost ? wb[sheetMap.buildingCost] : null);
  const buildingNames = buildings.map((b) => b.name);
  const usedBuilding = new Set<number>();

  const cols = detectPropDescCols(pd);
  const start = cols.headerIdx >= 0 ? cols.headerIdx + 1 : 1;
  const assets: ParsedAsset[] = [];

  for (let i = start; i < pd.length; i++) {
    const row = pd[i];
    const seqNo = parseNumber(row[cols.seq]);
    const name = text(row[cols.name]).trim();
    if (seqNo == null || !name) continue;

    // Төрлийг ТОДОРХОЙ баганаас авна (байхгүй бол нэрээр таамаглана)
    const tk = cols.type >= 0 ? typeToKind(text(row[cols.type])) : null;
    if (tk === "land" || isLand(name)) continue; // газар нь land, энд орохгүй
    const kind: AssetKind | null = tk === "real_state" || tk === "property" ? tk : detectKind(name);

    const asset: ParsedAsset = {
      seqNo,
      name,
      unit: text(row[cols.unit]).trim(),
      quantity: parseNumber(row[cols.qty]),
      description: text(row[cols.desc]).trim(),
      kind,
      unitPrice: null,
      totalPrice: null,
    };

    if (kind === "real_state" && buildings.length) {
      // Барилгын өртгийн баганыг НЭРЭЭР нь тааруулах (Байшин-1 ↔ Байшин-1)
      const m = bestMatch(name, buildingNames, 0.6);
      let idx = m && !usedBuilding.has(m.index) ? m.index : -1;
      if (idx < 0) idx = buildings.findIndex((_, bi) => !usedBuilding.has(bi));
      if (idx >= 0) {
        usedBuilding.add(idx);
        asset.building = buildings[idx];
        asset.totalPrice = buildings[idx].replacementCost;
        if (buildings[idx].areaM2 != null) asset.quantity = buildings[idx].areaM2;
      }
    } else {
      // Бусад хөрөнгө хүснэгтээс үнэ тааруулах
      const m = priceNames.length ? bestMatch(name, priceNames, 0.7) : null;
      if (m) {
        const p = priceRows[m.index];
        asset.unitPrice = p.unitPrice;
        if (asset.quantity == null) asset.quantity = p.quantity;
        // Нийт үнэ: Бусад хөрөнгө хүснэгтээс (боломжтой бол), эсвэл тоо хэмжээ × нэгж үнэ.
        // (Загварын "Нийт үнэ" багана #VALUE! алдаатай ирж болзошгүй тул тооцоолж нөхнө.)
        asset.totalPrice =
          p.totalPrice ??
          (asset.quantity != null && p.unitPrice != null ? asset.quantity * p.unitPrice : null);
        if (asset.kind == null) asset.kind = "property";
      }
    }
    assets.push(asset);
  }
  return assets;
}

/** Газар чөлөөлөх / түр суурьшуулах зэрэг зардлын хүснэгтүүдээс мөрүүд.
 *  Олон дэд хүснэгттэй — толгой мөр тус бүрээс баганыг дахин илрүүлнэ (багана солигдоход тэсвэртэй). */
export function extractClearance(grid: Grid | null): ParsedClearance[] {
  if (!grid) return [];
  const out: ParsedClearance[] = [];
  let category = "Газар чөлөөлөх зардал";
  // Багана: default fallback; толгой олдвол шинэчилнэ
  let cols: PriceCols = { headerIdx: -1, seq: 0, name: 1, unit: 2, qty: 3, unitPrice: 4, total: 5 };
  for (const row of grid) {
    const rk = normalizeKey(rowText(row));

    // Дэд хүснэгтийн ТОЛГОЙ мөр (нэр/зардал + "үнэ" гэсэн ШОШГО, тоон утгагүй) → баганыг дахин илрүүлнэ.
    // (Толгойд зөвхөн бичвэр байх тул мөрөнд тоо байвал энэ нь толгой биш.)
    const hasNumber = row.some((c) => parseNumber(c) != null);
    if ((rk.includes("нэр") || rk.includes("зардал")) && rk.includes("үнэ") && !hasNumber) {
      cols = detectPriceCols([row]);
      cols.headerIdx = 0;
      continue;
    }

    // Багана толгойгоор нь уншина (col0-д тулгуурлахгүй — багана солигдоход тэсвэртэй)
    const name = text(row[cols.name]).trim();
    if (!name) continue;
    const total = parseNumber(row[cols.total]);
    const unitPrice = parseNumber(row[cols.unitPrice]);

    // Үнэгүй мөр = хэсгийн гарчиг эсвэл нийлбэр. Зардлын гарчиг бол ангиллыг шинэчилнэ.
    if ((total == null || total === 0) && unitPrice == null) {
      const nk = normalizeKey(name);
      if (!nk.startsWith("нийт") && (rk.includes("зардал") || rk.includes("алдагдсан"))) category = name;
      continue;
    }
    out.push({
      category,
      name,
      unit: text(row[cols.unit]).trim(),
      quantity: parseNumber(row[cols.qty]),
      unitPrice,
      totalPrice: total,
    });
  }
  return out;
}

/** Нэгтгэлийн sheet-ээс нийт дүн (боломжтой бол). */
function extractSummaryTotal(grid: Grid | null): number | null {
  if (!grid) return null;
  const idx = findRowIndex(grid, "бүхэлчилсэн дүн", "нөхөн олговрын нийт");
  if (idx >= 0) {
    const n = lastNumber(grid[idx]);
    if (n != null) return n;
  }
  return null;
}

/** Бүх бүлгийг нэгтгэн ParsedValuation үүсгэх (validation-гүй — index.ts дуудна). */
export function extractValuation(wb: Workbook): Omit<ParsedValuation, "warnings"> {
  const names = Object.keys(wb);
  const sheetMap = mapSheets(names);
  return {
    org: extractOrg(wb, names),
    land: extractLand(wb, sheetMap),
    assets: extractAssets(wb, sheetMap),
    clearance: extractClearance(sheetMap.clearance ? wb[sheetMap.clearance] : null),
    summaryTotal: extractSummaryTotal(sheetMap.summary ? wb[sheetMap.summary] : null),
    sheetMap,
  };
}

// Багана толгойг гаднаас ашиглах боломжтой байлгах (тестэд хэрэгтэй).
export const __test = { findRowIndex, lastNumber, rowText, similarity };
