import type { DocumentType } from "@/types";

/**
 * Хавсралтын төрлийг НЭРИЙН үсгийн дарааллаар (монгол цагаан толгой —
 * Ө, Ү нь О, У-гийн дараа; кодын цэгээр эрэмбэлбэл төгсгөлд гардаг) эрэмбэлнэ.
 * «Бусад» (other) нь ҮРГЭЛЖ хамгийн сүүлд.
 */
export function sortDocumentTypes<T extends Pick<DocumentType, "type" | "name">>(types: readonly T[]): T[] {
  return [...types].sort((a, b) => {
    const aOther = a.type === "other";
    const bOther = b.type === "other";
    if (aOther !== bOther) return aOther ? 1 : -1;
    return a.name.localeCompare(b.name, "mn", { sensitivity: "base" });
  });
}

/**
 * Төрөл бүрт зөвшөөрөгдөх файл — backend-ийн allowedDocumentContentType-тэй
 * ИЖИЛ: ерөнхийдөө PDF; хурлын тэмдэглэл, үнэлгээний тайлан — DOCX ч;
 * үнэлгээний хүснэгт — XLSX ч; ажлын зураг — JPG/PNG ч.
 */
export function documentAcceptFor(typeCode: string): string {
  switch (typeCode) {
    case "meeting_minutes":
    case "valuation_report":
      return ".pdf,application/pdf,.docx";
    case "valuation_source":
      return ".pdf,application/pdf,.xlsx";
    case "work_photo":
      return ".pdf,application/pdf,.jpg,.jpeg,.png,image/jpeg,image/png";
    default:
      return ".pdf,application/pdf";
  }
}
