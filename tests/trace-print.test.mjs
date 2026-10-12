import test from "node:test";
import assert from "node:assert/strict";
import { fitTraceMainView, polygonsExtent, resolutionForScale, wktToPolygons } from "../src/components/map/trace-print.ts";
import { computeScaleDenominator } from "../src/components/map/print-map.ts";

// traceLayout нь текст хэмжихэд canvas хэрэглэдэг тул энд гараар өгнө
// (A4 босоо: зургийн талбай 746×1003, жижиг зураг зүүн дээд буланд).
function layout(bandH = 92) {
  return {
    page: { width: 794, height: 1123 },
    mapArea: { x: 24, y: 96, w: 746, h: 1003 },
    bandH,
    inset: { x: 13, y: 13, w: 313, h: 235 },
    cards: {},
  };
}

/** extent нь canvas дээр ямар тэгш өнцөгтөд буухыг (y доош) */
function projected(view, res, ext) {
  return {
    x0: (ext[0] - view[0]) / res,
    x1: (ext[2] - view[0]) / res,
    y0: (view[3] - ext[3]) / res,
    y1: (view[3] - ext[1]) / res,
  };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

for (const [name, ext] of [
  ["өндөр нарийн (гол дагуу)", [0, 0, 1000, 4000]],
  ["өргөн нам", [0, 0, 5000, 800]],
  ["дөрвөлжин", [0, 0, 2000, 2000]],
]) {
  for (const corner of ["top-left", "top-right"]) {
    test(`гол зураг жижиг зураг/доод зурвастай давхцахгүй — ${name}, ${corner}`, () => {
      const L = layout();
      const canvasW = 2238;
      const canvasH = Math.round((canvasW * L.mapArea.h) / L.mapArea.w);
      const k = canvasW / L.mapArea.w;
      const insetX = corner === "top-left" ? L.inset.x : L.mapArea.w - L.inset.x - L.inset.w;
      const { view, resolution } = fitTraceMainView({ extent: ext, canvasW, canvasH, layout: { ...L, inset: { ...L.inset, x: insetX } }, corner });

      const p = projected(view, resolution, ext);
      const inset = { x0: insetX * k, x1: (insetX + L.inset.w) * k, y0: L.inset.y * k, y1: (L.inset.y + L.inset.h) * k };
      const band = { x0: 0, x1: canvasW, y0: canvasH - L.bandH * k, y1: canvasH };

      assert.ok(p.x0 >= -0.5 && p.x1 <= canvasW + 0.5, "хэвтээ чиглэлд багтана");
      assert.ok(p.y0 >= -0.5, "дээд захаас гарахгүй");
      assert.ok(!overlaps(p, inset), "жижиг зурагтай давхцахгүй");
      assert.ok(!overlaps(p, band), "доод зурвастай давхцахгүй");
      // харагдацын харьцаа canvas-тай ижил (тайралтгүй)
      assert.ok(Math.abs((view[2] - view[0]) / (view[3] - view[1]) - canvasW / canvasH) < 1e-9);
    });
  }
}

test("урт нарийн хилд хажуу хэсгийг, өргөн хилд доод хэсгийг сонгоно", () => {
  const L = layout();
  const canvasW = 2238;
  const canvasH = Math.round((canvasW * L.mapArea.h) / L.mapArea.w);
  const k = canvasW / L.mapArea.w;
  const tall = fitTraceMainView({ extent: [0, 0, 500, 5000], canvasW, canvasH, layout: L, corner: "top-left" });
  const pt = projected(tall.view, tall.resolution, [0, 0, 500, 5000]);
  assert.ok(pt.x0 >= (L.inset.x + L.inset.w) * k, "өндөр хил жижиг зургийн БАРУУН талд");

  const wide = fitTraceMainView({ extent: [0, 0, 5000, 500], canvasW, canvasH, layout: L, corner: "top-left" });
  const pw = projected(wide.view, wide.resolution, [0, 0, 5000, 500]);
  assert.ok(pw.y0 >= (L.inset.y + L.inset.h) * k, "өргөн хил жижиг зургийн ДООР");
});

test("wktToPolygons — Polygon, MultiPolygon, буруу оролт", () => {
  assert.equal(wktToPolygons("POLYGON((106.9 47.9,106.91 47.9,106.91 47.91,106.9 47.9))").length, 1);
  assert.equal(
    wktToPolygons("MULTIPOLYGON(((106.9 47.9,106.91 47.9,106.91 47.91,106.9 47.9)),((107 48,107.01 48,107.01 48.01,107 48)))").length,
    2,
  );
  assert.deepEqual(wktToPolygons(""), []);
  assert.deepEqual(wktToPolygons("NOT WKT"), []);
  assert.equal(polygonsExtent([]), null);
  const ext = polygonsExtent(wktToPolygons("POLYGON((106.9 47.9,106.91 47.9,106.91 47.91,106.9 47.9))"));
  assert.ok(ext && ext[0] < ext[2] && ext[1] < ext[3], "EPSG:3857 хүрээ");
});

test("resolutionForScale нь computeScaleDenominator-ийн урвуу (хэвлэгдэх масштаб = сонгосон)", () => {
  for (const den of [500, 1000, 2500, 5000, 10000, 50000]) {
    for (const lat of [43, 47.9, 50]) {
      const pagePxPerCanvasPx = 1 / 3;
      const resolution = resolutionForScale(den, pagePxPerCanvasPx, lat);
      assert.equal(computeScaleDenominator({ resolution, centerLat: lat }, pagePxPerCanvasPx), den);
    }
  }
});

test("сонгосон масштабтай гол зураг: нягтаршил хэвээр, нэгж талбар үргэлж харагдана", () => {
  const L = layout();
  const canvasW = 2238;
  const canvasH = Math.round((canvasW * L.mapArea.h) / L.mapArea.w);
  const k = canvasW / L.mapArea.w;
  const ext = [0, 0, 1000, 4000];
  const fixed = 0.5; // хил багтахгүй томруулсан масштаб

  // Нэгж талбар хилийн төв орчимд — төв нь чөлөөлөлтийн төв хэвээр
  const near = fitTraceMainView({ extent: ext, canvasW, canvasH, layout: L, corner: "top-left", resolution: fixed, keep: [520, 2050] });
  assert.equal(near.resolution, fixed);
  assert.ok(Math.abs((near.view[0] + near.view[2]) / 2 - 500) < (canvasW * fixed) / 2, "төв хил орчим");

  // Нэгж талбар хилийн захад — түүн рүү төвлөрч, зураг дээр харагдана
  const keep = [990, 3990];
  const far = fitTraceMainView({ extent: ext, canvasW, canvasH, layout: L, corner: "top-left", resolution: fixed, keep });
  assert.equal(far.resolution, fixed);
  const px = (keep[0] - far.view[0]) / fixed;
  const py = (far.view[3] - keep[1]) / fixed;
  const insetRight = (L.inset.x + L.inset.w) * k;
  const insetBottom = (L.inset.y + L.inset.h) * k;
  assert.ok(px > 0 && px < canvasW && py > 0 && py < canvasH - L.bandH * k, "зургийн талбайд");
  assert.ok(!(px < insetRight && py < insetBottom), "жижиг зургийн доор нуугдахгүй");
});
