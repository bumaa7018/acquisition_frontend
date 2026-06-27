const ACCESS_TOKEN_KEY = "gov_access_token";
const REFRESH_TOKEN_KEY = "gov_refresh_token";
const USER_KEY = "gov_user";

function userFromAccessToken(token: string | null) {
  if (!token) return null;
  try {
    const rawPayload = token.split(".")[1];
    const normalizedPayload = rawPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(rawPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalizedPayload));
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
  } catch {
    return null;
  }
}

export const authStorage = {
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
    } catch {
      return userFromAccessToken(localStorage.getItem(ACCESS_TOKEN_KEY));
    }
  },
  setTokens: (access: string, refresh: string) => {
    if (access) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access);
      const tokenUser = userFromAccessToken(access);
      if (tokenUser) localStorage.setItem(USER_KEY, JSON.stringify(tokenUser));
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
  },
};
