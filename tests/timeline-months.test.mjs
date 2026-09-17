import test from "node:test";
import assert from "node:assert/strict";
import { monthlyTimeline } from "../src/lib/timeline-months.ts";
import { getParcelStatusStyle } from "../src/types/index.ts";

// ── Цагийн график: сонгосон оны БҮХ сар ───────────────────────────────────
// Засварлаж буй алдаа: график нь ӨГӨГДӨЛ БАЙГАА эхний сараас эхэлдэг байсан
// тул хайлтад сонгосон оны эхлэл харагддаггүй байв.

const raw2026 = [
  { date: "2026.03.14", count: 2 },
  { date: "2026.03.28", count: 3 },
  { date: "2026.09.01", count: 1 },
];

test("сонгосон оны 1-р сараас 12-р сар хүртэл бүх сар гарна", () => {
  const out = monthlyTimeline(raw2026, [2026]);
  assert.equal(out.length, 12, "12 сар байх ёстой");
  assert.equal(out[0].date, "2026.01");
  assert.equal(out[11].date, "2026.12");
});

test("шошго нь ОНОО агуулна — олон жилд сарууд андуурагдахгүй", () => {
  const out = monthlyTimeline(raw2026, [2026]);
  for (const p of out) assert.match(p.date, /^\d{4}\.\d{2}$/);
});

test("нэг сарын өдрүүд нийлбэр болно", () => {
  const out = monthlyTimeline(raw2026, [2026]);
  const mar = out.find((p) => p.date === "2026.03");
  assert.equal(mar.count, 5, "3-р сарын 2 + 3 = 5 байх ёстой");
});

test("өгөгдөлгүй сар 0 болж үлдэнэ (график тасрахгүй)", () => {
  const out = monthlyTimeline(raw2026, [2026]);
  assert.equal(out.find((p) => p.date === "2026.01").count, 0);
  assert.equal(out.find((p) => p.date === "2026.12").count, 0);
});

test("олон он сонговол эртнийхээс сүүлийнх хүртэл тасралтгүй", () => {
  const out = monthlyTimeline(raw2026, [2024, 2026]);
  assert.equal(out[0].date, "2024.01", "хамгийн эртний оны 1-р сараас эхэлнэ");
  assert.equal(out[out.length - 1].date, "2026.12");
  assert.equal(out.length, 36, "3 жил = 36 сар");
  // Дунд нь ЦООРХОЙГҮЙ байх ёстой.
  for (let i = 1; i < out.length; i++) {
    const [py, pm] = out[i - 1].date.split(".").map(Number);
    const [cy, cm] = out[i].date.split(".").map(Number);
    const step = (cy - py) * 12 + (cm - pm);
    assert.equal(step, 1, `${out[i - 1].date} → ${out[i].date} алгасалттай`);
  }
});

test("СОНГОСОН ОН тэнхлэгийг тодорхойлно — гадуурх сар гарахгүй", () => {
  // Оны шүүлт нь төлөвийн оноор, график нь эхлэх огноогоор явдаг тул
  // 2026 сонгоход эхлэх огноо нь 2023 байсан бичлэг багтаж болно. Хүрээг
  // сунгавал тэнхлэг 2023-аас эхэлж, "сонгосон оноо тоосонгүй" мэт харагдана.
  const out = monthlyTimeline([{ date: "2023.11.05", count: 7 }, ...raw2026], [2026]);
  assert.equal(out[0].date, "2026.01", "сонгосон оны 1-р сараас эхлэх ёстой");
  assert.equal(out[out.length - 1].date, "2026.12");
  assert.ok(!out.some((p) => p.date.startsWith("2023")), "гадуурх сар тэнхлэгт гарах ёсгүй");
});

test("он сонгоогүй бол өгөгдлийн хүрээгээр", () => {
  const out = monthlyTimeline(raw2026, []);
  assert.equal(out[0].date, "2026.03");
  assert.equal(out[out.length - 1].date, "2026.09");
});

test("өгөгдөлгүй бөгөөд он сонгоогүй бол ЭНЭ ОНЫ хуваарь гарна", () => {
  // Хоосон буцаавал график алга болж, хэрэглэгч "юу ч гарахгүй" гэж үзнэ.
  const out = monthlyTimeline([], []);
  assert.equal(out.length, 12);
  assert.equal(out[0].date, `${new Date().getFullYear()}.01`);
});

test("гажсан огноог алгасна (график эвдрэхгүй)", () => {
  const out = monthlyTimeline(
    [{ date: "", count: 1 }, { date: "буруу", count: 2 }, { date: "2026.05.01", count: 4 }],
    [2026],
  );
  assert.equal(out.find((p) => p.date === "2026.05").count, 4);
  assert.equal(out.reduce((a, p) => a + p.count, 0), 4, "гажсан мөр тоонд нэмэгдэх ёсгүй");
});

// ── Төлөвийн ӨНГӨ бүртгэлээс ──────────────────────────────────────────────
// Засварлаж буй алдаа: дашбоардын диаграм, газрын зургийн дэлгэрэнгүй цонх
// код дотор хатуу бичсэн хүснэгтээс өнгөө авдаг тул бүртгэлд өнгө солиход
// хуучин өнгөөрөө үлддэг байв.

test("бүртгэлийн өнгө хатуу хүснэгтээс ДАВУУ", () => {
  // 5 = Чөлөөлсөн, хатуу хүснэгтэд #22c55e. Бүртгэл өөр өнгө өгвөл тэр нь дийлнэ.
  assert.equal(getParcelStatusStyle(5, "Чөлөөлсөн", "#a855f7").color, "#a855f7");
});

test("бүртгэлд байхгүй ШИНЭ төлөв ч өнгөтэйгөө гарна", () => {
  // Хатуу хүснэгтэд 7 гэсэн төлөв ОГТ байхгүй — зөвхөн бүртгэл л өнгө өгнө.
  assert.equal(getParcelStatusStyle(7, "Шинэ төлөв", "#f22ef5").color, "#f22ef5");
});

test("өнгө өгөөгүй үед хуучин зан төлөв хэвээр", () => {
  assert.equal(getParcelStatusStyle(5, "Чөлөөлсөн").color, "#22c55e");
});

test("гажсан өнгийг үл хэрэгсэнэ", () => {
  for (const bad of ["ногоон", "#12345", "rgb(1,2,3)", ""]) {
    assert.equal(getParcelStatusStyle(5, "Чөлөөлсөн", bad).color, "#22c55e", `"${bad}"`);
  }
});

test("он сонгоогүй + өгөгдөлгүй үед ч оны хуваарь гарна", () => {
  // Өмнө нь хоосон массив буцааж, график бүхэлдээ алга болж "мэдээлэл
  // байхгүй" гэсэн ганц мөр үлддэг байв.
  const out = monthlyTimeline([], [], 2026);
  assert.equal(out.length, 12, "12 сарын хуваарь гарах ёстой");
  assert.equal(out[0].date, "2026.01");
  assert.equal(out[11].date, "2026.12");
  assert.equal(out.reduce((a, p) => a + p.count, 0), 0, "бүх сар 0 байна");
});

test("он сонгоогүй ч ӨГӨГДӨЛ байвал түүний хүрээгээр (нөөц он хэрэглэхгүй)", () => {
  const out = monthlyTimeline([{ date: "2024.06.01", count: 3 }], [], 2026);
  assert.equal(out[0].date, "2024.06");
  assert.equal(out[out.length - 1].date, "2024.06");
});
