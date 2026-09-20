// ШИНЭ загвар (нэг sheet дээрх 3.1–5.1 хэсгүүд)-ын задлалт.
//
// Хуучин загвараас гол ялгаа:
//  • Хүснэгт бүр тусдаа sheet биш, нэг sheet дээр дараалан байна (sections.ts хуваана).
//  • "Газрын эрх зүйн байдал" (Хүснэгт-2) хүснэгт нэмэгдсэн — өмчлөгч, гэрчилгээ,
//    нэгж талбарын дугаарыг ТОДОРХОЙ уншина (өмнө нь тодорхойлолтоос regex-ээр таадаг байсан).
//  • "Барилгын тодорхойлолт" (Хүснэгт-4) — барилга бүрийн үзүүлэлт (asset_spec).
//  • "Орлогын алдагдсан боломж" (Хүснэгт-9) зардлын шинэ хүснэгт.
//  • Хүснэгт бүрийн доор ТАЙЛБАР.
// Багана ТОГТМОЛ, өгөгдөл зөвхөн доошоо мөрөөр нэмэгддэг тул мөрийн тоонд хамаарахгүй уншина.

import {
  detectPriceCols,
  detectPropDescCols,
  extractBuildingCosts,
  extractOtherAssets,
  lastNumber,
  rowText,
  text,
  type Grid,
} from "./extract.ts";
import { bestMatch } from "./fuzzy.ts";
import { detectKind, isLand } from "./kind.ts";
import { normalizeKey, parseNumber } from "./normalize.ts";
import { cleanTitle, splitSections, type ValuationSection } from "./sections.ts";
import type {
  AssetKind,
  ParsedAsset,
  ParsedBuildingSpec,
  ParsedClearance,
  ParsedLand,
  ParsedValuation,
  ValuationNotes,
  ValuationSectionKey,
  ValuationSections,
} from "./types.ts";

/** Мөрийн хоосон биш нүднүүдийг (индекстэй нь) буцаана. */
function filled(row: Grid[number]): { c: number; t: string }[] {
  const out: { c: number; t: string }[] = [];
  row.forEach((cell, c) => {
    const t = text(cell).trim();
    if (t) out.push({ c, t });
  });
  return out;
}

/** Хүснэгтийн толгой мөр эсэх (№ + үзүүлэлт/нэр гэх мэт шошготой, тоон утгагүй). */
function isHeaderRow(row: Grid[number]): boolean {
  const rk = normalizeKey(rowText(row));
  if (!rk) return false;
  const labelish =
    rk.includes("үзүүлэлт") ||
    rk.includes("хөрөнгийннэр") ||
    rk.includes("хөрөнгийннэрс") ||
    rk.includes("зардлыннэр") ||
    rk.includes("барилгынүзүүлэлт") ||
    rk.includes("хөрөнгийнүнэлгээнийзүйлс");
  return labelish;
}

// ── Хүснэгт-2: газрын эрх зүйн байдал (түлхүүр | утга) ──
function readLandLegal(section: ValuationSection | undefined, land: ParsedLand) {
  if (!section) return;
  for (const row of section.rows) {
    if (isHeaderRow(row)) continue;
    const cells = filled(row).filter((x) => !(x.c === 0 && parseNumber(x.t) != null));
    if (cells.length < 2) continue;
    const key = normalizeKey(cells[0].t);
    const value = cells[cells.length - 1].t;
    if (key.includes("өмчлөгч") || key.includes("эзэмшигч")) land.ownerName = value;
    else if (key.includes("гэрчилгээнийдугаар")) land.certNo = value;
    else if (key.includes("нэгжталбар")) land.parcelNo = value;
    else if (key.includes("улсынбүртгэл")) land.stateRegNo = value;
    else if (key.includes("гэрчилгээндзаасан")) land.certAreaM2 = parseNumber(value);
    else if (key.includes("зориулалт")) land.purpose = value;
    else if (key.includes("байршил")) land.location = value;
    else if (key.includes("өртсөнгазрынхэмжээ") || key.includes("нөлөөлөлдөртсөн"))
      land.affectedAreaM2 = parseNumber(value);
  }
}

// ── Хүснэгт-3: газрын үнэлгээ (үзүүлэлт | нэгж | дүн) ──
function readLandValuation(section: ValuationSection | undefined, land: ParsedLand) {
  if (!section) return;
  // "Дүн" баганыг ТОЛГОЙГООР илрүүлнэ (олдохгүй бол хамгийн баруун толгойт багана).
  let valueCol = -1;
  const header = section.rows.find((r) => isHeaderRow(r));
  if (header) {
    header.forEach((cell, i) => {
      const k = normalizeKey(cell);
      if (!k) return;
      if (k.includes("дүн") || k.includes("үнэлгээ")) valueCol = i;
      else if (valueCol < 0 && !k.includes("хэмжихнэгж") && i > 1) valueCol = i;
    });
  }
  if (valueCol < 0) valueCol = (header?.length ?? 7) - 1;
  for (const row of section.rows) {
    if (isHeaderRow(row)) continue;
    const cells = filled(row).filter((x) => !(x.c === 0 && parseNumber(x.t) != null));
    if (!cells.length) continue;
    const key = normalizeKey(cells[0].t);
    // Утгыг ЗӨВХӨН "Дүн" баганаас авна. Мөрөөр шүүвэл бөглөгдөөгүй загварт "№"
    // баганын дугаар (1,2,3) эсвэл хэмжих нэгж ("м2" → 2) утга мэт уншигдана.
    const value = parseNumber(row[valueCol]);
    if (value == null) continue;
    if (key.includes("хэмжээ")) land.affectedAreaM2 = value;
    else if (key.includes("суурьүнэ")) land.basePriceM2 = value;
    else if (key.includes("газрынүнэлгээ") || key.includes("газрынүнэ")) land.totalValue = value;
  }
}

// ── Хүснэгт-4: барилгын тодорхойлолт (үзүүлэлт × барилга) ──
export function extractBuildingSpecs(section: ValuationSection | undefined): ParsedBuildingSpec[] {
  if (!section) return [];
  const headerIdx = section.rows.findIndex((r) => isHeaderRow(r));
  if (headerIdx < 0) return [];
  const header = section.rows[headerIdx];
  // Шошгоны багана (Барилгын үзүүлэлт) — түүнээс ХОЙШ толгойтой багана бүр = барилга
  let labelCol = 1;
  header.forEach((cell, i) => {
    if (normalizeKey(cell).includes("үзүүлэлт")) labelCol = i;
  });
  const cols: { c: number; name: string }[] = [];
  for (let c = labelCol + 1; c < header.length; c++) {
    const nm = text(header[c]).replace(/\s+/g, " ").trim();
    if (nm) cols.push({ c, name: nm });
  }
  if (!cols.length) return [];

  const specs: ParsedBuildingSpec[] = cols.map(({ name }) => ({ name, items: [] }));
  for (let i = headerIdx + 1; i < section.rows.length; i++) {
    const row = section.rows[i];
    const label = text(row[labelCol]).replace(/\s+/g, " ").trim();
    if (!label) continue;
    cols.forEach(({ c }, bi) => {
      specs[bi].items.push({ label, value: text(row[c]).replace(/\s+/g, " ").trim() });
    });
  }
  return specs;
}

/** Барилгын үзүүлэлтээс давхрын тоог (байвал) авах. */
function floorCountOf(spec: ParsedBuildingSpec | undefined): number | null {
  if (!spec) return null;
  const it = spec.items.find((x) => normalizeKey(x.label).includes("давхрынтоо"));
  return it ? parseNumber(it.value) : null;
}

// ── Хүснэгт-7/8/9: зардлын хүснэгтүүд ──
function readCostSection(section: ValuationSection | undefined): ParsedClearance[] {
  if (!section) return [];
  const cols = detectPriceCols(section.rows);
  const start = cols.headerIdx >= 0 ? cols.headerIdx + 1 : 0;
  const category = cleanTitle(section.title);
  const out: ParsedClearance[] = [];
  for (let i = start; i < section.rows.length; i++) {
    const row = section.rows[i];
    const name = text(row[cols.name]).trim();
    if (!name) continue;
    const nk = normalizeKey(name);
    if (nk.startsWith("нийт") || nk.startsWith("дүн")) continue;
    const totalPrice = parseNumber(row[cols.total]);
    const unitPrice = parseNumber(row[cols.unitPrice]);
    // Загварын бөглөгдөөгүй мөрийг (үнэгүй) оруулахгүй
    if ((totalPrice == null || totalPrice === 0) && unitPrice == null) continue;
    out.push({
      category,
      name,
      unit: text(row[cols.unit]).trim(),
      quantity: parseNumber(row[cols.qty]),
      unitPrice,
      totalPrice: totalPrice ?? null,
    });
  }
  return out;
}

// ── 4.1 нэгтгэл: "Нийт" мөрийн дүн ──
function readSummaryTotal(section: ValuationSection | undefined): number | null {
  if (!section) return null;
  for (let i = section.rows.length - 1; i >= 0; i--) {
    const row = section.rows[i];
    const cells = filled(row);
    if (!cells.length) continue;
    const label = cells.find((x) => parseNumber(x.t) == null)?.t ?? "";
    if (/^(нийт|бүгд|дүн)/.test(normalizeKey(label))) {
      const n = lastNumber(row);
      if (n != null) return n;
    }
  }
  return null;
}

/** Хэсэг бүрийн ТАЙЛБАР-ыг түлхүүрээр цуглуулна. */
function collectNotes(sections: ValuationSection[]): ValuationNotes {
  const notes: ValuationNotes = {};
  for (const s of sections) {
    if (!s.key || !s.note) continue;
    const prev = notes[s.key];
    notes[s.key] = prev ? `${prev}\n${s.note}` : s.note;
  }
  return notes;
}

/** Хэсэг бүрийн дугаар/шошго/гарчиг/дарааллыг цуглуулна (Excel-ийн хүснэгтийн таних мэдээлэл). */
function collectSections(sections: ValuationSection[]): ValuationSections {
  const out: ValuationSections = {};
  let order = 0;
  for (const s of sections) {
    if (!s.key || out[s.key]) continue;
    out[s.key] = {
      no: s.no,
      label: s.tableLabel,
      title: cleanTitle(s.title),
      order: order++,
    };
  }
  return out;
}

/** ШИНЭ загварын нэг sheet-ийг бүрэн задлана. */
export function extractSingleSheet(grid: Grid): Omit<ParsedValuation, "warnings"> {
  const sections = splitSections(grid);
  const byKey = new Map<ValuationSectionKey, ValuationSection>();
  for (const s of sections) {
    if (s.key && !byKey.has(s.key)) byKey.set(s.key, s);
  }
  const S = (k: ValuationSectionKey) => byKey.get(k);

  // ── Газар ──
  const land: ParsedLand = {
    ownerName: "",
    certNo: "",
    parcelNo: "",
    affectedAreaM2: null,
    basePriceM2: null,
    totalValue: null,
    description: "",
  };
  readLandLegal(S("land_legal"), land);
  readLandValuation(S("land_valuation"), land);

  // ── Хөрөнгийн танилцуулга (Хүснэгт 1) ──
  const propRows = S("property_desc")?.rows ?? [];
  const cols = detectPropDescCols(propRows);
  const priceRows = extractOtherAssets(S("other_assets")?.rows ?? null);
  const priceNames = priceRows.map((p) => p.name);
  const buildings = extractBuildingCosts(S("building_cost")?.rows ?? null);
  const buildingNames = buildings.map((b) => b.name);
  const specs = extractBuildingSpecs(S("building_spec"));
  const specNames = specs.map((s) => s.name);
  // Бөглөгдөөгүй загварт (бүх нүд хоосон) барилгын багана байдаг ч утга байхгүй —
  // ийм үед хоосон барилгын хөрөнгө үүсгэхгүй.
  const hasBuildingData = buildings.some(
    (b) => b.replacementCost != null || b.unitCostM2 != null || b.areaM2 != null,
  );
  const hasSpecData = specs.some((sp) => sp.items.some((it) => it.value !== ""));
  const usedBuilding = new Set<number>();
  const usedSpec = new Set<number>();
  // "Бусад эд хөрөнгө" (3.6) хүснэгтийн аль мөр нь аль хэдийн хөрөнгөтэй
  // тааруулагдсаныг тэмдэглэнэ — ингэснээр нэг мөр ХОЁР хөрөнгө болж орохгүй.
  const usedPrice = new Set<number>();

  const assets: ParsedAsset[] = [];
  const start = cols.headerIdx >= 0 ? cols.headerIdx + 1 : 0;
  for (let i = start; i < propRows.length; i++) {
    const row = propRows[i];
    const name = text(row[cols.name]).trim();
    if (!name) continue;
    const seqNo = parseNumber(row[cols.seq]);
    const quantity = parseNumber(row[cols.qty]);
    const description = text(row[cols.desc]).trim();

    // Газрын мөр — land мэдээлэлд нэгтгэнэ, хөрөнгө болгохгүй
    if (isLand(name)) {
      if (!land.description) land.description = description;
      if (land.affectedAreaM2 == null) land.affectedAreaM2 = quantity;
      continue;
    }

    // Хөрөнгийн ТӨРЛИЙГ системийн бүртгэлээс хайхгүй: барилга/сууц нь үл хөдлөх,
    // БУСАД БҮХ зүйл нэрээрээ "эд хөрөнгө" болж хадгалагдана. Ингэснээр загварт
    // байхгүй шинэ төрлийн хөрөнгө ч чөлөөтэй орж ирнэ.
    const kind: AssetKind = detectKind(name) ?? "property";
    const asset: ParsedAsset = {
      seqNo,
      name,
      unit: text(row[cols.unit]).trim(),
      quantity,
      description,
      kind,
      unitPrice: null,
      totalPrice: null,
    };

    if (kind === "real_state" && (hasBuildingData || hasSpecData)) {
      const bm = buildingNames.length ? bestMatch(name, buildingNames, 0.6) : null;
      let bi = bm && !usedBuilding.has(bm.index) ? bm.index : -1;
      if (bi < 0) bi = buildings.findIndex((_, x) => !usedBuilding.has(x));
      if (bi >= 0) {
        usedBuilding.add(bi);
        asset.building = buildings[bi];
        asset.totalPrice = buildings[bi].replacementCost;
        if (buildings[bi].areaM2 != null) asset.quantity = buildings[bi].areaM2;
      }
      const sm = specNames.length ? bestMatch(name, specNames, 0.6) : null;
      let si = sm && !usedSpec.has(sm.index) ? sm.index : -1;
      if (si < 0) si = specs.findIndex((_, x) => !usedSpec.has(x));
      if (si >= 0) {
        usedSpec.add(si);
        asset.spec = specs[si];
        asset.floorCount = floorCountOf(specs[si]);
      }
    } else {
      const m = priceNames.length ? bestMatch(name, priceNames, 0.7) : null;
      if (m && !usedPrice.has(m.index)) {
        usedPrice.add(m.index);
        const p = priceRows[m.index];
        asset.unitPrice = p.unitPrice;
        if (asset.quantity == null) asset.quantity = p.quantity;
        asset.totalPrice =
          p.totalPrice ??
          (asset.quantity != null && p.unitPrice != null ? asset.quantity * p.unitPrice : null);
      }
    }

    // Загварын БӨГЛӨГДӨӨГҮЙ каталогийн мөр (тоо ч, үнэ ч, тодорхойлолт ч алга) — алгасна.
    // Эс бөгөөс загварын 30 гаруй хоосон мөр бүгд хөрөнгө болж орж ирнэ.
    const empty =
      asset.quantity == null &&
      asset.totalPrice == null &&
      asset.unitPrice == null &&
      !asset.description &&
      !asset.building;
    if (empty) continue;
    assets.push(asset);
  }

  // Хөрөнгийн танилцуулгад (3.1) ороогүй ч "Бусад эд хөрөнгө" (3.6)-д үнэтэй
  // байгаа мөрүүдийг НЭМЖ хөрөнгө болгоно. Аль хэдийн тааруулагдсан (usedPrice)
  // болон нэр нь давхацсан мөрийг ДАХИН нэмэхгүй — эс бөгөөс нэг эд хөрөнгө
  // хоёр хүснэгтэд хоёр өөр бичлэг болж хадгалагдана.
  const known = new Set(assets.map((a) => normalizeKey(a.name)));
  for (let pi = 0; pi < priceRows.length; pi++) {
    const p = priceRows[pi];
    if (usedPrice.has(pi)) continue;
    if (known.has(normalizeKey(p.name))) continue;
    if ((p.totalPrice == null || p.totalPrice === 0) && p.unitPrice == null) continue;
    assets.push({
      seqNo: null,
      name: p.name,
      unit: p.unit,
      quantity: p.quantity,
      description: "",
      kind: detectKind(p.name) ?? "property",
      unitPrice: p.unitPrice,
      totalPrice:
        p.totalPrice ?? (p.quantity != null && p.unitPrice != null ? p.quantity * p.unitPrice : null),
    });
  }

  const clearance = [
    ...readCostSection(S("temporary_cost")),
    ...readCostSection(S("clearance_cost")),
    ...readCostSection(S("lost_income")),
  ];

  // Дутуу утгыг нөхөж тооцоолол хийх (хуучин задлалттай ижил дүрэм)
  if (land.basePriceM2 == null && land.totalValue != null && land.affectedAreaM2)
    land.basePriceM2 = land.totalValue / land.affectedAreaM2;
  if (land.totalValue == null && land.basePriceM2 != null && land.affectedAreaM2 != null)
    land.totalValue = land.basePriceM2 * land.affectedAreaM2;

  const conclusionSection = S("conclusion");
  const conclusion = conclusionSection
    ? conclusionSection.rows
        .map((r) => filled(r).map((x) => x.t).join(" "))
        .filter(Boolean)
        .join("\n")
    : "";

  return {
    org: { name: "", stateRegNo: "", regNo: "", director: "", license: "", address: "", contact: "" },
    land,
    assets,
    clearance,
    summaryTotal: readSummaryTotal(S("summary")),
    sheetMap: (() => {
      const map: Record<string, string | null> = {};
      byKey.forEach((s, k) => {
        map[k] = s.tableLabel || s.title;
      });
      return map;
    })(),
    notes: collectNotes(sections),
    sections: collectSections(sections),
    layout: "single-sheet",
    conclusion,
  };
}
