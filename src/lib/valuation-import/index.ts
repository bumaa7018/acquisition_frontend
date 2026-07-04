// Excel файлыг browser дээр задлан ParsedValuation болгох нэвтрэх цэг.
// xlsx (SheetJS) нь зөвхөн browser дээр ажиллах тул DINAMIC IMPORT ашиглаж,
// үндсэн bundle-д орохоос сэргийлж, SSR үед `window` алдаа гаргахгүй.

import { extractValuation, type Grid, type Workbook } from "./extract.ts";
import { validateParsed } from "./validate.ts";
import type { ParsedValuation } from "./types.ts";

export * from "./types.ts";
export { extractValuation } from "./extract.ts";
export { validateParsed } from "./validate.ts";

/** Задлан авсан workbook-оос ParsedValuation (extract + validate) үүсгэх. */
export function buildValuation(wb: Workbook): ParsedValuation {
  const base = extractValuation(wb);
  return { ...base, warnings: validateParsed(base) };
}

/**
 * Excel файлыг уншиж, sheet бүрийг мөр×баганын матриц (Grid) болгож,
 * ParsedValuation буцаана. Файлыг ХЭЗЭЭ Ч сервер рүү илгээхгүй — бүх боловсруулалт client дээр.
 */
export async function parseValuationFile(file: File): Promise<ParsedValuation> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wbRaw = XLSX.read(buf, { cellFormula: false, cellText: true, cellDates: false });
  const wb: Workbook = {};
  for (const name of wbRaw.SheetNames) {
    const ws = wbRaw.Sheets[name];
    wb[name] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: true,
    }) as Grid;
  }
  return buildValuation(wb);
}

/**
 * Файлын SHA-256 hash (давхардал шалгах — client дээр, файл серверт очихгүй).
 * `crypto.subtle` нь зөвхөн secure context (https эсвэл localhost) дээр байдаг.
 * http (LAN IP г.м) орчинд байхгүй бол hash-ийг алгасаж, "" буцаана — импортыг
 * зогсоохгүй (hash нь заавал биш, давхардал шалгахад л хэрэглэгддэг).
 */
export async function fileSha256(file: File): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "";
    const buf = await file.arrayBuffer();
    const digest = await subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}
