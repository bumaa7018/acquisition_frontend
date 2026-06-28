import type { AccessActor } from "./access-policy";

export function actorFromAuthorization(authorization: string | null): AccessActor {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { userId: null, roles: [] };

  try {
    const rawPayload = token.split(".")[1];
    const normalizedPayload = rawPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(rawPayload.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8"));
    return {
      userId: payload.user_id ?? null,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  } catch {
    return { userId: null, roles: [] };
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
