import test from "node:test";
import assert from "node:assert/strict";

/**
 * Нэгж талбарын ТӨЛӨВИЙН ӨНГӨ — бүрэн мөчлөгийн e2e.
 *
 * ЯАГААД: өнгө нь өмнө нь код дотор (frontend-ийн хүснэгт + GeoServer-ийн
 * SLD) хатуу бичигдсэн байсан тул бүртгэлд ШИНЭ төлөв нэмэхэд газрын зураг
 * дээр өнгөгүй/огт гарахгүй байв. Одоо өнгө нь `parcel_status` хүснэгтийн
 * шинж бөгөөд API-аар гарч, давхаргын өнгө болж хэрэглэгдэнэ.
 *
 * Энэ тест бодит API-тай ярина (mock биш):
 *   POST/PUT/GET/DELETE /parcel-statuses
 *
 * Ажиллуулах:
 *   E2E_BASE_URL=http://localhost:8099 node --test tests/e2e/parcel-status-color.e2e.mjs
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/v1`;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

async function request(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Accept-Language": "mn",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  if (text) json = JSON.parse(text);
  return { res, json };
}

async function login(username, password) {
  const { res, json } = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(res.status, 200, `login failed for ${username}: ${res.status}`);
  return json.data.access_token;
}

test("нэгж талбарын төлөвийн өнгө — үүсгэх, унших, засах, буцаах", async () => {
  const token = await login("admin@example.com", "Admin123!");
  let createdId = null;

  try {
    // ── 1. Одоо байгаа төлөвүүд өнгөтэйгөө ирнэ ────────────────────────
    const listed = await request("/parcel-statuses", { token });
    assert.equal(listed.res.status, 200);
    const existing = listed.json.data ?? [];
    assert.ok(existing.length > 0, "бүртгэлд төлөв алга");

    for (const s of existing) {
      assert.ok("color" in s, `${s.code}: хариунд color талбар байхгүй`);
      if (s.color) {
        assert.match(s.color, /^#[0-9a-f]{6}$/, `${s.code}: өнгө буруу хэлбэртэй: ${s.color}`);
      }
    }
    // Seeder тавьсан утгууд — эдгээр нь өмнө frontend-д хатуу бичигдсэн
    // байсантай ЯГ ижил байх ёстой (харагдах байдал өөрчлөгдөхгүй).
    const released = existing.find((s) => s.code === "released");
    assert.ok(released, "released төлөв алга");
    assert.equal(released.color, "#22c55e", "Чөлөөлсөн төлөвийн өнгө зөрж байна");

    // ── 2. ШИНЭ төлөв өнгөтэйгөөр үүснэ ───────────────────────────────
    const created = await request("/parcel-statuses", {
      token,
      method: "POST",
      body: {
        code: `e2e_color_${suffix}`,
        name: `E2E өнгөний тест ${suffix}`,
        sort_order: 900,
        color: "#A855F7",
      },
    });
    // id-г ЭХЛЭЭД авна: assert унавал доорх `finally` цэвэрлэхийн тулд
    // id аль хэдийн хадгалагдсан байх ёстой (эс бөгөөс тест унасан бүрд
    // бүртгэлд хог үлдэнэ).
    // Үүсгэх нь бусад маршрутаас ЯЛГААТАЙ — `data` бүрхүүлгүй, объектыг
    // шууд буцаадаг. Хоёуланг нь дэмжинэ.
    const createdBody = created.json?.data ?? created.json ?? {};
    createdId = createdBody.id ?? null;
    assert.equal(created.res.status, 201, `үүсгэх амжилтгүй: ${created.res.status}`);
    // Том үсгээр илгээсэн ч ЖИЖИГ болж нэгтгэгдэнэ — эс бөгөөс ижил өнгө
    // хоёр янзаар хадгалагдаж, UI-ийн харьцуулалт таарахгүй болно.
    assert.equal(createdBody.color, "#a855f7", "өнгө жижиг үсэг рүү нэгтгэгдээгүй");

    // ── 3. Жагсаалтад өнгөтэйгөө харагдана ────────────────────────────
    const after = await request("/parcel-statuses", { token });
    const mine = (after.json.data ?? []).find((s) => s.id === createdId);
    assert.ok(mine, "шинэ төлөв жагсаалтад алга");
    assert.equal(mine.color, "#a855f7");

    // ── 4. Өнгө засагдана ─────────────────────────────────────────────
    const updated = await request(`/parcel-statuses/${createdId}`, {
      token,
      method: "PUT",
      body: { color: "#0ea5e9" },
    });
    assert.equal(updated.res.status, 200);
    assert.equal(updated.json.data.color, "#0ea5e9");
    // Нэр/код нь хоосон илгээсэн ч ХЭВЭЭР үлдэнэ.
    assert.equal(updated.json.data.code, `e2e_color_${suffix}`, "код санамсаргүй өөрчлөгдсөн");

    // ── 5. Өнгө ИЛГЭЭХГҮЙ үед хуучин утга хэвээр ──────────────────────
    const noColor = await request(`/parcel-statuses/${createdId}`, {
      token,
      method: "PUT",
      body: { name: `E2E өнгөний тест ${suffix} (засварласан)` },
    });
    assert.equal(noColor.res.status, 200);
    assert.equal(
      noColor.json.data.color,
      "#0ea5e9",
      "өнгө дамжуулаагүй үед арилах ёсгүй — өнгө мэдэхгүй клиент устгаж болохгүй",
    );

    // ── 6. БУРУУ хэлбэрийн өнгө татгалзана ────────────────────────────
    for (const bad of ["ногоон", "#12345", "#gggggg", "rgb(1,2,3)", "#1234567"]) {
      const rejected = await request(`/parcel-statuses/${createdId}`, {
        token,
        method: "PUT",
        body: { color: bad },
      });
      assert.equal(
        rejected.res.status,
        400,
        `"${bad}" зөвшөөрөгдөх ёсгүй (SLD руу шууд очдог утга)`,
      );
    }
    // Татгалзсаны дараа хуучин утга эвдрээгүй байх ёстой.
    const stillOk = await request(`/parcel-statuses/${createdId}`, { token });
    assert.equal(stillOk.json.data.color, "#0ea5e9", "татгалзсан хүсэлт утгыг эвдэж орхив");
  } finally {
    if (createdId != null) {
      await request(`/parcel-statuses/${createdId}`, { token, method: "DELETE" });
    }
  }
});
