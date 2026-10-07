/**
 * «Төлбөрийн гүйцэтгэл» (нөхөх олговрын гүйцэтгэл) — нийт үнэлгээг
 * олголтын шатаар (60% / 40% / 100% — нэг удаа бүрэн) хувьлан бодно.
 *
 * Урьд авсан санхүүжилтийг нэгж талбарт ХАДГАЛСАН олголтын гүйцэтгэлээс
 * (compensation_paid_60 / _40 / _full — «Нөхөх олговор олгосон баримт»-аас)
 * авна: 40%-ийг хэвлэхэд 60% нь олгогдсон бол урьд авсан = 60%, г.м.
 */

export type PaymentPerformanceStage = 60 | 40 | 100;

/** Сонгох боломжтой хувь (дэлгэцийн дараалал). */
export const PAYMENT_PERFORMANCE_STAGES: PaymentPerformanceStage[] = [60, 40, 100];

export interface PaymentPerformanceInput {
  /** Нийт үнэлгээ (₮) — ангиллаар */
  land: number;
  realEstate: number;
  property: number;
  stage: PaymentPerformanceStage;
  paid60?: boolean;
  paid40?: boolean;
  paidFull?: boolean;
}

export interface PaymentPerformanceRow {
  /** Төсөвт өртөг (нийт үнэлгээ) */
  budget: number;
  /** Ажил эхэлснээс хойшхи гүйцэтгэл (хуримтлагдсан) */
  cumulative: number;
  /** Урьд авсан санхүүжилт */
  prior: number;
  /** Тайлант үеийн (энэ удаагийн) гүйцэтгэл */
  current: number;
  /** Үлдэгдэл санхүүжилт */
  remaining: number;
}

export interface PaymentPerformance {
  /** Хувь (0–1) */
  stagePct: number;
  priorPct: number;
  cumulativePct: number;
  remainingPct: number;
  land: PaymentPerformanceRow;
  realEstate: PaymentPerformanceRow;
  property: PaymentPerformanceRow;
  total: PaymentPerformanceRow;
}

/**
 * Урьд олгосон хувь — СОНГОСОН шатаас бусад олгогдсон шат. «Бүрэн» олгосон
 * бол сонгосон шатаас бусдыг бүгдийг урьд олгосонд тооцно. 100% (нэг удаа
 * бүрэн) сонговол урьд олгосон 0.
 */
export function priorPaidPercent(input: Pick<PaymentPerformanceInput, "stage" | "paid60" | "paid40" | "paidFull">): number {
  if (input.paidFull) return 100 - input.stage;
  let prior = 0;
  if (input.paid60 && input.stage !== 60) prior += 60;
  if (input.paid40 && input.stage !== 40) prior += 40;
  return Math.min(prior, 100 - input.stage);
}

const round = (v: number) => Math.round(v);

function row(budget: number, priorPct: number, stagePct: number): PaymentPerformanceRow {
  const prior = round(budget * priorPct);
  const current = round(budget * stagePct);
  const cumulative = prior + current;
  return { budget: round(budget), prior, current, cumulative, remaining: round(budget) - cumulative };
}

export function computePaymentPerformance(input: PaymentPerformanceInput): PaymentPerformance {
  const stagePct = input.stage / 100;
  const priorPct = priorPaidPercent(input) / 100;
  const land = row(input.land, priorPct, stagePct);
  const realEstate = row(input.realEstate, priorPct, stagePct);
  const property = row(input.property, priorPct, stagePct);
  const sum = (k: keyof PaymentPerformanceRow) => land[k] + realEstate[k] + property[k];
  return {
    stagePct,
    priorPct,
    cumulativePct: priorPct + stagePct,
    remainingPct: 1 - priorPct - stagePct,
    land,
    realEstate,
    property,
    total: {
      budget: sum("budget"),
      prior: sum("prior"),
      current: sum("current"),
      cumulative: sum("cumulative"),
      remaining: sum("remaining"),
    },
  };
}

/** Санал болгох шат: 60% олгогдсон, 40% олгогдоогүй бол 40%, эс бөгөөс 60%. */
export function suggestedStage(paid60?: boolean, paid40?: boolean): PaymentPerformanceStage {
  return paid60 && !paid40 ? 40 : 60;
}
