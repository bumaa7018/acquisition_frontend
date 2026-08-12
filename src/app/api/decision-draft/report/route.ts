import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
const MAIN_SHEET = "7р хавсралт_322.58тэрбум";
const SUMMARY_SHEET = "Өнгөт хүснэгт";
const LOCAL_BUDGET = 322_582_200_000;
const INTERNATIONAL_BUDGET = 19_001_526_923.5;
const USD_RATE = 3565.5;
const TOTAL_USD = 10_925_155;
const SPENT_2025 = 19_952_113_229;

type BackendList<T> = {
  code: number;
  data: T[];
  message: string;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type DecisionDraftReportRow = {
  id: string;
  proposal_no: string;
  decree_number: string;
  decision_date?: string;
  location: string;
  duration_year?: number;
  status: number;
  work_type_name: string;
  parcel_count: number;
  parcel_area_m2: number;
  funding_local_amount: number;
  funding_international_amount: number;
  funding_source_amounts?: Record<string, number>;
  funding_source_compensation_amounts?: Record<string, number>;
  funding_source_parcel_counts?: Record<string, number>;
  funding_source_parcel_areas?: Record<string, number>;
  current_progress_type: string;
};

type Totals = {
  parcels: number;
  area: number;
  budgets: Record<string, number>;
  compensations: Record<string, number>;
  counts: Record<string, number>;
  areas: Record<string, number>;
};

type MainSheetMeta = {
  issuedTotalRow: number;
  reviewingTotalRow: number;
  allTotalRow: number;
  helperStartRow: number;
  sourceColumns: string[];
};

const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FF000000" } },
  left: { style: "thin" as const, color: { argb: "FF000000" } },
  bottom: { style: "thin" as const, color: { argb: "FF000000" } },
  right: { style: "thin" as const, color: { argb: "FF000000" } },
};
const mediumBorder = {
  top: { style: "medium" as const, color: { argb: "FF000000" } },
  left: { style: "medium" as const, color: { argb: "FF000000" } },
  bottom: { style: "medium" as const, color: { argb: "FF000000" } },
  right: { style: "medium" as const, color: { argb: "FF000000" } },
};
const font = { name: "Arial", size: 9, color: { argb: "FF000000" } };
const sectionFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFB7DEE8" } };
const issuedFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEAF3F8" } };
const reviewingFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } };
const totalFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD9EAD3" } };
const yellowFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFF00" } };
const intlFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6E0B4" } };
const localFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFE699" } };

function fmtReportDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function fmtDecisionDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function wsColumn(index: number) {
  let n = index;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function valueOrBlank(value: number | undefined | null) {
  return value && value !== 0 ? value : null;
}

function totals(rows: DecisionDraftReportRow[]): Totals {
  return rows.reduce(
    (acc, row) => ({
      parcels: acc.parcels + (row.parcel_count || 0),
      area: acc.area + (row.parcel_area_m2 || 0),
      budgets: mergeSourceAmounts(acc.budgets, row.funding_source_amounts),
      compensations: mergeSourceAmounts(acc.compensations, row.funding_source_compensation_amounts),
      counts: mergeSourceAmounts(acc.counts, row.funding_source_parcel_counts),
      areas: mergeSourceAmounts(acc.areas, row.funding_source_parcel_areas),
    }),
    { parcels: 0, area: 0, budgets: {}, compensations: {}, counts: {}, areas: {} },
  );
}

function mergeSourceAmounts(current: Record<string, number>, next?: Record<string, number>) {
  const merged = { ...current };
  Object.entries(next ?? {}).forEach(([key, value]) => {
    merged[key] = (merged[key] ?? 0) + (Number(value) || 0);
  });
  return merged;
}

function sourceTypes(rows: DecisionDraftReportRow[]) {
  const types = new Set<string>();
  rows.forEach((row) => {
    Object.keys({
      ...(row.funding_source_amounts ?? {}),
      ...(row.funding_source_compensation_amounts ?? {}),
    }).forEach((key) => {
      if (key.trim()) types.add(key.trim());
    });
  });
  return Array.from(types).sort((a, b) => a.localeCompare(b, "mn"));
}

function fundingHeaderLabel(sourceType: string, amount: number) {
  if (sourceType === "Санхүүгийн эх үүсвэр" && !amount) return sourceType;
  const billion = amount / 1_000_000_000;
  const rounded = billion >= 1 ? Math.round(billion) : billion;
  return `${sourceType} ${rounded.toLocaleString("mn-MN", { maximumFractionDigits: 3 })} тэрбум`;
}

function formula(formulaText: string, result: number) {
  return { formula: formulaText, result };
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    parcels: a.parcels + b.parcels,
    area: a.area + b.area,
    budgets: mergeSourceAmounts(a.budgets, b.budgets),
    compensations: mergeSourceAmounts(a.compensations, b.compensations),
    counts: mergeSourceAmounts(a.counts, b.counts),
    areas: mergeSourceAmounts(a.areas, b.areas),
  };
}

function styleCells(row: ExcelJS.Row, from: number, to: number, fill?: ExcelJS.Fill) {
  for (let c = from; c <= to; c += 1) {
    const cell = row.getCell(c);
    cell.font = font;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
    if (fill) cell.fill = fill;
  }
}

function setNumberFormats(row: ExcelJS.Row, sourceCount = 2) {
  row.getCell(4).numFmt = "#,##0";
  row.getCell(5).numFmt = "#,##0.00";
  for (let c = 6; c < 6 + sourceCount; c += 1) {
    row.getCell(c).numFmt = "#,##0";
  }
}

function setSummaryNumberFormats(row: ExcelJS.Row) {
  row.eachCell((cell, colNumber) => {
    if (colNumber >= 4) cell.numFmt = "#,##0.00";
  });
}

function addSection(ws: ExcelJS.Worksheet, rowNumber: number, label: string, columnCount: number) {
  ws.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const row = ws.getRow(rowNumber);
  row.height = 18;
  row.getCell(1).value = label;
  styleCells(row, 1, columnCount, sectionFill);
  row.eachCell((cell) => {
    cell.font = { ...font, bold: true };
  });
}

function addDataRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  index: number,
  rowData: DecisionDraftReportRow,
  issued: boolean,
  sourceColumns: string[],
) {
  const decisionInfo = issued
    ? [fmtDecisionDate(rowData.decision_date), rowData.decree_number].filter(Boolean).join(" ")
    : "";
  const sourceValues = sourceColumns.map((type) => valueOrBlank(rowData.funding_source_compensation_amounts?.[type]));
  const locationCol = 6 + sourceColumns.length;
  const row = ws.getRow(rowNumber);
  row.values = [
    undefined,
    index,
    rowData.proposal_no,
    decisionInfo,
    valueOrBlank(rowData.parcel_count),
    valueOrBlank(rowData.parcel_area_m2),
    ...sourceValues,
    rowData.location,
    rowData.work_type_name,
    rowData.duration_year ?? null,
  ];
  if (rowData.location?.length > 120) row.height = 36;
  else if (rowData.location?.length > 70) row.height = 24;
  styleCells(row, 1, sourceColumns.length + 8, issued ? issuedFill : reviewingFill);
  row.getCell(2).font = { ...font, bold: true };
  row.getCell(3).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  row.getCell(locationCol).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  row.getCell(locationCol + 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  setNumberFormats(row, sourceColumns.length);
}

function addTotalRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  total: Totals,
  sourceColumns: string[],
  labelCol = 2,
) {
  const row = ws.getRow(rowNumber);
  row.values = [
    undefined,
    null,
    labelCol === 2 ? label : null,
    labelCol === 3 ? label : null,
    total.parcels,
    total.area,
    ...sourceColumns.map((type) => total.compensations[type] ?? 0),
  ];
  styleCells(row, 1, sourceColumns.length + 6, totalFill);
  row.getCell(labelCol).font = { ...font, bold: true };
  row.eachCell((cell) => {
    cell.font = { ...(cell.font ?? font), bold: true };
  });
  setNumberFormats(row, sourceColumns.length);
}

function addSummaryBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  issued: Totals,
  reviewing: Totals,
  issuedTotalRow: number,
  reviewingTotalRow: number,
  sourceColumns: string[],
) {
  const all = addTotals(issued, reviewing);
  const helperLabelCol = 4;
  const helperSourceStartCol = helperLabelCol + 1;
  const helperEndCol = helperLabelCol + sourceColumns.length;

  const header = ws.getRow(startRow);
  header.values = [undefined, null, null, "Үзүүлэлт", ...sourceColumns];
  styleCells(header, helperLabelCol, helperEndCol, sectionFill);
  header.eachCell((cell) => {
    cell.font = { ...font, bold: true };
  });

  const rows = [
    {
      label: "Батлагдсан төсөв",
      values: sourceColumns.map((type) => all.budgets[type] ?? 0),
      fill: yellowFill,
    },
    {
      label: "Захирамж гарсан ",
      values: sourceColumns.map((_, i) => {
        const col = wsColumn(7 + i);
        const result = issued.compensations[sourceColumns[i]] ?? 0;
        return formula(`${col}${issuedTotalRow}`, result);
      }),
    },
    {
      label: "Захирамжийн төсөлд хянагдаж байгаа",
      values: sourceColumns.map((_, i) => {
        const col = wsColumn(7 + i);
        const result = reviewing.compensations[sourceColumns[i]] ?? 0;
        return formula(`${col}${reviewingTotalRow}`, result);
      }),
    },
    {
      label: "БҮГД",
      values: sourceColumns.map((type, i) => {
        const col = wsColumn(helperSourceStartCol + i);
        const result = all.compensations[type] ?? 0;
        return formula(`${col}${startRow + 2}+${col}${startRow + 3}`, result);
      }),
      fill: totalFill,
    },
    {
      label: "Зөрүү дүн",
      values: sourceColumns.map((type, i) => {
        const col = wsColumn(helperSourceStartCol + i);
        const result = (all.budgets[type] ?? 0) - (all.compensations[type] ?? 0);
        return formula(`${col}${startRow + 1}-${col}${startRow + 4}`, result);
      }),
      fill: yellowFill,
    },
  ];

  rows.forEach((values, i) => {
    const row = ws.getRow(startRow + 1 + i);
    row.values = [undefined, null, null, values.label, ...values.values];
    styleCells(row, helperLabelCol, helperEndCol, values.fill);
    row.getCell(helperLabelCol).font = { ...font, bold: true };
    setSummaryNumberFormats(row);
  });
}

function buildMainSheet(wb: ExcelJS.Workbook, rows: DecisionDraftReportRow[]): MainSheetMeta {
  const sourceColumns = sourceTypes(rows);
  const visibleSourceColumns = sourceColumns.length > 0 ? sourceColumns : ["Санхүүгийн эх үүсвэр"];
  const reportTotals = totals(rows);
  const sourceHeaders = visibleSourceColumns.map((type) =>
    fundingHeaderLabel(type, reportTotals.budgets[type] ?? 0),
  );
  const columnCount = visibleSourceColumns.length + 8;
  const lastCol = wsColumn(columnCount);
  const ws = wb.addWorksheet(MAIN_SHEET, {
    pageSetup: {
      orientation: "landscape",
      paperSize: 8 as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.25, header: 0.3, footer: 0.3 },
    },
    views: [{ zoomScale: 85 }],
  });
  ws.columns = [
    { width: 4.28515625 },
    { width: 9.85546875 },
    { width: 18.140625 },
    { width: 10.42578125 },
    { width: 13.5703125 },
    ...visibleSourceColumns.map(() => ({ width: 18.140625 })),
    { width: 84 },
    { width: 18.42578125 },
    { width: 8.7109375 },
  ];

  ws.mergeCells(1, 1, 1, columnCount);
  ws.getRow(1).height = 15.75;
  ws.getCell("A1").value = "НӨХӨХ ОЛГОВРЫН МЭДЭЭ";
  ws.getCell("A1").font = { ...font, bold: true };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(2).height = 11.25;
  ws.getCell(`${lastCol}2`).value = fmtReportDate();
  ws.getCell(`${lastCol}2`).font = { ...font, bold: true };
  ws.getCell(`${lastCol}2`).alignment = { horizontal: "right", vertical: "middle" };
  ws.getCell(`${lastCol}2`).fill = yellowFill;

  const header = ws.getRow(3);
  header.height = 84.75;
  header.values = [
    undefined,
    "№",
    "Саналын хуудасны дугаар",
    "НЗД-ын захирамжийн огноо дугаар",
    "Нэгж талбарын тоо",
    "Талбайн хэмжээ /м2/",
    ...sourceHeaders,
    "Байршил",
    "Ажлын төрөл",
    "Хугацаа",
  ];
  styleCells(header, 1, columnCount);

  const issued = rows.filter((row) => row.status === 2 || row.current_progress_type === "confirming");
  const reviewing = rows.filter((row) => !(row.status === 2 || row.current_progress_type === "confirming"));
  const issuedTotals = totals(issued);
  const reviewingTotals = totals(reviewing);
  const allTotals = addTotals(issuedTotals, reviewingTotals);

  let r = 4;
  addSection(ws, r, "Гарсан захирамж", columnCount);
  r += 1;
  issued.forEach((row, i) => {
    addDataRow(ws, r, i + 1, row, true, visibleSourceColumns);
    r += 1;
  });
  const issuedTotalRow = r;
  addTotalRow(ws, r, "НИЙТ", issuedTotals, visibleSourceColumns, 3);
  r += 1;
  addSection(ws, r, "Хянагдаж байгаа захирамж", columnCount);
  r += 1;
  reviewing.forEach((row, i) => {
    addDataRow(ws, r, i + 1, row, false, visibleSourceColumns);
    r += 1;
  });
  const reviewingTotalRow = r;
  addTotalRow(ws, r, "НИЙТ", reviewingTotals, visibleSourceColumns);
  r += 1;
  const allTotalRow = r;
  addTotalRow(ws, r, "БҮГД", allTotals, visibleSourceColumns);
  r += 3;
  const helperStartRow = r;
  addSummaryBlock(ws, r, issuedTotals, reviewingTotals, issuedTotalRow, reviewingTotalRow, visibleSourceColumns);
  return { issuedTotalRow, reviewingTotalRow, allTotalRow, helperStartRow, sourceColumns: visibleSourceColumns };
}

function buildSummarySheet(wb: ExcelJS.Workbook, rows: DecisionDraftReportRow[], mainMeta: MainSheetMeta) {
  const ws = wb.addWorksheet(SUMMARY_SHEET);
  const sourceColumns = mainMeta.sourceColumns;
  const sourceStartCol = 4;
  const helperSourceStartCol = 5;
  const totalCol = sourceStartCol + sourceColumns.length;
  const totalColLetter = wsColumn(totalCol);
  const sourceHeaders = sourceColumns.map((type) =>
    fundingHeaderLabel(type, totals(rows).budgets[type] ?? 0),
  );
  ws.columns = [
    { width: 3.42578125 },
    { width: 22.85546875 },
    { width: 23.85546875 },
    ...sourceColumns.map(() => ({ width: 24 })),
    { width: 10.42578125 },
  ];
  ws.getRow(2).height = 36;
  ws.getRow(3).height = 15.75;
  ws.getRow(6).height = 15.75;
  ws.getRow(9).height = 15.75;
  ws.getRow(12).height = 15.75;

  const issued = totals(rows.filter((row) => row.status === 2 || row.current_progress_type === "confirming"));
  const reviewing = totals(rows.filter((row) => !(row.status === 2 || row.current_progress_type === "confirming")));
  const all = addTotals(issued, reviewing);
  const mainRef = `'${MAIN_SHEET}'`;
  const helperBudgetRow = mainMeta.helperStartRow + 1;
  const helperIssuedRow = mainMeta.helperStartRow + 2;
  const helperReviewingRow = mainMeta.helperStartRow + 3;
  const helperAllRow = mainMeta.helperStartRow + 4;
  const helperDiffRow = mainMeta.helperStartRow + 5;
  const sourceFormulaValues = (rowNo: number, divisor: number, results: Record<string, number>) =>
    sourceColumns.map((type, i) =>
      formula(`${mainRef}!${wsColumn(helperSourceStartCol + i)}${rowNo}${divisor === 1 ? "" : `/${divisor}`}`, (results[type] ?? 0) / divisor),
    );
  const countValues = (total: Totals) => sourceColumns.map((type) => total.counts[type] ?? 0);
  const areaValues = (total: Totals) => sourceColumns.map((type) => (total.areas[type] ?? 0) / 10000);
  const amountBillionValues = (helperRowNo: number, total: Totals) =>
    sourceFormulaValues(helperRowNo, 1_000_000_000, total.compensations);
  const cellResult = (value: number | ReturnType<typeof formula>) =>
    typeof value === "number" ? value : value.result;
  const sourceSumFormula = (rowNo: number, values: Array<number | ReturnType<typeof formula>>) =>
    formula(
      `SUM(${wsColumn(sourceStartCol)}${rowNo}:${wsColumn(totalCol - 1)}${rowNo})`,
      values.reduce<number>((sum, value) => sum + cellResult(value), 0),
    );
  const summaryRows: Array<{ label: string; unit: string; values: Array<number | ReturnType<typeof formula>>; fill?: ExcelJS.Fill }> = [
    {
      label: "Батлагдсан төсөв",
      unit: "тэрбум төгрөг",
      values: sourceFormulaValues(helperBudgetRow, 1_000_000_000, all.budgets),
      fill: yellowFill,
    },
    { label: "Захирамж гарсан ", unit: "Нэгж талбарын тоо", values: countValues(issued) },
    { label: "Захирамж гарсан ", unit: "Хэмжээ, га", values: areaValues(issued) },
    { label: "Захирамж гарсан ", unit: "Тэрбум төгрөг", values: amountBillionValues(helperIssuedRow, issued) },
    { label: "Захирамжийн төсөлд хянагдаж байгаа", unit: "Нэгж талбарын тоо", values: countValues(reviewing) },
    { label: "Захирамжийн төсөлд хянагдаж байгаа", unit: "Хэмжээ, га", values: areaValues(reviewing) },
    { label: "Захирамжийн төсөлд хянагдаж байгаа", unit: "Тэрбум төгрөг", values: amountBillionValues(helperReviewingRow, reviewing) },
    { label: "БҮГД", unit: "Нэгж талбарын тоо", values: sourceColumns.map((type, i) => formula(`${wsColumn(sourceStartCol + i)}4+${wsColumn(sourceStartCol + i)}7`, all.counts[type] ?? 0)), fill: totalFill },
    { label: "БҮГД", unit: "Хэмжээ, га", values: sourceColumns.map((type, i) => formula(`${wsColumn(sourceStartCol + i)}5+${wsColumn(sourceStartCol + i)}8`, (all.areas[type] ?? 0) / 10000)), fill: totalFill },
    { label: "БҮГД", unit: "Тэрбум төгрөг", values: amountBillionValues(helperAllRow, all), fill: totalFill },
    {
      label: "Зөрүү дүн",
      unit: "тэрбум төгрөг",
      values: sourceFormulaValues(helperDiffRow, 1_000_000_000, sourceColumns.reduce<Record<string, number>>((acc, type) => {
        acc[type] = (all.budgets[type] ?? 0) - (all.compensations[type] ?? 0);
        return acc;
      }, {})),
      fill: yellowFill,
    },
  ];

  const header = ws.getRow(2);
  header.values = [undefined, "Үзүүлэлт", "Хэмжих нэгж", ...sourceHeaders, "Бүгд"];
  styleCells(header, 2, totalCol);
  header.eachCell((cell) => {
    cell.font = { ...font, bold: true };
  });

  summaryRows.forEach((values, i) => {
    const rowNo = i + 3;
    const row = ws.getRow(rowNo);
    row.values = [undefined, values.label, values.unit, ...values.values, sourceSumFormula(rowNo, values.values)];
    styleCells(row, 2, totalCol, values.fill);
    for (let c = sourceStartCol; c <= totalCol; c += 1) {
      row.getCell(c).numFmt = values.unit === "Нэгж талбарын тоо" ? "#,##0" : "#,##0.00";
    }
  });
  ws.mergeCells("B4:B6");
  ws.mergeCells("B7:B9");
  ws.mergeCells("B10:B12");
  ws.getCell("B4").value = "Захирамж гарсан ";
  ws.getCell("B7").value = "Захирамжийн төсөлд хянагдаж байгаа";
  ws.getCell("B10").value = "БҮГД";
  ["B4", "B7", "B10"].forEach((addr) => {
    ws.getCell(addr).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  for (let r = 2; r <= 13; r += 1) {
    ws.getRow(r).getCell(2).border = { ...ws.getRow(r).getCell(2).border, left: mediumBorder.left };
    ws.getRow(r).getCell(totalCol).border = { ...ws.getRow(r).getCell(totalCol).border, right: mediumBorder.right };
  }
}

async function fetchDecisionDrafts(query: URLSearchParams, authorization: string) {
  const pageSize = 500;
  const fetchPage = async (page: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(page));
    q.set("page_size", String(pageSize));
    const res = await fetch(`${BACKEND}/api/v1/decision-drafts?${q.toString()}`, {
      headers: { Authorization: authorization, "Accept-Language": "mn" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return res.json() as Promise<BackendList<DecisionDraftReportRow>>;
  };

  const first = await fetchPage(1);
  const pages = first.total_pages > 1
    ? await Promise.all(Array.from({ length: first.total_pages - 1 }, (_, i) => fetchPage(i + 2)))
    : [];
  return [first, ...pages].flatMap((page) => page.data ?? []);
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ message: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  try {
    const rows = await fetchDecisionDrafts(req.nextUrl.searchParams, authorization);
    const wb = new ExcelJS.Workbook();
    wb.creator = "government";
    wb.created = new Date();
    wb.modified = new Date();
    wb.calcProperties.fullCalcOnLoad = true;
    const mainMeta = buildMainSheet(wb, rows);
    buildSummarySheet(wb, rows, mainMeta);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `decision_report_${fmtReportDate().replaceAll(".", "")}.xlsx`;
    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("decision draft report failed", err);
    return NextResponse.json({ message: "Тайлан үүсгэхэд алдаа гарлаа" }, { status: 500 });
  }
}
