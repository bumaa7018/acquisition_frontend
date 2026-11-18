import test from "node:test";
import assert from "node:assert/strict";
import {
  collectLayers,
  hasForbiddenParam,
  stripForbiddenParams,
  isSafeCqlFragment,
  hasDuplicateControlParam,
  isAllowedViewParams,
} from "../src/lib/server/geoserver-guard.ts";

const qs = (s) => new URLSearchParams(s);

test("бүх давхаргын параметрийг цуглуулна — эхнийх нь л биш", () => {
  // Өмнө нь зөвхөн `layers` уншигдаж, WFS-ийн typeNames (parcel) шалгагдахгүй байв.
  assert.deepEqual(collectLayers(qs("layers=au1&typeNames=land:parcel")), ["au1", "parcel"]);
  assert.deepEqual(collectLayers(qs("LAYERS=land:a,land:b&QUERY_LAYERS=land:a")), ["a", "b", "a"]);
  assert.deepEqual(collectLayers(qs("typeName=land:x&TypeNames=y")), ["x", "y"]);
  assert.deepEqual(collectLayers(qs("request=GetMap")), []);
});

test("давхаргын нэргүй хүрэх / SLD параметрүүд хориотой", () => {
  for (const p of ["featureID=parcel.1", "FEATUREID=x", "resourceId=x", "STOREDQUERY_ID=x",
    "filter=<x/>", "SLD=http://x", "sld_body=<x/>"]) {
    assert.equal(hasForbiddenParam(qs("request=GetFeature&" + p)), true, p);
  }
  assert.equal(hasForbiddenParam(qs("request=GetMap&layers=a&cql_filter=status=1")), false);
  const s = qs("featureID=parcel.1&typeNames=x&SLD_BODY=y");
  stripForbiddenParams(s);
  assert.equal(s.toString(), "typeNames=x");
});

test("CQL: хаалт тэнцвэргүй эсвэл `;`-тэй шүүлт аюултай", () => {
  assert.equal(isSafeCqlFragment("1=1) OR (1=1"), false);
  assert.equal(isSafeCqlFragment("status=1) OR acquisition_id IS NOT NULL OR (1=1"), false);
  assert.equal(isSafeCqlFragment("a=1;1=1"), false);
  assert.equal(isSafeCqlFragment("(a=1"), false);
  assert.equal(isSafeCqlFragment("parcel_id='x"), false);
  assert.equal(isSafeCqlFragment("status=1"), true);
  assert.equal(isSafeCqlFragment("(status=1 OR status=2) AND au2_code='16'"), true);
  // Тэмдэгт мөр доторх хаалт / `;` / '' escape тооцогдохгүй.
  assert.equal(isSafeCqlFragment("parcel_id='a)b;c' AND name='O''Brien'"), true);
});

test("удирдах параметр давхардвал татгалзана", () => {
  assert.equal(hasDuplicateControlParam(qs("CQL_FILTER=a&cql_filter=1=1")), true);
  assert.equal(hasDuplicateControlParam(qs("request=GetMap&REQUEST=GetCapabilities")), true);
  assert.equal(hasDuplicateControlParam(qs("request=GetMap&layers=a&cql_filter=x")), false);
});

test("VIEWPARAMS — зөвхөн month:current|YYYY-MM (газрын зургийн сарын давхарга)", () => {
  assert.equal(isAllowedViewParams(qs("layers=a")), true);
  assert.equal(isAllowedViewParams(qs("VIEWPARAMS=month:2026-10")), true);
  assert.equal(isAllowedViewParams(qs("viewparams=month:current")), true);
  for (const bad of ["month:2026-13", "month:2026-1", "month:x", "month:2026-10;other:1",
    "other:1", "month:2026-10,x", "month:'1'"]) {
    assert.equal(isAllowedViewParams(qs("VIEWPARAMS=" + encodeURIComponent(bad))), false, bad);
  }
  assert.equal(hasDuplicateControlParam(qs("VIEWPARAMS=month:current&viewparams=x")), true);
});

// РЕГРЕСС: газрын зургийн нэгж талбарын төлөвийн давхаргын БОДИТ хүсэлт
// (map-view.tsx) proxy-ийн бүх шалгалтыг давах ёстой — эс бөгөөс нэгж талбар
// газрын зургаас алга болдог (VIEWPARAMS хориглогдсон үед ингэж эвдэрсэн).
test("газрын зургийн төлөвийн давхаргын хүсэлт хаагдахгүй", () => {
  const map = qs(
    "SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true" +
      "&LAYERS=land:v_parcel_status&CQL_FILTER=status%3D2&VIEWPARAMS=month:2026-10" +
      "&WIDTH=256&HEIGHT=256&CRS=EPSG:3857&STYLES=&BBOX=1,2,3,4",
  );
  assert.equal(hasForbiddenParam(map), false);
  assert.equal(hasDuplicateControlParam(map), false);
  assert.equal(isAllowedViewParams(map), true);
  assert.deepEqual(collectLayers(map), ["v_parcel_status"]);
  assert.equal(isSafeCqlFragment(map.get("CQL_FILTER")), true);
});
