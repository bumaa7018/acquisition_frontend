import { NextRequest } from "next/server";

// `/api/files` болон `/api/geoserver` proxy-ийн эрхийн хамгаалалт.
//
// Токеныг ХОЁР эх сурвалжаас олно:
//   1. Authorization header — fetch/API дуудлагад (WMS `wmsPostLoad`, WFS).
//   2. httpOnly session cookie — browser-ийн эх хандалтад (`<img src>`,
//      `<a href download>`, OpenLayers XYZ tile) — эдгээр header зөөж чадахгүй.
//
// Гарын үсгийг ЭНД шалгахгүй (нууц түлхүүр frontend-д байхгүй) — backend-ийн
// `/users/me`-ээр токен хүчинтэй эсэхийг батална. Нэг газрын зураг олон tile
// татдаг тул богино (30с) in-memory кэшээр backend-ыг хамгаална.

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
export const SESSION_COOKIE = "gov_sess";

const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 5000;
type CacheEntry = { ok: boolean; exp: number };
const cache = new Map<string, CacheEntry>();

export function tokenFromRequest(req: NextRequest): string {
  const header = req.headers.get("authorization");
  if (header) return header.replace(/^Bearer\s+/i, "").trim();
  return req.cookies.get(SESSION_COOKIE)?.value ?? "";
}

export async function isSessionValid(token: string): Promise<boolean> {
  if (!token) return false;
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.exp > now) return hit.ok;

  let ok = false;
  try {
    const res = await fetch(`${BACKEND}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  cache.set(token, { ok, exp: now + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) {
    cache.forEach((v, k) => {
      if (v.exp <= now) cache.delete(k);
    });
  }
  return ok;
}

/** Хүсэлтийг нэвтэрсэн эсэхээр шалгана. Эрхгүй бол true биш. */
export async function requireSession(req: NextRequest): Promise<boolean> {
  return isSessionValid(tokenFromRequest(req));
}
