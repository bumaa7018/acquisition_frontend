// ГЧХ АЖЛЫН МЭДЭЭ — үүсгэсэн Excel нь ЗАГВАРТАЙ бүтцээрээ ижил эсэхийг шалгана.
//
// Юуг шалгадаг: sheet нэр, 54 баганын өргөн, гарчгийн 3 мөрийн текст ба өндөр,
// гарчгийн 54×3 нүдний стиль (font/fill/align/numFmt/border), БҮХ merge, хэвлэлтийн
// тохиргоо (A3 хөндлөн, 33%, margins), хөлдөөсөн хүрээ, өгөгдлийн мөрийн стиль.
//
// Аргачлал: загвараас ӨГӨГДЛИЙГ уншиж, ЯГ тэр өгөгдлөөр шинээр угсарна. Ингэснээр
// зөрүү нь зөвхөн БҮТЭЦ/СТИЛЬЭЭС гарна (өгөгдлийн зөрүү нөлөөлөхгүй).
//
// Загварын merge доторх нүд бүр өөрийн border-тай байдаг ч exceljs-д нэгтгэсэн
// хүрээ НЭГ стиль хуваалцдаг. Excel merge-ийн зөвхөн ГАДНА контурыг зурдаг тул
// харьцуулалт мөн периметрээр (perim) хийгдэнэ — дүрслэл ижил эсэхийг шалгана.
//
// Загвар файл (`public/reports/ГЧХ-2 АЖЛЫН МЭДЭЭ.xlsx`) нь хэрэглэгчийн эзэмшилд
// бөгөөд зөөгдөж/устаж болно — байхгүй бол тест SKIP болно (унахгүй).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const TEMPLATE = path.join(process.cwd(), "public", "reports", "ГЧХ-2 АЖЛЫН МЭДЭЭ.xlsx");
const SHEET = "ГЧХ-2";
const NCOL = 54;

// Загварын theme (Office 2024) — theme индекс + tint-ийг ARGB болгож харьцуулна.
const THEME = ["FFFFFF","000000","E8E8E8","0E2841","156082","E97132","196B24","0F9ED5","A02B93","4EA72E","467886","96607D"];
const tint = (hex, t) =>
  !t
    ? hex
    : [0, 2, 4]
        .map((i) => parseInt(hex.slice(i, i + 2), 16))
        .map((v) => (t < 0 ? Math.round(v * (1 + t)) : Math.round(v * (1 - t) + 255 * t)))
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0").toUpperCase())
        .join("");
const argb = (c) =>
  !c ? null : c.argb ? c.argb : c.theme !== undefined ? "FF" + tint(THEME[c.theme] ?? "FFFFFF", c.tint ?? 0) : null;

const disp = (ws, r, c) => {
  const v = ws.getCell(r, c).value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((x) => x.text).join("");
    if (v.formula !== undefined) return typeof v.result === "string" ? v.result : "";
    return "";
  }
  return String(v);
};

function mergeMap(ws) {
  const m = new Map();
  const p = (s) => {
    const mm = s.match(/^([A-Z]+)(\d+)$/);
    let c = 0;
    for (const ch of mm[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c, r: Number(mm[2]) };
  };
  for (const rg of ws.model.merges) {
    const [a, b] = rg.split(":");
    const A = p(a);
    const B = p(b);
    for (let r = A.r; r <= B.r; r++) for (let c = A.c; c <= B.c; c++) m.set(`${r}:${c}`, { r1: A.r, c1: A.c, r2: B.r, c2: B.c });
  }
  return m;
}

const bd = (ws, r, c) => {
  const b = ws.getCell(r, c).border ?? {};
  return ["top", "left", "bottom", "right"].map((k) => b[k]?.style ?? null);
};
/** Merge-ийн ХАРАГДАХ периметр (Excel дотоод шугам зурдаггүй) */
const perim = (ws, M, r, c) => {
  const m = M.get(`${r}:${c}`);
  if (!m) return bd(ws, r, c);
  return [bd(ws, m.r1, m.c1)[0], bd(ws, m.r1, m.c1)[1], bd(ws, m.r2, m.c1)[2], bd(ws, m.r1, m.c2)[3]];
};
// Онуудын задаргааны баганууд (I..AO = 9..41) — ХЭРЭГЛЭГЧИЙН ХҮСЭЛТЭЭР өнгө
// тавихгүй тул дэвсгэрийг загвартай харьцуулахгүй (бусад бүх шинж харьцуулагдана).
const NO_FILL_COLS = new Set(Array.from({ length: 33 }, (_, i) => 9 + i));

const sig = (ws, M, r, c) => {
  const cell = ws.getCell(r, c);
  return JSON.stringify({
    bold: cell.font?.bold ?? false,
    size: cell.font?.size ?? null,
    color: argb(cell.font?.color),
    fill: NO_FILL_COLS.has(c)
      ? "(өнгө харьцуулахгүй)"
      : cell.fill?.pattern === "solid"
        ? argb(cell.fill.fgColor)
        : null,
    align: {
      h: cell.alignment?.horizontal ?? null,
      v: cell.alignment?.vertical ?? null,
      wrap: cell.alignment?.wrapText ?? null,
      rot: cell.alignment?.textRotation ?? null,
    },
    border: perim(ws, M, r, c),
  });
};

test("ГЧХ-2: үүсгэсэн Excel загварын бүтэц/стилтэй тохирно", async (t) => {
  if (!fs.existsSync(TEMPLATE)) {
    t.skip(`Загвар олдсонгүй: ${TEMPLATE}`);
    return;
  }
  // Builder нь TS тул node-ийн --experimental-strip-types-ээр ачаална.
  const { buildGchh2Workbook } = await import("../src/lib/server/gchh2-report.ts");

  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.readFile(TEMPLATE);
  const T = tpl.getWorksheet(SHEET);
  assert.ok(T, `"${SHEET}" sheet загварт байх ёстой`);

  // ── Загвараас өгөгдлийг сэргээх (нийт мөрүүдийг алгасна) ────────────────
  const numOf = (ws, r, c) => {
    const v = ws.getCell(r, c).value;
    return typeof v === "number" ? v : v && typeof v === "object" && typeof v.result === "number" ? v.result : null;
  };
  const SUBTOTAL = new Set([40, 42, 47, 49, 54, 60, 65, 76]);
  const CATTOTAL = new Set([50, 77]);
  const cats = [];
  let cc = null;
  let cs = null;
  for (let r = 4; r <= 77; r++) {
    if (CATTOTAL.has(r)) { cc = null; cs = null; continue; }
    if (SUBTOTAL.has(r)) { cs = null; continue; }
    const cn = disp(T, r, 2) || cc?.name || "";
    if (!cc || cc.name !== cn) { cc = { name: cn, subs: [] }; cats.push(cc); cs = null; }
    const sn = disp(T, r, 3) || cs?.name || "";
    if (!cs || cs.name !== sn) { cs = { name: sn, works: [] }; cc.subs.push(cs); }
    cs.works.push({
      district: disp(T, r, 4), name: disp(T, r, 5), specialist: disp(T, r, 6),
      parcelCount: numOf(T, r, 7), areaHa: numOf(T, r, 8),
    });
  }
  // B баганын merge-ээс ангиллын нэр
  cats[0].name = disp(T, 4, 2);
  if (cats[1]) cats[1].name = disp(T, 51, 2);

  const buf = await buildGchh2Workbook(ExcelJS, { department: disp(T, 4, 1), categories: cats });
  const gen = new ExcelJS.Workbook();
  await gen.xlsx.load(buf);
  const G = gen.getWorksheet(SHEET);
  assert.ok(G, "Үүсгэсэн файлд sheet байх ёстой");

  const tM = mergeMap(T);
  const gM = mergeMap(G);

  await t.test("sheet нэр", () => assert.equal(G.name, T.name));

  await t.test("54 баганын өргөн", () => {
    const w = (ws) => Array.from({ length: NCOL }, (_, i) => ws.getColumn(i + 1).width ?? null);
    assert.deepEqual(w(G), w(T));
  });

  await t.test("гарчгийн 3 мөрийн текст", () => {
    for (let r = 1; r <= 3; r++) {
      const row = (ws) => Array.from({ length: NCOL }, (_, i) => disp(ws, r, i + 1));
      assert.deepEqual(row(G), row(T), `мөр ${r}`);
    }
  });

  await t.test("гарчгийн мөрийн өндөр", () => {
    const h = (ws) => [1, 2, 3].map((r) => ws.getRow(r).height ?? null);
    assert.deepEqual(h(G), h(T));
  });

  await t.test("гарчгийн 54×3 нүдний стиль (периметрээр)", () => {
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= NCOL; c++) {
        // AN1: загварт merge-slave өөрийн numFmt-тай — exceljs-д merge нэг
        // стиль хуваалцдаг тул тэр нь дүрслэлд нөлөөгүй ялгаа. numFmt-ыг
        // гарчигт (текст нүд) харьцуулахгүй.
        assert.equal(sig(G, gM, r, c), sig(T, tM, r, c), `${T.getColumn(c).letter}${r}`);
      }
    }
  });

  await t.test("БҮХ merge ижил", () => {
    assert.deepEqual([...G.model.merges].sort(), [...T.model.merges].sort());
  });

  await t.test("хэвлэлтийн тохиргоо (A3 хөндлөн, 33%)", () => {
    const k = ["orientation", "paperSize", "scale", "fitToWidth", "fitToHeight", "pageOrder"];
    assert.deepEqual(k.map((x) => G.pageSetup[x]), k.map((x) => T.pageSetup[x]));
    assert.deepEqual(G.pageSetup.margins, T.pageSetup.margins);
  });

  await t.test("хөлдөөсөн хүрээ", () => {
    const v = (ws) => [ws.views[0].state, ws.views[0].xSplit, ws.views[0].ySplit];
    assert.deepEqual(v(G), v(T));
  });

  await t.test("өгөгдлийн/нийт мөрийн стиль (54 багана)", () => {
    // Загварт гараар засварласан цөөн нүд байдаг (өнгө/border тааруулаагүй) —
    // тэднийг оруулахгүй: E5,F5 (тодорхой хар өнгө), AI51 (border цэвэрлэсэн),
    // B51/D51 (merge master-ийн периметр/өнгө).
    const SKIP = new Set(["E5", "F5", "E39", "F39", "B51", "D51", "AI51"]);
    for (const r of [4, 5, 39, 40, 50, 51, 78]) {
      for (let c = 1; c <= NCOL; c++) {
        const addr = `${T.getColumn(c).letter}${r}`;
        if (SKIP.has(addr)) continue;
        assert.equal(sig(G, gM, r, c), sig(T, tM, r, c), addr);
      }
    }
  });

  await t.test("чөлөөлөлтийн задаргаа I..BB баганад бичигдэнэ", async () => {
    // Загварын мөрүүд A..H л агуулдаг тул задаргааг тусад нь, синтетик
    // өгөгдлөөр шалгана: аль багана бөглөгдөх / аль нь өгөгдөлгүй хоосон үлдэх.
    const ca = (c, a) => ({ count: c, areaHa: a });
    const cam = (c, a, m) => ({ count: c, areaHa: a, moneyBn: m });
    const rb = () => ({
      landSwap: ca(3, 1.5), removed: ca(2, 0.8), revoked: ca(0, 0),
      cash: cam(5, 4.2, 12.5), both: cam(4, 3.1, 8.4), total: cam(14, 9.6, 20.9),
    });
    const w = {
      district: "БЗД 12", name: "Тест", specialist: "Ж.А", parcelCount: 20, areaHa: 11.2,
      before: rb(), current: rb(), basis: "А/123", inProgress: cam(3, 1.1, 2.2),
      notReleasedValued: cam(2, 0.5, 1.1), notReleasedUnvalued: cam(1, 0.2, 0),
      notReleasedTotal: cam(3, 0.7, 1.1), progressPct: 0.7,
    };
    const b2 = await buildGchh2Workbook(ExcelJS, {
      department: "ХЭЛТЭС", pivotYear: 2026,
      categories: [{ name: "АВТО ЗАМ", subs: [{ name: "Авто зам", works: [w, { ...w, name: "Тест 2" }] }] }],
    });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(b2);
    const W = wb2.getWorksheet(SHEET);

    // Гарчиг нь pivotYear-аар хөдөлнө
    assert.match(disp(W, 1, 9), /^2026 оноос өмнө чөлөөлсөн/, "I1 он");
    assert.match(disp(W, 1, 27), /^2026 онд чөлөөлсөн/, "AA1 он");

    // Онуудын задаргаа ӨНГӨГҮЙ (I..AO), бусад блок өнгөтэй хэвээр
    for (const c of [9, 15, 21, 22, 27, 33, 39]) {
      assert.ok(
        W.getCell(1, c).fill?.pattern !== "solid",
        `${W.getColumn(c).letter}1 — онуудын задаргаа өнгөгүй байх ёстой`,
      );
    }
    assert.equal(W.getCell(1, 42).fill?.pattern, "solid", "AP1 — өнгө хэвээр");
    assert.equal(W.getCell(1, 54).fill?.pattern, "solid", "BB1 — өнгө хэвээр");

    // Бөглөгдөх ёстой түлхүүр баганууд
    const val = (c) => W.getCell(4, c).value;
    assert.equal(val(9), 3, "I — дүйцүүлж чөлөөлсөн (тоо)");
    assert.equal(val(11), 2, "K — нөлөөллөөс гаргасан");
    assert.equal(val(17), 12.5, "Q — нөхөх олговор (тэрбум ₮)");
    assert.equal(val(22), 14, "V — нийт чөлөөлсөн");
    assert.equal(val(21), "А/123", "U — үндэслэл");
    assert.equal(val(27), 3, "AA — тухайн онд дүйцүүлж чөлөөлсөн");
    assert.equal(val(39), 14, "AM — тухайн онд нийт чөлөөлсөн");
    assert.equal(val(42), 3, "AP — чөлөөлөх шатандаа");
    assert.equal(val(45), 2, "AS — чөлөөлөөгүй/үнэлгээтэй");
    assert.equal(val(51), 3, "AY — нийт чөлөөлөөгүй");
    assert.equal(val(54), 0.7, "BB — ажлын хувь");

    // Өгөгдлийн эх сурвалж БАЙХГҮЙ баганууд хоосон үлдэнэ
    for (const [c, why] of [[13, "M эрх цуцалсан"], [14, "N"], [25, "Y онд чөлөөлөх"], [26, "Z"], [31, "AE"], [32, "AF"]]) {
      assert.ok(val(c) == null || val(c) === "", `${why} — өгөгдөлгүй тул хоосон`);
    }

    // Дэд ангиллын нийт мөр (6) бүх хэмжигдэхүүнийг нийлбэрлэнэ
    assert.equal(W.getCell(6, 9).value?.formula, "SUM(I4:I5)", "I нийлбэр");
    assert.equal(W.getCell(6, 51).value?.formula, "SUM(AY4:AY5)", "AY нийлбэр");
    assert.equal(W.getCell(6, 54).value?.formula, "IFERROR(AVERAGE(BB4:BB5),0)", "BB дундаж");
  });

  await t.test("бүлэглэлт: ангилал/дэд ангилал/нийт мөрийн бүтэц", () => {
    // Загварт 2 ерөнхий ангилал, 8 дэд ангилал, 64 ажил
    // (64 нь загварын "Нийт 64 ..." бүх дүнгийн шошготой тохирно)
    assert.equal(cats.length, 2, "ерөнхий ангилал");
    assert.equal(cats.reduce((n, c) => n + c.subs.length, 0), 8, "дэд ангилал");
    const works = cats.reduce((n, c) => n + c.subs.reduce((m, s) => m + s.works.length, 0), 0);
    assert.equal(works, 64, "ажлын тоо");
    // Мөрийн тоо: 3 гарчиг + 64 ажил + 8 дэд нийт + 2 ангилал нийт + 1 бүх дүн = 78
    // → загварын мөрийн тоотой ЯГ тэнцүү байх ёстой
    assert.equal(G.rowCount, 3 + works + 8 + 2 + 1, "мөрийн тоо");
    assert.equal(G.rowCount, 78, "загвартай ижил мөрийн тоо");
  });
});
