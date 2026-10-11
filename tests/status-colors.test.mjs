import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_FALLBACK_COLOR,
  contrastRatio,
  deriveStatusColors,
  hexToOklch,
  normalizeStatusColor,
  oklchToHex,
  statusLabelVars,
} from "../src/lib/status-colors.ts";

// Админ ямар ч өнгө сонгож болно — хар, цагаан, саарал, неон, бараан хөх г.м.
const SAMPLES = ["#000000", "#FFFFFF", "#808080", "#FFEB3B", "#00FFFF", "#FF00FF", "#0D1B2A", "#17B26A", "#F79009", "#E11D48"];

test("текст/дэвсгэрийн контраст light ба dark дээр ≥ 4.5 (WCAG AA)", () => {
  for (const hex of SAMPLES) {
    for (const theme of ["light", "dark"]) {
      const c = deriveStatusColors(hex, theme);
      const ratio = contrastRatio(c.text, c.bg);
      assert.ok(ratio >= 4.5, `${hex} ${theme}: ${c.text} / ${c.bg} = ${ratio.toFixed(2)}`);
    }
  }
});

test("цэг нь бүртгэлийн өнгө өөрчлөлтгүй (том үсгээр)", () => {
  assert.equal(deriveStatusColors("#17b26a", "light").dot, "#17B26A");
  assert.equal(deriveStatusColors("#17b26a", "dark").dot, "#17B26A");
});

test("ахроматик өнгө саарал шошго болно, алдаа гаргахгүй", () => {
  for (const hex of ["#000000", "#FFFFFF", "#808080"]) {
    for (const theme of ["light", "dark"]) {
      const c = deriveStatusColors(hex, theme);
      for (const part of [c.bg, c.border, c.text, c.ring]) {
        const [, chroma] = hexToOklch(part);
        assert.ok(chroma < 0.01, `${hex} ${theme}: ${part} саарал биш (C=${chroma})`);
      }
    }
  }
});

test("цагаан цэг light-д, хар цэг dark-д цагирагаараа ялгарна", () => {
  const white = deriveStatusColors("#FFFFFF", "light");
  assert.ok(contrastRatio(white.ring, white.bg) >= 2, `цагаан: ${white.ring} / ${white.bg}`);
  const black = deriveStatusColors("#000000", "dark");
  assert.ok(contrastRatio(black.ring, black.bg) >= 2, `хар: ${black.ring} / ${black.bg}`);
});

// Томьёо hue-г хадгална; гэхдээ sRGB-ээс гадуурх текстийг (ж: улбар шар,
// L=0.46 C=0.17) хөтөчийн адил суваг бүрээр тайрахад hue ~20° хүртэл шилждэг.
test("hue ойролцоо хадгалагдана (өнгөт төлөв)", () => {
  for (const hex of ["#17B26A", "#E11D48", "#F79009"]) {
    const [, , h] = hexToOklch(hex);
    for (const theme of ["light", "dark"]) {
      const [, , th] = hexToOklch(deriveStatusColors(hex, theme).text);
      const diff = Math.abs(((th - h + 540) % 360) - 180);
      assert.ok(diff < 25, `${hex} ${theme}: hue ${h.toFixed(1)} → ${th.toFixed(1)}`);
    }
  }
});

test("буруу / хоосон өнгө саарал болно (CSS руу шууд очихгүй)", () => {
  for (const bad of [undefined, null, "", "red", "#FFF", "#12345G", "#000000;background:url(x)"]) {
    assert.equal(normalizeStatusColor(bad), STATUS_FALLBACK_COLOR);
  }
  assert.equal(statusLabelVars("red;}")["--c"], STATUS_FALLBACK_COLOR);
});

test("OKLCH хөрвүүлэлт эргэж буцна", () => {
  for (const hex of SAMPLES) {
    assert.equal(oklchToHex(...hexToOklch(hex)), hex);
  }
});

test("statusLabelVars — хоёр theme-ийн fallback утга", () => {
  const vars = statusLabelVars("#17B26A");
  assert.equal(vars["--c"], "#17B26A");
  const light = deriveStatusColors("#17B26A", "light");
  const dark = deriveStatusColors("#17B26A", "dark");
  assert.equal(vars["--st-bg-light"], light.bg);
  assert.equal(vars["--st-tx-dark"], dark.text);
  assert.equal(vars["--st-ring-dark"], dark.ring);
});
