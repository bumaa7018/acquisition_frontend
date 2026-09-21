// Үнэлгээний ТООЦООЛЛЫН нэг эх сурвалж.
//
// Яагаад тусдаа модуль: нэг тоо засахад түүнээс хамаарах БҮХ дүн (бүрэн
// орлуулах өртөг, элэгдэл, нөхөн орлуулах өртөг, нөхөх олговрын дүн, улмаар
// нэгдсэн дүн) хамт өөрчлөгдөх ёстой. Тэр гинжийг дэлгэц бүрт дахин бичвэл
// хооронд нь зөрөх тул ЭНД л тодорхойлж, оруулах цонх, "Нөхөх олговор" таб,
// шалгалт (validate.ts) гурав ижил дүрэм хэрэглэнэ.
//
// Excel дэх гинж (Хүснэгт-5):
//   бүрэн орлуулах өртөг = нэгжийн өртөг × талбай × Π(итгэлцүүр)
//   элэгдлийн дүн        = бүрэн орлуулах өртөг × элэгдлийн хувь / 100
//   нөхөн орлуулах өртөг = бүрэн орлуулах өртөг − элэгдлийн дүн

export interface BuildingCalcRow {
  /** asset_calc_type.id — хадгалахад хэрэгтэй. */
  calc_type_id: number;
  /** asset_calc_type.code (байвал) — нэрнээс илүү найдвартай таних тэмдэг. */
  code?: string;
  label: string;
  /** Excel дэх бүлэг (Итгэлцүүр г.м) — мөртэй хамт хадгалагдана. */
  group: string;
  unit: string;
  value: number;
}

const has = (text: string | undefined, re: RegExp) => !!text && re.test(text);

/** Нэгж м²-ийн өртөг (жишиг нэгж үнэ / төсөвт өртөг). */
export function isUnitCostRow(row: BuildingCalcRow): boolean {
  return (
    row.code === "unit_cost" ||
    has(row.label, /төсөвт өртөг|жишиг|нэгжийн өртөг/i)
  );
}

/** Итгэлцүүр — бүлгээр нь, эс бөгөөс хэмжих нэгжээр нь таньна. */
export function isCoefficientRow(row: BuildingCalcRow): boolean {
  if (isUnitCostRow(row) || isFullCostRow(row) || isNetCostRow(row)) return false;
  return has(row.group, /итгэлцүүр/i) || has(row.unit, /коэф/i);
}

/** Бүрэн орлуулах өртөг (элэгдэл хасахаас ӨМНӨХ). */
export function isFullCostRow(row: BuildingCalcRow): boolean {
  return row.code === "full_replacement_cost" || has(row.label, /бүрэн орлуулах/i);
}

/** Элэгдлийн хувь. */
export function isDepreciationPercentRow(row: BuildingCalcRow): boolean {
  return row.code === "depreciation_percent" || has(row.label, /элэгдлийн хувь/i);
}

/** Элэгдлийн дүн (мөнгөн дүн). */
export function isDepreciationAmountRow(row: BuildingCalcRow): boolean {
  return row.code === "depreciation_amount" || has(row.label, /элэгдлийн дүн/i);
}

/** Нөхөн орлуулах өртөг — хөрөнгийн ЭЦСИЙН үнэ. */
export function isNetCostRow(row: BuildingCalcRow): boolean {
  return row.code === "net_replacement_cost" || has(row.label, /нөхөн орлуулах/i);
}

export interface BuildingCostResult {
  /** Дахин тооцоолсон мөрүүд (оролтын ДАРААЛАЛ хэвээр — Excel-тэй ижил). */
  rows: BuildingCalcRow[];
  unitCost: number | null;
  coefficientProduct: number;
  fullCost: number | null;
  depreciationPercent: number | null;
  depreciationAmount: number | null;
  /** Хөрөнгийн эцсийн үнэ (нөхөн орлуулах өртөг). */
  netCost: number | null;
}

/**
 * Барилгын өртгийн мөрүүдийг дахин тооцоолно. Мөрийн ДАРААЛАЛ хөндөгдөхгүй:
 * зөвхөн ҮР ДҮНГИЙН мөрүүдийн (бүрэн / элэгдлийн дүн / нөхөн орлуулах) утга
 * шинэчлэгдэнэ. Нэгжийн өртөг эсвэл талбай мэдэгдэхгүй бол гинжийг ОГТ
 * хөндөхгүй (хэрэглэгчийн гараар бичсэн дүнг дарж бичихгүй).
 */
export function recalcBuildingCost(
  rows: BuildingCalcRow[],
  areaM2: number | null,
): BuildingCostResult {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const unitCostRow = rows.find(isUnitCostRow);
  const unitCost = unitCostRow ? num(unitCostRow.value) : null;
  const coefficientProduct = rows
    .filter(isCoefficientRow)
    .reduce((p, r) => p * (num(r.value) || 1), 1);
  const deprPctRow = rows.find(isDepreciationPercentRow);
  const depreciationPercent = deprPctRow ? num(deprPctRow.value) : null;

  const area = areaM2 == null ? null : num(areaM2);
  const canChain = unitCost != null && unitCost > 0 && area != null && area > 0;

  const prevFull = rows.find(isFullCostRow);
  const fullCost = canChain
    ? unitCost * area * coefficientProduct
    : prevFull
      ? num(prevFull.value)
      : null;
  const depreciationAmount =
    fullCost != null && depreciationPercent != null
      ? (fullCost * depreciationPercent) / 100
      : (rows.find(isDepreciationAmountRow)?.value ?? null);
  const netCost =
    fullCost != null
      ? fullCost - (depreciationAmount ?? 0)
      : (rows.find(isNetCostRow)?.value ?? null);

  const next = rows.map((row) => {
    if (isFullCostRow(row) && fullCost != null) return { ...row, value: fullCost };
    if (isDepreciationAmountRow(row) && depreciationAmount != null)
      return { ...row, value: depreciationAmount };
    if (isNetCostRow(row) && netCost != null) return { ...row, value: netCost };
    return row;
  });

  return {
    rows: next,
    unitCost,
    coefficientProduct,
    fullCost,
    depreciationPercent,
    depreciationAmount,
    netCost,
  };
}

/**
 * Бусад эд хөрөнгө / зардлын мөр: нийт үнэ = тоо хэмжээ × нэгж үнэ.
 * Хэрэглэгч НИЙТ үнийг шууд өөрчилвөл (total !== qty×price) түүнийг нь
 * хүндэтгэж, нэгж үнийг эргүүлэн бодно — Excel дээр хоёр талаас нь бөглөдөг.
 */
export function recalcCostRow(input: {
  qty: number | null;
  unitPrice: number | null;
  total: number | null;
  changed: "qty" | "unitPrice" | "total";
}): { qty: number | null; unitPrice: number | null; total: number | null } {
  const { qty, unitPrice, total, changed } = input;
  if (changed === "total") {
    if (total != null && qty != null && qty !== 0)
      return { qty, unitPrice: total / qty, total };
    return { qty, unitPrice, total };
  }
  if (qty != null && unitPrice != null) return { qty, unitPrice, total: qty * unitPrice };
  return { qty, unitPrice, total };
}
