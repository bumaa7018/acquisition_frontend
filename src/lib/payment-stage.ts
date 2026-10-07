import type { DocumentPaymentInput } from "@/lib/api";

/** «Нөхөх олговор олгосон баримт» — хавсралтын төрлийн код. */
export const COMPENSATION_RECEIPT_TYPE = "compensation_paid_receipt";

/** Олголтын шат — backend нь нэрийн ард « /60%/», « /бүрэн/» залгана. */
export const PAYMENT_STAGE_OPTIONS: { value: DocumentPaymentInput["stage"]; label: string }[] = [
  { value: "60", label: "60%" },
  { value: "40", label: "40%" },
  { value: "full", label: "Бүрэн (100%)" },
];

/** 60 | 40 | 100 → «60%», «Бүрэн (100%)». */
export function paymentStageLabel(stage: number) {
  return stage === 100 ? "Бүрэн (100%)" : `${stage}%`;
}

/** Backend-тэй ИЖИЛ: « /60%/», « /бүрэн/» — гараас бичсэн хуучин тэмдэглэгээг сольж. */
export function withPaymentSuffix(name: string, stage: DocumentPaymentInput["stage"]) {
  const base = name.replace(/\s*\/(\d{1,3}%|бүрэн)\/\s*$/, "").trim();
  return `${base} /${stage === "full" ? "бүрэн" : `${stage}%`}/`;
}

/** Өнөөдрийн огноо (хэрэглэгчийн цагийн бүсээр) YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
