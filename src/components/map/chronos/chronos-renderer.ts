/**
 * «Он цагийн зураг» canvas renderer — изометр блок, анимэйшн, суурь (харанхуй тор
 * эсвэл суурь зургийн tile), hit-test. React-аас хамааралгүй; ChronosView
 * үүсгэж, төлөвийг setter-ээр дамжуулна. Бүх математик нь @/lib/chronos-д.
 *
 * Сонгосон сарын байдлаар: өнгө = явцын төлөв, өндөр = явцын эрэмбэ (ахих
 * тусам намхан «хашаа»), чөлөөлсөн = төлөвийн өнгөтэй тасархай контур,
 * түүх нь хараахан эхлээгүй (чөлөөлөгдөөгүй) = саарал хашаа. Төлөв нь өөрчлөгдсөн нэгж талбар газраас
 * долгион шиг (хол → ойр) дараалан зөөлөн босно.
 */
import {
  type ChronosParcel,
  type ChronosStatus,
  type Iso,
  CHRONOS_NO_COLOR,
  CHRONOS_NOT_STARTED,
  fitIso,
  monthKey,
  outerRings,
  pointInPolygon,
  progressHeights,
  project,
  ringCentroid,
  shade,
  tileTransform,
  tileZoom,
  unproject,
} from "@/lib/chronos";

export type ChronosBasemap = "dark" | "imagery";

const C = {
  bg: "#07090D",
  floor: "#0C1118",
  floorBorder: "#1B2430",
  grid: "#121821",
  future: "#33404F",
  select: "#FFFFFF",
};
const WORLD = 20037508.342789244;

type Mode = "block" | "released" | "unknown";

interface Item {
  p: ChronosParcel;
  rings: [number, number][][];
  centroid: [number, number];
  depth: number;
  /** Төлөвийн түүх — сараар (огноогоор эрэмбэлсэн). */
  events: { key: string; status: number }[];
  cur: number;
  target: number;
  color: string;
  /** Чөлөөлсөн төлөвт шилжихэд хашаа намсах үеийн (өмнөх) өнгө. */
  fromColor: string;
  mode: Mode;
  /** Өмнөх сарын төлөв — өөрчлөгдсөн эсэхийг таних. */
  state: string;
  /** Энэ хугацаанаас (ms) өмнө газарт хүлээнэ — долгион шиг дараалан босгоно. */
  riseAt: number;
  /** Чөлөөлсөн контурын гарч ирэх явц (0–1). */
  appear: number;
  phase: number;
}

/** Дараалан босох долгионы нийт хугацаа ба өндрийн зөөлөн шилжилт. */
const WAVE_MS = 550;
const EASE = 0.1;

/** Тогтвортой псевдо-санамсаргүй (id-аас) — анимэйшний delay/гэрлийн байршил. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export class ChronosRenderer {
  private ctx: CanvasRenderingContext2D;
  private items: Item[] = [];
  private iso: Iso = { s: 1, cx: 0, cy: 0, ox: 0, oy: 0 };
  private bbox: [number, number, number, number] | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private asOf = 0;
  private months: string[] = [];
  private statusById = new Map<number, ChronosStatus>();
  private heights = new Map<number, number>();
  private basemap: ChronosBasemap = "dark";
  private tileUrls: string[] = [];
  private maxZoom = 20;
  private tiles = new Map<string, HTMLImageElement | null>();
  private selected: string | null = null;
  private hover: string | null = null;
  private raf = 0;
  private dirty = true;
  private start = performance.now();
  private destroyed = false;
  private lastDraw = 0;

  constructor(private canvas: HTMLCanvasElement, private reducedMotion: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context алга");
    this.ctx = ctx;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.tiles.clear();
  }

  resize(w: number, h: number, dpr: number) {
    const first = this.w === 0;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (first) this.fit();
    else {
      this.iso.cx = w / 2;
      this.iso.cy = h / 2;
    }
    this.dirty = true;
  }

  setData(parcels: ChronosParcel[], months: string[], statuses: ChronosStatus[]) {
    this.months = months;
    this.statusById = new Map(statuses.map((st) => [st.id, st]));
    this.heights = progressHeights(statuses);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    this.items = parcels
      .map((p) => {
        const rings = outerRings(p.geometry);
        if (!rings.length) return null;
        for (const r of rings) for (const [x, y] of r) {
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
        const centroid = ringCentroid(rings[0]);
        return {
          p,
          rings,
          centroid,
          // Изометрт хол → ойр: x + y = (wx − ox) − (wy − oy) өсөхөөр.
          depth: centroid[0] - centroid[1],
          events: p.events.map((e) => ({ key: monthKey(e.date), status: e.status_id })),
          cur: 0,
          target: 0,
          color: C.future,
          fromColor: C.future,
          mode: "unknown",
          state: "",
          riseAt: 0,
          appear: 1,
          phase: hash(p.id),
        } as Item;
      })
      .filter((x): x is Item => x !== null)
      .sort((a, b) => a.depth - b.depth);
    this.bbox = this.items.length ? [minx, miny, maxx, maxy] : null;
    this.fit();
    this.applyTargets();
  }

  setAsOf(idx: number) {
    this.asOf = idx;
    this.applyTargets();
  }

  private applyTargets() {
    const key = this.months[this.asOf] ?? "";
    const now = performance.now();
    const n = Math.max(1, this.items.length);
    this.items.forEach((it, idx) => {
      let status: number | null = null;
      for (const e of it.events) {
        if (e.key <= key) status = e.status;
        else break;
      }
      const st = status === null ? undefined : this.statusById.get(status);
      const prevColor = it.color;
      const prevMode = it.mode;
      if (!st) {
        // Тухайн үед түүх нь эхлээгүй — чөлөөлөгдөөгүй, саарал хашаа (эхний шатны өндөр).
        it.mode = "unknown";
        it.color = CHRONOS_NOT_STARTED;
        it.target = Math.max(4, ...Array.from(this.heights.values()));
      } else if (st.is_released) {
        it.mode = "released";
        it.color = st.color || CHRONOS_NO_COLOR;
        it.target = 0;
      } else {
        it.mode = "block";
        it.color = st.color || CHRONOS_NO_COLOR;
        it.target = this.heights.get(st.id) ?? 4;
      }
      const state = `${it.mode}:${status ?? ""}`;
      if (this.reducedMotion) {
        it.cur = it.target;
        it.appear = 1;
      } else if (state !== it.state) {
        // Төлөв өөрчлөгдсөн — хол → ойр долгион шиг дараалан. Хашаа байсан бол
        // одоогийн өндрөөсөө шинэ өндөр рүү зөөлөн өндөрсөж/НАМСАНА (газар
        // унахгүй); чөлөөлсөн болбол газар хүртэл намсаад тасархай контур гарна.
        // Анх гарч ирэх эсвэл чөлөөлсөнөөс буцах үед л газраас босно.
        const wasFence = it.state !== "" && prevMode !== "released" && it.cur > 0.3;
        if (!wasFence) it.cur = 0;
        it.fromColor = wasFence ? prevColor : it.color;
        it.riseAt = now + (idx / n) * WAVE_MS;
        it.appear = 0;
      }
      it.state = state;
    });
    this.dirty = true;
  }

  setBasemap(mode: ChronosBasemap, urls: string[], maxZoom: number) {
    this.basemap = mode;
    this.tileUrls = urls;
    this.maxZoom = maxZoom;
    this.dirty = true;
  }

  setSelected(id: string | null) {
    this.selected = id;
    this.dirty = true;
  }

  setHover(id: string | null) {
    if (this.hover === id) return;
    this.hover = id;
    this.dirty = true;
  }

  fit() {
    if (!this.w || !this.h) return;
    this.iso = this.bbox
      ? fitIso(this.bbox, this.w, this.h, Math.min(140, Math.max(40, this.w * 0.12)))
      : { s: 0.05, cx: this.w / 2, cy: this.h / 2, ox: 11_900_000, oy: 6_090_000 };
    this.dirty = true;
  }

  panBy(dx: number, dy: number) {
    this.iso.cx += dx;
    this.iso.cy += dy;
    this.dirty = true;
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = unproject(this.iso, sx, sy);
    this.iso.s = Math.min(50, Math.max(1e-4, this.iso.s * factor));
    const [nx, ny] = project(this.iso, wx, wy);
    this.iso.cx += sx - nx;
    this.iso.cy += sy - ny;
    this.dirty = true;
  }

  /** Сонгосон нэгж талбарыг дэлгэцийн төвд. */
  focus(id: string) {
    const it = this.items.find((i) => i.p.id === id);
    if (!it) return;
    const [sx, sy] = project(this.iso, it.centroid[0], it.centroid[1]);
    this.panBy(this.w / 2 - sx, this.h / 2 - sy);
  }

  hitTest(sx: number, sy: number): string | null {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      for (const ring of it.rings) {
        const top = ring.map(([x, y]) => project(this.iso, x, y, it.cur));
        const base = ring.map(([x, y]) => project(this.iso, x, y, 0));
        if (pointInPolygon(sx, sy, top) || pointInPolygon(sx, sy, base)) return it.p.id;
      }
    }
    return null;
  }

  private loop(now: number) {
    if (this.destroyed) return;
    let moving = false;
    for (const it of this.items) {
      if (now < it.riseAt) {
        moving = true;
        continue;
      }
      // Тасархай контур — хашаа газар хүртэл намсаж дууссаны дараа гарч ирнэ.
      if (it.appear < 1 && it.cur <= 0.3) {
        it.appear = Math.min(1, it.appear + 0.06);
        moving = true;
      }
      const d = it.target - it.cur;
      if (Math.abs(d) < 0.15) it.cur = it.target;
      else {
        it.cur += d * EASE;
        moving = true;
      }
    }
    // Зөвхөн өөрчлөлт/хөдөлгөөн байвал зурна — сул үед мянга мянган нэгж
    // талбарыг 60fps-ээр дахин зурж CPU/GPU-г тасралтгүй ачаалахгүй. Сонгосон
    // нэгж талбарын гэрлийн цохилт л үргэлжилнэ — 30fps-ээр хязгаарлана.
    const pulse = !this.reducedMotion && this.selected !== null && now - this.lastDraw >= 33;
    if (this.dirty || moving || pulse) {
      this.draw((now - this.start) / 1000);
      this.dirty = false;
      this.lastDraw = now;
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  private draw(t: number) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    if (this.basemap === "imagery") this.drawTiles();
    else this.drawGrid();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.basemap === "dark") this.drawFloor();
    else {
      // Блокуудыг тодруулах бүдэг хаалт.
      ctx.fillStyle = "rgba(7,9,13,0.28)";
      ctx.fillRect(0, 0, this.w, this.h);
    }

    const anim = !this.reducedMotion;
    for (const it of this.items) this.drawItem(it);
    const sel = this.selected ? this.items.find((i) => i.p.id === this.selected) : null;
    if (sel) this.drawSelection(sel, t, anim);
  }

  private visibleWorld(): [number, number, number, number] {
    const pts = [
      unproject(this.iso, 0, 0),
      unproject(this.iso, this.w, 0),
      unproject(this.iso, 0, this.h),
      unproject(this.iso, this.w, this.h),
    ];
    return [
      Math.min(...pts.map((p) => p[0])),
      Math.min(...pts.map((p) => p[1])),
      Math.max(...pts.map((p) => p[0])),
      Math.max(...pts.map((p) => p[1])),
    ];
  }

  private drawGrid() {
    const ctx = this.ctx;
    const [minx, miny, maxx, maxy] = this.visibleWorld();
    // Торын алхам ≈ 50px — 1·2·5 цуваа.
    const raw = 50 / (this.iso.s * 0.866);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= raw) ?? raw;
    if ((maxx - minx) / step > 400 || (maxy - miny) / step > 400) return;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(minx / step) * step; x <= maxx; x += step) {
      const [ax, ay] = project(this.iso, x, miny);
      const [bx, by] = project(this.iso, x, maxy);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    for (let y = Math.floor(miny / step) * step; y <= maxy; y += step) {
      const [ax, ay] = project(this.iso, minx, y);
      const [bx, by] = project(this.iso, maxx, y);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }

  private drawFloor() {
    if (!this.bbox) return;
    const ctx = this.ctx;
    const [minx, miny, maxx, maxy] = this.bbox;
    const padX = (maxx - minx) * 0.12 + 20;
    const padY = (maxy - miny) * 0.12 + 20;
    const corners = [
      [minx - padX, miny - padY],
      [maxx + padX, miny - padY],
      [maxx + padX, maxy + padY],
      [minx - padX, maxy + padY],
    ].map(([x, y]) => project(this.iso, x, y));
    ctx.beginPath();
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = C.floor;
    ctx.fill();
    ctx.strokeStyle = C.floorBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawTiles() {
    if (!this.tileUrls.length) return;
    const ctx = this.ctx;
    const z = tileZoom(this.iso.s, this.maxZoom);
    const n = 2 ** z;
    const size = (2 * WORLD) / n;
    const [minx, miny, maxx, maxy] = this.visibleWorld();
    const x0 = Math.max(0, Math.floor((minx + WORLD) / size));
    const x1 = Math.min(n - 1, Math.floor((maxx + WORLD) / size));
    const y0 = Math.max(0, Math.floor((WORLD - maxy) / size));
    const y1 = Math.min(n - 1, Math.floor((WORLD - miny) / size));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return;
    const res = size / 256;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        const img = this.tile(z, tx, ty);
        if (!img) continue;
        const [a, b, c, d, e, f] = tileTransform(this.iso, -WORLD + tx * size, WORLD - ty * size, res);
        const k = this.dpr;
        ctx.setTransform(a * k, b * k, c * k, d * k, e * k, f * k);
        // 1px давхцуулж tile хоорондын зурвасыг арилгана.
        ctx.drawImage(img, 0, 0, 256, 256, 0, 0, 256.6, 256.6);
      }
    }
  }

  private tile(z: number, x: number, y: number): HTMLImageElement | null {
    const key = `${z}/${x}/${y}`;
    const cached = this.tiles.get(key);
    if (cached !== undefined) return cached && cached.complete && cached.naturalWidth ? cached : null;
    const tpl = this.tileUrls[(x + y) % this.tileUrls.length];
    const url = tpl.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y))
      .replace("{-y}", String(2 ** z - 1 - y));
    const img = new Image();
    img.onload = () => (this.dirty = true);
    img.onerror = () => this.tiles.set(key, null);
    img.src = url;
    this.tiles.set(key, img);
    if (this.tiles.size > 600) {
      const first = this.tiles.keys().next().value;
      if (first) this.tiles.delete(first);
    }
    return null;
  }

  private drawItem(it: Item) {
    const ctx = this.ctx;
    const h = it.cur;
    const hover = this.hover === it.p.id;
    for (const ring of it.rings) {
      const base = ring.map(([x, y]) => project(this.iso, x, y, 0));
      const outline = () => {
        ctx.beginPath();
        base.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      };
      if (it.mode === "released" && h <= 0.3) {
        // Чөлөөлсөн — төлөвийн өнгөтэй тасархай контур (зөөлөн гарч ирнэ).
        outline();
        ctx.globalAlpha = it.appear;
        ctx.fillStyle = hover ? `${it.color}40` : `${it.color}1a`;
        ctx.fill();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        continue;
      }
      if (h < 0.3) {
        // Босохоо хүлээж буй — газарт нимгэн контур.
        outline();
        ctx.strokeStyle = `${it.color}66`;
        ctx.lineWidth = 1;
        ctx.stroke();
        continue;
      }
      const top = ring.map(([x, y]) => project(this.iso, x, y, h));
      // Чөлөөлсөн болж буй хашаа — өмнөх өнгөөрөө газар хүртэл намсана.
      const color = it.mode === "released" ? it.fromColor : it.color;
      // «Хашаа»: хажуу тал (хол → ойр), баруун ×0.62, зүүн ×0.42 — бага зэрэг тунгалаг.
      const walls: { d: number; i: number }[] = [];
      for (let i = 0; i < ring.length - 1; i++) {
        walls.push({ d: (ring[i][0] + ring[i + 1][0]) / 2 - (ring[i][1] + ring[i + 1][1]) / 2, i });
      }
      walls.sort((a, b) => a.d - b.d);
      ctx.globalAlpha = 0.92;
      for (const { i } of walls) {
        const a0 = base[i], a1 = base[i + 1], b1 = top[i + 1], b0 = top[i];
        ctx.beginPath();
        ctx.moveTo(a0[0], a0[1]);
        ctx.lineTo(a1[0], a1[1]);
        ctx.lineTo(b1[0], b1[1]);
        ctx.lineTo(b0[0], b0[1]);
        ctx.closePath();
        ctx.fillStyle = shade(color, a1[0] - a0[0] >= 0 ? 0.62 : 0.42);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Дээд тал — хагас тунгалаг талбай, ирмэг нь тод «хашааны дээд мод».
      ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = hover ? `${color}99` : `${color}59`;
      ctx.fill();
      ctx.strokeStyle = shade(color, hover ? 1.45 : 1.25);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  private drawSelection(it: Item, t: number, anim: boolean) {
    const ctx = this.ctx;
    const h = it.cur;
    for (const ring of it.rings) {
      const top = ring.map(([x, y]) => project(this.iso, x, y, h));
      ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    const [x, y] = project(this.iso, it.centroid[0], it.centroid[1], h);
    const glow = anim ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((t / 1.8) * Math.PI * 2)) : 1;
    const grad = ctx.createLinearGradient(x, y, x, y - 90);
    grad.addColorStop(0, `rgba(255,255,255,${0.9 * glow})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 1.5, y - 90, 3, 90);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    // ID-тай цагаан pill (96×30).
    const label = it.p.parcel_id;
    ctx.font = "600 12px 'IBM Plex Mono', ui-monospace, monospace";
    const w = Math.max(96, ctx.measureText(label).width + 24);
    const px = x - w / 2;
    const py = y - 90 - 30;
    ctx.fillStyle = "#F4EFE4";
    ctx.beginPath();
    ctx.roundRect(px, py, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = "#07090D";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, py + 15);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}
