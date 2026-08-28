// External store — axios interceptors and navigation events update this,
// useSyncExternalStore reads it inside React.
//
// ─── ХАМГААЛАЛТ (watchdog) ──────────────────────────────────────────────────
// Overlay нь бүтэн дэлгэцийг `pointer-events` -тэй хааддаг тул "асаасан ч
// унтраагаагүй" ганц алдаа аппыг БҮРМӨСӨН гацаадаг (зөвхөн F5 гаргана).
// Урьд нь яг тэр болдог байсан:
//
//   1. `notifyNavStart()` нь холбоос дарах бүрд БОЛЗОЛГҮЙ асдаг байсан ч
//      `notifyNavEnd()` нь зөвхөн pathname СОЛИГДОХОД ажилладаг. Иймд
//      pathname хэвээр үлдэх даралт (цэснээс өөрийнхөө хуудсыг дахин дарах,
//      зөвхөн `?query` солигдох шилжилт, Ctrl/Cmd+click, шинэ таб) бүрд
//      overlay мөнхөд наалддаг байв.
//   2. `timeout: 0` хүсэлт (төлөвлөгөөний хилээр хил солих) минутаар үргэлжилдэг
//      ба тэр бүх хугацаанд дэлгэц түгжээтэй байдаг.
//
// Одоо: (а) pathname солигдохгүй шилжилтэд loader огт асахгүй, (б) хоёуланд нь
// дээд хугацаа тавьж, хэтэрвэл overlay АВТОМАТААР унтарна. Хүсэлт өөрөө
// цуцлагдахгүй — зөвхөн дэлгэцийн түгжээ тайлагдана.

/** Хүсэлтийн overlay-ийн дээд хугацаа. Хэтэрвэл дэлгэц чөлөөлөгдөнө. */
const MAX_BLOCK_MS = 20_000;
/** Шилжилтийн overlay-ийн дээд хугацаа. */
const MAX_NAV_MS = 10_000;

/** Идэвхтэй хүсэлтүүдийн id. Set — давхар хасалт/алдагдалаас хамгаална. */
const _pending = new Set<number>();
let _nextId = 1;

let _navPending = false;
let _navTimer: ReturnType<typeof setTimeout> | null = null;

let _apiTimer: ReturnType<typeof setTimeout> | null = null;
let _apiExpired = false;

const _subscribers = new Set<() => void>();

function emit() {
  _subscribers.forEach((cb) => cb());
}

export function subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  return () => _subscribers.delete(cb);
}

export function getIsBlocking(): boolean {
  return (_pending.size > 0 && !_apiExpired) || _navPending;
}

function armApiWatchdog() {
  if (_apiTimer !== null || typeof window === "undefined") return;
  _apiTimer = setTimeout(() => {
    _apiTimer = null;
    _apiExpired = true;
    emit();
  }, MAX_BLOCK_MS);
}

function disarmApiWatchdog() {
  if (_apiTimer !== null) {
    clearTimeout(_apiTimer);
    _apiTimer = null;
  }
  _apiExpired = false;
}

/** Хүсэлт эхлэв. Буцаах id-г `notifyRequestEnd`-д ЗААВАЛ буцааж өгнө. */
export function notifyRequestStart(): number {
  const id = _nextId++;
  _pending.add(id);
  if (_pending.size === 1) armApiWatchdog();
  emit();
  return id;
}

/**
 * Хүсэлт дууслаа. id-гаар ажилладаг тул давхар дуудвал (ижил config дахин
 * оролдох, cancel + error давхацах) тоолуур сөрөг/гажуудахгүй. `_silent`
 * хүсэлт id авдаггүй тул `undefined` ирвэл юу ч хийхгүй.
 */
export function notifyRequestEnd(id: number | undefined): void {
  if (id === undefined) return;
  if (!_pending.delete(id)) return;
  if (_pending.size === 0) disarmApiWatchdog();
  emit();
}

/**
 * Холбоос дарахад ирэх үйл явдлын шаардлагатай талбарууд. React-ийн
 * SyntheticEvent болон DOM MouseEvent хоёулаа тэнцэнэ.
 */
type NavStartEvent = {
  defaultPrevented?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
  currentTarget?: unknown;
};

/**
 * Энэ даралт ЖИНХЭНЭ хуудас солих шилжилт үү?
 *
 * `notifyNavEnd()` нь ЗӨВХӨН pathname солигдоход ажилладаг тул pathname
 * өөрчлөгдөхгүй ямар ч даралтад loader-ыг асаах ёсгүй — эс бөгөөс мөнхөд
 * үлдэнэ.
 */
function shouldTrackNavigation(event?: NavStartEvent): boolean {
  if (typeof window === "undefined") return false;
  if (!event) return true; // гараар дуудсан (router.push) — watchdog хамгаална
  if (event.defaultPrevented) return false;
  // Ctrl/Cmd/Shift/Alt + click, дунд товч → шинэ таб/цонх нээгдэнэ,
  // ЭНЭ хуудас хэвээр үлдэнэ.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (typeof event.button === "number" && event.button !== 0) return false;

  const anchor = event.currentTarget as { href?: unknown; target?: unknown } | null | undefined;
  const href = typeof anchor?.href === "string" ? anchor.href : "";
  if (!href) return true; // <a> биш элемент — шалгах зүйлгүй, watchdog хамгаална

  const target = typeof anchor?.target === "string" ? anchor.target : "";
  if (target && target !== "_self") return false; // шинэ таб

  try {
    const next = new URL(href, window.location.href);
    if (next.origin !== window.location.origin) return false; // гадаад холбоос
    if (next.pathname === window.location.pathname) return false; // pathname хэвээр
  } catch {
    return true;
  }
  return true;
}

export function notifyNavStart(event?: NavStartEvent): void {
  if (!shouldTrackNavigation(event)) return;
  _navPending = true;
  if (_navTimer !== null) clearTimeout(_navTimer);
  _navTimer = setTimeout(() => {
    _navTimer = null;
    _navPending = false;
    emit();
  }, MAX_NAV_MS);
  emit();
}

export function notifyNavEnd(): void {
  if (_navTimer !== null) {
    clearTimeout(_navTimer);
    _navTimer = null;
  }
  if (!_navPending) return;
  _navPending = false;
  emit();
}
