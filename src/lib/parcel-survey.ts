import type { ParcelSurvey, RelocationType } from "@/types";

// Чөлөөлөгдсөн газрын судалгааны асуулт, хариултын нэрс — нэгж талбарын
// «Судалгаа» таб ба «Газрын судалгаа» хуудас хоёулаа эндээс уншина.

export type SurveyCountField = "chimney_count" | "toilet_count" | "cohabitant_count";

/** Тоон асуултууд: title — маягтын гарчиг, question — тайлбар асуулт. */
export const SURVEY_COUNT_QUESTIONS: {
  field: SurveyCountField;
  summaryKey: "chimney_counts" | "toilet_counts" | "cohabitant_counts";
  title: string;
  question: string;
}[] = [
  {
    field: "chimney_count",
    summaryKey: "chimney_counts",
    title: "Яндангийн тоо",
    question: "Тухайн нэгж талбарт утаат яндан хэд байсан",
  },
  {
    field: "toilet_count",
    summaryKey: "toilet_counts",
    title: "Нойлын тоо",
    question: "Нүхэн жорлон хэдэн удаа гаргаж байсан",
  },
  {
    field: "cohabitant_count",
    summaryKey: "cohabitant_counts",
    title: "Хажуу өрхийн судалгаа",
    question: "Гэр сууцанд амьдардаг хэдэн хамтран амьдрагч байсан",
  },
];

/** Тоон хариултын дээд утга (backend: domain.SurveyCountMax) — тоо нь бодитоор хязгааргүй. */
export const SURVEY_COUNT_MAX = 999;

/** Статистикийн ангилал — 3 нь «3+» (backend: domain.SurveyCountBucketMax). */
export const SURVEY_COUNT_OPTIONS = [1, 2, 3] as const;

export function surveyCountLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(value);
}

/** Статистикийн ангиллын нэр: 3 → «3+». */
export function surveyBucketLabel(value: number): string {
  return value >= SURVEY_COUNT_OPTIONS[SURVEY_COUNT_OPTIONS.length - 1] ? `${value}+` : String(value);
}

/**
 * Тоон асуултын нийт тоо — ангилал бүрийн тоог хариултаар нь үржүүлж нэмнэ.
 * «3+» нь 3-аар бодогдох тул бодит тооноос бага гарч болно.
 */
export function surveyCountTotal(counts: Record<string, number>): number {
  return SURVEY_COUNT_OPTIONS.reduce((sum, n) => sum + n * (counts[String(n)] ?? 0), 0);
}

export const RELOCATION_LABELS: Record<RelocationType, string> = {
  ger_district: "Гэр хороолол",
  apartment: "Орон сууц",
};

export const RELOCATION_QUESTION = "Нөлөөлөлд өртсөний дараа хаана оршин суусан";

/** Бөглөсөн эсэх — backend-ийн surveyAnsweredSQL-тэй ижил дүрэм. */
export function isSurveyAnswered(s: ParcelSurvey | null | undefined): boolean {
  if (!s) return false;
  return (
    s.chimney_count != null ||
    s.toilet_count != null ||
    s.cohabitant_count != null ||
    !!s.relocation_type ||
    !!s.note
  );
}
