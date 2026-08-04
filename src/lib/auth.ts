import { logger } from "./logger";

const ACCESS_TOKEN_KEY = "gov_access_token";
const REFRESH_TOKEN_KEY = "gov_refresh_token";
const USER_KEY = "gov_user";

// JWT payload-г задалж буцаана (client-side base64url). Буруу/хоосон бол null.
// Клиент талын цорын ганц decoder — role-utils.ts мөн үүнийг ашиглана.
// (Сервер тал нь Node Buffer ашигладаг тул lib/server-auth.ts-д тусдаа байна.)
export function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const rawPayload = token.split(".")[1];
    const normalizedPayload = rawPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(rawPayload.length / 4) * 4, "=");
    const binary = atob(normalizedPayload);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    // Түүхий JWT payload-г буцаана (user_id, roles: string[], permissions: string[]).
    // getCurrentActor() энэ түүхий бүтцээс role/permission уншдаг тул
    // энд User хэлбэрт хувиргаж БОЛОХГҮЙ (тэр хувиргалт нь userFromAccessToken-д).
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    // Токеныг НЭВТРҮҮЛЭХГҮЙ, зөвхөн задлах явцад алдаа гарсныг тэмдэглэнэ.
    logger.warn("jwt decode failed", { error: String(err) });
    return null;
  }
}

function userFromAccessToken(token: string | null) {
  const payload = decodeJwtPayload(token) as {
    user_id?: string;
    username?: string;
    email?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    roles?: string[];
  } | null;
  if (!payload) return null;
  return {
    id: payload.user_id,
    username: payload.username,
    email: payload.email,
    full_name: payload.full_name,
    first_name: payload.first_name,
    last_name: payload.last_name,
    position: payload.position,
    roles: (payload.roles ?? []).map((name: string) => ({
      id: name,
      name,
      permissions: [],
    })),
  };
}

// httpOnly session cookie-г тохируулах/цэвэрлэх серверийн route.
//
// ЯАГААД ЭНЭ COOKIE ХЭРЭГТЭЙ: `/api/files` (баримт, зураг) болон
// `/api/geoserver` (газрын зургийн tile) нь browser-ийн ЭХ ХАНДАЛТААР
// (`<img src>`, `<a href download>`, OpenLayers XYZ) ачаалагддаг ба тэдгээр нь
// Authorization header зөөж чаддаггүй. Cookie нь ижил origin-д автоматаар
// явдаг тул proxy эрхийг ЭНЭ cookie-гоор шалгана. Токен нь httpOnly тул
// JS-ээс (XSS) уншигдахгүй — localStorage-оос ч аюулгүй.
const SESSION_ENDPOINT = "/api/session";

async function startSession(access: string): Promise<void> {
  if (!access || typeof window === "undefined") return;
  try {
    await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    });
  } catch (err) {
    logger.warn("session cookie set failed", { error: String(err) });
  }
}

function endSession(): void {
  if (typeof window === "undefined") return;
  fetch(SESSION_ENDPOINT, { method: "DELETE" }).catch(() => {});
}

export const authStorage = {
  // Login flow-д cookie тохирсоныг БАТЛАХ (навигацаас өмнө await хийнэ) —
  // үгүй бол эхний map/файл хүсэлт cookie-гүй явж 401 болох race үүснэ.
  startSession,
  getAccessToken: () => {
    if (typeof window === "undefined") return null;
    const t = localStorage.getItem(ACCESS_TOKEN_KEY);
    return t && t !== "undefined" && t !== "null" ? t : null;
  },
  getRefreshToken: () => {
    if (typeof window === "undefined") return null;
    const t = localStorage.getItem(REFRESH_TOKEN_KEY);
    return t && t !== "undefined" && t !== "null" ? t : null;
  },
  getUser: () => {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem(USER_KEY);
    if (!u || u === "undefined" || u === "null") {
      return userFromAccessToken(localStorage.getItem(ACCESS_TOKEN_KEY));
    }
    try {
      return JSON.parse(u);
    } catch (err) {
      logger.warn("stored user parse failed", { error: String(err) });
      return userFromAccessToken(localStorage.getItem(ACCESS_TOKEN_KEY));
    }
  },
  setTokens: (access: string, refresh: string) => {
    if (access) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access);
      const tokenUser = userFromAccessToken(access);
      if (tokenUser) localStorage.setItem(USER_KEY, JSON.stringify(tokenUser));
      // Login БОЛОН refresh (api.ts interceptor) бүрд cookie-г шинэчилнэ —
      // доторх access token 15 мин-д хүчингүй болдог тул синк байлгана.
      void startSession(access);
    }
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  setUser: (user: unknown) => {
    if (user == null) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    endSession();
  },
};
