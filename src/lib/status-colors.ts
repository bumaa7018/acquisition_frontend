/**
 * Нэгж талбарын төлөвийн шошгоны өнгө — бүртгэлийн ГАНЦ hex өнгөнөөс
 * (`parcel_status.color`) дэвсгэр, хүрээ, текст, цэгийн цагирагийг гаргана.
 *
 * OKLCH орон зайд: өнгөний hue-г хадгалж, lightness-ийг theme бүрийн уншигдах
 * хязгаарт шахна. Хар, цагаан, неон гэх мэт дурын өнгө light ба dark хоёуланд
 * уншигдана (текст/дэвсгэр ≥ 4.5:1 — tests/status-colors.test.mjs).
 *
 *   Хэсэг    | L (light / dark)                 | C
 *   ---------|----------------------------------|-----------------
 *   дэвсгэр  | 0.965 / 0.27                     | min(c·0.4, 0.045)
 *   хүрээ    | 0.87  / 0.42                     | min(c, 0.11)
 *   текст    | clamp(0,l,0.46) / clamp(0.83,l,1)| min(c, 0.17)
 *   цагираг  | 0.62  / 0.66                     | min(c, 0.1)
 *   цэг      | өнгө өөрчлөлтгүй
 *
 * ИЖИЛ томьёо CSS-д (status-label.css, `oklch(from …)`) — энэ нь түүний
 * fallback: relative color syntax дэмждэггүй хөтөчид бэлэн hex утга өгнө.
 * Нэгийг нь өөрчилбөл нөгөөг нь заавал хамт өөрчил.
 */

export type StatusTheme = "light" | "dark";

export interface StatusThemeParams {
  bgL: number;
  bdL: number;
  txMin: number;
  txMax: number;
  ringL: number;
}

export const STATUS_THEME_PARAMS: Record<StatusTheme, StatusThemeParams> = {
  light: { bgL: 0.965, bdL: 0.87, txMin: 0, txMax: 0.46, ringL: 0.62 },
  dark: { bgL: 0.27, bdL: 0.42, txMin: 0.83, txMax: 1, ringL: 0.66 },
};

/** Өнгө тохируулаагүй / буруу хэлбэртэй төлөвийн саарал. */
export const STATUS_FALLBACK_COLOR = "#94A3B8";

export interface StatusColors {
  /** Цэг — бүртгэлийн өнгө өөрчлөлтгүй. */
  dot: string;
  bg: string;
  border: string;
  text: string;
  ring: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Бүртгэлийн өнгийг шалгаж, том үсэгтэй `#RRGGBB` болгоно. Буруу утгыг
 * (CSS-д шууд очих тул injection-оос сэргийлж) саарлаар орлуулна.
 */
export function normalizeStatusColor(color?: string | null): string {
  return color && HEX_RE.test(color) ? color.toUpperCase() : STATUS_FALLBACK_COLOR;
}

// ── sRGB ↔ OKLCH (Björn Ottosson, OKLab) ─────────────────────────────────────

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): [l: number, c: number, h: number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  // Ахроматик (хар, цагаан, саарал) — hue тодорхойгүй; 0 гэж үзнэ (C≈0 тул нөлөөгүй).
  const H = C < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** OKLCH → `#RRGGBB`. sRGB-ээс гадуурх утгыг суваг бүрээр тайрна (хөтчийн адил). */
export function oklchToHex(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

/** Ганц өнгөнөөс theme-д тохирсон шошгоны өнгөнүүд. */
export function deriveStatusColors(color: string | null | undefined, theme: StatusTheme): StatusColors {
  const dot = normalizeStatusColor(color);
  const [l, c, h] = hexToOklch(dot);
  const p = STATUS_THEME_PARAMS[theme];
  return {
    dot,
    bg: oklchToHex(p.bgL, Math.min(c * 0.4, 0.045), h),
    border: oklchToHex(p.bdL, Math.min(c, 0.11), h),
    text: oklchToHex(clamp(p.txMin, l, p.txMax), Math.min(c, 0.17), h),
    ring: oklchToHex(p.ringL, Math.min(c, 0.1), h),
  };
}

/** WCAG 2 харьцангуй тодрол. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 контраст (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Шошгоны inline CSS хувьсагчид: `--c` (CSS-ийн `oklch(from …)` томьёонд) ба
 * хоёр theme-ийн бэлэн fallback утга (`--st-*-light` / `--st-*-dark`).
 * Аль theme идэвхтэйг CSS сонгоно — JS theme мэдэх шаардлагагүй (SSR-д ч тогтвортой).
 */
export function statusLabelVars(color: string | null | undefined): Record<string, string> {
  const vars: Record<string, string> = { "--c": normalizeStatusColor(color) };
  for (const theme of ["light", "dark"] as const) {
    const d = deriveStatusColors(color, theme);
    vars[`--st-bg-${theme}`] = d.bg;
    vars[`--st-bd-${theme}`] = d.border;
    vars[`--st-tx-${theme}`] = d.text;
    vars[`--st-ring-${theme}`] = d.ring;
  }
  return vars;
}
