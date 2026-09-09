import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_Z_INDEX,
  DRONE_Z_INDEX,
  MAP_LAYER_STYLES,
  GUS_REFERENCE_LAYERS,
  isGusReferenceLayer,
  shouldFitOnEnable,
  LAYER_TYPE_LEGEND,
  legendFor,
} from "../src/components/map/layer-config.ts";

// Дроны ортофото нь СУУРЬ зургийн дээр, давхаргын хэсэгт байгаа БҮХ давхаргын
// ДООР байх ёстой. Шинэ давхарга нэмэхэд эрэмбэ эвдэрвэл энэ тест барина.
test("дрон нь суурь зургийн дээр, бусад бүх давхаргын доор", () => {
  const zs = Object.values(MAP_LAYER_STYLES).map((s) => s.zIndex);
  assert.ok(zs.length > 0, "давхаргын тодорхойлолт хоосон");

  assert.ok(
    BASE_Z_INDEX < DRONE_Z_INDEX,
    `суурь (${BASE_Z_INDEX}) нь дроноос (${DRONE_Z_INDEX}) доор байх ёстой`,
  );

  const lowest = Math.min(...zs);
  assert.ok(
    DRONE_Z_INDEX < lowest,
    `дрон (${DRONE_Z_INDEX}) нь хамгийн доод давхаргаас (${lowest}) доор байх ёстой`,
  );
});

test("давхарга бүр zIndex-тэй бөгөөс эерэг", () => {
  for (const [id, style] of Object.entries(MAP_LAYER_STYLES)) {
    assert.equal(typeof style.zIndex, "number", `${id}: zIndex тоо биш`);
    assert.ok(style.zIndex > 0, `${id}: zIndex эерэг байх ёстой (${style.zIndex})`);
  }
});

// Чөлөөлөлтийн хил нь ТӨЛӨВЛӨГӨӨНИЙ хилээс хуулагддаг болсон тул хоёр нь яг
// давхцана. Давхаргын хэсэгт ЗӨВХӨН төлөвлөгөөний хил харагдана — чөлөөлөх
// бүсийн хилийг эргүүлж нэмвэл энэ тест барина.
test("давхаргын жагсаалтад зөвхөн төлөвлөгөөний хил байна", () => {
  assert.ok(
    "v_acquisition_plan" in MAP_LAYER_STYLES,
    "төлөвлөгөөний хил давхарга байх ёстой",
  );
  assert.ok(
    !("v_acquisition_boundary" in MAP_LAYER_STYLES),
    "чөлөөлөх бүсийн хил давхаргын жагсаалтаас хасагдсан байх ёстой",
  );
  assert.equal(MAP_LAYER_STYLES.v_acquisition_plan.label, "Төлөвлөгөөний хил");
});

// ── Асаахад зумлахгүй давхаргууд ─────────────────────────────────────────────
// УЛС ДАЯАРЫН давхаргыг асаахад fitLayerToMap нь WFS-ээр олон МБ геометр
// татдаг (хэмжсэн: au2 = 23 МБ). Browser-ийн холболтууд дүүрч, зэрэг явж буй
// API дуудлагууд 30 секундын timeout-д унаж "Серверт холбогдоход алдаа гарлаа"
// гэсэн анхааруулга гардаг байв. Эдгээр дээр fitOnEnable нь ЗААВАЛ false.
test("улс даяарын давхаргууд асаахад зумлахгүй", () => {
  for (const id of ["au1", "au2", "au3", "ca_agreed_parcel", "ca_sec_parcel"]) {
    assert.equal(
      MAP_LAYER_STYLES[id].fitOnEnable,
      false,
      `${id}: fitOnEnable === false байх ёстой (WFS-ийн хэмжээ)`,
    );
    assert.equal(shouldFitOnEnable(id), false, `${id}: shouldFitOnEnable false байх ёстой`);
  }
});

test("бусад давхарга асаахад зумлана (өмнөх зан төлөв)", () => {
  for (const id of ["v_acquisition_plan", "v_parcel_s5", "parcel"]) {
    assert.equal(shouldFitOnEnable(id), true, `${id}: зумлах ёстой`);
  }
});

// ГУС-ийн давхаргууд нь appdb-д БАЙХГҮЙ (data_landuse схемээс шууд уншигдана)
// тул proxy дээр гадаад ролид хаагддаг — жагсаалт нь layer-config-т үлдэнэ.
test("ГУС-ийн лавлах давхаргууд бүртгэгдсэн", () => {
  for (const id of GUS_REFERENCE_LAYERS) {
    assert.ok(id in MAP_LAYER_STYLES, `${id}: MAP_LAYER_STYLES-д байхгүй`);
    assert.ok(isGusReferenceLayer(id), `${id}: isGusReferenceLayer false буцаав`);
  }
});

// ── Доторх төрлийн өнгөний тайлбар ───────────────────────────────────────────
// ГУС-ийн 2 давхарга нь НЭГ өнгөөр бус, дотоод төрлөөрөө (work_type / explan)
// өнгө ялган зурагддаг. Тайлбарын өнгө нь GeoServer-ийн SLD-тэй ТААРАХ ёстой
// (styles/ca_agreed_parcel.sld, styles/ca_sec_parcel.sld) — эс бөгөөс самбар
// дээрх өнгө зурган дээрхтэй зөрж, хэрэглэгчийг төөрөгдүүлнэ.
test("ГУС-ийн давхаргууд төрлийн өнгөний тайлбартай", () => {
  for (const id of GUS_REFERENCE_LAYERS) {
    const legend = legendFor(id);
    assert.ok(Array.isArray(legend) && legend.length > 0, `${id}: тайлбар байхгүй`);
    const labels = new Set();
    for (const item of legend) {
      assert.ok(item.label, `${id}: төрлийн нэр хоосон`);
      assert.match(item.color, /^#[0-9a-f]{6}$/i, `${id}/${item.label}: өнгө буруу`);
      assert.ok(!labels.has(item.label), `${id}: "${item.label}" давхардсан`);
      labels.add(item.label);
    }
    // "Бусад" нь ЗААВАЛ байх — SLD дээрх ElseFilter-ийн эсрэг тал.
    assert.ok(labels.has("Бусад"), `${id}: "Бусад" төрөл тайлбарт байхгүй`);
  }
});

test("төрлийн тайлбар нь зөвхөн ГУС-ийн давхаргад байна", () => {
  const withLegend = Object.keys(LAYER_TYPE_LEGEND);
  assert.deepEqual(
    withLegend.sort(),
    [...GUS_REFERENCE_LAYERS].sort(),
    "тайлбартай давхаргын жагсаалт ГУС-ийн давхаргуудтай таарахгүй",
  );
});
