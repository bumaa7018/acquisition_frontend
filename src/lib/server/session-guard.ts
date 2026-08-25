import { NextRequest } from "next/server";

// `/api/files` болон `/api/geoserver` proxy-ийн эрхийн хамгаалалт.
//
// Токеныг ХОЁР эх сурвалжаас олно:
//   1. Authorization header — fetch/API дуудлагад (WMS `wmsPostLoad`, WFS).
//   2. httpOnly session cookie — browser-ийн эх хандалтад (`<img src>`,
//      `<a href download>`, OpenLayers XYZ tile) — эдгээр header зөөж чадахгүй.
//
// Гарын үсгийг ЭНД шалгахгүй (нууц түлхүүр frontend-д байхгүй) — эрхийн БҮХ
// шийдвэрийг backend гаргана. Энэ файл зөвхөн backend-ийн хариултыг богино
// хугацаанд (30с) кэшлэж, нэг газрын зураг олон tile татахад backend-ыг
// хамгаална. Кэшийн түлхүүрт токен ордог тул хэрэглэгч хооронд холилдохгүй.

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
export const SESSION_COOKIE = "gov_sess";

const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 5000;

// Backend руу хийх ЭРХИЙН лавлагааны хугацааны хязгаар.
//
// Node-ийн `fetch` (undici) нь анхдагчаар хүсэлтийн хугацаа хязгаарладаггүй
// (зөвхөн 300 сек-ийн header/body хязгаартай). Эдгээр лавлагаа нь
// `/api/files` болон `/api/geoserver`-ийн ХҮСЭЛТ БҮРИЙГ хаалгалдаг тул
// backend гацвал зураг/tile-ийн хүсэлтүүд 5 минут ЗҮҮГДЭЖ, browser-ийн
// origin тус бүрийн 6 холболтыг бүгдийг эзэлдэг — тэр агшнаас апп бүхэлдээ
// "уншиж гацна". `/users/me` нь хэвийн үед миллисекундэд хариулдаг тул 20
// секунд бол хэвийн саатлаас хол дээгүүр, гэхдээ хязгаартай.
const AUTH_LOOKUP_TIMEOUT_MS = 20_000;

/** Хугацааны хязгаартай signal. Хэтэрвэл fetch нь AbortError шиднэ. */
function authLookupSignal(): AbortSignal {
  return AbortSignal.timeout(AUTH_LOOKUP_TIMEOUT_MS);
}

type CacheEntry<T> = { value: T; exp: number };

/**
 * Богино хугацааны in-memory кэш. Түлхүүр нь ҮРГЭЛЖ токеноор эхэлнэ.
 *
 * `inflight` нь ЯВЖ БУЙ хүсэлтийг ч хуваалцана. Урьд нь зөвхөн ДУУССАН үр дүн
 * кэшлэгддэг байсан тул кэш хоосон агшинд ирсэн бүх хүсэлт өөр өөрийн
 * backend дуудлагаа явуулдаг байв: хуудас дахин ачаалахад 20 зураг зэрэг
 * ирвэл `/api/files` нь `/users/me` + `/files/authorize`-ыг 40+ удаа ЗЭРЭГ
 * дууддаг, газрын зураг дээр tile бүр `sessionRoles` +
 * `externalAcquisitionScope` дууддаг. Энэ нь backend-ийг дүүргэж, өөрсдийгөө
 * удаашруулж, "уншиж гацах"-ын нэг эх үүсвэр болдог байлаа.
 */
function makeCache<T>() {
  const store = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();

  return function cached(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.exp > now) return Promise.resolve(hit.value);

    const running = inflight.get(key);
    if (running) return running;

    const pending = load()
      .then((value) => {
        const settledAt = Date.now();
        store.set(key, { value, exp: settledAt + CACHE_TTL_MS });
        if (store.size > CACHE_MAX) {
          store.forEach((v, k) => {
            if (v.exp <= settledAt) store.delete(k);
          });
        }
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, pending);
    return pending;
  };
}

export function tokenFromRequest(req: NextRequest): string {
  const header = req.headers.get("authorization");
  if (header) return header.replace(/^Bearer\s+/i, "").trim();
  return req.cookies.get(SESSION_COOKIE)?.value ?? "";
}

const sessionCache = makeCache<boolean>();

export async function isSessionValid(token: string): Promise<boolean> {
  if (!token) return false;
  return sessionCache(token, async () => {
    try {
      const res = await fetch(`${BACKEND}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: authLookupSignal(),
      });
      return res.ok;
    } catch {
      return false;
    }
  });
}

/** Хүсэлтийг нэвтэрсэн эсэхээр шалгана. Эрхгүй бол true биш. */
export async function requireSession(req: NextRequest): Promise<boolean> {
  return isSessionValid(tokenFromRequest(req));
}

// ── Ролийн шалгалт ──────────────────────────────────────────────────────────

// Гадаад (байгууллага даяар харах эрхгүй) ролиуд. Тэдний газрын зураг/файлын
// хандалтыг ӨӨРИЙН чөлөөлөлтөөр хумина.
const EXTERNAL_ROLES = new Set([
  "professional_org",
  "Мэргэжлийн байгууллага",
  "Мэргэжлийн байгуулл...",
  "mika",
  "МИКА",
  "finance_specialist",
  "Санхүүгийн мэргэжилтэн",
  "Санхүү",
]);

const PROF_ORG_ROLES = new Set([
  "professional_org",
  "Мэргэжлийн байгууллага",
  "Мэргэжлийн байгуулл...",
]);

const rolesCache = makeCache<string[] | null>();

/**
 * Токены БОДИТ ролиуд (backend-ийн `/users/me`-ээс — гарын үсэг шалгагдсаны
 * дараах өгөгдлийн сангийн утга). Токен хүчингүй бол null.
 *
 * ЖИЧ: JWT-г frontend дээр өөрөө задалж роль уншиж БОЛОХГҮЙ — гарын үсгийн
 * түлхүүр энд байхгүй тул хуурамч роль илрэхгүй.
 */
export async function sessionRoles(token: string): Promise<string[] | null> {
  if (!token) return null;
  return rolesCache(`roles:${token}`, async () => {
    try {
      const res = await fetch(`${BACKEND}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: authLookupSignal(),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        data?: { roles?: { name?: string }[] };
        roles?: { name?: string }[];
      };
      const roles = body.data?.roles ?? body.roles ?? [];
      return roles.map((r) => r?.name ?? "").filter(Boolean);
    } catch {
      return null;
    }
  });
}

export function isExternalRoleSet(roles: string[]): boolean {
  return roles.some((r) => EXTERNAL_ROLES.has(r));
}

export function isProfOrgRoleSet(roles: string[]): boolean {
  return roles.some((r) => PROF_ORG_ROLES.has(r));
}

// ── Файлын объектын эрх ─────────────────────────────────────────────────────

const fileAuthCache = makeCache<boolean>();

/**
 * Тухайн объектын түлхүүрт хандах эрхийг backend-ээр шалгуулна.
 *
 * Яагаад заавал backend вэ: түлхүүр нь `acquisition/<acq_id>/<файлын нэр>`
 * хэлбэртэй ба баримтын төрөл заасан үед файлын нэр ЭХ нэр хэвээр үлддэг тул
 * таамаглаж болно. Backend нь эзний чөлөөлөлт/нэгж талбарт буулгаж, тухайн
 * маршрутуудын ЯГ ижил дүрмээр (land:read/compensation:read + хуваарилалт /
 * байгууллагын гишүүнчлэл) шалгана.
 */
export async function authorizeFileKey(token: string, key: string): Promise<boolean> {
  if (!token || !key) return false;
  return fileAuthCache(`file:${token}:${key}`, async () => {
    try {
      const res = await fetch(
        `${BACKEND}/api/v1/files/authorize?key=${encodeURIComponent(key)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: authLookupSignal() },
      );
      return res.ok;
    } catch {
      return false;
    }
  });
}

// ── Гадаад ролийн харагдах чөлөөлөлтүүд (газрын зургийн хумилтад) ───────────

const acqScopeCache = makeCache<string[] | null>();

// Нэг хүсэлтэд татах дээд хэмжээ. Гадаад байгууллага ийм олон чөлөөлөлттэй
// байх нь бодит биш; хэтэрвэл хумилт хийх боломжгүй тул хандалтыг хаана.
const MAX_SCOPE_IDS = 300;

/**
 * Гадаад ролийн хэрэглэгч ХАРАХ эрхтэй чөлөөлөлтийн ID-ууд.
 *
 * Жагсаалтыг backend өөрөө шүүдэг: мэрг. байгууллага `/prof/land-acquisitions`
 * (гишүүнчлэлээр), санхүү/МИКА `/land-acquisitions` (backend талд "Хээрийн
 * судалгаа" / илгээсэн үнэлгээгээр хатуу шүүгддэг). Иймд энд шинэ эрхийн
 * дүрэм үүсгээгүй — байгаа дүрмийг л газрын зурагт тусгаж байна.
 *
 * null = тодорхойлж чадсангүй (алдаа) → дуудагч хандалтыг хаана.
 */
export async function externalAcquisitionScope(
  token: string,
  roles: string[],
): Promise<string[] | null> {
  const path = isProfOrgRoleSet(roles)
    ? "/api/v1/prof/land-acquisitions"
    : "/api/v1/land-acquisitions";
  return acqScopeCache(`scope:${token}`, async () => {
    try {
      const res = await fetch(`${BACKEND}${path}?page=1&page_size=${MAX_SCOPE_IDS}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: authLookupSignal(),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { id?: string }[] };
      const ids = (body.data ?? []).map((a) => a?.id ?? "").filter(Boolean);
      // UUID биш утга CQL руу орохоос сэргийлнэ (тэмдэгт мөр тайрах халдлага).
      return ids.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
    } catch {
      return null;
    }
  });
}
