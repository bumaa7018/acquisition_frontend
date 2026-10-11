import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusDot, StatusLabel } from "../src/components/ui/status-label.ts";
import { STATUS_FALLBACK_COLOR, deriveStatusColors } from "../src/lib/status-colors.ts";

const render = (props) => renderToStaticMarkup(createElement(StatusLabel, props));

test("цэг + текст; цэг aria-hidden, текст заавал", () => {
  const html = render({ color: "#17B26A", name: "Чөлөөлсөн" });
  assert.match(html, /^<span class="status-label"/);
  assert.match(html, /<span class="status-label__dot" aria-hidden="true"><\/span>/);
  assert.match(html, /<span class="status-label__text">Чөлөөлсөн<\/span>/);
});

test("бүтэн нэр title-д (урт нэр CSS-ээр таслагдана)", () => {
  const name = "СУУРИН БОЛОН ХЭЭРИЙН СУДАЛГАА — маш урт төлөвийн нэр";
  const html = render({ color: "#414244", name });
  assert.ok(html.includes(`title="${name}"`), html);
});

test("нэрийг өгөгдлийн сангийнх хэвээр харуулна (том/жижиг үсэг хөрвүүлэхгүй)", () => {
  assert.match(render({ color: "#22C55E", name: "ЧӨЛӨӨЛСӨН" }), />ЧӨЛӨӨЛСӨН</);
});

test("өнгө нь CSS хувьсагчаар — хоёр theme-ийн fallback", () => {
  const html = render({ color: "#e11d48", name: "Татгалзсан" });
  const light = deriveStatusColors("#E11D48", "light");
  const dark = deriveStatusColors("#E11D48", "dark");
  assert.ok(html.includes("--c:#E11D48"), html);
  assert.ok(html.includes(`--st-bg-light:${light.bg}`), html);
  assert.ok(html.includes(`--st-tx-dark:${dark.text}`), html);
});

test("буруу өнгө style руу орохгүй — саарал", () => {
  const html = render({ color: "red;background:url(x)", name: "X" });
  assert.ok(html.includes(`--c:${STATUS_FALLBACK_COLOR}`), html);
  assert.ok(!html.includes("url("), html);
});

test("StatusDot — зөвхөн цэг, aria-hidden", () => {
  const html = renderToStaticMarkup(createElement(StatusDot, { color: "#FFFFFF" }));
  assert.match(html, /^<span class="status-dot" style="[^"]*--c:#FFFFFF[^"]*" aria-hidden="true"><\/span>$/);
});
