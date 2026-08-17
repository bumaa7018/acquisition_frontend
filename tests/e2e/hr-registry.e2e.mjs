import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/v1`;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const shortSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();

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

async function loginAny(username, passwords) {
  let lastStatus = 0;
  for (const password of passwords) {
    const { res, json } = await request("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    if (res.status === 200) return json.data.access_token;
    lastStatus = res.status;
  }
  assert.fail(`login failed for ${username}: ${lastStatus}`);
}

async function expectStatus(token, method, path, body, status) {
  const { res } = await request(path, { token, method, body });
  assert.equal(res.status, status, `${method} ${path} expected ${status}, got ${res.status}`);
}

async function resetSeedPassword(adminToken, search, password) {
  const { res, json } = await request(`/users?search=${encodeURIComponent(search)}`, { token: adminToken });
  assert.equal(res.status, 200);
  const user = (json.data ?? [])[0];
  assert.ok(user, `seed user not found: ${search}`);
  const changed = await request(`/users/${user.id}/password`, {
    token: adminToken,
    method: "PUT",
    body: { password },
  });
  assert.equal(changed.res.status, 200);
  return user;
}

test("authdb HR chain happy path, business rules, permissions", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const created = { org: null, dep: null, pos: null, person: null, emp: null, user: null };

  try {
    let out = await request("/organizations", {
      token: admin,
      method: "POST",
      body: { name: `E2E байгууллага ${suffix}`, register_no: `E2E-ORG-${suffix}` },
    });
    assert.equal(out.res.status, 201);
    created.org = out.json.data;

    out = await request("/departments", {
      token: admin,
      method: "POST",
      body: { organization_id: created.org.id, name: `E2E хэлтэс ${suffix}`, code: `D-${suffix}` },
    });
    assert.equal(out.res.status, 201);
    created.dep = out.json.data;

    out = await request("/positions", {
      token: admin,
      method: "POST",
      body: { name: `E2E албан тушаал ${suffix}`, code: `P-${suffix}` },
    });
    assert.equal(out.res.status, 201);
    created.pos = out.json.data;

    out = await request("/persons", {
      token: admin,
      method: "POST",
      body: { person_type: "citizen", register_no: `E2${shortSuffix}`, last_name: "E2E", first_name: `Иргэн ${suffix}` },
    });
    assert.equal(out.res.status, 201);
    created.person = out.json.data;

    out = await request("/employees", {
      token: admin,
      method: "POST",
      body: {
        person_id: created.person.id,
        organization_id: created.org.id,
        department_id: created.dep.id,
        position_id: created.pos.id,
      },
    });
    assert.equal(out.res.status, 201);
    created.emp = out.json.data;
    assert.equal(created.emp.person_id, created.person.id);

    out = await request("/users", {
      token: admin,
      method: "POST",
      body: {
        username: `e2e_${suffix.replaceAll("-", "_")}`,
        email: `e2e-${suffix}@example.mn`,
        password: "Password123!",
        employee_id: created.emp.id,
      },
    });
    assert.equal(out.res.status, 201);
    created.user = out.json.data;
    assert.equal(created.user.employee_id, created.emp.id);

    out = await request(`/employees/${created.emp.id}`, { token: admin });
    assert.equal(out.res.status, 200);
    assert.equal(out.json.data.person_id, created.person.id);

    await expectStatus(admin, "POST", "/users", {
      username: `noemp_${suffix.replaceAll("-", "_")}`,
      email: `noemp-${suffix}@example.mn`,
      password: "Password123!",
    }, 400);

    await expectStatus(admin, "POST", "/employees", {
      organization_id: created.org.id,
      position_id: created.pos.id,
    }, 400);

    await expectStatus(admin, "POST", "/users", {
      username: `dupemp_${suffix.replaceAll("-", "_")}`,
      email: `dupemp-${suffix}@example.mn`,
      password: "Password123!",
      employee_id: created.emp.id,
    }, 409);

    await expectStatus(admin, "DELETE", `/persons/${created.person.id}`, null, 409);

    const txRegister = `TX${shortSuffix}`;
    const badPositionID = "00000000-0000-0000-0000-000000000404";
    const tx = await request("/users", {
      token: admin,
      method: "POST",
      body: {
        username: `tx_${suffix.replaceAll("-", "_")}`,
        email: `tx-${suffix}@example.mn`,
        password: "Password123!",
        employee: {
          organization_id: created.org.id,
          position_id: badPositionID,
          person: { person_type: "citizen", register_no: txRegister, last_name: "Rollback", first_name: "Person" },
        },
      },
    });
    assert.ok([400, 404].includes(tx.res.status), `bad chain expected 400/404, got ${tx.res.status}`);
    out = await request(`/persons?search=${encodeURIComponent(txRegister)}`, { token: admin });
    assert.equal(out.res.status, 200);
    assert.equal((out.json.data ?? []).length, 0);

    const financeUser = await resetSeedPassword(admin, "finance", "Password123!");
    const profUser = await resetSeedPassword(admin, "professional_primary", "Password123!");

    for (const [username, password] of [
      ["employee@example.com", "Employee123!"],
      [financeUser.username || financeUser.email, "Password123!"],
      [profUser.username || profUser.email, "Password123!"],
    ]) {
      const token = await login(username, password);
      await expectStatus(token, "GET", "/organizations", null, 403);
      await expectStatus(token, "POST", "/organizations", { name: `deny ${suffix}` }, 403);
      await expectStatus(token, "PUT", `/organizations/${created.org.id}`, { name: `deny ${suffix}` }, 403);
      await expectStatus(token, "DELETE", `/organizations/${created.org.id}`, null, 403);
    }
  } finally {
    if (created.user) await request(`/users/${created.user.id}`, { token: admin, method: "DELETE" });
    if (created.emp) await request(`/employees/${created.emp.id}`, { token: admin, method: "DELETE" });
    if (created.person) await request(`/persons/${created.person.id}`, { token: admin, method: "DELETE" });
    if (created.dep) await request(`/departments/${created.dep.id}`, { token: admin, method: "DELETE" });
    if (created.pos) await request(`/positions/${created.pos.id}`, { token: admin, method: "DELETE" });
    if (created.org) await request(`/organizations/${created.org.id}`, { token: admin, method: "DELETE" });
  }
});
