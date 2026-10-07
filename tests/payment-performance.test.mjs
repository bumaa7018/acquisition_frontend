// «Төлбөрийн гүйцэтгэл» — нийт үнэлгээг олголтын шатаар (60% / 40%) хувьлах,
// урьд авсан санхүүжилтийг нэгж талбарын олголтын гүйцэтгэлээс бодох, загварыг
// хэв маягаар нь хадгалан бөглөх.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import {
  computePaymentPerformance,
  priorPaidPercent,
  suggestedStage,
} from "../src/lib/payment-performance.ts";
import { fillPaymentPerformance } from "../src/lib/server/payment-performance-xlsx.ts";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const TEMPLATE = path.join(process.cwd(), "public", "templates", "tulbur_guitsegel.xlsx");

const amounts = { land: 10_000_000, realEstate: 5_000_000, property: 1_000_001 };

test("60% — анхны олголт: урьд авсан 0, үлдэгдэл 40%", () => {
  const p = computePaymentPerformance({ ...amounts, stage: 60 });
  assert.equal(p.priorPct, 0);
  assert.equal(p.stagePct, 0.6);
  assert.deepEqual(p.land, { budget: 10_000_000, prior: 0, current: 6_000_000, cumulative: 6_000_000, remaining: 4_000_000 });
  assert.equal(p.total.budget, 16_000_001);
  assert.equal(p.total.current, 6_000_000 + 3_000_000 + 600_001);
  assert.equal(p.total.cumulative + p.total.remaining, p.total.budget, "дүн тэнцэнэ");
});

test("40% — 60% нь олгогдсон бол урьд авсан санхүүжилт = 60%, үлдэгдэл 0", () => {
  const p = computePaymentPerformance({ ...amounts, stage: 40, paid60: true });
  assert.equal(p.priorPct, 0.6);
  assert.equal(p.cumulativePct, 1);
  assert.deepEqual(p.land, { budget: 10_000_000, prior: 6_000_000, current: 4_000_000, cumulative: 10_000_000, remaining: 0 });
  assert.equal(p.total.remaining, 0);
});

test("40% — 60% олгогдоогүй бол урьд авсан 0 (хадгалсан гүйцэтгэлээр)", () => {
  const p = computePaymentPerformance({ ...amounts, stage: 40 });
  assert.equal(p.priorPct, 0);
  assert.equal(p.land.remaining, 6_000_000);
});

test("100% — нэг удаа бүрэн: урьд авсан 0, тайлант үе = нийт, үлдэгдэл 0", () => {
  const p = computePaymentPerformance({ ...amounts, stage: 100 });
  assert.equal(p.priorPct, 0);
  assert.equal(p.stagePct, 1);
  assert.equal(p.cumulativePct, 1);
  assert.deepEqual(p.land, { budget: 10_000_000, prior: 0, current: 10_000_000, cumulative: 10_000_000, remaining: 0 });
  assert.equal(p.total.current, p.total.budget);
  // Өмнө 60% олгосон байсан ч 100% сонговол урьд авсныг давхар тоолохгүй.
  assert.equal(computePaymentPerformance({ ...amounts, stage: 100, paid60: true }).total.prior, 0);
});

test("урьд олгосон хувь — сонгосон шатыг давхар тоолохгүй", () => {
  assert.equal(priorPaidPercent({ stage: 60, paid60: true }), 0);
  assert.equal(priorPaidPercent({ stage: 60, paid40: true }), 40);
  assert.equal(priorPaidPercent({ stage: 40, paid60: true, paid40: true }), 60);
  assert.equal(priorPaidPercent({ stage: 40, paidFull: true }), 60);
  assert.equal(priorPaidPercent({ stage: 60, paidFull: true }), 40);
  assert.equal(priorPaidPercent({ stage: 100, paidFull: true }), 0);
  assert.equal(priorPaidPercent({ stage: 100, paid60: true, paid40: true }), 0);
});

test("санал болгох шат", () => {
  assert.equal(suggestedStage(false, false), 60);
  assert.equal(suggestedStage(true, false), 40);
  assert.equal(suggestedStage(true, true), 60);
});

test("загварыг бөглөнө — утга, формат, нэгтгэсэн нүд хадгалагдана", { skip: !fs.existsSync(TEMPLATE) }, async () => {
  const out = await fillPaymentPerformance(fs.readFileSync(TEMPLATE), {
    ...amounts,
    stage: 40,
    paid60: true,
    acquisitionName: "Тест чөлөөлөлт",
    period: "2026.06.01-2026.12.31",
    date: "2026.10.06",
  });
  const before = new ExcelJS.Workbook();
  await before.xlsx.readFile(TEMPLATE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.worksheets[0];
  const v = (a) => ws.getCell(a).value;

  assert.equal(v("E8"), "Тест чөлөөлөлт");
  assert.equal(v("E9"), "", "загварын жишээ гэрээний дугаар үлдэхгүй");
  assert.equal(v("E11"), "2026.10.06");
  assert.match(String(v("C7")), /№2$/);
  assert.equal(v("C22"), "Газар чөлөөлсөн гүйцэтгэл 40%");
  // Газрын үнэлгээ: төсөв 10сая, урьд 60%, тайлант 40%.
  assert.equal(v("D13"), 10_000_000);
  assert.equal(v("F13"), 6_000_000);
  assert.equal(v("G13"), 4_000_000);
  assert.equal(v("H13"), 4_000_000);
  assert.equal(v("E13"), 10_000_000);
  assert.equal(v("J13"), 0);
  assert.equal(v("I13"), 1);
  // Бүгд дүн.
  assert.equal(v("D16"), 16_000_001);
  assert.equal(v("F16"), 6_000_000 + 3_000_000 + 600_001);
  assert.equal(v("F17"), 0.6);
  assert.equal(v("G17"), 0.4);
  // Формат ба бүтэц.
  assert.equal(ws.getCell("D13").numFmt, "#,##0");
  assert.equal(ws.getCell("I13").numFmt, "0%");
  assert.deepEqual(
    Object.keys(ws._merges).sort(),
    Object.keys(before.worksheets[0]._merges).sort(),
    "нэгтгэсэн нүд хэвээр",
  );
  assert.deepEqual(ws.getCell("D13").border, before.worksheets[0].getCell("D13").border, "хүрээ хэвээр");
});

test("загвар — 100%: №1, «гүйцэтгэл 100%», тайлант үе = нийт", { skip: !fs.existsSync(TEMPLATE) }, async () => {
  const out = await fillPaymentPerformance(fs.readFileSync(TEMPLATE), { ...amounts, stage: 100, date: "2026.10.06" });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.worksheets[0];
  assert.match(String(ws.getCell("C7").value), /№1$/);
  assert.equal(ws.getCell("C22").value, "Газар чөлөөлсөн гүйцэтгэл 100%");
  assert.equal(ws.getCell("G16").value, 16_000_001);
  assert.equal(ws.getCell("F16").value, 0);
  assert.equal(ws.getCell("J16").value, 0);
  assert.equal(ws.getCell("G17").value, 1);
});
