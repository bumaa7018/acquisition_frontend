// Үнэлгээний байгууллагын бүртгэл ба БАЙГУУЛЛАГЫН ТҮВШНИЙ хандалтын e2e тест.
//
// Шалгах гол зүйлс:
//   1. JWT-ийн org_id зөв эх сурвалжаас гарч байгаа эсэх (auth/main санд ID
//      мөргөлддөг тул дотоод хэрэглэгчид org_id ОГТ байх ёсгүй).
//   2. /valuation-orgs CRUD + эрхийн хаалт.
//   3. Нэг байгууллагын ХОЁР ажилтан ижил ажлыг харах (энэ өөрчлөлтийн гол зорилго).
//   4. Өөр байгууллагын ажилтан тэр ажлыг ХАРАХГҮЙ.
//   5. sdplatform шилжилтээс эвдэрсэн шүүлтүүд (assigned_user_id) сэргэсэн эсэх.
//
// Ажиллуулах: API (8080) болон Postgres асаалттай байхад
//   E2E_BASE_URL=http://localhost:8080 node --test tests/e2e/valuation-org.e2e.mjs
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const API = `${BASE}/api/v1`;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
// bs_person.person_register нь 10 тэмдэгтээр хязгаарлагдана.
const reg = (n) => `T${String(Date.now()).slice(-7)}${n}`;

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
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { res, json };
}

// /auth бүлэг минутад 30 хүсэлтийн хязгаартай тул нэг ажиллагааны дотор нэг
// хэрэглэгчээр давтан нэвтрэхгүй — токеныг кэшлэнэ. ШИНЭ нэвтрэлт шаардсан
// тестүүд (идэвхгүй болсны дараах шалгалт г.м.) /auth/login-г ШУУД дуудна.
const tokenCache = new Map();

async function login(username, password) {
  const key = `${username}:${password}`;
  if (tokenCache.has(key)) return tokenCache.get(key);
  const { res, json } = await request("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  assert.equal(res.status, 200, `login failed for ${username}: ${res.status}`);
  tokenCache.set(key, json.data.access_token);
  return json.data.access_token;
}

function claims(token) {
  const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(raw.padEnd(Math.ceil(raw.length / 4) * 4, "="), "base64").toString("utf8"));
}

const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "admin@example.com";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? "Admin123!";

let admin;
const created = { orgId: null, usernames: [] };
const EMP1_USER = `e2e_emp1_${suffix}`.replace(/-/g, "_");
const EMP2_USER = `e2e_emp2_${suffix}`.replace(/-/g, "_");

test("бэлтгэл: админаар нэвтрэх", async () => {
  admin = await login(ADMIN_USER, ADMIN_PASS);
  assert.ok(admin);
});

// ── 1. org_id нэхэмжлэлийн зөв эх сурвалж ───────────────────────────────────

test("дотоод хэрэглэгчид org_id ОГТ олгогдохгүй", async () => {
  // auth ба main сан тус тусын serial4 дараалалтай тул organization.id
  // мөргөлддөг. Дотоод ажилтны байгууллагыг org_id-д бичвэл тэр нь өөр
  // байгууллагын чөлөөлөлтөд тохирч, хөндлөнгийн хандалт үүсгэнэ.
  const c = claims(admin);
  assert.equal(c.org_id, undefined, `админд org_id олгогдсон байна: ${c.org_id}`);
});

test("үнэлгээний байгууллагын хэрэглэгчид org_id олгогдоно", async () => {
  const token = await login("valuation_org_1", "Testpass123!");
  const c = claims(token);
  assert.ok(Number.isInteger(c.org_id), `org_id алга: ${JSON.stringify(c.org_id)}`);
  assert.deepEqual(c.roles, ["professional_org"]);
});

test("өөр өөр байгууллагын хэрэглэгчид ӨӨР org_id авна", async () => {
  const a = claims(await login("valuation_org_1", "Testpass123!"));
  const b = claims(await login("valuation_org_2", "Testpass123!"));
  assert.notEqual(a.org_id, b.org_id, "хоёр байгууллага ижил org_id авчээ");
});

// ── 2. Бүртгэл ба эрхийн хаалт ──────────────────────────────────────────────

test("админ байгууллагыг ажилтнуудынх нь хамт бүртгэнэ", async () => {
  const { res, json } = await request("/valuation-orgs", {
    token: admin,
    method: "POST",
    body: {
      name: `E2E Үнэлгээ ${suffix}`,
      short_name: "E2E",
      register_no: `E${String(Date.now()).slice(-8)}`,
      license_no: `LIC-${suffix}`,
      license_expires_at: "2030-12-31",
      phone: "99112233",
      email: `e2e-${suffix}@example.mn`,
      address: "Улаанбаатар",
      is_active: true,
      employees: [
        {
          last_name: "Дорж",
          first_name: "Бат",
          register_no: reg("1"),
          position_name: "Ерөнхий үнэлгээчин",
          phone: "88001122",
          email: `emp1-${suffix}@example.mn`,
          username: EMP1_USER,
          password: "Testpass123!",
        },
        {
          last_name: "Дорж",
          first_name: "Болд",
          register_no: reg("2"),
          position_name: "Үнэлгээчин",
          username: EMP2_USER,
          password: "Testpass123!",
        },
      ],
    },
  });
  assert.equal(res.status, 201, `үүсгэх амжилтгүй: ${res.status} ${JSON.stringify(json)}`);
  created.orgId = String(json.data.id);
  created.usernames = [EMP1_USER, EMP2_USER];
  assert.equal(json.data.employee_count, 2, "ажилтны тоо буруу");
  assert.equal(json.data.register_no.length > 0, true);
  assert.equal(json.data.license_no, `LIC-${suffix}`);
});

test("дэлгэрэнгүй нь ажилтнуудыг буцаана", async () => {
  const { res, json } = await request(`/valuation-orgs/${created.orgId}`, { token: admin });
  assert.equal(res.status, 200);
  assert.equal(json.data.employees.length, 2);
  // Ажилтан бүр нэвтрэх эрхтэй холбогдсон байх ёстой.
  for (const e of json.data.employees) {
    assert.ok(e.user_id, `ажилтан нэвтрэх эрхгүй: ${JSON.stringify(e)}`);
    assert.ok(e.person?.register_no, "хүний регистр алга");
  }
});

test("жагсаалт болон хайлт ажиллана", async () => {
  const { res, json } = await request(`/valuation-orgs?search=${encodeURIComponent(`E2E Үнэлгээ ${suffix}`)}`, {
    token: admin,
  });
  assert.equal(res.status, 200);
  assert.equal((json.data ?? []).length, 1, "хайлт яг нэг мөр буцаах ёстой");
  assert.equal(String(json.data[0].id), created.orgId);
});

test("мэргэжлийн байгууллага бүртгэл ҮҮСГЭХ/ЗАСАХ эрхгүй", async () => {
  const token = await login("valuation_org_1", "Testpass123!");
  const c = await request("/valuation-orgs", {
    token,
    method: "POST",
    body: { name: `hack-${suffix}` },
  });
  assert.equal(c.res.status, 403, `POST хаагдаагүй: ${c.res.status}`);

  const u = await request(`/valuation-orgs/${created.orgId}`, {
    token,
    method: "PUT",
    body: { name: `hack-${suffix}` },
  });
  assert.equal(u.res.status, 403, `PUT хаагдаагүй: ${u.res.status}`);

  const d = await request(`/valuation-orgs/${created.orgId}`, { token, method: "DELETE" });
  assert.equal(d.res.status, 403, `DELETE хаагдаагүй: ${d.res.status}`);
});

test("нэвтрээгүй хүсэлт 401 буцаана", async () => {
  const { res } = await request("/valuation-orgs");
  assert.equal(res.status, 401);
});

// ── 3. Нэг байгууллагын олон ажилтан ────────────────────────────────────────

test("НЭГ байгууллагын ХОЁР ажилтан тус тусдаа нэвтэрч, ИЖИЛ org_id авна", async () => {
  // Энэ бол өөрчлөлтийн гол зорилго: өмнө нь байгууллага = нэг хэрэглэгч
  // байсан тул нэг байгууллагад ганцхан хүн ажиллаж чаддаг байв.
  const org = Number(created.orgId);
  const got = [];
  for (const uname of created.usernames) {
    const t = await login(uname, "Testpass123!");
    const c = claims(t);
    got.push(c.org_id);
    assert.deepEqual(c.roles, ["professional_org"], `${uname}-д professional_org роль олгогдоогүй`);
  }
  assert.equal(got.length, 2);
  for (const g of got) assert.equal(g, org, "ажилтны org_id байгууллагатайгаа таарахгүй байна");
});

test("байгууллагын ажилтнууд ИЖИЛ ажлын жагсаалт харна", async () => {
  const [u1, u2] = created.usernames;
  const t1 = await login(u1, "Testpass123!");
  const t2 = await login(u2, "Testpass123!");
  const a = await request("/prof/land-acquisitions?page=1&page_size=50", { token: t1 });
  const b = await request("/prof/land-acquisitions?page=1&page_size=50", { token: t2 });
  assert.equal(a.res.status, 200);
  assert.equal(b.res.status, 200);
  const idsA = (a.json.data ?? []).map((x) => x.id).sort();
  const idsB = (b.json.data ?? []).map((x) => x.id).sort();
  assert.deepEqual(idsA, idsB, "нэг байгууллагын ажилтнууд өөр өөр жагсаалт харж байна");
});

// ── 4. Устгах ба хамаарлын хамгаалалт ───────────────────────────────────────

test("байгууллагыг устгахад профайл нь мөн устана", async () => {
  const del = await request(`/valuation-orgs/${created.orgId}`, { token: admin, method: "DELETE" });
  assert.equal(del.res.status, 200, `устгах амжилтгүй: ${del.res.status}`);

  const after = await request(`/valuation-orgs/${created.orgId}`, { token: admin });
  assert.equal(after.res.status, 404, "устгасны дараа ч олдсоор байна");

  const list = await request(`/valuation-orgs?search=${encodeURIComponent(`E2E Үнэлгээ ${suffix}`)}`, {
    token: admin,
  });
  // Хоосон хуудсанд backend `data: null` буцаадаг тул ?? [] хэрэгтэй.
  assert.equal((list.json.data ?? []).length, 0, "устгасан байгууллага жагсаалтад үлдсэн");
});

// ── 5. sdplatform шилжилтээс эвдэрсэн шүүлтүүд ──────────────────────────────

test("ажилтнаар шүүх (assigned_user_id) 500 өгөхгүй", async () => {
  // Регресс: land_acquisition_assignee.user_id нь int4 болсон ч SQL нь
  // "$N::uuid" хэвээр байсан тул энэ шүүлт бүхэлдээ 500 өгдөг байв.
  const { res, json } = await request("/land-acquisitions?assigned_user_id=1&page=1&page_size=5", {
    token: admin,
  });
  assert.equal(res.status, 200, `шүүлт унасан: ${res.status} ${JSON.stringify(json)}`);
  assert.ok(Array.isArray(json.data ?? []));
});

test("хяналтын самбар ажилтны шүүлттэйгээр ажиллана", async () => {
  // Регресс A-ийн хоёр дахь дуудлагын цэг (land_acquisition_repo.go:3325).
  const { res } = await request("/dashboard?assigned_user_id=1", { token: admin });
  assert.equal(res.status, 200, `dashboard status=${res.status}`);
});

test("мэргэжлийн байгууллагын жагсаалт зөвхөн өөрийн ажлыг буцаана", async () => {
  const t1 = await login("valuation_org_1", "Testpass123!");
  const t2 = await login("valuation_org_2", "Testpass123!");
  const a = await request("/prof/land-acquisitions?page=1&page_size=50", { token: t1 });
  const b = await request("/prof/land-acquisitions?page=1&page_size=50", { token: t2 });
  assert.equal(a.res.status, 200, `org1 жагсаалт: ${a.res.status}`);
  assert.equal(b.res.status, 200, `org2 жагсаалт: ${b.res.status}`);

  const idsA = new Set((a.json.data ?? []).map((x) => x.id));
  const idsB = new Set((b.json.data ?? []).map((x) => x.id));
  for (const id of idsA) {
    assert.equal(idsB.has(id), false, `хоёр байгууллага ижил чөлөөлөлт харж байна: ${id}`);
  }
});

// ── 6. Бодит чөлөөлөлт дээрх байгууллагын түвшний хандалт ───────────────────
//
// Энэ бүлэг нь өөрчлөлтийн ГОЛ мэдэгдлийг шалгана: чөлөөлөлтөд БАЙГУУЛЛАГА
// оноогдоход тэр байгууллагын АЛЬ Ч ажилтан ажиллаж чадах ба өөр байгууллага
// хандаж чадахгүй.

const scoped = { orgId: null, acqId: null, usernames: [] };
const S_EMP1 = `e2e_scope1_${suffix}`.replace(/-/g, "_");
const S_EMP2 = `e2e_scope2_${suffix}`.replace(/-/g, "_");

test("бэлтгэл: 2 ажилтантай байгууллага үүсгэж чөлөөлөлтөд оноох", async () => {
  const org = await request("/valuation-orgs", {
    token: admin,
    method: "POST",
    body: {
      name: `E2E Хамрах хүрээ ${suffix}`,
      is_active: true,
      employees: [
        {
          last_name: "Сүх", first_name: "Ганаа", register_no: reg("3"),
          position_name: "Үнэлгээчин", username: S_EMP1, password: "Testpass123!",
        },
        {
          last_name: "Сүх", first_name: "Тулга", register_no: reg("4"),
          position_name: "Үнэлгээчин", username: S_EMP2, password: "Testpass123!",
        },
      ],
    },
  });
  assert.equal(org.res.status, 201, `байгууллага үүсгэх: ${org.res.status} ${JSON.stringify(org.json)}`);
  scoped.orgId = String(org.json.data.id);
  scoped.usernames = [S_EMP1, S_EMP2];

  const list = await request("/land-acquisitions?page=1&page_size=1", { token: admin });
  assert.equal(list.res.status, 200);
  const acq = (list.json.data ?? [])[0];
  assert.ok(acq, "тестлэх чөлөөлөлт олдсонгүй");
  scoped.acqId = acq.id;

  const assign = await request(`/land-acquisitions/${scoped.acqId}/professional-org`, {
    token: admin,
    method: "PUT",
    body: { org_id: scoped.orgId },
  });
  assert.equal(assign.res.status, 200, `оноох: ${assign.res.status}`);
});

test("оноосон байгууллагын нэр ЗӨВ буцна (хэрэглэгчийн нэр биш)", async () => {
  // Регресс: professional_org_id нь БАЙГУУЛЛАГЫН ID болсон ч нэрийг нь
  // хэрэглэгчийн лавлахаас нөхдөг байсан тул огт хамаагүй хүний нэр гардаг байв.
  const { res, json } = await request(`/land-acquisitions/${scoped.acqId}`, { token: admin });
  assert.equal(res.status, 200);
  assert.equal(json.data.professional_org_id, scoped.orgId);
  assert.equal(json.data.professional_org_name, `E2E Хамрах хүрээ ${suffix}`);
});

test("жагсаалт дээр ч байгууллагын нэр зөв харагдана", async () => {
  const { json } = await request("/land-acquisitions?page=1&page_size=20", { token: admin });
  const row = (json.data ?? []).find((a) => a.id === scoped.acqId);
  assert.ok(row, "чөлөөлөлт жагсаалтад алга");
  assert.equal(row.professional_org_name, `E2E Хамрах хүрээ ${suffix}`);
});

test("байгууллагын ХОЁУЛАА ажилтан тэр чөлөөлөлтөд хандана", async () => {
  for (const uname of scoped.usernames) {
    const t = await login(uname, "Testpass123!");
    const one = await request(`/prof/land-acquisitions/${scoped.acqId}`, { token: t });
    assert.equal(one.res.status, 200, `${uname} хандаж чадсангүй: ${one.res.status}`);
    const parcels = await request(`/prof/land-acquisitions/${scoped.acqId}/parcels`, { token: t });
    assert.equal(parcels.res.status, 200, `${uname} нэгж талбар: ${parcels.res.status}`);
  }
});

test("ӨӨР байгууллагын ажилтан тэр чөлөөлөлтөд ХАНДАХГҮЙ", async () => {
  const other = await login("valuation_org_1", "Testpass123!");
  const { res } = await request(`/prof/land-acquisitions/${scoped.acqId}`, { token: other });
  assert.equal(res.status, 403, `өөр байгууллага хандаж чадсан: ${res.status}`);
});

test("байгууллагын харьяалалгүй дотоод ажилтан prof маршрутад хандахгүй", async () => {
  const { res } = await request(`/prof/land-acquisitions/${scoped.acqId}`, { token: admin });
  assert.equal(res.status, 403, `админ prof маршрутад оржээ: ${res.status}`);
});

test("байгууллага устахад ажилтан нь ӨӨР байгууллагад наалдахгүй", async () => {
  // hr_employee.department_id-д гадаад түлхүүр байхгүй тул хэлтэс устахад
  // ажилтан устсан дугаар руу зааж үлддэг. Serial дугаар дахин ашиглагдвал
  // тэр ажилтан шинэ байгууллагад чимээгүй наалдах эрсдэлтэй байсан.
  const tmp = await request("/valuation-orgs", {
    token: admin,
    method: "POST",
    body: {
      name: `E2E Түр ${suffix}`,
      employees: [{
        last_name: "Түр", first_name: "Ажилтан", register_no: reg("9"),
        position_name: "Үнэлгээчин",
        username: `e2e_tmp_${suffix}`.replace(/-/g, "_"), password: "Testpass123!",
      }],
    },
  });
  assert.equal(tmp.res.status, 201);
  const tmpId = String(tmp.json.data.id);
  const tmpUser = `e2e_tmp_${suffix}`.replace(/-/g, "_");

  const del = await request(`/valuation-orgs/${tmpId}`, { token: admin, method: "DELETE" });
  assert.equal(del.res.status, 200);

  // Байгууллага устахад ажилтан салгагдаад зогсохгүй нэвтрэх эрх нь ч хаагдана
  // (мөр устгагдахгүй — зөвхөн төлөв). Иймд нэвтрэлт татгалзагдана.
  const { res } = await request("/auth/login", {
    method: "POST",
    body: { username: tmpUser, password: "Testpass123!" },
  });
  assert.equal(res.status, 401, `устгасан байгууллагын ажилтан нэвтэрсэн хэвээр: ${res.status}`);
});

test("цэвэрлэгээ: оноолт салгаж, байгууллагыг устгана", async () => {
  const unassign = await request(`/land-acquisitions/${scoped.acqId}/professional-org`, {
    token: admin,
    method: "PUT",
    body: { org_id: null },
  });
  assert.equal(unassign.res.status, 200);

  const after = await request(`/land-acquisitions/${scoped.acqId}`, { token: admin });
  assert.equal(after.json.data.professional_org_id ?? null, null, "оноолт салгагдсангүй");

  const del = await request(`/valuation-orgs/${scoped.orgId}`, { token: admin, method: "DELETE" });
  assert.equal(del.res.status, 200, `устгах: ${del.res.status}`);
});

// ── 7. Идэвхтэй эсэхийн шалгалт ─────────────────────────────────────────────

const act = { orgId: null, user: null };

test("бэлтгэл: идэвхжилт шалгах байгууллага + ажилтан", async () => {
  act.user = `e2e_act_${suffix}`.replace(/-/g, "_");
  const { res, json } = await request("/valuation-orgs", {
    token: admin,
    method: "POST",
    body: {
      name: `E2E Идэвхжилт ${suffix}`,
      employees: [{
        last_name: "Идэвх", first_name: "Тест", register_no: reg("7"),
        position_name: "Үнэлгээчин", username: act.user, password: "Testpass123!",
      }],
    },
  });
  assert.equal(res.status, 201, `${res.status} ${JSON.stringify(json)}`);
  act.orgId = String(json.data.id);
});

test("нэвтрэх нэр нь ИМЭЙЛ байх шаардлагагүй", async () => {
  // "e2e_act_…" нь имэйл биш — backend үүнийг хүлээж авах ёстой.
  const t = await login(act.user, "Testpass123!");
  assert.ok(t, "энгийн нэвтрэх нэрээр нэвтэрч чадсангүй");
  assert.equal(claims(t).org_id, Number(act.orgId));
});

test("имэйлээр ч нэвтэрч болно (хоёулаа дэмжигдэнэ)", async () => {
  const { res, json } = await request("/auth/login", {
    method: "POST",
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  assert.equal(res.status, 200);
  assert.ok(json.data.access_token);
});

test("ажилтныг байгууллагаас хасахад НЭВТРЭХ ЭРХ нь хаагдана", async () => {
  // Ажилтныг жагсаалтаас хасна (мөр устахгүй — зөвхөн төлөв).
  const upd = await request(`/valuation-orgs/${act.orgId}`, {
    token: admin,
    method: "PUT",
    body: { name: `E2E Идэвхжилт ${suffix}`, employees: [] },
  });
  assert.equal(upd.res.status, 200, `${upd.res.status} ${JSON.stringify(upd.json)}`);
  assert.equal(upd.json.data.employee_count, 0);

  // Өмнө нь ажилтан хасагдсан ч sd_user идэвхтэй хэвээр үлдэж, нэвтэрсээр байв.
  const { res, json } = await request("/auth/login", {
    method: "POST",
    body: { username: act.user, password: "Testpass123!" },
  });
  assert.equal(res.status, 401, `хасагдсан ажилтан нэвтэрсэн хэвээр: ${res.status} ${JSON.stringify(json)}`);
});

test("идэвхгүй хэрэглэгч 'олдсонгүй' (401) болно — 403 биш", async () => {
  // Бүртгэл байгаа эсэхийг гаднаас таамаглах боломжгүй байх ёстой.
  const { res } = await request("/auth/login", {
    method: "POST",
    body: { username: act.user, password: "buruu-nuuts-ug" },
  });
  assert.equal(res.status, 401);
});

test("цэвэрлэгээ: идэвхжилтийн байгууллагыг устгах", async () => {
  const del = await request(`/valuation-orgs/${act.orgId}`, { token: admin, method: "DELETE" });
  assert.equal(del.res.status, 200);
});
