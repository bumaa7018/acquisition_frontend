import { escapeXml, readZipEntries, writeZipEntries } from "./docx-template";

export type DecisionDraftDocxTableRow = {
  no: string;
  holder: string;
  address: string;
  parcelId: string;
  areaM2: string;
  rightType: string;
  landCertificateNo: string;
  affectedAreaM2: string;
  landCompensation: string;
  assetCertificateNo: string;
  realEstateCompensation: string;
  propertyCompensation: string;
  totalCompensation: string;
};

export type DecisionDraftDocxGroup = {
  title: string;
  rows: DecisionDraftDocxTableRow[];
};

const TABLE_START_RE = /<w:tbl[\s\S]*?<\/w:tbl>/g;
const ROW_RE = /<w:tr\b[\s\S]*?<\/w:tr>/g;
const CELL_RE = /<w:tc\b[\s\S]*?<\/w:tc>/g;
const TEXT_RE = /<w:t\b[^>]*>[\s\S]*?<\/w:t>/g;
const TEXT_BODY_RE = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/;
const GRID_COL_RE = /<w:gridCol\b[^>]*w:w="([^"]+)"/g;

// Загварын хүснэгтэд босоо (доороос дээш) бичигддэг нарийн баганууд — grid index:
// 3 "Нэгж талбарын дугаар", 5 "Эдэлбэрийн хэлбэр", 6 газрын "Гэрчилгээний дугаар",
// 9 хөрөнгийн "Гэрчилгээний дугаар". Гарчиг ба өгөгдлийн мөр хоёуланд хамаарна.
const VERTICAL_GRID_COLUMNS = new Set([3, 5, 6, 9]);

function plainText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function rowRanges(tableXml: string) {
  return Array.from(tableXml.matchAll(ROW_RE)).map((m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    xml: m[0],
    text: plainText(m[0]),
  }));
}

function withCellText(cellXml: string, value: string): string {
  let used = false;
  const escaped = escapeXml(value);
  const replaced = cellXml.replace(TEXT_RE, (node) => {
    const next = used ? "" : escaped;
    used = true;
    return node.replace(TEXT_BODY_RE, (_full, open: string, _inner: string, close: string) => `${open}${next}${close}`);
  });
  if (used) return replaced;
  return replaced.replace(/<\/w:tc>$/, `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p></w:tc>`);
}

function cellGridSpan(cellXml: string): number {
  const m = cellXml.match(/<w:gridSpan\b[^>]*w:val="([^"]+)"/);
  const span = m ? Number.parseInt(m[1], 10) : 1;
  return Number.isFinite(span) && span > 0 ? span : 1;
}

function withCellWidth(cellXml: string, width: number): string {
  if (!Number.isFinite(width) || width <= 0) return cellXml;
  const tcW = `<w:tcW w:w="${Math.round(width)}" w:type="dxa"/>`;
  if (/<w:tcW\b[^>]*\/>/.test(cellXml)) {
    return cellXml.replace(/<w:tcW\b[^>]*\/>/, tcW);
  }
  if (/<w:tcPr>/.test(cellXml)) {
    return cellXml.replace(/<w:tcPr>/, `<w:tcPr>${tcW}`);
  }
  return cellXml.replace(/<w:tc\b([^>]*)>/, `<w:tc$1><w:tcPr>${tcW}</w:tcPr>`);
}

// Word-ийн бичдэг <w:tblGridChange> дотор ХУУЧИН grid давхар байдаг тул түүнийг
// хасаж, зөвхөн бодит баганын өргөнийг уншина.
function extractGridWidths(tableXml: string): number[] {
  const gridXml = (tableXml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? "").replace(
    /<w:tblGridChange\b[\s\S]*$/,
    "",
  );
  return Array.from(gridXml.matchAll(GRID_COL_RE))
    .map((m) => Number.parseInt(m[1], 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

type CellLayout = { index: number; gridStart: number; span: number; width: number };

function mapRowCells(
  rowXml: string,
  gridWidths: number[],
  transform: (cellXml: string, layout: CellLayout) => string,
): string {
  let index = 0;
  let gridStart = 0;
  return rowXml.replace(CELL_RE, (cellXml) => {
    const span = cellGridSpan(cellXml);
    const width = gridWidths.slice(gridStart, gridStart + span).reduce((sum, item) => sum + item, 0);
    const layout: CellLayout = { index, gridStart, span, width };
    index += 1;
    gridStart += span;
    return transform(cellXml, layout);
  });
}

function isVerticalCell(layout: CellLayout): boolean {
  return layout.span === 1 && VERTICAL_GRID_COLUMNS.has(layout.gridStart);
}

// Нүдийг босоо (btLr — доороос дээш) бичлэгт болгоно. CT_TcPr-ийн элементийн
// дараалал заавал: ... shd, noWrap, tcMar, textDirection, tcFitText, vAlign — тул
// vAlign-аас ӨМНӨ тавина, эс бөгөөс Word файлыг эвдэрсэн гэж үзнэ.
function withVerticalText(cellXml: string): string {
  if (/<w:textDirection\b/.test(cellXml)) return cellXml;
  const node = '<w:textDirection w:val="btLr"/>';
  if (/<w:vAlign\b/.test(cellXml)) return cellXml.replace("<w:vAlign", `${node}<w:vAlign`);
  if (/<\/w:tcPr>/.test(cellXml)) return cellXml.replace("</w:tcPr>", `${node}</w:tcPr>`);
  return cellXml.replace(/<w:tc\b([^>]*)>/, `<w:tc$1><w:tcPr>${node}</w:tcPr>`);
}

function withRowCells(
  rowXml: string,
  values: string[],
  gridWidths: number[] = [],
  options: { vertical?: boolean } = {},
): string {
  return mapRowCells(rowXml, gridWidths, (cellXml, layout) => {
    const filled = withCellWidth(withCellText(cellXml, values[layout.index] ?? ""), layout.width);
    return options.vertical && isVerticalCell(layout) ? withVerticalText(filled) : filled;
  });
}

function withVerticalHeaderCells(rowXml: string, gridWidths: number[]): string {
  return mapRowCells(rowXml, gridWidths, (cellXml, layout) =>
    isVerticalCell(layout) ? withVerticalText(cellXml) : cellXml,
  );
}

// Баганын дугаарлалтын мөр (1..13) — тоонууд нь хэвтээ хэвээр байх ёстой.
function isColumnNumberRow(rowXml: string): boolean {
  const texts = Array.from(rowXml.matchAll(CELL_RE)).map((m) => plainText(m[0]));
  return texts.length > 1 && texts.every((text) => /^\d+$/.test(text));
}

function findCompensationTable(documentXml: string) {
  for (const match of Array.from(documentXml.matchAll(TABLE_START_RE))) {
    const tableXml = match[0];
    const text = plainText(tableXml);
    if (
      text.includes("Газар эзэмшигч") &&
      text.includes("Нийт нөхөх олговор") &&
      text.includes("{acquisition_au2_name}")
    ) {
      return { start: match.index ?? 0, end: (match.index ?? 0) + tableXml.length, xml: tableXml };
    }
  }
  return null;
}

function buildTableXml(tableXml: string, groups: DecisionDraftDocxGroup[]) {
  const rows = rowRanges(tableXml);
  const gridWidths = extractGridWidths(tableXml);
  const groupRowIndex = rows.findIndex((row) => row.text.includes("{acquisition_au2_name}"));
  if (groupRowIndex < 0 || groupRowIndex + 1 >= rows.length) return tableXml;

  const groupTemplate = rows[groupRowIndex].xml;
  const dataTemplate = rows[groupRowIndex + 1].xml;
  const totalTemplate = rows[rows.length - 1].xml;
  const headerXml = tableXml
    .slice(rows[0].start, rows[groupRowIndex].start)
    .replace(ROW_RE, (rowXml) => (isColumnNumberRow(rowXml) ? rowXml : withVerticalHeaderCells(rowXml, gridWidths)));
  const beforeBody = tableXml.slice(0, rows[0].start) + headerXml;
  const afterBody = tableXml.slice(rows[rows.length - 1].end);

  const totals = {
    areaM2: 0,
    affectedAreaM2: 0,
    landCompensation: 0,
    realEstateCompensation: 0,
    propertyCompensation: 0,
    totalCompensation: 0,
  };

  const body: string[] = [];
  for (const group of groups) {
    body.push(withRowCells(groupTemplate, [group.title], gridWidths));
    for (const row of group.rows) {
      body.push(
        withRowCells(dataTemplate, [
          row.no,
          row.holder,
          row.address,
          row.parcelId,
          row.areaM2,
          row.rightType,
          row.landCertificateNo,
          row.affectedAreaM2,
          row.landCompensation,
          row.assetCertificateNo,
          row.realEstateCompensation,
          row.propertyCompensation,
          row.totalCompensation,
        ], gridWidths, { vertical: true }),
      );
      totals.areaM2 += Number(row.areaM2.replace(/,/g, "")) || 0;
      totals.affectedAreaM2 += Number(row.affectedAreaM2.replace(/,/g, "")) || 0;
      totals.landCompensation += Number(row.landCompensation.replace(/,/g, "")) || 0;
      totals.realEstateCompensation += Number(row.realEstateCompensation.replace(/,/g, "")) || 0;
      totals.propertyCompensation += Number(row.propertyCompensation.replace(/,/g, "")) || 0;
      totals.totalCompensation += Number(row.totalCompensation.replace(/,/g, "")) || 0;
    }
  }

  body.push(
    withRowCells(totalTemplate, [
      "",
      "",
      "",
      "",
      formatNumber(totals.areaM2, 2),
      "-",
      "-",
      formatNumber(totals.affectedAreaM2, 2),
      formatNumber(totals.landCompensation, 0),
      "-",
      formatNumber(totals.realEstateCompensation, 0),
      formatNumber(totals.propertyCompensation, 0),
      formatNumber(totals.totalCompensation, 0),
    ], gridWidths),
  );

  return beforeBody + body.join("") + afterBody;
}

export function formatNumber(value: number, maximumFractionDigits: number): string {
  return (Number(value) || 0).toLocaleString("mn-MN", {
    minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0,
    maximumFractionDigits,
  });
}

export async function injectDecisionDraftCompensationRows(
  templateBuf: Buffer,
  groups: DecisionDraftDocxGroup[],
): Promise<Buffer> {
  const entries = await readZipEntries(templateBuf);
  const idx = entries.findIndex((e) => e.name === "word/document.xml");
  if (idx === -1) return templateBuf;

  const xml = entries[idx].data.toString("utf8");
  const table = findCompensationTable(xml);
  if (!table) return templateBuf;

  const nextTableXml = buildTableXml(table.xml, groups);
  const nextXml = xml.slice(0, table.start) + nextTableXml + xml.slice(table.end);
  entries[idx] = { ...entries[idx], data: Buffer.from(nextXml, "utf8") };
  return writeZipEntries(entries);
}
