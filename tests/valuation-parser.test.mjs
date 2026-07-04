import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as xlsx from "xlsx";

import { fixHomoglyphs, normalizeText, parseNumber } from "../src/lib/valuation-import/normalize.ts";
import { bestMatch, similarity } from "../src/lib/valuation-import/fuzzy.ts";
import { detectKind } from "../src/lib/valuation-import/kind.ts";
import { buildValuation } from "../src/lib/valuation-import/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "..", "compensation.xlsx");

// ── normalize ──
test("parseNumber: тоо биш утгыг null болгоно (0 биш)", () => {
  assert.equal(parseNumber("д/д"), null);
  assert.equal(parseNumber("#ERROR!"), null);
  assert.equal(parseNumber(""), null);
});

test("parseNumber: нэгж, мянгатын таслал, аравтыг зөв уншина", () => {
  assert.equal(parseNumber("480 м.Кв"), 480);
  assert.equal(parseNumber("1,606,000"), 1606000);
  assert.equal(parseNumber("36 500"), 36500);
  assert.equal(parseNumber("1.054"), 1.054);
});

test("fixHomoglyphs: латин үсгийг кирилл дүрс адил үсгээр солино", () => {
  // c→с, y→у, y→у, ц→ц ⇒ "сууц"
  assert.equal(fixHomoglyphs("cyyц"), "сууц");
});

test("normalizeText: зай + том үсэг + homoglyph жигдэрнэ", () => {
  assert.equal(normalizeText("  Газрын   ҮНЭЛГЭЭ "), "газрын үнэлгээ");
});

// ── fuzzy ──
test("bestMatch: sheet нэрийг ойролцоо утгаар олно", () => {
  const names = ["газрын үнэлгээ", "Бусад хөрөнгө", "Түр сууршуулах"];
  const m = bestMatch("газар үнэлгээ", names, 0.75);
  assert.ok(m);
  assert.equal(m.value, "газрын үнэлгээ");
});

test("similarity: огт хамааралгүй бичвэрт бага оноо", () => {
  assert.ok(similarity("газар", "хашаа") < 0.5);
});

// ── kind ──
test("detectKind: барилга→real_state, хашаа→property, газар→null", () => {
  assert.equal(detectKind("Байшин"), "real_state");
  assert.equal(detectKind("Хувийн сууц"), "real_state");
  assert.equal(detectKind("Хашаа"), "property");
  assert.equal(detectKind("Хашааны хаалга"), "property");
  assert.equal(detectKind("Газар"), null);
});

// ── бүрэн pipeline: жишиг compensation.xlsx дээр ──
test("buildValuation: compensation.xlsx-ийг зөв задална", (t) => {
  if (!fs.existsSync(FIXTURE)) {
    t.skip("compensation.xlsx олдсонгүй");
    return;
  }
  const wbRaw = xlsx.read(fs.readFileSync(FIXTURE), { cellFormula: false, cellText: true });
  const wb = {};
  for (const n of wbRaw.SheetNames) {
    wb[n] = xlsx.utils.sheet_to_json(wbRaw.Sheets[n], {
      header: 1,
      blankrows: false,
      defval: "",
      raw: true,
    });
  }
  const v = buildValuation(wb);

  // Газар
  assert.equal(v.land.ownerName, "Н.Туул");
  assert.equal(v.land.affectedAreaM2, 480);
  assert.equal(v.land.basePriceM2, 175000);
  assert.equal(v.land.certNo, "Г-2202012474");
  assert.equal(v.land.parcelNo, "18642316854193");

  // Хоёр үл хөдлөх (Байшин-1, Байшин-2) тус тусын өртгийн баганатай
  const buildings = v.assets.filter((a) => a.kind === "real_state" && a.building);
  assert.equal(buildings.length, 2, "2 барилга байх ёстой");
  const b1 = buildings.find((a) => a.name.includes("Байшин-1"));
  const b2 = buildings.find((a) => a.name.includes("Байшин-2"));
  assert.ok(b1 && b2, "Байшин-1 ба Байшин-2 хоёулаа олдох ёстой");
  assert.equal(b1.building.replacementCost, 110019854.6);
  assert.equal(b2.building.replacementCost, 26608289.32);
  assert.equal(b1.building.unitCostM2, 833032.71);
  assert.ok(b1.building.coefficients.length >= 3);

  // Эд хөрөнгө нь property болсон байх ба үнэ нь Бусад хөрөнгөнөөс тааруулагдсан
  const fence = v.assets.find((a) => a.name.includes("Хашаа") && !a.name.includes("болок"));
  assert.equal(fence.kind, "property");
  assert.equal(fence.totalPrice, 1606000);

  // Толгойн мөр хөрөнгө болж орж ирээгүй байх (parseNumber засвар)
  assert.ok(v.assets.every((a) => a.name && !a.name.includes("Үнэлж буй")));

  // Түр суурьшуулах зардал
  const clearance = v.clearance.find((c) => c.totalPrice === 3000000);
  assert.ok(clearance, "3сая түр суурьшуулах зардал олдсон байх");

  // Байгууллага
  assert.equal(v.org.director, "Д. Биндэръяа");
});

// ── Робуст байдал: sheet байршил + багана/мөрийн тохиргоо өөрчлөгдсөн ч бүрэн уншина ──
test("buildValuation: багана/мөр/sheet өөрчлөгдсөн ч бүрэн уншина", (t) => {
  if (!fs.existsSync(FIXTURE)) {
    t.skip("compensation.xlsx олдсонгүй");
    return;
  }
  const wbRaw = xlsx.read(fs.readFileSync(FIXTURE), { cellFormula: false, cellText: true });
  const base = {};
  for (const n of wbRaw.SheetNames)
    base[n] = xlsx.utils.sheet_to_json(wbRaw.Sheets[n], { header: 1, blankrows: false, defval: "", raw: true });

  const insertCol = (aoa, at, hv) =>
    aoa.map((r, i) => {
      const c = r.slice();
      c.splice(at, 0, i === 1 ? hv : "");
      return c;
    });

  // Хосолсон өөрчлөлт: багана шилжүүлэх/нэмэх + бүх sheet-д дээд мөр + sheet дараалал урвуулах
  const m = {};
  for (const k in base) m[k] = base[k].map((r) => r.slice());
  m["Бусад хөрөнгө"] = m["Бусад хөрөнгө"].map((r) => ["", ...r]);
  m["Түр сууршуулах"] = m["Түр сууршуулах"].map((r) => ["", "", ...r]);
  m["хөрөнгийн тодорхойлолт"] = insertCol(m["хөрөнгийн тодорхойлолт"], 3, "Нэмэлт");
  m["барилга өртгийн хандлага"] = insertCol(m["барилга өртгийн хандлага"], 2, "x");
  for (const k in m) m[k] = [[""]].concat(m[k]);
  const wb = {};
  for (const n of Object.keys(m).reverse()) wb[n] = m[n];

  const v = buildValuation(wb);
  assert.equal(v.land.basePriceM2, 175000, "газрын суурь үнэ");
  assert.equal(v.land.affectedAreaM2, 480, "газрын талбай");
  const b = v.assets.find((a) => a.building);
  assert.ok(b && b.building.unitCostM2 === 833032.71, "барилгын нэгж өртөг");
  assert.equal(b.building.replacementCost, 110019854.6, "нөхөн орлуулах өртөг");
  const fence = v.assets.find((a) => /^Хашаа$/.test(a.name));
  assert.ok(fence && fence.kind === "property" && fence.totalPrice === 1606000, "эд хөрөнгийн үнэ");
  assert.ok(v.clearance.some((c) => c.totalPrice === 3000000), "түр суурьшуулах зардал");
});
