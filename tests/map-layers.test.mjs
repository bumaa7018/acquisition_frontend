import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  BASE_Z_INDEX,
  DRONE_Z_INDEX,
  MAP_LAYER_STYLES,
  GUS_REFERENCE_LAYERS,
  isGusReferenceLayer,
  shouldFitOnEnable,
  AGREED_GROUP,
  AGREED_GROUP_ID,
  AGREED_CODE_LAYERS,
  AGREED_CODE_LAYER_IDS,
  SEC_GROUP,
  SEC_GROUP_ID,
  SEC_CODE_LAYERS,
  SEC_CODE_LAYER_IDS,
  geoServerName,
  combineCql,
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
  for (const id of [
    "au1",
    "au2",
    "au3",
    "ca_agreed_parcel",
    "ca_sec_parcel",
    // ГУС-ийн дэд давхаргууд ч ижил улс даяарын хүснэгтээс уншигддаг —
    // тэдгээр дээр ч зумлах нь ижил хортой.
    ...AGREED_CODE_LAYER_IDS,
    ...SEC_CODE_LAYER_IDS,
  ]) {
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

// ── Шинэ зөвшилцсөн зураг: `code`-оор задарсан дэд давхаргууд ────────────────
// ГУС-ийн `code` багана (xsd:int) нь 8 утга авдаг; дээр нь "бусад код" гэсэн
// хамгаалалтын дэд давхарга. Эдгээр нь GeoServer дээр БАЙХГҮЙ виртуал
// давхаргууд тул ЗААВАЛ эх давхаргын нэрээр (source) дуудагдана.
test("зөвшилцсөн зургийн дэд давхаргууд эх давхаргаасаа CQL-ээр гарна", () => {
  assert.ok(AGREED_CODE_LAYERS.length >= 2, "дэд давхарга хоосон");

  const codes = new Set();
  const colors = new Set();
  let elseCount = 0;

  for (const sub of AGREED_CODE_LAYERS) {
    const def = MAP_LAYER_STYLES[sub.id];
    assert.ok(def, `${sub.id}: MAP_LAYER_STYLES-д байхгүй`);
    assert.equal(def.source, "ca_agreed_parcel", `${sub.id}: source буруу`);
    assert.equal(
      geoServerName(sub.id),
      "ca_agreed_parcel",
      `${sub.id}: GeoServer-ийн нэр эх давхарга байх ёстой`,
    );
    assert.equal(def.group, AGREED_GROUP_ID, `${sub.id}: самбарын хэсэг буруу`);
    assert.equal(def.label, sub.label, `${sub.id}: нэр зөрөв`);
    assert.equal(def.color, sub.color, `${sub.id}: өнгө зөрөв`);
    assert.match(sub.color, /^#[0-9a-f]{6}$/i, `${sub.id}: өнгө буруу`);
    assert.ok(!colors.has(sub.color), `${sub.id}: өнгө давхардсан (${sub.color})`);
    colors.add(sub.color);
    // Нэр дээр КОД харагдахгүй — дэлгэц дээр зөвхөн НЭР.
    assert.doesNotMatch(sub.label, /\d/, `${sub.id}: нэр дээр код харагдаж байна`);

    if (sub.code === null) {
      elseCount += 1;
      // "Бусад код" нь танигдсан БҮХ кодыг хасах ёстой (шинэ код гарахад
      // өгөгдөл чимээгүй алга болохоос сэргийлнэ).
      assert.match(def.cql, /^\(code NOT IN \([\d,]+\) OR code IS NULL\)$/, `${sub.id}: cql буруу`);
      for (const c of AGREED_CODE_LAYERS.map((l) => l.code).filter((c) => c !== null)) {
        assert.ok(def.cql.includes(String(c)), `${sub.id}: ${c} код хасагдаагүй`);
      }
    } else {
      assert.equal(def.cql, `code=${sub.code}`, `${sub.id}: cql буруу`);
      assert.ok(!codes.has(sub.code), `код ${sub.code} давхардсан`);
      codes.add(sub.code);
    }
  }

  assert.equal(elseCount, 1, '"бусад код" дэд давхарга ЯГ нэг байх ёстой');
  assert.deepEqual([...AGREED_CODE_LAYER_IDS], AGREED_CODE_LAYERS.map((l) => l.id));
  // Хэсгийн нэр/өнгө нь ЭХ давхаргаасаа гарна (хоёр газар бичихгүй).
  assert.equal(AGREED_GROUP.label, MAP_LAYER_STYLES.ca_agreed_parcel.label);
  assert.equal(AGREED_GROUP.color, MAP_LAYER_STYLES.ca_agreed_parcel.color);
  // Эх давхарга нь самбарт ӨӨРӨӨ гарахгүй (хэсгээрээ орно) — group-гүй хэвээр.
  assert.equal(MAP_LAYER_STYLES.ca_agreed_parcel.group, undefined);
});

// CQL нэгтгэлт: дэд давхаргын шүүлт "OR" агуулж болох тул ХААЛТГҮЙ нэгтгэвэл
// AND/OR-ийн эрэмбээс болж шүүлт бүхэлдээ эвдэрнэ (бусад чөлөөлөлтийн өгөгдөл
// зурагдана).
test("CQL нэгтгэхэд хэсэг бүр хаалтад орно", () => {
  assert.equal(combineCql("code=48"), "code=48");
  assert.equal(combineCql(undefined, "code=48"), "code=48");
  assert.equal(combineCql("", null), "");
  assert.equal(
    combineCql("(code NOT IN (30) OR code IS NULL)", "acquisition_id='x'"),
    "((code NOT IN (30) OR code IS NULL)) AND (acquisition_id='x')",
  );
});

// ── Хамгаалалтын зурвас: `code`-оор задарсан дэд давхаргууд ─────────────────
// Зөвшилцсөн зурагтай ижил зарчим. ЯЛГАА: `code` нь ТЕКСТ багана (CQL-д
// хашилттай) ба будалт нь тор биш ЦЭГЭН.
test("хамгаалалтын зурвасын дэд давхаргууд эх давхаргаасаа CQL-ээр гарна", () => {
  assert.ok(SEC_CODE_LAYERS.length >= 2, "дэд давхарга хоосон");

  const codes = new Set();
  const colors = new Set();
  let elseCount = 0;

  for (const sub of SEC_CODE_LAYERS) {
    const def = MAP_LAYER_STYLES[sub.id];
    assert.ok(def, `${sub.id}: MAP_LAYER_STYLES-д байхгүй`);
    assert.equal(def.source, "ca_sec_parcel", `${sub.id}: source буруу`);
    assert.equal(
      geoServerName(sub.id),
      "ca_sec_parcel",
      `${sub.id}: GeoServer-ийн нэр эх давхарга байх ёстой`,
    );
    assert.equal(def.group, SEC_GROUP_ID, `${sub.id}: самбарын хэсэг буруу`);
    assert.equal(def.label, sub.label, `${sub.id}: нэр зөрөв`);
    assert.equal(def.color, sub.color, `${sub.id}: өнгө зөрөв`);
    assert.equal(def.hatch, "dot", `${sub.id}: будалт ЦЭГЭН байх ёстой`);
    assert.match(sub.color, /^#[0-9a-f]{6}$/i, `${sub.id}: өнгө буруу`);
    assert.ok(!colors.has(sub.color), `${sub.id}: өнгө давхардсан (${sub.color})`);
    colors.add(sub.color);

    if (sub.code === null) {
      elseCount += 1;
      assert.match(
        def.cql,
        /^\(code NOT IN \('[\d',]+'\) OR code IS NULL\)$/,
        `${sub.id}: cql буруу`,
      );
      for (const c of SEC_CODE_LAYERS.map((l) => l.code).filter((c) => c !== null)) {
        assert.ok(def.cql.includes(`'${c}'`), `${sub.id}: '${c}' код хасагдаагүй`);
      }
    } else {
      // ХАШИЛТ ЗААВАЛ: `code` нь varchar — хашилтгүй бол GeoServer
      // "Could not convert" алдаа өгч давхарга ХООСОН зурагдана.
      assert.equal(def.cql, `code='${sub.code}'`, `${sub.id}: cql буруу`);
      assert.ok(!codes.has(sub.code), `код ${sub.code} давхардсан`);
      codes.add(sub.code);
    }
  }

  assert.equal(elseCount, 1, '"бусад код" дэд давхарга ЯГ нэг байх ёстой');
  assert.deepEqual([...SEC_CODE_LAYER_IDS], SEC_CODE_LAYERS.map((l) => l.id));
  assert.equal(SEC_GROUP.label, MAP_LAYER_STYLES.ca_sec_parcel.label);
  assert.equal(SEC_GROUP.color, MAP_LAYER_STYLES.ca_sec_parcel.color);
  assert.equal(MAP_LAYER_STYLES.ca_sec_parcel.group, undefined);
  // Хоёр ГУС-ийн давхаргын дэд давхаргууд НЭГ хэсэгт орж хутгалдахгүй.
  assert.notEqual(AGREED_GROUP_ID, SEC_GROUP_ID);
});

// Самбарын өнгө/тор нь ЗУРГАН дээрхтэй таарах ёстой — эх сурвалж нь SLD.
// Хажуугийн repo байхгүй бол (CI-д зөвхөн frontend clone хийсэн) алгасна.
test("зөвшилцсөн зургийн өнгө/код/тор SLD-тэй таарна", () => {
  const sld = "../government-geoserver/styles/ca_agreed_parcel.sld";
  if (!existsSync(sld)) return;
  const xml = readFileSync(sld, "utf8");

  // Дүрэм тус бүрийг ЗААВАЛ тусад нь шалгана: файлын хаа нэгтээ өнгө байгаа
  // эсэх нь хангалттай биш — тухайн КОДЫН дүрэм дээр байх ёстой.
  const rules = new Map(
    xml
      .split("<Rule>")
      .slice(1)
      .map((block) => [/<Name>(.+?)<\/Name>/.exec(block)?.[1], block]),
  );

  for (const sub of AGREED_CODE_LAYERS) {
    const name = sub.code === null ? "code_other" : `code_${sub.code}`;
    const rule = rules.get(name);
    assert.ok(rule, `SLD-д ${name} дүрэм байхгүй`);

    if (sub.code === null) {
      assert.ok(rule.includes("<ElseFilter/>"), `${name}: ElseFilter байх ёстой`);
    } else {
      assert.ok(
        rule.includes(`<ogc:Literal>${sub.code}</ogc:Literal>`),
        `${name}: code=${sub.code} шүүлт байхгүй`,
      );
    }

    // Торны хэлбэр (GraphicFill) ба ГАДНА хилийн зураас хоёулаа ТУХАЙН
    // дэд төрлийн өнгөөр — хилийг нэгдсэн ягаанаар үлдээвэл энэ тест барина.
    assert.ok(
      rule.includes(`shape://${sub.hatch}`),
      `${name}: тор нь shape://${sub.hatch} байх ёстой`,
    );
    const strokes = [...rule.matchAll(/name="stroke">(#[0-9a-fA-F]{6})</g)].map((m) =>
      m[1].toLowerCase(),
    );
    assert.deepEqual(
      strokes,
      [sub.color.toLowerCase(), sub.color.toLowerCase()],
      `${name}: тор ба гадна хил хоёулаа ${sub.color} байх ёстой`,
    );
  }
});

// Хамгаалалтын зурвас — ЦЭГЭН будалт (circle тэмдэг), хил нь ижил өнгө.
test("хамгаалалтын зурвасын өнгө/код/цэг SLD-тэй таарна", () => {
  const sld = "../government-geoserver/styles/ca_sec_parcel.sld";
  if (!existsSync(sld)) return;
  const xml = readFileSync(sld, "utf8");

  const rules = new Map(
    xml
      .split("<Rule>")
      .slice(1)
      .map((block) => [/<Name>(.+?)<\/Name>/.exec(block)?.[1], block]),
  );
  // SLD-д дэд давхаргаас ИЛҮҮ/ДУТУУ дүрэм байвал (код нэмэхэд нэг талыг л
  // зассан гэдэг) энэ шалгалт барина.
  assert.equal(rules.size, SEC_CODE_LAYERS.length, "SLD-ийн дүрмийн тоо зөрөв");

  for (const sub of SEC_CODE_LAYERS) {
    const name = sub.code === null ? "code_other" : `code_${sub.code}`;
    const rule = rules.get(name);
    assert.ok(rule, `SLD-д ${name} дүрэм байхгүй`);

    if (sub.code === null) {
      assert.ok(rule.includes("<ElseFilter/>"), `${name}: ElseFilter байх ёстой`);
    } else {
      assert.ok(
        rule.includes(`<ogc:Literal>${sub.code}</ogc:Literal>`),
        `${name}: code=${sub.code} шүүлт байхгүй`,
      );
    }

    // ЦЭГЭН будалт: GraphicFill дээр circle тэмдэг (тор БИШ).
    assert.ok(rule.includes("<WellKnownName>circle</WellKnownName>"), `${name}: цэгэн будалт биш`);
    assert.doesNotMatch(rule, /shape:\/\//, `${name}: торлолт хэрэглэсэн байна`);
    // Цэгийн Fill ба ГАДНА хилийн Stroke хоёулаа тухайн дэд төрлийн өнгөөр.
    assert.ok(
      rule.includes(`name="stroke">${sub.color}<`),
      `${name}: гадна хил ${sub.color} байх ёстой`,
    );
    assert.ok(
      rule.includes(`name="fill">${sub.color}<`),
      `${name}: цэгийн өнгө ${sub.color} байх ёстой`,
    );
  }
});
