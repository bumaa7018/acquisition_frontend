// Чөлөөлөлтийн ХИЛ нь ТӨЛӨВЛӨГӨӨНИЙ хилээс хуулагдаж байгааг батлах e2e тест.
//
// Юуг батлах вэ:
//   1. Чөлөөлөлт ҮҮСГЭХЭД гараас shapefile авахгүй — backend нь дундын
//      сервисээс (/plan/project) төлөвлөгөөг ТАТАЖ, түүний хилийг
//      чөлөөлөлтийн хил болгож хадгална.
//   2. Хил ЗАСАХАД төлөвлөгөөний дугаараар ДАХИН хайж, олдсон төлөвлөгөөний
//      хилийг шинэ хил болгож тохируулна.
//   3. Төлөвлөгөөнд хил байхгүй бол үүсгэх/солих аль аль нь 422-оор зогсоно.
//   4. Хуучин клиент shapefile илгээсэн ч ҮЛ ХЭРЭГСЭГДЭНЭ (хил төлөвлөгөөнийх).
//   5. Хил солиход нэгж талбарын өөрчлөлтийн ХУУЧИН ФЛОВ хэвээр: давхцах
//      талбар нэмэгдэх, гадна хоцорсон нь бүрмөсөн устах, түүх бичигдэх,
//      "Чөлөөлсөн" талбар гадна гарвал хил ХҮЛЭЭГДЭХГҮЙ.
//
// Тест нь бүх хамаарлаа ӨӨРӨӨ асаана:
//   - ХУУРАМЧ дундын сервис (/plan/project, /parcels/by/acquisition) — Node
//     сервер. Ингэснээр "төлөвлөгөөний хил ТАТАГДСАН уу" гэдгийг хүсэлтийн
//     тоогоор шууд шалгана.
//   - API-г өөрөө build хийж, тусдаа порт дээр асаана (MIDDLEWARE_BASE_URL нь
//     хуурамч сервис рүү заасан).
//
// Урьдчилсан нөхцөл: Postgres (appdb/authdb) асаалттай, ../government дээр
// .env бэлэн байх.
//
// Ажиллуулах:
//   node --test tests/e2e/acquisition-plan-boundary.e2e.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = process.env.E2E_BACKEND_DIR ?? path.resolve(HERE, "../../../government");
const API_PORT = Number(process.env.E2E_API_PORT ?? 8099);
const API = `http://127.0.0.1:${API_PORT}/api/v1`;
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "admin@example.com";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? "Admin123!";

const suffix = `${Date.now()}`.slice(-8);
const PLAN_A = `E2E-PLAN-A-${suffix}`;
const PLAN_B = `E2E-PLAN-B-${suffix}`;
const PLAN_C = `E2E-PLAN-C-${suffix}`;
const PLAN_NO_GEOM = `E2E-PLAN-NOGEOM-${suffix}`;

// ── ../government/.env уншилт (DB холболтод) ────────────────────────────────
function loadBackendEnv() {
  const file = path.join(BACKEND_DIR, ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const backendEnv = loadBackendEnv();
const pool = new Pool({
  host: process.env.DB_HOST ?? backendEnv.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? backendEnv.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? backendEnv.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? backendEnv.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? backendEnv.DB_NAME ?? "appdb",
  connectionTimeoutMillis: 5_000,
  max: 2,
});

// ── ХУУРАМЧ дундын сервис (ГУС) ─────────────────────────────────────────────
//
// ГУС-ийн холболт байхгүй тул түр МОК ашиглана. Мокийн өгөгдөл нь зохиомол
// БИШ — appdb дээр аль хэдийн байгаа БОДИТ дата:
//   - /plan/project      → plan.boundary_wkt (өмнө нь ГУС-аас татагдсан хил)
//   - /parcels/by/acquisition → parcel.geometry (бодит нэгж талбарууд)
// Ингэснээр тест нь бодит геометрийн хэмжээ/байрлалтай ажиллана.
/** code → { geometry_wkt } . Хоосон хилтэй төлөвлөгөө ч энд бүртгэгдэнэ. */
const plans = new Map();
/** Аль төлөвлөгөө хэдэн удаа ТАТАГДСАНЫГ тоолно (хил татагдсаны БАТАЛГАА). */
const planFetches = [];
/** Нэгж талбарын дуудлага бүрийн (limit, after, буцаасан мөр) — дибаг. */
const parcelCalls = [];
let middleware;
let middlewareURL;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Мок ГУС-ийн буцаах нэгж талбарууд.
 *
 * ГЕОМЕТР нь бодит: төлөвлөгөөний хилийн (appdb) координатаас гаргасан жижиг
 * талбайнууд. ДУГААР нь тестийн (ажиллуулалт тутам шинэ) — `parcel.parcel_id`
 * нь ГЛОБАЛ unique тул бодит дугаар хэрэглэвэл "өөр чөлөөлөлтөд бүртгэлтэй"
 * гэж алгасагдаж, бүртгэх/устгах урсгал шалгагдахгүй байсан.
 */
let sourceParcels = [];

/**
 * ГУС-ийн "хилээр нэгж талбар хайх" дуудлагын МОК.
 *
 * Дундын сервисийн гэрээ: parcel_id-аар эрэмбэлж, `after`-оос ХОЙШХИ хамгийн
 * ихдээ `limit` мөр буцаана (backend багцаар дуудна). Давхцлыг PostGIS-ээр
 * бодитоор шалгана — өгсөн хилтэй давхцахгүй талбар хэзээ ч буцахгүй.
 */
async function parcelsByAcquisition({ geometry, limit = 100, after = "" }) {
  if (!geometry || sourceParcels.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT t.id
       FROM unnest($2::text[], $3::text[]) AS t(id, wkt)
      WHERE t.id > $4
        AND ST_Intersects(ST_GeomFromText(t.wkt, 4326), ST_GeomFromText($1, 4326))
      ORDER BY t.id
      LIMIT $5`,
    [
      geometry,
      sourceParcels.map((p) => p.parcel_id),
      sourceParcels.map((p) => p.geometry_wkt),
      after,
      limit,
    ],
  );
  const byID = new Map(sourceParcels.map((p) => [p.parcel_id, p]));
  return rows.map((r) => byID.get(r.id)).filter(Boolean);
}

/**
 * Мокийн нэгж талбаруудыг хилийн БОДИТ координатаас бүтээнэ:
 *   - "core"  — хилийн дотоод цэг дээрх жижиг талбай (жижиг хил дотор ч үлдэнэ)
 *   - "edge"  — хилийн ринг дээрх цэгүүд (хил агшихад ГАДНА хоцорно)
 * Ингэснээр хил солиход НЭМЭГДЭХ ба ХАСАГДАХ урсгал хоёулаа шалгагдана.
 */
async function buildSourceParcels(boundaryWKT, idPrefix) {
  const { rows } = await pool.query(
    `WITH b AS (SELECT ST_MakeValid(ST_GeomFromText($1, 4326)) AS geom),
     poly AS (SELECT ST_GeometryN(ST_Multi(geom), 1) AS geom FROM b),
     ring AS (SELECT ST_ExteriorRing(geom) AS r FROM poly),
     pts AS (
       SELECT 0 AS idx, ST_PointOnSurface(geom) AS pt FROM poly
       UNION ALL
       SELECT n, ST_PointN(r, n)
         FROM ring, generate_series(1, LEAST(ST_NPoints(r) - 1, 4)) AS n
     )
     SELECT idx, ST_AsText(ST_Buffer(pt::geography, 10)::geometry) AS wkt
       FROM pts ORDER BY idx`,
    [boundaryWKT],
  );
  // AU код/зориулалтыг бодит талбараас зээлнэ (байхгүй бол хоосон).
  const { rows: sample } = await pool.query(
    `SELECT COALESCE(au1_code,'') AS au1_code, COALESCE(au2_code,'') AS au2_code,
            COALESCE(au3_code,'') AS au3_code, COALESCE(landuse,'') AS landuse
       FROM parcel WHERE geometry IS NOT NULL AND deleted_at IS NULL
        AND ST_Intersects(geometry, ST_GeomFromText($1, 4326)) LIMIT 1`,
    [boundaryWKT],
  );
  const au = sample[0] ?? { au1_code: "", au2_code: "", au3_code: "", landuse: "" };

  return rows.map((r) => ({
    parcel_id: `${idPrefix}${String(r.idx).padStart(2, "0")}`,
    geometry_wkt: r.wkt,
    kind: r.idx === 0 ? "core" : "edge",
    area_m2: 314,
    right_type: 1,
    ...au,
  }));
}

function startMiddleware() {
  return new Promise((resolve) => {
    middleware = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const json = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };

      if (req.method === "GET" && url.pathname === "/plan/project") {
        const code = url.searchParams.get("code") ?? "";
        planFetches.push(code);
        const plan = plans.get(code);
        if (!plan) return json(404, { data: null });
        return json(200, {
          data: {
            parcel_id: code,
            project_id: "E2E-PRJ",
            code,
            name: `E2E төлөвлөгөө ${code}`,
            plan_type_name: "Хэсэгчилсэн ерөнхий төлөвлөгөө",
            gazner: "E2E бүтээн байгуулалт",
            geometry_wkt: plan.geometry_wkt,
            approved_date: "2026-01-01",
          },
        });
      }

      // Хил солиход backend нь ШИНЭ хилээр нэгж талбар татдаг.
      if (req.method === "POST" && url.pathname === "/parcels/by/acquisition") {
        readBody(req)
          .then((raw) => {
            const payload = JSON.parse(raw || "{}");
            return parcelsByAcquisition(payload).then((rows) => {
              parcelCalls.push({
                geometry: payload.geometry,
                limit: payload.limit,
                after: payload.after,
                returned: rows.length,
              });
              return rows;
            });
          })
          .then((rows) => json(200, { data: rows }))
          .catch((err) => json(500, { data: null, error: String(err) }));
        return;
      }

      req.resume();
      return json(404, { data: null });
    });
    middleware.listen(0, "127.0.0.1", () => {
      middlewareURL = `http://127.0.0.1:${middleware.address().port}`;
      resolve();
    });
  });
}

// ── API процесс ─────────────────────────────────────────────────────────────
let api;
const apiLog = [];

async function waitForApi(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (api?.exitCode != null) {
      throw new Error(`API процесс унав (code=${api.exitCode}):\n${apiLog.join("")}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/health`);
      if (res.ok) return;
    } catch {
      // хараахан асаагүй
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API ${timeoutMs}ms дотор асаагүй:\n${apiLog.join("")}`);
}

function startApi() {
  // ЯАГААД урьдчилж BUILD хийж байна: `go run` нь СЕРВЕРИЙГ ӨӨР процессоор
  // ажиллуулдаг тул `go run`-ыг алахад сервер амьд үлдэж, портыг барьсаар
  // байдаг (дараагийн ажиллуулалт хуучин процесс руу орж, тест хуурамчаар
  // өнгөрөх/гацах эрсдэлтэй). Бинарыг шууд асаавал ална гэдэг нь ална.
  const outDir = mkdtempSync(path.join(os.tmpdir(), "e2e-api-"));
  const bin = path.join(outDir, "api");
  const build = spawnSync("go", ["build", "-o", bin, "./cmd/api"], {
    cwd: BACKEND_DIR,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, `API build амжилтгүй:\n${build.stderr}`);

  // godotenv нь БАЙГАА орчны хувьсагчийг дарж бичдэггүй тул эндээс дамжуулсан
  // утга .env-ийнхээс давуу болно.
  api = spawn(bin, [], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      APP_PORT: String(API_PORT),
      APP_BASE_URL: `http://127.0.0.1:${API_PORT}`,
      MIDDLEWARE_BASE_URL: middlewareURL,
      LOG_LEVEL: process.env.E2E_API_LOG ?? "warn",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const keep = (chunk) => {
    apiLog.push(chunk.toString());
    if (apiLog.length > 200) apiLog.shift();
  };
  api.stdout.on("data", keep);
  api.stderr.on("data", keep);
}

// ── HTTP туслахууд ──────────────────────────────────────────────────────────
let token;

async function request(path, { method = "GET", body, form } = {}) {
  const headers = { "Accept-Language": "mn" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { res, json };
}

/** ST_Equals — WKT текст normalize болдог тул утгыг ГЕОМЕТРЭЭР харьцуулна. */
async function geomEquals(a, b) {
  const { rows } = await pool.query(
    "SELECT ST_Equals(ST_GeomFromText($1, 4326), ST_GeomFromText($2, 4326)) AS eq",
    [a, b],
  );
  return rows[0].eq === true;
}

/**
 * Мокийн төлөвлөгөөний хилийг appdb-ийн БОДИТ өгөгдлөөс гаргаж авна.
 *
 * Эрэмбэ:
 *   1. `plan.boundary_wkt` — өмнө нь ЖИНХЭНЭ ГУС-аас татагдаж хадгалагдсан
 *      төлөвлөгөөний хил. Нэгж талбартай давхцаж буйг нь эхэнд тавина
 *      (хил солиход бодит талбар татагдаж, урсгал бүрэн шалгагдана).
 *   2. Тийм мөр байхгүй бол `au2` лавлахаас нэг сум/дүүрэгт багтах полигон.
 *   3. Аль нь ч байхгүй бол (лавлах ачаалагдаагүй — backend шалгалтыг
 *      алгасдаг) Улаанбаатар орчмын тогтмол полигон.
 *
 * Буцаах: { primary, shrunk } — "хил солих" урсгалд ХОЁР ялгаатай хил
 * шаардлагатай тул хоёр дахийг нь эхнийхээс агшаах замаар гаргана (жинхэнэ
 * хилтэй ижил байрлалд үлдэнэ).
 */
async function loadBoundariesFromDb() {
  const { rows: real } = await pool.query(
    `SELECT ST_AsText(p.boundary_wkt) AS wkt,
            (SELECT count(*) FROM parcel pa
              WHERE pa.geometry IS NOT NULL AND pa.deleted_at IS NULL
                AND ST_Intersects(pa.geometry, p.boundary_wkt))::int AS parcels
       FROM plan p
      WHERE p.boundary_wkt IS NOT NULL
        AND p.plan_code NOT LIKE 'E2E-%'
      ORDER BY 2 DESC, ST_Area(p.boundary_wkt) DESC
      LIMIT 1`,
  );
  let primary = real[0]?.wkt ?? null;
  let source = primary ? `plan (бодит ГУС хил, ${real[0].parcels} нэгж талбар)` : null;

  if (!primary) {
    const { rows } = await pool.query(
      `WITH cand AS (
         SELECT ST_MakeValid(geometry) AS geom,
                ST_Buffer(ST_PointOnSurface(ST_MakeValid(geometry))::geography, 250)::geometry AS g
         FROM au2 WHERE geometry IS NOT NULL
       )
       SELECT ST_AsText(g) AS wkt FROM cand WHERE ST_CoveredBy(g, geom) LIMIT 1`,
    );
    primary = rows[0]?.wkt ?? null;
    if (primary) source = "au2 лавлах";
  }

  if (!primary) {
    primary = "POLYGON((106.900000 47.900000,106.902252 47.900000,106.902252 47.902252,106.900000 47.902252,106.900000 47.900000))";
    source = "тогтмол (лавлах өгөгдөл олдсонгүй)";
  }

  // Хоёр дахь хил: эхнийхээ ДОТООД хэсэг. Агшаалт хоосон/олон хэсэгтэй
  // болвол (нарийн хил) масштаблах аргад шилжинэ.
  const { rows: shrunkRows } = await pool.query(
    `WITH g AS (SELECT ST_MakeValid(ST_GeomFromText($1, 4326)) AS geom),
     shrunk AS (
       SELECT CASE
                WHEN ST_GeometryType(ST_Buffer(geom, -0.00015)) = 'ST_Polygon'
                     AND NOT ST_IsEmpty(ST_Buffer(geom, -0.00015))
                THEN ST_Buffer(geom, -0.00015)
                -- Агшаалт нурвал (нарийн/эвдэрсэн хил): хилийн ДОТОР талын
                -- цэгээс татсан тойрог — бодит хэмжээнээсээ гаргана.
                ELSE ST_Buffer(
                       ST_PointOnSurface(geom)::geography,
                       GREATEST(sqrt(ST_Area(geom::geography)) / 4, 20)
                     )::geometry
              END AS g
       FROM g
     )
     SELECT ST_AsText(g) AS wkt FROM shrunk`,
    [primary],
  );
  const shrunk = shrunkRows[0].wkt;
  assert.ok(shrunk, "хоёр дахь туршилтын хил гаргаж чадсангүй");
  console.log(`# туршилтын хилийн эх сурвалж: ${source}`);
  return { primary, shrunk };
}

function acquisitionForm(fields, file) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("shapefile", new Blob([file.data]), file.name);
  return fd;
}

let boundaryA;
let boundaryB;
let boundaryC;
let acquisitionId;

/** Тухайн хилтэй давхцах мокийн талбарын дугаарууд. */
async function expectedParcelIDs(boundaryWKT) {
  const rows = await parcelsByAcquisition({ geometry: boundaryWKT, limit: 1000 });
  return rows.map((r) => r.parcel_id).sort();
}

/** Чөлөөлөлтөд БҮРТГЭЛТЭЙ (устгагдаагүй) нэгж талбарын дугаарууд. */
async function registeredParcelIDs() {
  const { rows } = await pool.query(
    `SELECT parcel_id FROM parcel
      WHERE acquisition_id = $1 AND deleted_at IS NULL ORDER BY parcel_id`,
    [acquisitionId],
  );
  return rows.map((r) => r.parcel_id);
}

before(async () => {
  await startMiddleware();
  const boundaries = await loadBoundariesFromDb();
  boundaryA = boundaries.primary;
  boundaryB = boundaries.shrunk;
  assert.ok(!(await geomEquals(boundaryA, boundaryB)), "хоёр туршилтын хил ЯЛГААТАЙ байх ёстой");

  // Гурав дахь хил — B-ийн ДОТОРХ жижиг тойрог. Хил АГШИХАД нэгж талбар
  // хасагдах урсгалыг шалгахад хэрэглэнэ.
  const { rows: cRows } = await pool.query(
    `WITH g AS (SELECT ST_MakeValid(ST_GeomFromText($1, 4326)) AS geom)
     SELECT ST_AsText(
              ST_Buffer(
                ST_PointOnSurface(geom)::geography,
                GREATEST(sqrt(ST_Area(geom::geography)) / 6, 30)
              )::geometry
            ) AS wkt
       FROM g`,
    [boundaryB],
  );
  boundaryC = cRows[0].wkt;

  plans.set(PLAN_A, { geometry_wkt: boundaryA });
  plans.set(PLAN_B, { geometry_wkt: boundaryB });
  plans.set(PLAN_C, { geometry_wkt: boundaryC });
  plans.set(PLAN_NO_GEOM, { geometry_wkt: "" });

  // Мокийн нэгж талбарууд — B хилийн координатаас. Хил B → C болоход
  // "edge" талбарууд гадна хоцорч ХАСАГДАХ ёстой.
  sourceParcels = await buildSourceParcels(boundaryB, suffix);
  assert.ok(sourceParcels.length >= 2, "мокийн нэгж талбар бүтээгдсэнгүй");
  const inB = await expectedParcelIDs(boundaryB);
  const inC = await expectedParcelIDs(boundaryC);
  assert.ok(inB.length > inC.length, "жижиг хилээс гарах талбар байх ёстой (тестийн бэлтгэл)");
  assert.ok(inC.length > 0, "жижиг хилд үлдэх талбар байх ёстой (тестийн бэлтгэл)");

  startApi();
  await waitForApi();

  const { res, json } = await request("/auth/login", {
    method: "POST",
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  assert.equal(res.status, 200, `нэвтрэлт амжилтгүй: ${res.status} ${JSON.stringify(json)}`);
  token = json.data.access_token;
});

after(async () => {
  if (acquisitionId) {
    await request(`/land-acquisitions/${acquisitionId}`, { method: "DELETE" });
  }
  if (process.env.E2E_DEBUG) {
    console.log("# ── API лог ──\n" + apiLog.join(""));
    console.log("# ── мок ГУС: нэгж талбарын дуудлага ──\n" + JSON.stringify(parcelCalls, null, 1));
  }
  api?.kill("SIGKILL");
  for (let i = 0; i < 20 && api?.exitCode == null && api?.signalCode == null; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  middleware?.close();
  // Тестийн нэгж талбарууд — хүү мөрүүд нь ON DELETE CASCADE тул хамт устна.
  if (sourceParcels.length > 0) {
    await pool.query(`DELETE FROM parcel WHERE parcel_id = ANY($1::text[])`, [
      sourceParcels.map((p) => p.parcel_id),
    ]);
  }
  // Тестийн чөлөөлөлт/төлөвлөгөөг цэвэрлэнэ. API-ийн устгалт нь SOFT тул
  // мөрүүд үлддэг — тестийн өгөгдөл хуримтлагдахаас сэргийлж эндээс хатуу
  // устгана (хүү хүснэгтүүд ON DELETE CASCADE).
  await pool.query(`DELETE FROM land_acquisition WHERE plan_code LIKE 'E2E-PLAN-%'`);
  await pool.query(
    `DELETE FROM plan
      WHERE plan_code LIKE 'E2E-PLAN-%'
        AND NOT EXISTS (SELECT 1 FROM land_acquisition la WHERE la.plan_id = plan.id)`,
  );
  await pool.end();
});

// ── 1. Үүсгэх: хил нь ТӨЛӨВЛӨГӨӨНӨӨС татагдана ─────────────────────────────

test("чөлөөлөлт үүсгэхэд төлөвлөгөөний хил татагдаж, чөлөөлөлтийн хил болно", async () => {
  const before = planFetches.filter((c) => c === PLAN_A).length;

  const { res, json } = await request("/land-acquisitions", {
    method: "POST",
    form: acquisitionForm({
      plan_parcel_id: PLAN_A,
      start_date: "2026-01-01",
      acquisition_name: `E2E чөлөөлөлт ${suffix}`,
    }),
  });

  assert.equal(res.status, 201, `үүсгэх амжилтгүй: ${res.status} ${JSON.stringify(json)}`);
  acquisitionId = json.data.id;

  // Хил ТАТАГДСАН эсэх — дундын сервис рүү тэр дугаараар хүсэлт очсон байна.
  assert.ok(
    planFetches.filter((c) => c === PLAN_A).length > before,
    "төлөвлөгөө дундын сервисээс татагдаагүй байна",
  );

  // Хадгалагдсан хил нь ТӨЛӨВЛӨГӨӨНИЙ хилтэй ЯГ ижил.
  assert.ok(json.data.geometry_wkt, "чөлөөлөлт хилгүй бүртгэгдэв");
  assert.ok(
    await geomEquals(json.data.geometry_wkt, boundaryA),
    "чөлөөлөлтийн хил төлөвлөгөөний хилтэй тэнцэхгүй байна",
  );
  // Талбай нь тэр хилээс автоматаар тооцогдоно.
  assert.ok(json.data.area_m2 > 0, "талбай хилээс тооцогдоогүй");
});

test("хадгалагдсан хил ба төлөвлөгөөний хил хоёулаа DB-д бичигдэнэ", async () => {
  const { rows } = await pool.query(
    `SELECT ST_AsText(geometry) AS geom, ST_AsText(plan_geom) AS plan_geom
       FROM land_acquisition WHERE id = $1`,
    [acquisitionId],
  );
  assert.equal(rows.length, 1);
  assert.ok(await geomEquals(rows[0].geom, boundaryA));
  assert.ok(
    await geomEquals(rows[0].plan_geom, boundaryA),
    "plan_geom нь төлөвлөгөөний хилээр дүүрсэн байх ёстой",
  );
});

// ── 2. Хил засах: төлөвлөгөөний дугаараар ДАХИН хайж, шинэ хилээр солино ────

test("хил засахад төлөвлөгөөг дугаараар дахин хайж, түүний хилээр солино", async () => {
  const before = planFetches.filter((c) => c === PLAN_B).length;

  const { res, json } = await request(`/land-acquisitions/${acquisitionId}`, {
    method: "PUT",
    form: acquisitionForm({
      acquisition_name: `E2E чөлөөлөлт ${suffix}`,
      plan_parcel_id: PLAN_B,
    }),
  });

  assert.equal(res.status, 200, `засах амжилтгүй: ${res.status} ${JSON.stringify(json)}`);
  assert.ok(
    planFetches.filter((c) => c === PLAN_B).length > before,
    "шинэ төлөвлөгөө дундын сервисээс татагдаагүй байна",
  );
  assert.ok(
    await geomEquals(json.data.geometry_wkt, boundaryB),
    "чөлөөлөлтийн хил шинэ төлөвлөгөөний хилээр солигдоогүй",
  );
  // ХУУЧИН ФЛОВ хэвээр: хил солиход шинэ хилтэй давхцах нэгж талбар
  // НЭМЭГДЭЖ, хариултад тоо гарна (дэлгэц үүнийг toast-оор харуулдаг).
  const expectedAdded = (await expectedParcelIDs(boundaryB)).length;
  assert.equal(
    json.data.added_parcels ?? 0,
    expectedAdded,
    "шинэ хилээр нэмэгдсэн нэгж талбарын тоо таарсангүй",
  );
  assert.equal(json.data.removed_parcels ?? 0, 0, "эхний хил солилтод хасагдах талбар байх ёсгүй");
  assert.ok(json.data.warning, "хил солигдсон тухай анхааруулга буцаагдаагүй");

  const { rows } = await pool.query(
    `SELECT plan_code, ST_AsText(geometry) AS geom, ST_AsText(plan_geom) AS plan_geom
       FROM land_acquisition WHERE id = $1`,
    [acquisitionId],
  );
  assert.equal(rows[0].plan_code, PLAN_B, "төлөвлөгөөний дугаар шинэчлэгдээгүй");
  assert.ok(await geomEquals(rows[0].geom, boundaryB));
  assert.ok(await geomEquals(rows[0].plan_geom, boundaryB));
});

// Хуулж авсан хил нь зөвхөн хадгалагдаад зогсохгүй, нэгж талбар ТАТАХАД
// ашиглагдана: ГУС (мок) руу яг ТЭР хилээр хайлт явсан байх ёстой.
test("нэгж талбарын хайлт хуулсан ХИЛЭЭР явна", async () => {
  assert.ok(parcelCalls.length > 0, "хил солиход нэгж талбарын хайлт огт хийгдээгүй");

  // Хайлт бүрийн геометр нь ШИНЭ (хуулсан) хилтэй тэнцүү байх ёстой —
  // хуучин хилээр эсвэл өөр геометрээр хайсан бол энэ тест барина.
  for (const call of parcelCalls) {
    assert.ok(
      await geomEquals(call.geometry, boundaryB),
      "нэгж талбарын хайлт төлөвлөгөөнөөс хуулсан хилээр хийгдээгүй",
    );
  }
  // Хилтэй давхцах бодит талбар байсан эсэхийг мок өөрөө баталгаажуулна.
  assert.ok(
    parcelCalls.some((c) => c.returned > 0),
    "мок ГУС бодит нэгж талбар буцаасангүй — өгөгдлийн санд давхцах талбар алга",
  );

  // Бүртгэгдсэн талбар бүр шинэ хилтэй давхцсан байна. (parcel_id нь ГЛОБАЛ
  // unique тул өөр чөлөөлөлтөд аль хэдийн бүртгэгдсэн талбар алгасагдана —
  // тиймээс "хэд бүртгэгдэв" биш, "буруу талбар бүртгэгдээгүй"-г шалгана.)
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (
              WHERE geometry IS NOT NULL
                AND NOT ST_Intersects(geometry, ST_GeomFromText($1, 4326))
            )::int AS outside
       FROM parcel WHERE acquisition_id = $2 AND deleted_at IS NULL`,
    [boundaryB, acquisitionId],
  );
  assert.equal(rows[0].outside, 0, "шинэ хилтэй давхцахгүй нэгж талбар бүртгэгдэв");
});

test("хил солиход хилийн ӨӨРЧЛӨЛТИЙН түүх бичигдэнэ", async () => {
  const { res, json } = await request(`/land-acquisitions/${acquisitionId}/boundary-history`);
  assert.equal(res.status, 200);
  const history = json.data ?? [];
  assert.ok(history.length >= 1, "хилийн өөрчлөлтийн түүх бичигдээгүй");
  assert.ok(
    await geomEquals(history[0].new_geometry_wkt, boundaryB),
    "түүхэнд шинэ хил буруу бичигдэв",
  );
  assert.ok(
    await geomEquals(history[0].old_geometry_wkt, boundaryA),
    "түүхэнд хуучин хил буруу бичигдэв",
  );
});

// ── 3. Төлөвлөгөөний дугаар өгөөгүй бол хил ХӨНДӨГДӨХГҮЙ ────────────────────

test("төлөвлөгөөний дугааргүй засварт хил хэвээр үлдэнэ", async () => {
  const before = planFetches.length;

  const { res, json } = await request(`/land-acquisitions/${acquisitionId}`, {
    method: "PUT",
    form: acquisitionForm({
      acquisition_name: `E2E чөлөөлөлт ${suffix} (нэр солив)`,
      reason: "нэр засав",
    }),
  });

  assert.equal(res.status, 200, JSON.stringify(json));
  assert.equal(planFetches.length, before, "хил хөндөөгүй засварт төлөвлөгөө татагдах ёсгүй");
  assert.ok(await geomEquals(json.data.geometry_wkt, boundaryB), "хил санамсаргүй өөрчлөгдөв");
});

// ── 4. Хилгүй төлөвлөгөө — үүсгэх ч, солих ч боломжгүй ──────────────────────

test("хилгүй төлөвлөгөөгөөр чөлөөлөлт үүсгэх боломжгүй (422)", async () => {
  const { res, json } = await request("/land-acquisitions", {
    method: "POST",
    form: acquisitionForm({
      plan_parcel_id: PLAN_NO_GEOM,
      start_date: "2026-01-01",
      acquisition_name: `E2E хилгүй ${suffix}`,
    }),
  });

  assert.equal(res.status, 422, `хилгүй төлөвлөгөө бүртгэгдэв: ${JSON.stringify(json)}`);
  assert.match(json.error ?? json.message ?? "", /хил/i);
});

test("хилгүй төлөвлөгөөгөөр хил солих боломжгүй (422), хуучин хил хэвээр", async () => {
  const { res } = await request(`/land-acquisitions/${acquisitionId}`, {
    method: "PUT",
    form: acquisitionForm({
      acquisition_name: `E2E чөлөөлөлт ${suffix}`,
      plan_parcel_id: PLAN_NO_GEOM,
    }),
  });

  assert.equal(res.status, 422);
  const { rows } = await pool.query(
    "SELECT ST_AsText(geometry) AS geom FROM land_acquisition WHERE id = $1",
    [acquisitionId],
  );
  assert.ok(await geomEquals(rows[0].geom, boundaryB), "амжилтгүй солилт хилийг эвдэв");
});

// ── 5. Хуучин клиентийн shapefile ҮЛ ХЭРЭГСЭГДЭНЭ ──────────────────────────

test("илгээсэн shapefile-ыг үл хэрэгсэж, хилийг төлөвлөгөөнөөс авна", async () => {
  const { res, json } = await request("/land-acquisitions", {
    method: "POST",
    form: acquisitionForm(
      {
        plan_parcel_id: PLAN_A,
        start_date: "2026-01-01",
        acquisition_name: `E2E shapefile үл хэрэгсэх ${suffix}`,
      },
      // Задлагдах боломжгүй хог файл: хилд НӨЛӨӨЛӨХГҮЙ учир алдаа гарах ёсгүй.
      { name: "boundary.zip", data: Buffer.from("not-a-shapefile") },
    ),
  });

  assert.equal(res.status, 201, `shapefile илгээснээс болж унав: ${JSON.stringify(json)}`);
  assert.ok(
    await geomEquals(json.data.geometry_wkt, boundaryA),
    "хил төлөвлөгөөнөөс биш, файлаас авагдав",
  );

  await request(`/land-acquisitions/${json.data.id}`, { method: "DELETE" });
});

// ── 6. Нэгж талбарын өөрчлөлтийн ХУУЧИН ФЛОВ хэвээр эсэх ───────────────────
//
// Хил нь shapefile-аас төлөвлөгөө болж СОЛИГДСОН ч дараах урсгал бүрэн хэвээр
// байх ёстой:
//   а) шинэ хилтэй давхцах нэгж талбар бүртгэгдэх (added)
//   б) шинэ хилд ОРООГҮЙ болсон нь БҮРМӨСӨН устах (removed)
//   в) хилийн өөрчлөлтийн түүх бичигдэх
//   г) "Чөлөөлсөн" талбар шинэ хилээс гарвал хил ХҮЛЭЭГДЭХГҮЙ

test("бүртгэгдсэн нэгж талбарууд шинэ хилээр яг тодорхойлогдоно", async () => {
  const expected = await expectedParcelIDs(boundaryB);
  const registered = await registeredParcelIDs();
  assert.deepEqual(
    registered,
    expected,
    "бүртгэгдсэн нэгж талбарууд шинэ хилтэй давхцахтай таарсангүй",
  );

  // Төлөв бүрд түүх бичигддэг хуучин зан төлөв хэвээр эсэх.
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM parcel_status_history WHERE acquisition_id = $1`,
    [acquisitionId],
  );
  assert.ok(rows[0].n > 0, "шинээр бүртгэгдсэн талбарт төлөвийн түүх бичигдээгүй");
});

test("хил АГШИХАД гадна хоцорсон нэгж талбар бүрмөсөн устана", async () => {
  const beforeIDs = await registeredParcelIDs();
  const stayIDs = await expectedParcelIDs(boundaryC);
  const goneIDs = beforeIDs.filter((id) => !stayIDs.includes(id));
  assert.ok(goneIDs.length > 0, "тестийн бэлтгэл: хасагдах талбар байх ёстой");

  const { res, json } = await request(`/land-acquisitions/${acquisitionId}`, {
    method: "PUT",
    form: acquisitionForm({
      acquisition_name: `E2E чөлөөлөлт ${suffix}`,
      plan_parcel_id: PLAN_C,
    }),
  });

  assert.equal(res.status, 200, `засах амжилтгүй: ${res.status} ${JSON.stringify(json)}`);
  assert.equal(json.data.removed_parcels ?? 0, goneIDs.length, "хасагдсан талбарын тоо таарсангүй");
  assert.equal(json.data.added_parcels ?? 0, 0, "жижиг хилээр шинэ талбар нэмэгдэх ёсгүй");

  // Устгалт нь БҮРМӨСӨН: мөр өөрөө үлдэхгүй (soft delete биш).
  assert.deepEqual(await registeredParcelIDs(), stayIDs);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM parcel WHERE parcel_id = ANY($1::text[])`,
    [goneIDs],
  );
  assert.equal(rows[0].n, 0, "хасагдсан нэгж талбарын мөр устаагүй");

  // Хилийн түүх хоёр дахь бичлэгээ авсан байна.
  const history = (await request(`/land-acquisitions/${acquisitionId}/boundary-history`)).json.data;
  assert.equal(history.length, 2, "хилийн өөрчлөлт бүрд түүх бичигдэх ёстой");
  assert.ok(await geomEquals(history[0].new_geometry_wkt, boundaryC));
  assert.ok(await geomEquals(history[0].old_geometry_wkt, boundaryB));
});

test('"Чөлөөлсөн" талбар шинэ хилээс гарвал хил ХҮЛЭЭГДЭХГҮЙ', async () => {
  // Үлдсэн талбарын аль нэгийг "Чөлөөлсөн" (status=5) болгоно.
  const staying = await registeredParcelIDs();
  assert.ok(staying.length > 0, "тестийн бэлтгэл: үлдсэн талбар байх ёстой");
  await pool.query(
    `UPDATE parcel SET status = 5 WHERE acquisition_id = $1 AND parcel_id = $2`,
    [acquisitionId, staying[0]],
  );

  // Тэр талбарыг ГАДНА орхих хил (мокийн талбартай огт давхцахгүй хил) руу
  // солихыг оролдоно — backend ТАТГАЛЗАХ ёстой.
  const { rows: farRows } = await pool.query(
    `WITH g AS (SELECT ST_MakeValid(ST_GeomFromText($1, 4326)) AS geom)
     SELECT ST_AsText(
              ST_Buffer(
                ST_Translate(ST_PointOnSurface(geom), 0.05, 0.05)::geography, 60
              )::geometry
            ) AS wkt FROM g`,
    [boundaryC],
  );
  const PLAN_FAR = `E2E-PLAN-FAR-${suffix}`;
  plans.set(PLAN_FAR, { geometry_wkt: farRows[0].wkt });

  const { res, json } = await request(`/land-acquisitions/${acquisitionId}`, {
    method: "PUT",
    form: acquisitionForm({
      acquisition_name: `E2E чөлөөлөлт ${suffix}`,
      plan_parcel_id: PLAN_FAR,
    }),
  });

  assert.equal(res.status, 409, `чөлөөлсөн талбартай хил солигдов: ${JSON.stringify(json)}`);

  // Юу ч хөндөгдөөгүй байх ёстой: хил, талбар, түүх бүгд хэвээр.
  const { rows } = await pool.query(
    "SELECT ST_AsText(geometry) AS geom FROM land_acquisition WHERE id = $1",
    [acquisitionId],
  );
  assert.ok(await geomEquals(rows[0].geom, boundaryC), "татгалзсан солилт хилийг эвдэв");
  assert.deepEqual(await registeredParcelIDs(), staying, "татгалзсан солилт талбарыг хөндөв");
  const history = (await request(`/land-acquisitions/${acquisitionId}/boundary-history`)).json.data;
  assert.equal(history.length, 2, "татгалзсан солилтод түүх бичигдэх ёсгүй");

  // Төлвийг эгүүлнэ — "Чөлөөлсөн" талбартай чөлөөлөлтийг устгах боломжгүй тул
  // цэвэрлэгээ (after) хийгдэхгүй байх байлаа.
  await pool.query(`UPDATE parcel SET status = 0 WHERE acquisition_id = $1`, [acquisitionId]);
});
