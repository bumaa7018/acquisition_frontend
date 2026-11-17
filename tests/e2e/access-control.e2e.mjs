// Хандах эрхийн e2e тест — API-г ШУУД дуудаж, зөвхөн зөвшөөрөгдсөн хэрэглэгч
// үйлдлийг хийж чадаж байгааг батална (frontend-ийг тойрсон дуудлага).
//
// Юуг батлах вэ (аудитын дугаараар):
//   C2  Үнэлгээний урсгал: үндсэн урсгалд зөвхөн чөлөөлөлтийн үндсэн байгууллага,
//       хөндлөнгийн урсгалд зөвхөн тухайн нэгж талбарын хөндлөнгийн байгууллага,
//       МИКА урсгалд зөвхөн МИКА бичнэ.
//   H3  Ролийг admin гэж нэрлэх, admin ролийн нэрийг солихыг хориглоно.
//   H4  Админ ролийг зөвхөн админ олгоно; хоосон админ роль үүсэхгүй.
//   H5  Нэгж талбарын мэдээлэл дуудахад нэгж талбар URL-ын чөлөөлөлтийнх байна.
//   H6  Нэгж талбарын явц: өөр чөлөөлөлтийн нэгж талбар хориотой, урсгалд
//       байхгүй шилжилт хориотой (админ дурын төлөвт шилжүүлнэ).
//   H7  Санхүүжилтийн эх үүсвэр: өөр чөлөөлөлтийнхийг засах/устгахгүй,
//       захирамжтай холбогдсон бол устгахгүй.
//   H8  Үнэлгээ илгээх: зөвхөн урсгалын эзэн; батлах, буцаах: зөвхөн санхүү.
//   H9  Excel импорт: H8-тай ижил эзэмшлийн шалгалт.
//   H10 Хөндлөнгийн байгууллага нь үндсэн байгууллагаас өөр байна.
//   H11 Үнэлгээний байгууллага нэгж талбарын явц солихгүй.
//   H12 Үнэлгээний байгууллага төлбөр авагч, төлөөлөгчийг өөрчлөхгүй.
//   H13 МИКА бусад урсгалын үзүүлэлт, тооцоог өөрчлөхгүй.
//   H14 Мөрийг өөр нэгж талбар руу шилжүүлэхгүй; нэгж талбаргүй мөр үүсэхгүй.
//   H15 Дотоод ажилтан үнэлгээний дүнг өөрчлөхгүй.
//   H16 Нөхөн төлбөрийн нийт жагсаалтын API байхгүй.
//
// ЗӨВХӨН ЛОКАЛ хуулбар сан дээр ажиллана: туршилтын өгөгдөл үүсгэж, дараа нь
// цэвэрлэнэ. E2E_API_URL-ийг localhost руу заагаагүй бол бүх тест алгасагдана.
//
//   E2E_API_URL=http://localhost:8081/api/v1 node --test tests/e2e/access-control.e2e.mjs
//
// Урьдчилсан нөхцөл (гарын авлагын туршилтын хэрэглэгчид, нууц үг Guide2026!):
// admin, ahlah (ахлах), darga (хэлтсийн дарга), mika, unelgee (байгууллага 2).
import test from "node:test";
import assert from "node:assert/strict";

const API = process.env.E2E_API_URL || "";
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(API);
const skip = LOCAL ? false : "E2E_API_URL нь localhost биш — алгаслаа";

const PW = process.env.E2E_PASSWORD || "Guide2026!";
const ADMIN_PW = process.env.E2E_ADMIN_PASSWORD || "Admin123!";
const ACQ = process.env.E2E_ACQ || "4dd5749e-17a9-4be7-9984-a81f7621b490"; // үндсэн байгууллага = 2
const ACQ_B = process.env.E2E_ACQ_B || "9487a040-3ccd-4ab8-b53c-24026cc64772";
const P1 = { code: "1600900137", id: "e9848c87-b835-4766-a0d2-6d9d6ec1761f" }; // үнэлгээний шат, ноорог
const P2 = { code: "1600900166", id: "6c180f88-7c2f-4fb4-9b1c-3118a535e0fd" }; // хөндлөнгийн = байгууллага 1
const MAIN_ORG = "2";
const INDEP_ORG = "1";

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* хоосон хариу */ }
  return { status: res.status, json, data: json?.data };
}
async function login(username, password, prof = false) {
  const r = await call(null, "POST", prof ? "/auth/prof/login" : "/auth/login", { username, password });
  assert.equal(r.status, 200, `${username} нэвтэрч чадсангүй: ${JSON.stringify(r.json)}`);
  return r.data.access_token;
}
const denied = (r) => [403, 404].includes(r.status);
const rejected = (r) => [400, 403, 404, 409, 422].includes(r.status);
const show = (r) => `статус ${r.status}: ${JSON.stringify(r.json)?.slice(0, 200)}`;

const T = {};
const cleanup = [];

test("бэлтгэл: хэрэглэгчид, хөндлөнгийн байгууллага", { skip }, async () => {
  T.admin = await login("admin", ADMIN_PW);
  T.ahlah = await login("ahlah", PW);
  T.darga = await login("darga", PW);
  T.mika = await login("mika", PW);
  T.org = await login("unelgee", PW, true);

  // Байгууллага 1-д нэвтрэх эрхтэй туршилтын ажилтан (байхгүй бол нэмнэ).
  const vo = (await call(T.admin, "GET", `/valuation-orgs/${INDEP_ORG}`)).data;
  const emps = vo.employees ?? [];
  if (!emps.some((e) => e.username === "unelgee2")) {
    const r = await call(T.admin, "PUT", `/valuation-orgs/${INDEP_ORG}`, {
      name: vo.name, short_name: vo.short_name ?? "", register_no: vo.register_no ?? "", license_no: vo.license_no ?? "",
      license_issued_at: vo.license_issued_at?.slice(0, 10) ?? null, license_expires_at: vo.license_expires_at?.slice(0, 10) ?? null,
      phone: vo.phone ?? "", email: vo.email ?? "", address: vo.address ?? "", note: vo.note ?? "", is_active: true,
      employees: [
        ...emps.map((e) => ({ id: String(e.id), last_name: e.person?.last_name ?? "", first_name: e.person?.first_name ?? "",
          register_no: e.person?.register_no ?? "", phone: e.work_phone ?? "", email: e.work_email ?? "",
          position_name: e.position_name ?? "", username: e.username ?? "", password: "" })),
        { id: null, last_name: "Туршилт", first_name: "Хөндлөнгийн", register_no: "УБ91010101", phone: "", email: "",
          position_name: "Үнэлгээчин", username: "unelgee2", password: PW },
      ],
    });
    assert.equal(r.status, 200, show(r));
  }
  T.indep = await login("unelgee2", PW, true);

  const r = await call(T.admin, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P2.id}/independent-org`, { org_id: INDEP_ORG });
  assert.equal(r.status, 200, show(r));

  const list = await call(T.admin, "GET", `/land-acquisitions/${ACQ_B}/parcels?page=1&page_size=5`);
  const items = Array.isArray(list.data) ? list.data : list.data?.items ?? [];
  assert.ok(items.length > 0, "Өөр чөлөөлөлтийн нэгж талбар олдсонгүй");
  T.pB = { id: items[0].id, code: items[0].parcel_id, status: items[0].status ?? items[0].status_id };
});

// ── C2 Үнэлгээний урсгалын эзэмшил ────────────────────────────────────────────
const asset = (parcel, type) => ({ parcel_id: parcel, valuation_type: type, asset_type: "real_state", asset_name: "E2E хөрөнгө" });

test("C2 зөвшөөрөгдсөн бичилт ажиллана (эерэг)", { skip }, async () => {
  let r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/assets`, asset(P1.code, "asset"));
  assert.equal(r.status, 201, `үндсэн байгууллага өөрийн урсгалд: ${show(r)}`);
  T.orgAsset = r.data.id;
  cleanup.push(() => call(T.org, "DELETE", `/prof/land-acquisitions/${ACQ}/assets/${T.orgAsset}`));
  r = await call(T.indep, "POST", `/prof/land-acquisitions/${ACQ}/assets`, asset(P2.code, "independent"));
  assert.equal(r.status, 201, `хөндлөнгийн байгууллага өөрийн нэгж талбарт: ${show(r)}`);
  T.indepAsset = r.data.id;
  cleanup.push(() => call(T.indep, "DELETE", `/prof/land-acquisitions/${ACQ}/assets/${T.indepAsset}`));
  r = await call(T.mika, "POST", `/land-acquisitions/${ACQ}/assets`, asset(P1.code, "mika"));
  assert.equal(r.status, 201, `МИКА өөрийн урсгалд: ${show(r)}`);
  T.mikaAsset = r.data.id;
  cleanup.push(() => call(T.mika, "DELETE", `/land-acquisitions/${ACQ}/assets/${T.mikaAsset}`));
});

test("C2 хөндлөнгийн байгууллага өөр нэгж талбарын үндсэн урсгалд бичихгүй", { skip }, async () => {
  const r = await call(T.indep, "POST", `/prof/land-acquisitions/${ACQ}/assets`, asset(P1.code, "asset"));
  if (r.status === 201) cleanup.push(() => call(T.indep, "DELETE", `/prof/land-acquisitions/${ACQ}/assets/${r.data.id}`));
  assert.ok(denied(r), show(r));
});

test("C2 үндсэн байгууллага МИКА урсгалд бичихгүй", { skip }, async () => {
  const r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/assets`, asset(P1.code, "mika"));
  if (r.status === 201) cleanup.push(() => call(T.admin, "DELETE", `/land-acquisitions/${ACQ}/assets/${r.data.id}`));
  assert.ok(denied(r), show(r));
});

test("C2 үндсэн байгууллага хөндлөнгийн урсгалд бичихгүй", { skip }, async () => {
  const r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/assets`, asset(P2.code, "independent"));
  if (r.status === 201) cleanup.push(() => call(T.org, "DELETE", `/prof/land-acquisitions/${ACQ}/assets/${r.data.id}`));
  assert.ok(denied(r), show(r));
});

test("C2 хөндлөнгийн байгууллага үндсэн байгууллагын хөрөнгийг засахгүй, устгахгүй", { skip }, async () => {
  let r = await call(T.indep, "PUT", `/prof/land-acquisitions/${ACQ}/assets/${T.orgAsset}`, { asset_name: "E2E өөрчилсөн" });
  assert.ok(denied(r), `засах: ${show(r)}`);
  r = await call(T.indep, "DELETE", `/prof/land-acquisitions/${ACQ}/assets/${T.orgAsset}`);
  assert.ok(denied(r), `устгах: ${show(r)}`);
});

test("C2 газрын үнэлгээ, тайлбарыг бусдын урсгалд бичихгүй", { skip }, async () => {
  let r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/land-valuation`, { parcel_id: P1.code, valuation_type: "mika", land_area_m2: 1, base_price_per_m2: 1 });
  if (r.status === 200) cleanup.push(() => call(T.mika, "DELETE", `/land-acquisitions/${ACQ}/land-valuation?parcel_id=${P1.code}&valuation_type=mika`));
  assert.ok(denied(r), `МИКА газрын үнэлгээ: ${show(r)}`);
  r = await call(T.org, "PUT", `/prof/land-acquisitions/${ACQ}/valuation-notes`, { parcel_id: P2.code, valuation_type: "independent", notes: { s1: "E2E" } });
  assert.ok(denied(r), `хөндлөнгийн тайлбар: ${show(r)}`);
});

// ── H13 МИКА ба H15 дотоод ажилтан ───────────────────────────────────────────
test("H13 МИКА бусад урсгалын хөрөнгийн үзүүлэлт, тооцоо, мэдээллийг өөрчлөхгүй", { skip }, async () => {
  let r = await call(T.mika, "POST", `/land-acquisitions/${ACQ}/assets/${T.orgAsset}/specs`, { specs: [] });
  assert.ok(denied(r), `үзүүлэлт: ${show(r)}`);
  r = await call(T.mika, "POST", `/land-acquisitions/${ACQ}/assets/${T.orgAsset}/calculations`, { calculations: [] });
  assert.ok(denied(r), `тооцоо: ${show(r)}`);
  r = await call(T.mika, "PUT", `/land-acquisitions/${ACQ}/assets/${T.orgAsset}`, { asset_name: "E2E МИКА" });
  assert.ok(denied(r), `засах: ${show(r)}`);
});

test("H15 дотоод ажилтан (ахлах) үнэлгээний мэдээлэл үүсгэх, засахгүй", { skip }, async () => {
  let r = await call(T.ahlah, "POST", `/land-acquisitions/${ACQ}/assets`, asset(P1.code, "asset"));
  if (r.status === 201) cleanup.push(() => call(T.admin, "DELETE", `/land-acquisitions/${ACQ}/assets/${r.data.id}`));
  assert.ok(denied(r), `үүсгэх: ${show(r)}`);
  r = await call(T.ahlah, "PUT", `/land-acquisitions/${ACQ}/assets/${T.orgAsset}`, { asset_name: "E2E ахлах" });
  assert.ok(denied(r), `засах: ${show(r)}`);
});

// ── H14 мөр шилжүүлэх ────────────────────────────────────────────────────────
test("H14 хөрөнгийг өөр нэгж талбар руу шилжүүлэхгүй, нэгж талбаргүй олговор үүсэхгүй", { skip }, async () => {
  let r = await call(T.org, "PUT", `/prof/land-acquisitions/${ACQ}/assets/${T.orgAsset}`, { parcel_id: P2.code });
  assert.ok(rejected(r), `шилжүүлэх: ${show(r)}`);
  r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/compensations`, { parcel_id: "", valuation_type: "asset", amount: 1, compensation_type: "money" });
  if (r.status === 201) cleanup.push(() => call(T.org, "DELETE", `/prof/land-acquisitions/${ACQ}/compensations/${r.data.id}`));
  assert.ok(rejected(r), `нэгж талбаргүй олговор: ${show(r)}`);
});

// ── H8 илгээх, батлах ────────────────────────────────────────────────────────
test("H8 үнэлгээ илгээх: зөвхөн урсгалын эзэн", { skip }, async () => {
  let r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/parcels/${P1.id}/valuation-status`, { action: "submit", note: "E2E", valuation_type: "mika" });
  assert.ok(denied(r), `байгууллага МИКА урсгалыг илгээх: ${show(r)}`);
  r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/parcels/${P2.id}/valuation-status`, { action: "submit", note: "E2E", valuation_type: "independent" });
  assert.ok(denied(r), `үндсэн байгууллага хөндлөнгийн урсгалыг илгээх: ${show(r)}`);
  r = await call(T.ahlah, "POST", `/land-acquisitions/${ACQ}/parcels/${P1.id}/valuation-status`, { action: "submit", note: "E2E", valuation_type: "asset" });
  assert.ok(denied(r), `ахлах илгээх: ${show(r)}`);
});

test("H8 үнэлгээ батлах, буцаах: зөвхөн санхүү", { skip }, async () => {
  for (const action of ["approve", "return"]) {
    const r = await call(T.ahlah, "POST", `/land-acquisitions/${ACQ}/parcels/${P1.id}/valuation-status`, { action, note: "E2E", valuation_type: "asset" });
    assert.equal(r.status, 403, `ахлах ${action}: ${show(r)}`);
  }
});

// ── H9 импорт ────────────────────────────────────────────────────────────────
test("H9 Excel импорт бусдын урсгал руу хийгдэхгүй", { skip }, async () => {
  const body = (parcel, type) => ({ parcel_id: parcel, valuation_type: type, replace: false, land: {}, assets: [] });
  let r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/valuation-import`, body(P1.code, "mika"));
  assert.ok(denied(r), `МИКА урсгал руу: ${show(r)}`);
  r = await call(T.indep, "POST", `/prof/land-acquisitions/${ACQ}/valuation-import`, body(P2.code, "asset"));
  assert.ok(denied(r), `хөндлөнгийн байгууллага үндсэн урсгал руу: ${show(r)}`);
});

// ── H10 хөндлөнгийн байгууллага ──────────────────────────────────────────────
test("H10 хөндлөнгийн байгууллага нь үндсэн байгууллагаас өөр байна", { skip }, async () => {
  const r = await call(T.admin, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P2.id}/independent-org`, { org_id: MAIN_ORG });
  cleanup.push(() => call(T.admin, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P2.id}/independent-org`, { org_id: INDEP_ORG }));
  assert.ok(rejected(r), show(r));
  const p = await call(T.org, "PATCH", `/prof/land-acquisitions/${ACQ}/parcels/${P2.id}/independent-org`, { org_id: MAIN_ORG });
  assert.ok(denied(p) || p.status === 405, `байгууллага өөрөө холбох: ${show(p)}`);
});

// ── H11, H12 байгууллагын дуудлагууд ─────────────────────────────────────────
test("H11 үнэлгээний байгууллага нэгж талбарын явц солихгүй", { skip }, async () => {
  const r = await call(T.org, "PATCH", `/prof/land-acquisitions/${ACQ}/parcels/${P1.id}/status`, { status_id: 104, reason: "E2E" });
  assert.ok(denied(r) || r.status === 405, show(r));
});

test("H12 үнэлгээний байгууллага төлбөр авагч, төлөөлөгч өөрчлөхгүй", { skip }, async () => {
  let r = await call(T.org, "POST", `/prof/land-acquisitions/${ACQ}/parcels/${P1.id}/representatives`, { last_name: "E2E", first_name: "Төлөөлөгч" });
  if (r.status === 201 || r.status === 200) {
    const id = r.data?.id;
    if (id) cleanup.push(() => call(T.org, "DELETE", `/prof/land-acquisitions/${ACQ}/parcels/${P1.id}/representatives/${id}`));
  }
  assert.ok(denied(r) || r.status === 405, `төлөөлөгч нэмэх: ${show(r)}`);
  r = await call(T.org, "PUT", `/prof/land-acquisitions/${ACQ}/parcels/${P1.id}/payment-recipient`, { holder_id: null });
  assert.ok(denied(r) || r.status === 405, `төлбөр авагч: ${show(r)}`);
});

// ── H5 мэдээлэл дуудах ───────────────────────────────────────────────────────
test("H5 өөр чөлөөлөлтийн нэгж талбарын мэдээллийг дуудахгүй", { skip }, async () => {
  for (const suffix of ["sync", "sync/holders", "sync/fee"]) {
    const r = await call(T.ahlah, "POST", `/land-acquisitions/${ACQ}/parcels/${T.pB.code}/${suffix}`, {});
    assert.ok(denied(r), `${suffix}: ${show(r)}`);
  }
});

// ── H7 санхүүжилтийн эх үүсвэр ───────────────────────────────────────────────
test("H7 өөр чөлөөлөлтийн санхүүжилтийн эх үүсвэрийг засах, устгахгүй", { skip }, async () => {
  const c = await call(T.admin, "POST", `/land-acquisitions/${ACQ_B}/funding-sources`, { organization_name: "E2E Б", source_type: "Туршилт" });
  assert.ok([200, 201].includes(c.status), show(c));
  const id = c.data.id;
  cleanup.push(() => call(T.admin, "DELETE", `/land-acquisitions/${ACQ_B}/funding-sources/${id}`));
  let r = await call(T.ahlah, "PUT", `/land-acquisitions/${ACQ}/funding-sources/${id}`, { organization_name: "E2E өөрчилсөн", source_type: "Туршилт" });
  assert.ok(denied(r), `засах: ${show(r)}`);
  r = await call(T.ahlah, "DELETE", `/land-acquisitions/${ACQ}/funding-sources/${id}`);
  assert.ok(denied(r), `устгах: ${show(r)}`);
});

test("H7 захирамжтай холбогдсон эх үүсвэр устгагдахгүй, холбогдоогүй нь устгагдана", { skip }, async () => {
  const c = await call(T.admin, "POST", `/land-acquisitions/${ACQ}/funding-sources`, { organization_name: "E2E холбоостой", source_type: "Туршилт" });
  const fsID = c.data.id;
  const d = await call(T.admin, "POST", `/decision-drafts`, { proposal_no: "E2E-СХ-ЭРХ" });
  assert.ok([200, 201].includes(d.status), show(d));
  const draftID = d.data.id;
  const link = await call(T.admin, "POST", `/decision-drafts/${draftID}/funding-sources`, { funding_source_id: fsID, amount: 1 });
  assert.equal(link.status, 200, show(link));
  const linkID = (link.data ?? []).find((x) => (x.funding_source_id ?? x.funding_source?.id) === fsID)?.id;
  cleanup.push(async () => {
    if (linkID) await call(T.admin, "DELETE", `/decision-drafts/${draftID}/funding-sources/${linkID}`);
    await call(T.admin, "DELETE", `/decision-drafts/${draftID}`);
    await call(T.admin, "DELETE", `/land-acquisitions/${ACQ}/funding-sources/${fsID}`);
  });
  const r = await call(T.ahlah, "DELETE", `/land-acquisitions/${ACQ}/funding-sources/${fsID}`);
  assert.equal(r.status, 409, `холбоостой эх үүсвэр устгах: ${show(r)}`);

  const free = await call(T.ahlah, "POST", `/land-acquisitions/${ACQ}/funding-sources`, { organization_name: "E2E холбоосгүй", source_type: "Туршилт" });
  const del = await call(T.ahlah, "DELETE", `/land-acquisitions/${ACQ}/funding-sources/${free.data.id}`);
  assert.equal(del.status, 200, `холбоосгүй эх үүсвэр устгах: ${show(del)}`);
});

// ── H3, H4 роль ──────────────────────────────────────────────────────────────
test("H3 ролийг admin гэж нэрлэх, admin ролийн нэрийг солихгүй", { skip }, async () => {
  for (const name of ["admin", "Админ", "ADMIN"]) {
    const r = await call(T.admin, "POST", `/roles`, { name, description: "E2E" });
    if (r.status === 201) {
      // Засвараас өмнө үүссэн бол: нэрийг нь солиод устгана (админ нэртэй роль устгагдахгүй).
      cleanup.push(async () => {
        await call(T.admin, "PUT", `/roles/${r.data.id}`, { name: `e2e_tmp_${Date.now()}` });
        await call(T.admin, "DELETE", `/roles/${r.data.id}`);
      });
    }
    assert.ok(rejected(r), `"${name}" нэртэй роль үүсгэх: ${show(r)}`);
  }
  const tmp = await call(T.admin, "POST", `/roles`, { name: "e2e_role_rename", description: "E2E" });
  assert.equal(tmp.status, 201, show(tmp));
  cleanup.push(async () => {
    await call(T.admin, "PUT", `/roles/${tmp.data.id}`, { name: "e2e_role_rename" });
    await call(T.admin, "DELETE", `/roles/${tmp.data.id}`);
  });
  let r = await call(T.admin, "PUT", `/roles/${tmp.data.id}`, { name: "admin" });
  assert.ok(rejected(r), `роль admin болгож нэрлэх: ${show(r)}`);

  const roles = (await call(T.admin, "GET", `/roles`)).data;
  const adminRole = roles.find((x) => x.name === "admin");
  r = await call(T.admin, "PUT", `/roles/${adminRole.id}`, { name: "admin_renamed", description: adminRole.description });
  if (r.status === 200) cleanup.push(() => call(T.admin, "PUT", `/roles/${adminRole.id}`, { name: "admin", description: adminRole.description }));
  assert.ok(rejected(r), `admin ролийн нэр солих: ${show(r)}`);
});

test("H4 админ ролийг зөвхөн админ олгоно", { skip }, async () => {
  const roles = (await call(T.admin, "GET", `/roles`)).data;
  const adminRole = roles.find((x) => x.name === "admin");
  const users = (await call(T.admin, "GET", `/users?search=ganbaatar`)).data ?? [];
  const target = (Array.isArray(users) ? users : users.items ?? []).find((u) => u.username === "ganbaatar");
  assert.ok(target, "ganbaatar хэрэглэгч олдсонгүй");
  const r = await call(T.darga, "POST", `/users/${target.id}/roles`, { role_id: String(adminRole.id) });
  if (r.status === 200) cleanup.push(() => call(T.admin, "DELETE", `/users/${target.id}/roles/${adminRole.id}`));
  assert.equal(r.status, 403, `хэлтсийн дарга админ роль олгох: ${show(r)}`);
});

// ── H16 нөхөн төлбөрийн нийт жагсаалт ────────────────────────────────────────
test("H16 нөхөн төлбөрийн нийт жагсаалтын API байхгүй", { skip }, async () => {
  const r = await call(T.ahlah, "GET", `/compensations`);
  assert.equal(r.status, 404, show(r));
});

// ── H6 нэгж талбарын явц (сүүлд: төлөв өөрчилдөг тул) ────────────────────────
test("H6 өөр чөлөөлөлтийн нэгж талбарын явцыг солихгүй", { skip }, async () => {
  const r = await call(T.ahlah, "PATCH", `/land-acquisitions/${ACQ}/parcels/${T.pB.id}/status`, { status_id: Number(T.pB.status), reason: "E2E" });
  assert.ok(denied(r), show(r));
});

test("H6 урсгалд байхгүй шилжилт хийгдэхгүй, админ дурын төлөвт шилжүүлнэ", { skip }, async () => {
  // P1 нь 104 төлөвтэй; урсгалд 104 → 104 шилжилт байхгүй (зөвхөн 103, 105).
  // Төлөв бодитоор өөрчлөгдөхгүй тул туршилтын өгөгдөл эвдрэхгүй.
  const before = (await call(T.admin, "GET", `/land-acquisitions/${ACQ}/parcels/${P1.id}`)).data;
  const current = Number(before?.status_id ?? before?.status);
  assert.equal(current, 104, "P1 нь 104 төлөвтэй байх ёстой (өмнөх ажиллуулалтын үлдэгдэл?)");
  const avail = await call(T.ahlah, "GET", `/land-acquisitions/${ACQ}/parcels/${P1.id}/available-statuses`);
  const allowed = new Set((avail.data ?? []).map((s) => Number(s.id)));
  for (const target of [101, 104]) {
    assert.ok(!allowed.has(target), `${target} урсгалд байх ёсгүй`);
    const r = await call(T.ahlah, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P1.id}/status`, { status_id: target, reason: "E2E" });
    if (r.status === 200) cleanup.push(() => call(T.admin, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P1.id}/status`, { status_id: 104, reason: "E2E сэргээв" }));
    assert.ok(rejected(r), `ахлах урсгалд байхгүй ${target} рүү: ${show(r)}`);
  }
  // Админ урсгалд байхгүй шилжилт хийнэ (104 → 104 — төлөв өөрчлөгдөхгүй).
  // ЖИЧ: энэ нь parcel_status_history-д "E2E админ" шалтгаантай НЭГ мөр үлдээнэ
  // (түүхийг API-аар устгах боломжгүй).
  const a = await call(T.admin, "PATCH", `/land-acquisitions/${ACQ}/parcels/${P1.id}/status`, { status_id: 104, reason: "E2E админ" });
  assert.equal(a.status, 200, `админ урсгалд байхгүй шилжилт: ${show(a)}`);
});

test("цэвэрлэгээ", { skip }, async () => {
  for (const fn of cleanup.reverse()) {
    try { await fn(); } catch { /* дараагийнхыг үргэлжлүүлнэ */ }
  }
});
