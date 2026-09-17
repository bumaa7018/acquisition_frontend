import test from "node:test";
import assert from "node:assert/strict";
import { searchOnEnter } from "../src/components/ui/search-on-enter.ts";

// Шүүлтийн хэсэгт Enter дарахад хайлт хийгдэх ёстой. Энэ туслах нь бүх
// хайлтын дэлгэц дээр ИЖИЛ зан төлөв өгдөг тул онцгой тохиолдлуудыг нь
// (textarea, товч, IME, нээлттэй жагсаалт) тестээр бэхэлнэ.

/** Хуурамч React KeyboardEvent. */
function ev(key, tag = "INPUT", extra = {}) {
  let prevented = false;
  return {
    key,
    target: {
      tagName: tag,
      getAttribute: (n) => extra.attrs?.[n] ?? null,
    },
    nativeEvent: { isComposing: extra.isComposing ?? false },
    preventDefault() { prevented = true; },
    get prevented() { return prevented; },
  };
}

test("Enter дарахад хайлт хийгдэнэ", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  const e = ev("Enter");
  h.onKeyDown(e);
  assert.equal(called, 1, "хайлт дуудагдаагүй");
  assert.ok(e.prevented, "маягт GET-ээр илгээгдэхээс сэргийлэх ёстой");
});

test("бусад товчлуур хайлт эхлүүлэхгүй", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  for (const k of ["a", "Escape", "Tab", "ArrowDown", " "]) h.onKeyDown(ev(k));
  assert.equal(called, 0);
});

test("textarea дотор Enter нь МӨР ТАСЛАНА — хайхгүй", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  const e = ev("Enter", "TEXTAREA");
  h.onKeyDown(e);
  assert.equal(called, 0, "олон мөрт талбарт бичих боломжийг хаажээ");
  assert.ok(!e.prevented);
});

test("товч/холбоос дээрх Enter нь тэдний өөрийн үйлдэл — хайхгүй", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  // Жишээ: "Цэвэрлэх" товч дээр Enter дарахад хайлт биш цэвэрлэлт явна.
  h.onKeyDown(ev("Enter", "BUTTON"));
  h.onKeyDown(ev("Enter", "A"));
  assert.equal(called, 0);
});

test("IME үг баталгаажуулж буй Enter-ийг үл хэрэгснэ", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  // Кирилл хөрвүүлэгч үг сонгохдоо Enter ашигладаг — хагас бичсэн үгээр
  // хайлт явуулж болохгүй.
  h.onKeyDown(ev("Enter", "INPUT", { isComposing: true }));
  assert.equal(called, 0);
});

test("нээлттэй сонголтын жагсаалтад Enter нь сонголт баталгаажуулна", () => {
  let called = 0;
  const h = searchOnEnter(() => called++);
  h.onKeyDown(ev("Enter", "INPUT", { attrs: { "aria-expanded": "true" } }));
  assert.equal(called, 0);
  // Хаалттай бол хайлт явна.
  h.onKeyDown(ev("Enter", "INPUT", { attrs: { "aria-expanded": "false" } }));
  assert.equal(called, 1);
});
