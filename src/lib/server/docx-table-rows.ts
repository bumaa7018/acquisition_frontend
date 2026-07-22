import { escapeXml, readZipEntries, writeZipEntries } from "./docx-template";

export interface PropertyRow {
  name: string;
  certificateNo: string;
  area: string;
  amount: string;
}

const ROW_START = "<w:tr>";
const ROW_END = "</w:tr>";
// Мөрийн эхний нүд (дугаарлалт) — нээх/хаах тагийг бүхэлд нь барьж, дотоод текстийг сольж бичнэ.
const FIRST_TEXT_RE = /(<w:t\b[^>]*>)([^<]*)(<\/w:t>)/;

function findRow(xml: string, fromIndex: number): { start: number; end: number } | null {
  const start = xml.lastIndexOf(ROW_START, fromIndex);
  if (start === -1) return null;
  const endTag = xml.indexOf(ROW_END, fromIndex);
  if (endTag === -1) return null;
  return { start, end: endTag + ROW_END.length };
}

function nextRow(xml: string, fromIndex: number): { start: number; end: number } | null {
  const start = xml.indexOf(ROW_START, fromIndex);
  if (start === -1) return null;
  const endTag = xml.indexOf(ROW_END, start);
  if (endTag === -1) return null;
  return { start, end: endTag + ROW_END.length };
}

function rowIndexNumber(rowXml: string): number | null {
  const m = rowXml.match(FIRST_TEXT_RE);
  if (!m) return null;
  const n = Number.parseInt(m[2], 10);
  return Number.isFinite(n) ? n : null;
}

function withRowIndex(rowXml: string, index: number): string {
  return rowXml.replace(FIRST_TEXT_RE, (_full, open: string, _inner: string, close: string) => `${open}${index}${close}`);
}

function fillRowTemplate(rowXml: string, index: number, row: PropertyRow): string {
  return withRowIndex(rowXml, index)
    .replace(/\{property_names\}/g, escapeXml(row.name))
    .replace(/\{property_certificate_no\}/g, escapeXml(row.certificateNo))
    .replace(/\{property_area_m2\}/g, escapeXml(row.area))
    .replace(/\{property_compensation_amount\}/g, escapeXml(row.amount));
}

// Гэрээний "Үл хөдлөх" хүснэгтэд загварт зөвхөн НЭГ мөр (+ нэг хоосон нөөц мөр)
// байдаг тул үл хөдлөх бүрийг таслалаар нэг эсэд шахахын оронд бүртгэлтэй
// хөрөнгө тус бүрд ШИНЭ МӨР үүсгэнэ. Загварын бүтэц өөрчлөгдсөн/олдоогүй бол
// хэвээр (өөрчлөлтгүй) буцаана — {property_names} зэрэг placeholder-ууд ердийн
// байдлаараа (сингл утгаар) солигдоно.
function expandPropertyRows(documentXml: string, rows: PropertyRow[]): string {
  const placeholderIdx = documentXml.indexOf("{property_names}");
  if (placeholderIdx === -1) return documentXml;

  const templateRow = findRow(documentXml, placeholderIdx);
  if (!templateRow) return documentXml;

  const templateRowXml = documentXml.slice(templateRow.start, templateRow.end);
  const startIndex = rowIndexNumber(templateRowXml);
  if (startIndex == null) return documentXml;

  const items = rows.length > 0 ? rows : [{ name: "-", certificateNo: "", area: "-", amount: "-" }];
  const generatedRows = items.map((row, i) => fillRowTemplate(templateRowXml, startIndex + i, row)).join("");

  // Загварт property мөрний ард яг нэг хоосон нөөц мөр (жишээ нь дугаар "3", хоосон
  // нүднүүд) байдаг — устгаж, дараагийн (жишээ нь "Эд хөрөнгө, бусад") мөрийн
  // дугаарыг залгаж үргэлжлүүлнэ ("2, 3" гэсэн давхардал гарахгүй байхаар).
  const spareRow = nextRow(documentXml, templateRow.end);
  const followingRow = spareRow ? nextRow(documentXml, spareRow.end) : null;

  if (spareRow && followingRow) {
    const followingRowXml = documentXml.slice(followingRow.start, followingRow.end);
    const renumberedFollowingRow = withRowIndex(followingRowXml, startIndex + items.length);
    return (
      documentXml.slice(0, templateRow.start) +
      generatedRows +
      renumberedFollowingRow +
      documentXml.slice(followingRow.end)
    );
  }

  if (spareRow) {
    return documentXml.slice(0, templateRow.start) + generatedRows + documentXml.slice(spareRow.end);
  }

  return documentXml.slice(0, templateRow.start) + generatedRows + documentXml.slice(templateRow.end);
}

// Загварын docx буфер дотор word/document.xml-ийг олж, "Үл хөдлөх" хүснэгтийн
// мөрүүдийг өргөтгөнө (renderDocxTemplate дуудахаас ӨМНӨ дуудна).
export function injectPropertyRows(templateBuf: Buffer, rows: PropertyRow[]): Buffer {
  const entries = readZipEntries(templateBuf);
  const idx = entries.findIndex((e) => e.name === "word/document.xml");
  if (idx === -1) return templateBuf;

  const xml = entries[idx].data.toString("utf8");
  const nextXml = expandPropertyRows(xml, rows);
  if (nextXml === xml) return templateBuf;

  entries[idx] = { ...entries[idx], data: Buffer.from(nextXml, "utf8") };
  return writeZipEntries(entries);
}
