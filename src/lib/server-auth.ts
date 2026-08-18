import type { AccessActor } from "./access-policy";

/**
 * JWT-ийн ID нэхэмжлэлүүд (`user_id`, `org_id`) нь sdplatform-д int4 тул JSON-д
 * ТОО болж ирдэг. Харин API-ийн хариултууд (professional_org_id гэх мэт) нь
 * ТЭМДЭГТ МӨР. Хоёуланг нь мөр болгож нэгтгэхгүй бол `"12" === 12` нь үргэлж
 * false болж, хандалтын шалгалт чимээгүй унана.
 */
function idClaim(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value !== "") return value;
  return null;
}

export function actorFromAuthorization(authorization: string | null): AccessActor {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { userId: null, orgId: null, roles: [] };

  try {
    const rawPayload = token.split(".")[1];
    const normalizedPayload = rawPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(rawPayload.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8"));
    return {
      userId: idClaim(payload.user_id),
      orgId: idClaim(payload.org_id),
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  } catch (err) {
    // Энэ файл серверийн Node орчинд ажилладаг тул client logger (fetch/
    // sendBeacon) хэрэглэхгүй — Next серверийн stdout руу шууд бичнэ, энэ нь
    // Docker container лог болж Promtail/Loki-руу дамжина. Токен өөрийг нь
    // хэзээ ч логлохгүй, зөвхөн задлах явцад алдаа гарсныг тэмдэглэнэ.
    console.warn(JSON.stringify({ level: "WARN", msg: "jwt decode failed (server)", error: String(err) }));
    return { userId: null, orgId: null, roles: [] };
  }
}

export function isExternalAuthorization(authorization: string | null): boolean {
  const roles = actorFromAuthorization(authorization).roles ?? [];
  return roles.some((role) =>
    [
      "professional_org",
      "Мэргэжлийн байгууллага",
      "Мэргэжлийн байгуулл...",
      "mika",
      "МИКА",
      "finance_specialist",
      "Санхүүгийн мэргэжилтэн",
      "Санхүү",
    ].includes(role),
  );
}
