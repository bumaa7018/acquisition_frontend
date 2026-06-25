const ACCESS_TOKEN_KEY = "gov_access_token";
const REFRESH_TOKEN_KEY = "gov_refresh_token";
const USER_KEY = "gov_user";

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
    if (!u || u === "undefined" || u === "null") return null;
    try {
      return JSON.parse(u);
    } catch {
      return null;
    }
  },
  setTokens: (access: string, refresh: string) => {
    if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
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
