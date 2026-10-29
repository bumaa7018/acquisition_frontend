/**
 * Нээлттэй хуудасны табууд — sessionStorage-д хадгалагдана.
 *
 * - Таб бүр цэсийн нэг зүйлд (`key` = цэсийн href) харгалзана; `path` нь тухайн
 *   табын СҮҮЛД нээгдсэн бүтэн зам (query-тэй), ж: `/acquisition/12?tab=parcel`.
 *   Ингэснээр таб руу буцахад хэрэглэгч орхисон хуудсандаа очно.
 * - Таб бүр ӨӨРИЙН хугацаатай: цэс/таб дарж нээх бүрд (мөн тэр табаас гарах
 *   үед) `lastActiveAt` шинэчлэгдэж, түүнээс хойш TTL өнгөрвөл ЗӨВХӨН тэр таб
 *   хаагдана. Идэвхтэй (одоо харж буй) таб хаагдахгүй.
 * - Login/logout үед `clearPageTabs()` дуудагдаж бүгд устна.
 */

export type PageTab = { key: string; path: string; label: string; lastActiveAt: number };

const STORAGE_KEY = "gov_page_tabs";
/** Табын жагсаалт өөрчлөгдөхөд (хаах г.м.) цацагдах event. */
const CHANGE_EVENT = "gov-page-tabs-change";
/** Таб бүрийн хугацаа — 3 цаг. */
export const PAGE_TAB_TTL_MS = 3 * 60 * 60 * 1000;
/** Хэт олон таб нээгдэхээс сэргийлнэ — хамгийн хуучныг нь хасна. */
export const PAGE_TABS_MAX = 15;

/** Хадгалсан табууд (хугацаа шалгахгүй — идэвхтэй табыг мэддэггүй тул). */
export function loadPageTabs(): PageTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { tabs?: Partial<PageTab>[] };
    if (!Array.isArray(parsed?.tabs)) return [];
    return parsed.tabs
      .filter((t): t is PageTab => typeof t?.key === "string" && typeof t.path === "string")
      .map((t) => ({
        key: t.key,
        path: t.path,
        label: typeof t.label === "string" ? t.label : "Хуудас",
        // Хуучин хэлбэрээр хадгалагдсан таб — одооноос тоолно.
        lastActiveAt: typeof t.lastActiveAt === "number" ? t.lastActiveAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function savePageTabs(tabs: PageTab[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs }));
  } catch {
    // sessionStorage хаалттай (private горим г.м.) — табууд санах ойд л үлдэнэ.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Табын жагсаалт хадгалагдах бүрд `cb` дуудагдана — unsubscribe буцаана. */
export function subscribePageTabs(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/** Хугацаа нь дууссан табуудыг хасна — `activeKey` (одоо харж буй) үлдэнэ. */
export function pruneExpiredTabs(tabs: PageTab[], activeKey: string, now = Date.now()): PageTab[] {
  return tabs.filter((t) => t.key === activeKey || now - t.lastActiveAt < PAGE_TAB_TTL_MS);
}

/** Идэвхгүй табуудаас хамгийн түрүүнд хугацаа дуусах мөч (epoch мс). */
export function nextTabExpiry(tabs: PageTab[], activeKey: string): number | null {
  let next: number | null = null;
  for (const t of tabs) {
    if (t.key === activeKey) continue;
    const at = t.lastActiveAt + PAGE_TAB_TTL_MS;
    if (next === null || at < next) next = at;
  }
  return next;
}

export function clearPageTabs(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
