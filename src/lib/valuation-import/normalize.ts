// Текст нормчлол: илүү зай, том/жижиг үсэг, латин↔кирилл homoglyph-ийг
// жигдрүүлж, sheet/багана/утгын тааруулалтыг найдвартай болгоно.

// Латин үсэг → кирилл дүрс адил үсэг рүү буулгах хүснэгт.
// Excel-д гараас бичихдээ латин үсэг холилдох тохиолдол элбэг тул хамгаална.
const HOMOGLYPH: Record<string, string> = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  i: "і",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
};

/** Зөвхөн доод регистрийн латин үсгийг кирилл дүрс адил үсгээр солино. */
export function fixHomoglyphs(input: string): string {
  let out = "";
  for (const ch of input) {
    out += HOMOGLYPH[ch] ?? ch;
  }
  return out;
}

/**
 * Тааруулалтад ашиглах нормчилсон түлхүүр:
 * - trim + доод регистр
 * - дараалсан цагаан зайг нэг зай болгох (мөр таслалт орно)
 * - homoglyph засах
 * - үг хоорондын зайг устгаж болохгүй (token match-д хэрэгтэй)
 */
export function normalizeText(input: unknown): string {
  const s = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return fixHomoglyphs(s);
}

/** Тааруулалтад зай, цэг таслал, тусгай тэмдэгтийг устгасан хатуу түлхүүр. */
export function normalizeKey(input: unknown): string {
  return normalizeText(input).replace(/[\s.,\-/_()"'«»]/g, "");
}

/**
 * Excel-ийн тоон утгыг найдвартай задлана. "480 м.Кв", "1,606,000",
 * "36 500", "1.054" зэргийг зөв уншина. Задарч чадахгүй бол null.
 */
export function parseNumber(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s) return null;
  // Тооноос бусад угтвар/дагаврыг (нэгж г.м) хасаад зөвхөн тоон хэсгийг авна.
  // Мянгатын таслал (, эсвэл зай) устгаж, аравтын таслалыг цэг болгоно.
  s = s.replace(/[^\d.,\-\s]/g, " ").trim();
  const firstToken = s.split(/\s{2,}/)[0]?.trim() ?? s;
  let t = firstToken.replace(/\s/g, "");
  // Ядаж нэг цифргүй бол тоо биш (хоосон эсвэл "д/д", "#ERROR!" г.м).
  if (!/\d/.test(t)) return null;
  // Хэрэв таслал ба цэг хоёулаа байвал сүүлчийнхийг аравтын гэж үзнэ.
  if (t.includes(",") && t.includes(".")) {
    t = t.lastIndexOf(",") > t.lastIndexOf(".")
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    // Ганц таслал: аравтын таслал (1,054) эсвэл мянгат (1,606,000)?
    const parts = t.split(",");
    t = parts.length === 2 && parts[1].length !== 3
      ? t.replace(",", ".")
      : t.replace(/,/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
