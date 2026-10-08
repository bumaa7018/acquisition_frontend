/**
 * «Он цагийн зураг» — цаг хугацааны изометр зургийн ЦЭВЭР тооцоо (DOM/canvas-гүй,
 * Node тестээр шалгагдана). Координат нь EPSG:3857 (метр).
 *
 * Изометр проекц нь АФФИН хувиргалт:
 *   x = wx − ox (зүүн→баруун), y = −(wy − oy) (хойд→урд)
 *   sx = cx + (x − y)·0.866·s,  sy = cy + (x + y)·0.5·s − z
 * Тиймээс суурь зургийн tile-ийг canvas.setTransform-оор яг хэвтүүлж зурна.
 */

export interface ChronosEvent {
  date: string;
  status_id: number;
  name: string;
}

export interface ChronosParcel {
  id: string;
  parcel_id: string;
  acquisition_id: string;
  acquisition_name: string;
  status_id: number;
  status_name: string;
  status_color: string;
  released_at: string | null;
  area_m2: number;
  geometry: { type: string; coordinates: unknown };
  events: ChronosEvent[];
  holder_name: string;
  landuse_name: string;
  right_type: number;
  /** Нөхөх олговрын 3 үндсэн дүн: газар / үл хөдлөх / эд хөрөнгө. */
  comp_land: number;
  comp_real_state: number;
  comp_property: number;
  /** Сонгосон (үндсэн) урсгалын нөхөх олговор. */
  comp_amount: number;
  comp_at: string | null;
  comp_approved_at: string | null;
  decision_id: string | null;
  decision_linked_at: string | null;
  decision_confirmed_at: string | null;
  /** «Нөхөх олговор олгосон баримт» — шат 60/40/100, огноо YYYY-MM-DD. */
  payments: { date: string; stage: number }[];
}

export interface ChronosMonth {
  month: string; // YYYY-MM
  count: number;
}

export interface ChronosStatus {
  id: number;
  code?: string;
  name: string;
  color: string;
  sort_order: number;
  is_released: boolean;
  is_final?: boolean;
}

/** Захирамжийн төсөл — явцын түүхтэй (сонгосон сарын байдлыг тооцоход). */
export interface ChronosDecision {
  id: string;
  created_at: string;
  confirmed_at: string | null;
  events: { type: string; date: string }[];
}

export interface ChronosData {
  statuses: ChronosStatus[];
  decisions?: ChronosDecision[];
  parcels: ChronosParcel[];
  months: ChronosMonth[];
  truncated: boolean;
}

/** Өнгөний шатлал (хуучин → шинэ). */
export const CHRONOS_RAMP = ["#2E5A88", "#3E9C8F", "#F2A541"] as const;
export const CHRONOS_ISO_COS = 0.866;
export const CHRONOS_ISO_SIN = 0.5;
/** Хашаа шиг намхан: эхний шат 16px, сүүлийн шат 4px. */
export const CHRONOS_MIN_HEIGHT = 4;
export const CHRONOS_MAX_HEIGHT = 16;

/** «YYYY-MM» — огноо эсвэл ISO мөрөөс (цагийн бүсээс үл хамааран эхний 7 тэмдэгт). */
export function monthKey(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(value).slice(0, 7);
}

const monthOrdinal = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
const ordinalKey = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;

/** Хоёр сарын хоорондох сарын тоо (b − a). */
export function monthsBetween(a: string, b: string): number {
  return monthOrdinal(b) - monthOrdinal(a);
}

/**
 * Цагийн голын сарууд: эхний өөрчлөлтөөс НЭГ САРЫН ӨМНӨӨС (эхний кадрт бүх
 * нэгж талбар чөлөөлөгдөөгүй/саарал харагдана) ОДООГИЙН (эсвэл хамгийн сүүлийн
 * өгөгдлийн) сар хүртэл. Өгөгдөлгүй бол сүүлийн 12 сар.
 */
export function monthRange(months: ChronosMonth[], now: Date = new Date()): string[] {
  const current = monthKey(now);
  const keys = months.map((m) => m.month).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
  const lo = keys.length ? monthOrdinal(keys[0]) - 1 : monthOrdinal(current) - 11;
  const hi = Math.max(monthOrdinal(current), keys.length ? monthOrdinal(keys[keys.length - 1]) : 0);
  const out: string[] = [];
  for (let n = lo; n <= hi; n++) out.push(ordinalKey(n));
  return out;
}

/** «2021-07» → «2021.07». */
export const monthLabel = (key: string) => key.replace("-", ".");

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Шатлалын өнгө (t ∈ [0,1]). */
export function rampColor(t: number): string {
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const seg = x <= 0.5 ? 0 : 1;
  const local = seg === 0 ? x / 0.5 : (x - 0.5) / 0.5;
  const a = hexToRgb(CHRONOS_RAMP[seg]);
  const b = hexToRgb(CHRONOS_RAMP[seg + 1]);
  return toHex(a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local, a[2] + (b[2] - a[2]) * local);
}

/** Өнгийг гэрэлтүүлэх/бараантуулах (factor > 1 гэрэл, < 1 бараан). */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return toHex(r * factor, g * factor, b * factor);
}

/** Өнгөгүй төлөвт (бүртгэлд өнгө тохируулаагүй) хэрэглэх саарал. */
export const CHRONOS_NO_COLOR = "#8E97A3";
/** Түүх нь хараахан эхлээгүй (тухайн үед чөлөөлөгдөөгүй) нэгж талбарын саарал. */
export const CHRONOS_NOT_STARTED = "#6B7480";

/**
 * Сонгосон сарын ТӨГСГӨЛ дэх төлөв — тэр сар хүртэлх хамгийн сүүлийн түүхийн
 * бичлэг. Түүх огт байхгүй эсвэл бүх бичлэг хойно бол null (мэдэгдэхгүй).
 */
export function statusAt(events: { date: string; status_id: number }[], key: string): number | null {
  let status: number | null = null;
  for (const e of events) {
    if (monthKey(e.date) <= key) status = e.status_id;
    else break;
  }
  return status;
}

/**
 * Явцын ЭРЭМБЭ → хашааны өндөр (px): эхний шат хамгийн өндөр (16), явц ахих
 * тусам намсна (4). Чөлөөлсөн шат блок биш (тасархай контур) тул эрэмбэд орохгүй.
 */
export function progressHeights(statuses: ChronosStatus[]): Map<number, number> {
  const steps = statuses.filter((s) => !s.is_released).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const out = new Map<number, number>();
  steps.forEach((s, i) => {
    const t = steps.length > 1 ? i / (steps.length - 1) : 0;
    out.set(s.id, CHRONOS_MAX_HEIGHT - (CHRONOS_MAX_HEIGHT - CHRONOS_MIN_HEIGHT) * t);
  });
  return out;
}

export interface ChronosStatusStat {
  status: ChronosStatus;
  count: number;
  areaM2: number;
}

export interface ChronosStats {
  total: number;
  /** Тухайн сарын байдлаар төлөв бүрийн тоо/талбай (эрэмбээр, тоо > 0). */
  byStatus: ChronosStatusStat[];
  /** Түүх нь хараахан эхлээгүй (тухайн үед чөлөөлөгдөөгүй) нэгж талбар. */
  unknown: number;
  released: number;
  releasedAreaM2: number;
  /** Тухайн сард явц нь өөрчлөгдсөн нэгж талбар. */
  changedThisMonth: number;
  /** Нөхөх олговор (тухайн сарын байдлаар оруулсан). */
  compTotal: number;
  /** Захирамж батлагдсан нэгж талбарын олговор. */
  compIssued: number;
  /** Захирамжгүй, үнэлгээ батлагдсан. */
  compApproved: number;
  compUnapproved: number;
  /** Олгосон дүн (баримтын шат 60/40/100 × олговор). */
  compGranted: number;
  /** Захирамжид холбогдсон нэгж талбар. */
  decisionParcels: number;
  decisions: number;
  decisionsConfirmed: number;
}

const upTo = (date: string | null | undefined, key: string) => !!date && monthKey(date) <= key;

/** Тухайн сар хүртэл олгосон хувь (бүрэн бол 100, үгүй бол 60 + 40 гэх мэт, 100-аас хэтрэхгүй). */
export function paidPercentAt(payments: { date: string; stage: number }[], key: string): number {
  let sum = 0;
  for (const p of payments ?? []) {
    if (!upTo(p.date, key)) continue;
    if (p.stage >= 100) return 100;
    sum += p.stage;
  }
  return Math.min(100, sum);
}

/** Сонгосон сарын байдлаарх статистик (цагийн голтой хамт шинэчлэгдэнэ). */
export function statsAt(parcels: ChronosParcel[], statuses: ChronosStatus[], key: string): ChronosStats {
  const byId = new Map(statuses.map((s) => [s.id, { status: s, count: 0, areaM2: 0 }]));
  let unknown = 0;
  let released = 0;
  let releasedAreaM2 = 0;
  let changedThisMonth = 0;
  let compTotal = 0, compIssued = 0, compApproved = 0, compGranted = 0, decisionParcels = 0;
  const decisions = new Set<string>();
  const confirmed = new Set<string>();
  for (const p of parcels) {
    const amount = p.comp_amount || 0;
    if (amount > 0 && upTo(p.comp_at, key)) {
      compTotal += amount;
      if (upTo(p.decision_confirmed_at, key)) compIssued += amount;
      else if (upTo(p.comp_approved_at, key)) compApproved += amount;
      compGranted += (amount * paidPercentAt(p.payments, key)) / 100;
    }
    if (p.decision_id && upTo(p.decision_linked_at, key)) {
      decisionParcels++;
      decisions.add(p.decision_id);
      if (upTo(p.decision_confirmed_at, key)) confirmed.add(p.decision_id);
    }
    const id = statusAt(p.events, key);
    if (p.events.some((e) => monthKey(e.date) === key)) changedThisMonth++;
    const row = id === null ? undefined : byId.get(id);
    if (!row) {
      unknown++;
      continue;
    }
    row.count++;
    row.areaM2 += p.area_m2 || 0;
    if (row.status.is_released) {
      released++;
      releasedAreaM2 += p.area_m2 || 0;
    }
  }
  const byStatus = Array.from(byId.values())
    .filter((r) => r.count > 0)
    .sort((a, b) => a.status.sort_order - b.status.sort_order || a.status.id - b.status.id);
  return {
    total: parcels.length,
    byStatus,
    unknown,
    released,
    releasedAreaM2,
    changedThisMonth,
    compTotal,
    compIssued,
    compApproved,
    compUnapproved: compTotal - compIssued - compApproved,
    compGranted,
    decisionParcels,
    decisions: decisions.size,
    decisionsConfirmed: confirmed.size,
  };
}

export interface Iso {
  /** px / метр */
  s: number;
  /** дэлгэцийн төв */
  cx: number;
  cy: number;
  /** ертөнцийн төв (3857) */
  ox: number;
  oy: number;
}

export function project(iso: Iso, wx: number, wy: number, z = 0): [number, number] {
  const x = wx - iso.ox;
  const y = -(wy - iso.oy);
  return [iso.cx + (x - y) * CHRONOS_ISO_COS * iso.s, iso.cy + (x + y) * CHRONOS_ISO_SIN * iso.s - z];
}

/** Газрын (z=0) түвшинд дэлгэцээс ертөнц рүү. */
export function unproject(iso: Iso, sx: number, sy: number): [number, number] {
  const u = (sx - iso.cx) / (CHRONOS_ISO_COS * iso.s); // x − y
  const v = (sy - iso.cy) / (CHRONOS_ISO_SIN * iso.s); // x + y
  const x = (u + v) / 2;
  const y = (v - u) / 2;
  return [x + iso.ox, -y + iso.oy];
}

/**
 * Tile (зүүн дээд булан tminx/tmaxy, пикселийн хэмжээ res метр) зурах
 * canvas.setTransform(a, b, c, d, e, f) — tile-ийн (u, v) пиксел → дэлгэц.
 */
export function tileTransform(iso: Iso, tminx: number, tmaxy: number, res: number): [number, number, number, number, number, number] {
  const k = iso.s * res;
  const dx = tminx - iso.ox;
  const dy = tmaxy - iso.oy;
  return [
    CHRONOS_ISO_COS * k,
    CHRONOS_ISO_SIN * k,
    -CHRONOS_ISO_COS * k,
    CHRONOS_ISO_SIN * k,
    iso.cx + CHRONOS_ISO_COS * iso.s * (dx + dy),
    iso.cy + CHRONOS_ISO_SIN * iso.s * (dx - dy),
  ];
}

/** Хүрээг (3857) дэлгэцэд багтаах изометр параметр. */
export function fitIso(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  padding = 80,
): Iso {
  const [minx, miny, maxx, maxy] = bbox;
  const ox = (minx + maxx) / 2;
  const oy = (miny + maxy) / 2;
  const w = Math.max(1, maxx - minx);
  const h = Math.max(1, maxy - miny);
  // Изометр дэх хүрээний өргөн/өндөр (s=1): өргөн = (w + h)·cos, өндөр = (w + h)·sin.
  const isoW = (w + h) * CHRONOS_ISO_COS;
  const isoH = (w + h) * CHRONOS_ISO_SIN + CHRONOS_MAX_HEIGHT;
  const s = Math.min((width - padding * 2) / isoW, (height - padding * 2) / isoH);
  return { s: Math.max(1e-6, s), cx: width / 2, cy: height / 2, ox, oy };
}

/** Цэг олон өнцөгт дотор эсэх (ray casting). */
export function pointInPolygon(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** GeoJSON Polygon/MultiPolygon → гадаад цагиргууд (нүхгүй). */
export function outerRings(geometry: { type: string; coordinates: unknown } | null | undefined): [number, number][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const c = geometry.coordinates as [number, number][][];
    return c?.[0]?.length ? [c[0]] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return ((geometry.coordinates as [number, number][][][]) ?? []).map((p) => p?.[0]).filter((r) => r?.length >= 3);
  }
  return [];
}

/** Цагирагийн талбайн төв (shoelace); доройтсон бол дундаж. */
export function ringCentroid(ring: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** XYZ tile-ийн түвшин: дэлгэцийн 1px ≈ tile-ийн 1px. */
export function tileZoom(s: number, maxZoom = 20): number {
  const z = Math.round(Math.log2(156543.03392804097 * s * CHRONOS_ISO_COS));
  return Math.max(0, Math.min(maxZoom, z));
}
