import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateEstimatedValuation, initialConfidencePercent } from "../src/lib/estimated-valuation.ts";

const fee = (values) => ({ area: 0, landuse_area: 0, zone_area: 0, base_fee_per_m2: 10, confidence_percent: 1, ...values });
const fees = [fee({ landuse_area: 100, zone_area: 200 }), fee({ area: 100, base_fee_per_m2: 20 })];

test("one coefficient applies to all zones, weighted by recorded area", () => {
  assert.equal(calculateEstimatedValuation(fees, 200, 2), 125000);
  assert.equal(calculateEstimatedValuation(fees, 200, 4), 62500);
  assert.equal(calculateEstimatedValuation([fee({ area: 400, base_fee_per_m2: 1 })], 200, 3), 6600);
});

// ӨМЧЛӨХ эрхийн газар: итгэлцүүр ХЭРЭГЛЭХГҮЙ — газрын зах зээлийн жишиг үнийг
// нөлөөлөлд өртсөн талбайгаар шууд үржүүлнэ. Backend ч (Go) ижил дүрэмтэй тул
// цонхон дээрх урьдчилсан дүн хадгалагдсан дүнтэй таарна.
test("ownership land multiplies the market price by area with no coefficient", () => {
  assert.equal(calculateEstimatedValuation([], 200, null, 1500), 300000);
  assert.equal(calculateEstimatedValuation(fees, 200, null), 2500);
  // Итгэлцүүр орсон эсэх нь дүнг ЭРС хардаг: 2% бол 50 дахин их.
  assert.equal(calculateEstimatedValuation([], 200, 2, 1500), 15000000);
  // Бутархай жишиг үнэ нь м²-ийн үнэ болохдоо бүхэлчилнэ (backend-тэй ижил).
  assert.equal(calculateEstimatedValuation([], 200, null, 1500.4), 300000);
});

test("invalid percentages and missing source data cannot produce an estimate", () => {
  for (const percent of [0, -1, NaN, Infinity, Number.MIN_VALUE]) assert.equal(calculateEstimatedValuation(fees, 200, percent), null);
  assert.equal(calculateEstimatedValuation(fees, 0, 2), null);
  assert.equal(calculateEstimatedValuation(fees, 0, null), null);
  assert.equal(calculateEstimatedValuation([], 200, 2), null);
  assert.equal(calculateEstimatedValuation([], 200, null), null);
  assert.equal(calculateEstimatedValuation([fee({ area: 100, base_fee_per_m2: 0 })], 200, 2), null);
  assert.equal(calculateEstimatedValuation([fee({ area: 100, base_fee_per_m2: 0 })], 200, null), null);
});

test("reopening restores saved percentage; differing source percentages require input", () => {
  assert.equal(initialConfidencePercent(fees, 2), "2");
  assert.equal(initialConfidencePercent(fees), "1");
  assert.equal(initialConfidencePercent([fees[0], fee({ confidence_percent: 3 })]), "");
  assert.equal(initialConfidencePercent([]), "");
  assert.equal(initialConfidencePercent([fee({ confidence_percent: 0 })]), "");
});

test("missing fee records allow a manually entered base fee", () => {
  assert.equal(calculateEstimatedValuation([], 200, 2, 10), 100000);
  assert.equal(calculateEstimatedValuation([], 200, 4, 10), 50000);
  for (const rate of [0, -1, NaN, Infinity]) assert.equal(calculateEstimatedValuation([], 200, 2, rate), null);
  for (const rate of [0, -1, NaN, Infinity]) assert.equal(calculateEstimatedValuation([], 200, null, rate), null);
  assert.equal(calculateEstimatedValuation([], 0, 2, 10), null);
  assert.equal(calculateEstimatedValuation(fees, 200, 2, 999), 125000);
});
