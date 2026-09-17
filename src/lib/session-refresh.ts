import { ACCESS_TOKEN_KEY, accessTokenExpiresAt, authStorage } from "./auth";
import { refreshAccessToken } from "./api";
import { logger } from "./logger";

// Сессийг УРЬДЧИЛАН сунгах таймер + таб хоорондын зохицуулалт.
//
// ЯАГААД: access token 15 минутад дуусдаг ба апп өмнө нь ЗӨВХӨН 401 ирсний
// дараа л сэргээдэг байв. Үр дүнд нь:
//   1) хэрэглэгч эргэж ирэхэд нэг хуудасны 20-30 хүсэлт ЗЭРЭГ 401 авдаг,
//   2) хэд хэдэн JS контекст (таб) нэг refresh token-оор зэрэг сэргээхийг
//      оролддог. Backend refresh token-ыг НЭГ УДААГИЙН хэрэглээтэйгээр
//      эргүүлдэг тул хожигдсон нь «invalid token» аваад бүх сессийг
//      `authStorage.clear()`-ээр устгадаг байлаа.
//
// Энэ модуль хугацаа дуусахаас өмнө нам гүмхэн сэргээж, тэр үерийг бүрмөсөн
// үүсгэхгүй болгоно. Шинэ токеныг өөр таб бичмэгц `storage` event-ээр мэдэж,
// өөрийн таймераа дахин товлоно (давхар refresh хийхгүй).

/** Хугацаа дуусахаас хэдэн мс өмнө сэргээх вэ. */
const REFRESH_LEAD_MS = 60_000;
/** Хамгийн бага хүлээлт — exp өнгөрсөн үед гогцоо үүсгэхгүй. */
const MIN_DELAY_MS = 1_000;
/** Сүлжээний түр саатлын дараа дахин оролдох хүлээлт. */
const RETRY_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Одоогийн токены `exp`-ээс хамааруулж дараагийн сэргээлтийг товлоно. */
function schedule() {
  clearTimer();
  const token = authStorage.getAccessToken();
  if (!token) return; // нэвтрээгүй — таймер хэрэггүй
  const expiresAt = accessTokenExpiresAt(token);
  // `exp` уншигдахгүй бол урьдчилан сэргээхгүй: хуучин (401-д тулгуурласан)
  // зан төлөв хэвээр үлдэнэ — таамаглалаар refresh хийж token үрэхгүй.
  if (expiresAt == null) return;
  const delay = Math.max(MIN_DELAY_MS, expiresAt - Date.now() - REFRESH_LEAD_MS);
  timer = setTimeout(run, delay);
}

async function run() {
  timer = null;
  if (!authStorage.getRefreshToken()) return;

  // Өөр таб аль хэдийн сэргээсэн байж болно — тэр тохиолдолд дахин сэргээхгүй,
  // зүгээр шинэ хугацаагаар товлоно.
  const expiresAt = accessTokenExpiresAt(authStorage.getAccessToken());
  if (expiresAt != null && expiresAt - Date.now() > REFRESH_LEAD_MS) {
    schedule();
    return;
  }

  try {
    await refreshAccessToken();
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    logger.warn("proactive token refresh failed", { error: String(err), status });
    // 4xx = сесс үнэхээр дууссан. Давтан оролдвол backend-ийг дэмий цохино —
    // хэрэглэгчийн дараагийн үйлдэл дээр interceptor нь logout хийнэ.
    if (typeof status === "number" && status >= 400 && status < 500) return;
    // Сүлжээний түр саатал — дараа дахин оролдоно.
    timer = setTimeout(run, RETRY_MS);
    return;
  }
  schedule();
}

/** Өөр таб токеныг шинэчилсэн үед — өөрийн таймераа шинэ хугацаагаар товлоно. */
function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== ACCESS_TOKEN_KEY) return;
  schedule();
}

/**
 * Урьдчилан сэргээх ажиллагааг эхлүүлнэ (browser дээр л). Дахин дуудахад
 * давхар таймер үүсгэхгүй. Буцаах функц нь бүх сонсогч/таймерыг цэвэрлэнэ.
 */
export function startSessionRefresh(): () => void {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  window.addEventListener("storage", onStorage);
  schedule();
  return () => {
    started = false;
    window.removeEventListener("storage", onStorage);
    clearTimer();
  };
}

/** Тестэд зориулав — дотоод төлөвийг шалгах. */
export function __hasScheduledRefresh(): boolean {
  return timer !== null;
}
