import test from "node:test";
import assert from "node:assert/strict";

import {
  recalcBuildingCost,
  recalcCostRow,
  isCoefficientRow,
  isNetCostRow,
} from "../src/lib/valuation-calc.ts";

/** Excel-ийн Хүснэгт-5-тай ижил бүтэцтэй мөрүүд (дараалал нь Excel дэх дараалал). */
const rows = () => [
  { calc_type_id: 1, code: "unit_cost", label: "Барилгын нэгжийн өртөг", group: "", unit: "төгрөг/м²", value: 1_000_000 },
  { calc_type_id: 2, label: "Үнийн өсөлт", group: "Итгэлцүүр", unit: "%", value: 1.05 },
  { calc_type_id: 3, label: "Халаалт", group: "Итгэлцүүр", unit: "Коэф", value: 0.95 },
  { calc_type_id: 4, label: "Бүрэн орлуулах өртөг", group: "", unit: "₮", value: 0 },
  { calc_type_id: 5, label: "Элэгдлийн хувь", group: "", unit: "%", value: 20 },
  { calc_type_id: 6, label: "Элэгдлийн дүн", group: "", unit: "₮", value: 0 },
  { calc_type_id: 7, code: "net_replacement_cost", label: "Барилгын нөхөн орлуулах өртөг", group: "", unit: "₮", value: 0 },
];

test("өртгийн гинж: нэгж×талбай×итгэлцүүр → элэгдэл → нөхөн орлуулах", () => {
  const r = recalcBuildingCost(rows(), 100);
  // 1,000,000 × 100 × 1.05 × 0.95
  assert.equal(r.fullCost, 99_750_000);
  assert.equal(r.depreciationAmount, 19_950_000);
  assert.equal(r.netCost, 79_800_000);
  // Мөрийн дараалал хөндөгдөхгүй — Excel-тэй ижил хэвээр.
  assert.deepEqual(
    r.rows.map((x) => x.label),
    rows().map((x) => x.label),
  );
  assert.equal(r.rows.find(isNetCostRow).value, 79_800_000);
});

test("итгэлцүүрийг бүлгээр нь болон хэмжих нэгжээр нь таньна", () => {
  const list = rows();
  assert.equal(isCoefficientRow(list[1]), true); // group = Итгэлцүүр
  assert.equal(isCoefficientRow(list[2]), true); // unit = Коэф
  assert.equal(isCoefficientRow(list[0]), false); // нэгжийн өртөг
  assert.equal(isCoefficientRow(list[3]), false); // бүрэн орлуулах өртөг
});

test("нэгж өртөг/талбай мэдэгдэхгүй бол гараар бичсэн дүнг дарж бичихгүй", () => {
  const list = rows();
  list[0].value = 0; // нэгжийн өртөг байхгүй
  list[3].value = 50_000_000; // гараар бичсэн бүрэн орлуулах өртөг
  const r = recalcBuildingCost(list, null);
  assert.equal(r.fullCost, 50_000_000);
  assert.equal(r.depreciationAmount, 10_000_000);
  assert.equal(r.netCost, 40_000_000);
});

test("зардлын мөр: нийт = тоо × нэгж үнэ, нийтийг өөрчилвөл нэгж үнэ буцаж бодогдоно", () => {
  assert.deepEqual(recalcCostRow({ qty: 3, unitPrice: 2500, total: 0, changed: "qty" }), {
    qty: 3,
    unitPrice: 2500,
    total: 7500,
  });
  assert.deepEqual(recalcCostRow({ qty: 3, unitPrice: 2500, total: 9000, changed: "total" }), {
    qty: 3,
    unitPrice: 3000,
    total: 9000,
  });
});
