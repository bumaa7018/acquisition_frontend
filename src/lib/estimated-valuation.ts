import type { ParcelFeeItem } from "@/types";

export const feeArea = (fee: ParcelFeeItem) => fee.landuse_area + fee.zone_area || fee.area;
const positive = (value: number) => Number.isFinite(value) && value > 0;

export function initialConfidencePercent(fees: ParcelFeeItem[], saved?: number | null): string {
  if (saved != null && positive(saved)) return String(saved);
  const values = Array.from(new Set(fees.map((fee) => fee.confidence_percent)));
  return values.length === 1 && positive(values[0]) ? String(values[0]) : "";
}

/**
 * ТӨСӨӨЛЛИЙН үнэлгээ.
 *
 * `confidencePercent === null` бол ИТГЭЛЦҮҮРГҮЙ: суурь үнэ нь газрын зах
 * зээлийн жишиг үнэ (₮/м²) тул хувиргалтгүйгээр өртсөн талбайгаар үржигдэнэ.
 * Энэ нь ӨМЧЛӨХ эрхийн газарт хамаарна — дуудлага худалдааны анхны үнийн
 * итгэлцүүр нь эзэмших/ашиглах эрхийн СУУРЬ ТӨЛБӨРийг зах зээлийн үнэ болгож
 * хувиргах зорилготой ба өмчлөлд тэр хувиргалт утгагүй.
 *
 * Бодолт нь backend-ийн `calculateEstimatedValue` (Go) болон дундын сервисийн
 * м²-ийн үнэтэй ЯГ ижил тоймлолттой байх ёстой — эс бөгөөс цонхон дээрх
 * урьдчилсан дүн хадгалагдсан дүнгээсээ зөрнө. Эрхийн төрлөөр итгэлцүүр
 * хэрэглэх/эс хэрэглэхийг backend өөрөө ч шийддэг (client-д найдахгүй).
 */
export function calculateEstimatedValuation(fees: ParcelFeeItem[], affectedArea: number, confidencePercent: number | null, manualBaseFeePerM2?: number) {
  if (!positive(affectedArea)) return null;
  if (confidencePercent !== null && !positive(confidencePercent)) return null;
  const perM2 = (baseFeePerM2: number) =>
    Math.round(confidencePercent === null ? baseFeePerM2 : baseFeePerM2 * 100 / confidencePercent);
  if (fees.length === 0) {
    if (manualBaseFeePerM2 == null || !positive(manualBaseFeePerM2)) return null;
    const value = Math.round(perM2(manualBaseFeePerM2) * affectedArea);
    return Number.isFinite(value) && value >= 0 && value < 1e18 ? value : null;
  }
  if (fees.some((fee) => !positive(feeArea(fee)) || !positive(fee.base_fee_per_m2))) return null;
  const totalArea = fees.reduce((sum, fee) => sum + feeArea(fee), 0);
  const weightedPrice = fees.reduce((sum, fee) => sum + perM2(fee.base_fee_per_m2) * feeArea(fee), 0);
  const value = Math.round(weightedPrice / totalArea * affectedArea);
  return Number.isFinite(value) && value >= 0 && value < 1e18 ? value : null;
}
