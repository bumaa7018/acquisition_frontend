/**
 * Газрын зургийн СУУРЬ зургийн тохиргоо — OpenLayers-ээс ХАМААРАЛГҮЙ.
 *
 * (layer-config.ts-тэй ижил зарчим: OL-гүй хэсгийг тусад нь байлгаснаар Node
 * тестээр шалгах боломжтой.)
 *
 * Тохируулаагүй үед (эсвэл enabled=false) БҮХ газрын зураг ҮНДСЭН суурь
 * зургаа (Google хиймэл дагуул) хэрэглэнэ — өмнөх зан үйл хэвээр.
 */

export type BasemapType = "xyz" | "wms" | "image";

export interface BasemapSetting {
  type: BasemapType;
  url: string;
  enabled: boolean;
  /** ЗӨВХӨН wms — GetMap-ийн layers параметр */
  layer?: string;
  /** tile сервисийн хамгийн ойрын түвшин (0/байхгүй = заагаагүй) */
  max_zoom?: number;
  /** ЗӨВХӨН image — [minLon, minLat, maxLon, maxLat] (WGS84) */
  extent?: number[];
  attribution?: string;
  name?: string;
  updated_at?: string;
  updated_by?: string;
}

/**
 * ҮНДСЭН суурь зураг — Google хиймэл дагуулын tile (өмнө нь газрын зураг
 * бүрд хатуу бичигдсэн байсан утга). Дөрвөн дэд домэйн нь browser-ийн нэг
 * origin дээрх холболтын хязгаарыг тараахад хэрэглэгддэг.
 */
export const DEFAULT_BASEMAP_URLS = [
  "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
] as const;

export const DEFAULT_BASEMAP_MAX_ZOOM = 20;

/**
 * Хаягаас эх сурвалжийн ТӨРЛИЙГ таних.
 *
 * Хэрэглэгчээс ЗӨВХӨН хаяг авдаг тул төрөл нь хаягийн бүтцээр тодорхойлогдоно:
 *   • {x}/{y}/{z} орлуулагчтай                → tile (xyz)
 *   • service=WMS эсвэл .../wms               → растер (wms)
 *   • зургийн өргөтгөлтэй (.png/.jpg/.tif...) → тогтмол зураг (image)
 * Танигдахгүй бол tile гэж үзнэ (хамгийн өргөн тохиолдол).
 */
export function detectBasemapType(url: string): BasemapType {
  const value = (url ?? "").trim().toLowerCase();
  if (!value) return "xyz";

  // 1. Тайлын хаяг — орлуулагчаар шууд танигдана.
  const hasY = value.includes("{y}") || value.includes("{-y}");
  if (value.includes("{x}") && hasY && value.includes("{z}")) return "xyz";

  // 2. Зургийн файл.
  if (/\.(png|jpe?g|webp|gif|tiff?)(\?|#|$)/.test(value)) return "image";

  // 3. OGC сервисийн хаяг. Зөвхөн ".../wms" гэж хайвал хүрэлцэхгүй: жинхэнэ
  //    сервисүүд `/ows`, `/service`, `/mapserv`, `wms.cgi` зэрэг замтай ирдэг
  //    (ж: https://ows.terrestris.de/osm/service).
  if (
    /[?&]service=wms\b/.test(value) ||
    /[?&]request=getcapabilities\b/.test(value) ||
    /\/(wms|ows|service|mapserv)(\.[a-z]+)?(\?|#|\/|$)/.test(value)
  ) {
    return "wms";
  }

  // 4. Орлуулагч бичих гэж завдсан (`{`) бол тайл гэж үзнэ — шалгалт нь
  //    "{x}/{y}/{z} байх ёстой" гэсэн тодорхой мессеж харуулна.
  if (value.includes("{")) return "xyz";

  // 5. Бусад тохиолдолд сервисийн хаяг гэж үзээд давхаргыг таниж үзнэ.
  return "wms";
}

/**
 * WMS хаягнаас давхаргын нэрийг (layers=) уншина.
 *
 * GeoServer-ийн GetMap хаягийг бүтнээр хуулж тавихад давхаргын нэр хаяг дотроо
 * ирдэг тул хэрэглэгчээс дахин асуух шаардлагагүй.
 */
export function parseWmsLayerFromUrl(url: string): string {
  const qIndex = (url ?? "").indexOf("?");
  if (qIndex === -1) return "";
  try {
    // forEach — target ES5-д iterator задлах боломжгүй (downlevelIteration).
    let found = "";
    new URLSearchParams(url.slice(qIndex + 1)).forEach((value, key) => {
      if (!found && key.toLowerCase() === "layers" && value.trim()) found = value.trim();
    });
    return found;
  } catch {
    return "";
  }
  return "";
}

/** Тохиргоо бодитоор хэрэглэгдэх эсэх (хоосон хаяг = үндсэн суурь зураг). */
export function isBasemapActive(setting?: BasemapSetting | null): boolean {
  if (!setting || !setting.enabled) return false;
  if (!setting.url?.trim()) return false;
  if (setting.type === "wms" && !setting.layer?.trim()) return false;
  if (setting.type === "image" && (setting.extent?.length ?? 0) !== 4) return false;
  return true;
}

/**
 * Хаягийн шалгалт (дэлгэц дээр урьдчилан анхааруулахад). Сервер тал мөн ижил
 * дүрмээр шалгадаг — энэ нь ЗӨВХӨН хэрэглэгчид түргэн хариу өгөх зорилготой.
 *
 * Буцах утга: алдааны мессеж (монголоор) эсвэл null (зөв).
 */
export function validateBasemapInput(setting: {
  type: BasemapType;
  url: string;
  layer?: string;
  extent?: number[];
}): string | null {
  const url = setting.url?.trim() ?? "";
  if (!url) return null; // хоосон = үндсэн суурь зураг рүү буцна

  if (!/^https?:\/\//i.test(url)) {
    return "Хаяг http:// эсвэл https://-ээр эхлэх ёстой";
  }
  if (setting.type === "xyz") {
    const lower = url.toLowerCase();
    const hasY = lower.includes("{y}") || lower.includes("{-y}");
    if (!lower.includes("{x}") || !hasY || !lower.includes("{z}")) {
      return "Tile хаягт {x}, {y}, {z} орлуулагч байх ёстой";
    }
  }
  if (setting.type === "wms" && !setting.layer?.trim()) {
    return "WMS давхаргын нэрийг оруулна уу";
  }
  if (setting.type === "image") {
    const e = setting.extent ?? [];
    if (e.length !== 4 || e.some((v) => !Number.isFinite(v))) {
      return "Зургийн хүрээг 4 тоогоор оруулна уу (minLon, minLat, maxLon, maxLat)";
    }
    if (e[0] >= e[2] || e[1] >= e[3]) {
      return "Хүрээний min утга max-аас бага байх ёстой";
    }
  }
  return null;
}

// ── Одоогийн тохиргооны САН (модул түвшний) ─────────────────────────────────
//
// Газрын зургууд useEffect дотор НЭГ УДАА үүсдэг тул тохиргоог React-ийн
// state-ээр дамжуулах нь бүх зургийн үүсгэлтийг хүлээлгэдэг. Иймд тохиргоог
// модул түвшинд хадгалж, зураг үүсэхдээ ТЭР МӨЧИЙН утгыг авна; дараа нь
// (сервер хариу ирэх, админ солих үед) subscribe-аар зөвхөн суурь давхарга
// солигдоно — зураг дахин үүсэхгүй.

let currentSetting: BasemapSetting | null = null;
const listeners = new Set<(s: BasemapSetting | null) => void>();

export function getBasemapSetting(): BasemapSetting | null {
  return currentSetting;
}

export function setBasemapSetting(setting: BasemapSetting | null) {
  currentSetting = setting;
  listeners.forEach((cb) => cb(currentSetting));
}

/** Тохиргоо солигдоход мэдэгдэнэ. Буцах функц нь бүртгэлээ салгана. */
export function subscribeBasemap(cb: (s: BasemapSetting | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
