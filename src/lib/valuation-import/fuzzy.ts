// Sheet болон багана толгойг ойролцоо утгаар тааруулах fuzzy логик.
// Excel-ийн sheet нэр/толгой бичвэрүүд хувилбар болгонд өөр байдаг тул
// substring → Levenshtein харьцаа → token давхцал гэсэн 3 давхаргаар шалгана.

import { normalizeText, normalizeKey } from "./normalize.ts";

/** Levenshtein зай. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0..1 ижил төстэй байдлын харьцаа (1 = яг ижил). */
export function ratio(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Token (үг) давхцлын харьцаа — үг дараалал өөр байсан ч ажиллана. */
function tokenScore(a: string, b: string): number {
  const ta = Array.from(new Set(normalizeText(a).split(" ").filter(Boolean)));
  const tb = Array.from(new Set(normalizeText(b).split(" ").filter(Boolean)));
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const t of ta) {
    // үг нь нөгөө талын аль нэг үгэнд агуулагдвал (эсвэл эсрэгээр) тооцно
    if (tb.some((x) => x.includes(t) || t.includes(x))) hit++;
  }
  return hit / Math.max(ta.length, tb.length);
}

/** Аль нэг талбар нөгөөгөө агуулж байвал өндөр оноо. */
function containScore(a: string, b: string): number {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (!ka || !kb) return 0;
  if (ka.includes(kb) || kb.includes(ka)) return 0.9;
  return 0;
}

export function similarity(a: string, b: string): number {
  return Math.max(ratio(a, b), tokenScore(a, b), containScore(a, b));
}

export interface MatchResult {
  value: string;
  index: number;
  score: number;
}

/**
 * Сонголтуудаас target-т хамгийн ойрыг threshold-оор шүүж буцаана.
 * Аль ч хувилбар босго давахгүй бол null (UI дээр гар сонголт руу шилжинэ).
 */
export function bestMatch(
  target: string,
  candidates: string[],
  threshold = 0.75,
): MatchResult | null {
  let best: MatchResult | null = null;
  for (let index = 0; index < candidates.length; index++) {
    const value = candidates[index];
    const score = similarity(target, value);
    if (best === null || score > best.score) best = { value, index, score };
  }
  return best !== null && best.score >= threshold ? best : null;
}
