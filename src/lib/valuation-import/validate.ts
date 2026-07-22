// Client-side валидаци — backend дүрмүүдтэй ижил (UX-д урьдчилан анхааруулах зорилготой).
// level: "error" → оруулахыг блоклоно, "warning" → зөвшөөрнө (анхааруулаад үлдээнэ).

import type { ParsedValuation, ParsedWarning } from "./types.ts";

const TOL = 0.01; // харьцангуй зөрүүний хүлцэл (1%)

function approxEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom <= TOL;
}

export function validateParsed(v: Omit<ParsedValuation, "warnings">): ParsedWarning[] {
  const w: ParsedWarning[] = [];

  // ── Газар ──
  if (v.land.affectedAreaM2 == null || v.land.affectedAreaM2 <= 0)
    w.push({ code: "LAND_AREA_MISSING", level: "warning", message: "Газрын чөлөөлөгдөх талбай олдсонгүй." });
  if (v.land.basePriceM2 == null || v.land.basePriceM2 <= 0)
    w.push({ code: "LAND_PRICE_MISSING", level: "warning", message: "Газрын 1 м² суурь үнэ олдсонгүй." });
  if (
    v.land.basePriceM2 != null &&
    v.land.affectedAreaM2 != null &&
    v.land.totalValue != null &&
    !approxEqual(v.land.basePriceM2 * v.land.affectedAreaM2, v.land.totalValue)
  )
    w.push({
      code: "LAND_TOTAL_MISMATCH",
      level: "warning",
      message: "Газрын нийт үнэ = талбай × суурь үнэ тэнцэхгүй байна.",
    });

  // ── Хөрөнгө бүр ──
  for (const a of v.assets) {
    if (a.kind == null)
      w.push({
        code: "KIND_REQUIRED",
        level: "error",
        assetSeq: a.seqNo,
        message: `"${a.name}" хөрөнгийн төрлийг сонгоно уу (үл хөдлөх / эд хөрөнгө).`,
      });

    if (a.building) {
      const b = a.building;
      const coefProduct = b.coefficients.reduce((p, c) => p * (c.value || 1), 1);
      if (b.unitCostM2 != null && b.areaM2 != null && b.replacementCost != null) {
        const expected = b.unitCostM2 * b.areaM2 * coefProduct;
        if (!approxEqual(expected, b.replacementCost))
          w.push({
            code: "REPLACEMENT_COST_MISMATCH",
            level: "warning",
            assetSeq: a.seqNo,
            message: `"${a.name}": нөхөн орлуулах өртөг = нэгж×талбай×итгэлцүүр тэнцэхгүй байна.`,
          });
      }
      for (const c of b.coefficients) {
        if (c.value < 0.5 || c.value > 3)
          w.push({
            code: "COEFF_RANGE",
            level: "warning",
            assetSeq: a.seqNo,
            message: `"${a.name}": "${c.label}" итгэлцүүр [0.5, 3] мужаас гадуур (${c.value}).`,
          });
      }
      if (b.replacementCost == null || b.replacementCost <= 0)
        w.push({
          code: "REPLACEMENT_COST_MISSING",
          level: "warning",
          assetSeq: a.seqNo,
          message: `"${a.name}": нөхөн орлуулах өртөг олдсонгүй.`,
        });
    } else {
      if (a.totalPrice == null || a.totalPrice <= 0)
        w.push({
          code: "MISSING_UNIT_PRICE",
          level: "warning",
          assetSeq: a.seqNo,
          message: `"${a.name}": нэгж/нийт үнэ дутуу байна — оруулахаас өмнө нөхнө үү.`,
        });
      if (
        a.quantity != null &&
        a.unitPrice != null &&
        a.totalPrice != null &&
        !approxEqual(a.quantity * a.unitPrice, a.totalPrice)
      )
        w.push({
          code: "TOTAL_PRICE_MISMATCH",
          level: "warning",
          assetSeq: a.seqNo,
          message: `"${a.name}": нийт үнэ = тоо хэмжээ × нэгж үнэ тэнцэхгүй байна.`,
        });
    }

    if (a.quantity != null && (a.quantity <= 0 || a.quantity >= 100000))
      w.push({
        code: "AREA_RANGE",
        level: "warning",
        assetSeq: a.seqNo,
        message: `"${a.name}": талбай/тоо хэмжээ (${a.quantity}) хэвийн бус.`,
      });
  }

  if (v.assets.length === 0)
    w.push({ code: "NO_ASSETS", level: "warning", message: "Хөрөнгийн тодорхойлолт хүснэгтээс хөрөнгө олдсонгүй." });

  return w;
}
