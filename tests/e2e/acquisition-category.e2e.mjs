import test from "node:test";
import assert from "node:assert/strict";

/**
 * Чөлөөлөлтийн АНГИЛАЛ — ашиглалтын тоо ба устгах хамгаалалт.
 *
 * ЯАГААД: ангилалд чөлөөлөлт холбогдсон байхад устгах гэвэл
 * `land_acquisition`-ийн FK зөрчигдөж, хэрэглэгчид "Дотоод алдаа гарлаа"
 * (500) гэсэн ойлгомжгүй мессеж буцдаг байв. Одоо:
 *   - жагсаалт нь `acquisition_count` / `sub_count`-ыг буцаана (UI урьдчилж
 *     анхааруулахад),
 *   - устгах нь 409 + тодорхой мессеж буцаана (UI-г тойрч орсон ч).
 *
 * Ажиллуулах:
 *   E2E_BASE_URL=http://localhost:8099 node --test tests/e2e/acquisition-category.e2e.mjs
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
  assert.equal(res.status, 200, `login failed: ${res.status}`);
  return json.data.access_token;
}

const listOf = (json) => json?.data ?? json ?? [];
const bodyOf = (json) => json?.data ?? json ?? {};

test("ангиллын ашиглалтын тоо ба устгах хамгаалалт", async () => {
  const token = await login("admin@example.com", "Admin123!");
  const created = [];

  try {
    // ── 1. Жагсаалт тоолууруудыг буцаана ──────────────────────────────
    const generals = listOf((await request("/acquisition-categories", { token })).json);
    assert.ok(generals.length > 0, "ерөнхий ангилал алга");
    for (const g of generals) {
      assert.equal(typeof g.acquisition_count, "number", `${g.name}: acquisition_count алга`);
      assert.equal(typeof g.sub_count, "number", `${g.name}: sub_count алга`);
      assert.ok(g.acquisition_count >= 0 && g.sub_count >= 0);
    }

    // Ерөнхий ангилалын тоо нь дэд ангилалуудынхаа нийлбэрээс БАГА байж
    // болохгүй (дэдээр нь холбогдсон бүх чөлөөлөлт эцэгт нь тоологдоно).
    const parent = generals.find((g) => g.sub_count > 0);
    if (parent) {
      const subs = listOf(
        (await request(`/acquisition-categories?parent_id=${parent.id}`, { token })).json,
      );
      const subTotal = subs.reduce((a, s) => a + (s.acquisition_count ?? 0), 0);
      assert.ok(
        parent.acquisition_count >= subTotal,
        `${parent.name}: эцгийн тоо (${parent.acquisition_count}) нь дэдүүдийнхээс (${subTotal}) бага байна`,
      );
    }

    // ── 2. ХООСОН ангилал устгагдана ──────────────────────────────────
    const fresh = bodyOf(
      (
        await request("/acquisition-categories", {
          token,
          method: "POST",
          body: { name: `E2E ангилал ${suffix}`, parent_id: null, sort_order: 990 },
        })
      ).json,
    );
    assert.ok(fresh.id, "ангилал үүссэнгүй");
    created.push(fresh.id);

    const gone = await request(`/acquisition-categories/${fresh.id}`, { token, method: "DELETE" });
    assert.ok(
      gone.res.status >= 200 && gone.res.status < 300,
      `хоосон ангилал устгагдах ёстой, гэвч ${gone.res.status}`,
    );
    created.pop();

    // ── 3. ХОЛБОГДСОН ангилал устгагдахгүй — 409, 500 БИШ ─────────────
    const used = generals.find((g) => (g.acquisition_count ?? 0) > 0);
    if (!used) {
      // Локал санд холбоос байхгүй бол энэ хэсгийг шалгах боломжгүй.
      return;
    }
    const blocked = await request(`/acquisition-categories/${used.id}`, {
      token,
      method: "DELETE",
    });
    assert.equal(
      blocked.res.status,
      409,
      `холбоостой ангилал 409 буцаах ёстой (500 биш), гэвч ${blocked.res.status}`,
    );
    const msg = blocked.json?.message ?? blocked.json?.error ?? "";
    assert.match(msg, /устгах боломжгүй/i, `мессеж тодорхой биш: ${msg}`);

    // Татгалзсаны дараа ангилал ХЭВЭЭР байх ёстой.
    const after = listOf((await request("/acquisition-categories", { token })).json);
    assert.ok(after.some((g) => g.id === used.id), "татгалзсан хүсэлт ангилалыг устгачихжээ");
  } finally {
    for (const id of created) {
      await request(`/acquisition-categories/${id}`, { token, method: "DELETE" });
    }
  }
});
