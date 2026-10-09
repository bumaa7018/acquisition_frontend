import test from "node:test";
import assert from "node:assert/strict";
import {
  fitIso,
  paidPercentAt,
  progressHeights,
  statsAt,
  statusAt,
  monthRange,
  monthsBetween,
  outerRings,
  pointInPolygon,
  project,
  rampColor,
  ringCentroid,
  tileTransform,
  unproject,
} from "../src/lib/chronos.ts";

const iso = { s: 0.5, cx: 400, cy: 300, ox: 11_900_000, oy: 6_090_000 };

test("изометр проекц ба урвуу хувиргалт тэнцүү", () => {
  for (const [wx, wy] of [[11_900_000, 6_090_000], [11_900_120, 6_089_950], [11_899_800, 6_090_333]]) {
    const [sx, sy] = project(iso, wx, wy);
    const [bx, by] = unproject(iso, sx, sy);
    assert.ok(Math.abs(bx - wx) < 1e-6 && Math.abs(by - wy) < 1e-6);
  }
  // Төв нь дэлгэцийн төвд; зүүн (баруун) нь баруун-доош, хойд нь баруун-дээш.
  assert.deepEqual(project(iso, iso.ox, iso.oy), [400, 300]);
  const [ex, ey] = project(iso, iso.ox + 100, iso.oy);
  assert.ok(ex > 400 && ey > 300);
  const [nx, ny] = project(iso, iso.ox, iso.oy + 100);
  assert.ok(nx > 400 && ny < 300);
  // z нь дээш өргөнө.
  assert.equal(project(iso, iso.ox, iso.oy, 30)[1], 270);
});

test("tile-ийн аффин хувиргалт проекцтой нийцнэ", () => {
  const res = 0.6;
  const tminx = 11_899_900;
  const tmaxy = 6_090_100;
  const [a, b, c, d, e, f] = tileTransform(iso, tminx, tmaxy, res);
  for (const [u, v] of [[0, 0], [256, 0], [0, 256], [128, 77]]) {
    const sx = a * u + c * v + e;
    const sy = b * u + d * v + f;
    const [px, py] = project(iso, tminx + u * res, tmaxy - v * res);
    assert.ok(Math.abs(sx - px) < 1e-6 && Math.abs(sy - py) < 1e-6);
  }
});

test("хүрээ дэлгэцэд багтана", () => {
  const bbox = [11_899_000, 6_089_000, 11_901_000, 6_091_000];
  const fit = fitIso(bbox, 1440, 900, 80);
  const corners = [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[3]]];
  for (const [x, y] of corners) {
    const [sx, sy] = project(fit, x, y);
    assert.ok(sx >= 79 && sx <= 1361 && sy >= 79 && sy <= 821, `${sx},${sy}`);
  }
});

test("сарын хүрээ — эхний өөрчлөлтөөс НЭГ сарын өмнөөс одоо хүртэл, өгөгдөлгүй бол 12 сар", () => {
  const now = new Date(2026, 9, 8);
  const r = monthRange([{ month: "2025-11", count: 2 }, { month: "2026-02", count: 1 }], now);
  assert.equal(r[0], "2025-10", "эхний кадрт бүх нэгж талбар чөлөөлөгдөөгүй");
  assert.equal(r.at(-1), "2026-10");
  assert.equal(r.length, 13);
  const empty = monthRange([], now);
  assert.equal(empty.length, 12);
  assert.equal(empty.at(-1), "2026-10");
  assert.equal(monthsBetween("2025-11", "2026-02"), 3);
});

const STATUSES = [
  { id: 0, name: "Хүлээгдэж буй", color: "#64748b", sort_order: 0, is_released: false },
  { id: 2, name: "Үнэлгээ хийх", color: "#f97316", sort_order: 2, is_released: false },
  { id: 1, name: "Зөвшилцөх", color: "#facc15", sort_order: 1, is_released: false },
  { id: 5, name: "Чөлөөлсөн", color: "#22c55e", sort_order: 5, is_released: true },
];

test("явц ахих тусам намхан (хашаа): эхний шат 16px, сүүлийн шат 4px, чөлөөлсөн эрэмбэд орохгүй", () => {
  const h = progressHeights(STATUSES);
  assert.equal(h.get(0), 16);
  assert.equal(h.get(1), 10);
  assert.equal(h.get(2), 4);
  assert.equal(h.has(5), false);
});

test("тухайн сарын төлөв ба статистик", () => {
  const events = [
    { date: "2021-03-10T00:00:00Z", status_id: 0 },
    { date: "2021-07-15T00:00:00Z", status_id: 2 },
    { date: "2022-01-05T00:00:00Z", status_id: 5 },
  ];
  assert.equal(statusAt(events, "2021-02"), null, "түүхээс өмнө — мэдэгдэхгүй");
  assert.equal(statusAt(events, "2021-03"), 0);
  assert.equal(statusAt(events, "2021-12"), 2);
  assert.equal(statusAt(events, "2022-01"), 5);
  const parcels = [
    { id: "a", area_m2: 100, events },
    { id: "b", area_m2: 50, events: [{ date: "2021-07-01T00:00:00Z", status_id: 1 }] },
    { id: "c", area_m2: 10, events: [] },
  ];
  const s = statsAt(parcels, STATUSES, "2021-07");
  assert.equal(s.total, 3);
  assert.equal(s.unknown, 1);
  assert.deepEqual(s.byStatus.map((r) => [r.status.id, r.count]), [[1, 1], [2, 1]]);
  assert.equal(s.changedThisMonth, 2);
  assert.equal(s.released, 0);
  const later = statsAt(parcels, STATUSES, "2022-02");
  assert.equal(later.released, 1);
  assert.equal(later.releasedAreaM2, 100);
});

test("нөхөх олговор, захирамж, олголт — сонгосон сарын байдлаар", () => {
  const base = { area_m2: 0, events: [] };
  const parcels = [
    { ...base, id: "a", comp_amount: 1000, comp_at: "2021-05-01", comp_approved_at: "2021-06-15T00:00:00+08:00",
      decision_id: "d1", decision_linked_at: "2021-12-01", decision_confirmed_at: "2022-02-01",
      payments: [{ date: "2022-03-01", stage: 60 }, { date: "2022-05-01", stage: 40 }] },
    { ...base, id: "b", comp_amount: 300, comp_at: "2021-08-01", comp_approved_at: null,
      decision_id: null, decision_linked_at: null, decision_confirmed_at: null, payments: [] },
  ];
  const may = statsAt(parcels, STATUSES, "2021-05");
  assert.equal(may.compTotal, 1000);
  assert.equal(may.compUnapproved, 1000);
  const july = statsAt(parcels, STATUSES, "2021-07");
  assert.equal(july.compApproved, 1000);
  const sep = statsAt(parcels, STATUSES, "2021-09");
  assert.deepEqual([sep.compTotal, sep.compApproved, sep.compUnapproved, sep.compIssued], [1300, 1000, 300, 0]);
  const dec = statsAt(parcels, STATUSES, "2021-12");
  assert.deepEqual([dec.decisionParcels, dec.decisions, dec.decisionsConfirmed], [1, 1, 0]);
  const feb = statsAt(parcels, STATUSES, "2022-02");
  assert.deepEqual([feb.compIssued, feb.compApproved, feb.decisionsConfirmed], [1000, 0, 1]);
  assert.equal(statsAt(parcels, STATUSES, "2022-03").compGranted, 600);
  assert.equal(statsAt(parcels, STATUSES, "2022-06").compGranted, 1000);
  assert.equal(paidPercentAt([{ date: "2022-01-01", stage: 100 }, { date: "2022-02-01", stage: 60 }], "2022-12"), 100);
  assert.equal(paidPercentAt([{ date: "2022-01-01", stage: 60 }], "2021-12"), 0);
});

test("өнгөний шатлал", () => {
  assert.equal(rampColor(0), "#2e5a88");
  assert.equal(rampColor(0.5), "#3e9c8f");
  assert.equal(rampColor(1), "#f2a541");
});

test("геометр, цэг агуулах, төв", () => {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  assert.equal(outerRings({ type: "Polygon", coordinates: [ring, [[2, 2], [3, 2], [3, 3], [2, 2]]] }).length, 1);
  assert.equal(outerRings({ type: "MultiPolygon", coordinates: [[ring], [ring]] }).length, 2);
  assert.equal(outerRings({ type: "Point", coordinates: [1, 2] }).length, 0);
  assert.ok(pointInPolygon(5, 5, ring));
  assert.ok(!pointInPolygon(15, 5, ring));
  const [cx, cy] = ringCentroid(ring);
  assert.ok(Math.abs(cx - 5) < 1e-9 && Math.abs(cy - 5) < 1e-9);
});

test("Он цагийн зурагын хураангуй — бүтэн дэлгэцийн самбартай ижил бүтэц, сонгосон сарын байдлаар", async () => {
  const { overviewAt, NOT_STARTED_STATUS_ID } = await import("../src/lib/chronos-overview.ts");
  const statuses = [
    { id: 0, code: "pending", name: "Хүлээгдэж буй", color: "#64748b", sort_order: 0, is_released: false, is_final: false },
    { id: 5, code: "released", name: "Чөлөөлсөн", color: "#22c55e", sort_order: 5, is_released: true, is_final: true },
  ];
  const parcel = (id, events, extra = {}) => ({
    id, acquisition_id: "A", acquisition_name: "Чөлөөлөлт", area_m2: 100, events,
    comp_amount: 0, comp_at: null, comp_approved_at: null, comp_land: 0, comp_real_state: 0, comp_property: 0,
    decision_id: null, decision_linked_at: null, decision_confirmed_at: null, payments: [], ...extra,
  });
  const chronos = {
    statuses,
    parcels: [
      parcel("a", [{ date: "2024-01-01", status_id: 0 }, { date: "2024-03-10", status_id: 5 }],
        { comp_amount: 300, comp_at: "2024-02-01", comp_land: 200, comp_real_state: 100 }),
      parcel("b", [{ date: "2024-05-01", status_id: 0 }]),
    ],
    decisions: [{ id: "d1", created_at: "2024-02-01", confirmed_at: "2024-06-01", events: [{ type: "reviewing", date: "2024-04-01" }] }],
    months: [], truncated: false,
  };
  const base = { acquisitions: [{ id: "A", acquisition_name: "Чөлөөлөлт", parcel_count: 2, status: 2 }], plan_area_m2: 5000, locations: [{ district: "Сүхбаатар", khoroos: ["9-р хороо"] }] };

  const feb = overviewAt(base, null, chronos, "2024-02");
  assert.equal(feb.data.total_parcels, 2);
  assert.equal(feb.data.freed_parcels, 0);
  assert.deepEqual(feb.data.status_breakdown.map((r) => [r.status_id, r.count]), [[NOT_STARTED_STATUS_ID, 1], [0, 1]]);
  assert.equal(feb.data.decisions.total, 1);
  assert.equal(feb.data.decisions.draft, 1);
  assert.equal(feb.data.compensation.total, 300);
  assert.equal(feb.finance.land_amount, 200);
  assert.equal(feb.data.acquisitions[0].progress_percent, 0);
  assert.deepEqual(feb.data.locations, base.locations, "хугацаанаас үл хамаарах мэдээлэл хэвээр");

  const apr = overviewAt(base, null, chronos, "2024-04");
  assert.equal(apr.data.freed_parcels, 1);
  assert.equal(apr.data.freed_area_m2, 100);
  assert.equal(apr.data.decisions.reviewing, 1);
  assert.equal(apr.data.acquisitions[0].progress_percent, 50);
  assert.deepEqual(apr.data.timeline, [{ date: "2024.03.10", count: 1 }]);

  const jun = overviewAt(base, null, chronos, "2024-06");
  assert.equal(jun.data.decisions.confirmed, 1);
  assert.equal(jun.data.total_orders, 1);
  assert.equal(jun.data.status_breakdown.find((r) => r.status_id === NOT_STARTED_STATUS_ID), undefined);
});

test("Multi Brand Network / Masik WWW — Google apistyle кодчилол", async () => {
  const { googleApiStyle, MULTI_BRAND_NETWORK, MASIK_WWW } = await import("../src/lib/map-styles.ts");
  const decoded = decodeURIComponent(googleApiStyle(MULTI_BRAND_NETWORK)).split(",");
  assert.equal(decoded.length, 24);
  assert.equal(decoded[1], "s.e:l.t.f|p.s:36|p.c:#ff000000|p.l:40", "all → s.t-гүй");
  assert.ok(decoded.includes("s.t:5|s.e:g|p.c:#ff000000|p.l:20"), "landscape");
  assert.ok(decoded.includes("s.t:49|s.e:g.f|p.c:#ffe5c163|p.l:0"), "road.highway fill — алтлаг");
  assert.ok(decoded.includes("s.t:33|s.e:g|p.v:on"), "poi.business");
  assert.ok(decoded.includes("s.t:6|s.e:g|p.c:#ff000000|p.l:17"), "water");
  const light = decodeURIComponent(googleApiStyle(MASIK_WWW)).split(",");
  assert.ok(light.includes("s.t:18|s.e:a|p.v:off"), "administrative.province");
  assert.ok(light.includes("s.t:3|s.e:g|p.l:2|p.g:1.21"), "road gamma");
});
