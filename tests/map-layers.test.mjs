import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_Z_INDEX,
  DRONE_Z_INDEX,
  MAP_LAYER_STYLES,
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
