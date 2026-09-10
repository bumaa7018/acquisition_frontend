import type { ParcelFeeItem } from "@/types";

export const feeArea = (fee: ParcelFeeItem) => fee.landuse_area + fee.zone_area || fee.area;
const positive = (value: number) => Number.isFinite(value) && value > 0;

export function initialConfidencePercent(fees: ParcelFeeItem[], saved?: number | null): string {
  if (saved != null && positive(saved)) return String(saved);
  const values = Array.from(new Set(fees.map((fee) => fee.confidence_percent)));
  return values.length === 1 && positive(values[0]) ? String(values[0]) : "";
}

// Keep rounding aligned with the middleware's per-m² price and backend estimate.
export function calculateEstimatedValuation(fees: ParcelFeeItem[], affectedArea: number, confidencePercent: number, manualBaseFeePerM2?: number) {
  if (!positive(affectedArea) || !positive(confidencePercent)) return null;
  if (fees.length === 0) {
    if (manualBaseFeePerM2 == null || !positive(manualBaseFeePerM2)) return null;
    const value = Math.round(Math.round(manualBaseFeePerM2 * 100 / confidencePercent) * affectedArea);
    return Number.isFinite(value) && value >= 0 && value < 1e18 ? value : null;
  }
  if (fees.some((fee) => !positive(feeArea(fee)) || !positive(fee.base_fee_per_m2))) return null;
  const totalArea = fees.reduce((sum, fee) => sum + feeArea(fee), 0);
  const weightedPrice = fees.reduce((sum, fee) => sum + Math.round(fee.base_fee_per_m2 * 100 / confidencePercent) * feeArea(fee), 0);
  const value = Math.round(weightedPrice / totalArea * affectedArea);
  return Number.isFinite(value) && value >= 0 && value < 1e18 ? value : null;
}
