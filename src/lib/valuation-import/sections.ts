// Нэг sheet дээр 3.1–5.1 хэсгүүд ДАРААЛАН байрласан ШИНЭ загварыг хэсэг болгон хуваах.
//
// Шинэ загварын онцлог:
//  • Бүх хүснэгт "Sheet1"-д, гарчгийн мөрөөр (3.1, 3.2, … / G баганад "Хүснэгт N") тусгаарлагдана.
//  • Хүснэгт бүрийн дараа (заримд нь ГАРЧГИЙН ДАРАА, толгойн өмнө) "ТАЙЛБАР:" мөр байна.
//  • Өгөгдөл зөвхөн ДООШОО мөрөөр нэмэгддэг — багана тогтмол.
// Тиймээс хэсгийн хил, тайлбарыг эндээс тодорхойлж, задлалтыг хэсэг тус бүрээр хийнэ.

import { normalizeKey, normalizeText } from "./normalize.ts";
import type { Cell, Grid } from "./extract.ts";
import type { ValuationSectionKey } from "./types.ts";

export interface ValuationSection {
  key: ValuationSectionKey | null; // танигдаагүй хэсэг бол null
  no: string; // "3.1" гэх мэт дугаар (байхгүй бол "")
  title: string; // гарчгийн бичвэр (дугаартайгаа)
  tableLabel: string; // "Хүснэгт-3" (G баганад бичигддэг) — байхгүй бол ""
  titleRow: number; // гарчгийн мөрийн индекс (grid дотор)
  rows: Grid; // ТАЙЛБАР-аас бусад мөрүүд (толгой + өгөгдөл)
  note: string; // ТАЙЛБАР-ын бичвэр (олон мөр бол \n-ээр)
}

// Хэсгийн дугаар → түлхүүр. Дугаар шилжсэн тохиолдолд гарчгийн үгээр давхар тааруулна.
const BY_NUMBER: Record<string, ValuationSectionKey> = {
  "3.1": "property_desc",
  "3.2": "land_legal",
  "3.3": "land_valuation",
  "3.4": "building_spec",
  "3.5": "building_cost",
  "3.6": "other_assets",
  "3.7": "temporary_cost",
  "3.8": "clearance_cost",
  "3.9": "lost_income",
  "4.1": "summary",
  "4.2": "conclusion",
  "5.1": "certification",
};

// Гарчгийн үгээр тааруулах (дугаар өөрчлөгдсөн ч ажиллана). Дараалал нь ЧУХАЛ —
// эхэлж тохирсон нь сонгогдоно (жишээ: "барилгын тодорхойлолт" нь "тодорхойлолт"-оос өмнө).
const BY_TITLE: [ValuationSectionKey, string[]][] = [
  ["building_spec", ["барилгынтодорхойлолт", "барилгынүзүүлэлт"]],
  ["building_cost", ["өртгийнхандлага", "өртгийнтооцоолол"]],
  ["property_desc", ["үнэлжбуйхөрөнгүүд", "хөрөнгийнтанилцуулга", "хөрөнгийнтодорхойлолт"]],
  ["land_legal", ["эрхзүйнбайдал"]],
  ["land_valuation", ["газрынүнэлгээ"]],
  ["other_assets", ["бусадэдхөрөнгө", "бусадхөрөнгө"]],
  ["temporary_cost", ["түрсуурьшуулах", "түрсууршуулах"]],
  ["clearance_cost", ["газарчөлөөлөх", "чөлөөлөхзардал"]],
  ["lost_income", ["орлогыналдагдсан", "алдагдсанболомж"]],
  ["summary", ["хураангуйнэгтгэл", "нэгтгэл"]],
  ["conclusion", ["дүгнэлт"]],
  ["certification", ["баталгаа", "хязгаарлахнөхцөл", "нийцэлтийнмэдэгдэл"]],
];

function text(c: Cell): string {
  return c == null ? "" : String(c).trim();
}

/** Мөрийн эхний хоосон биш нүдний бичвэр. */
function firstText(row: Grid[number]): string {
  for (const c of row) {
    const t = text(c);
    if (t) return t;
  }
  return "";
}

/** Мөрөнд "Хүснэгт …" гэсэн шошго байвал буцаана. */
function tableLabelOf(row: Grid[number]): string {
  for (const c of row) {
    const t = text(c);
    if (/^хүснэгт/i.test(normalizeText(t))) return t;
  }
  return "";
}

/** "3.1 …", "4.2. …" мэтийн хэсгийн гарчиг мөр эсэх — дугаарыг буцаана ("" бол биш). */
function sectionNumberOf(row: Grid[number]): string {
  const t = firstText(row);
  const m = /^(\d{1,2}\.\d{1,2})\.?\s*\S/.exec(t.replace(/\s+/g, " "));
  return m ? m[1] : "";
}

/** "ТАЙЛБАР:" мөр эсэх. */
export function isNoteRow(row: Grid[number]): boolean {
  return normalizeKey(firstText(row)).startsWith("тайлбар");
}

/** "ТАЙЛБАР: …" бичвэрээс угтварыг нь хасаж, утгыг нь авна. */
function noteTextOf(row: Grid[number]): string {
  const parts: string[] = [];
  for (const c of row) {
    const t = text(c);
    if (t) parts.push(t);
  }
  const joined = parts.join(" ").trim();
  return joined.replace(/^\s*тайлбар\s*[:：-]?\s*/i, "").trim();
}

/** Мөрөнд утга (бичвэр эсвэл тоо) байгаа эсэх. */
function hasContent(row: Grid[number]): boolean {
  return row.some((c) => text(c) !== "");
}

function keyOfTitle(no: string, title: string): ValuationSectionKey | null {
  const k = normalizeKey(title);
  for (const [key, words] of BY_TITLE) {
    if (words.some((w) => k.includes(w))) return key;
  }
  return BY_NUMBER[no] ?? null;
}

/**
 * Grid-ийг хэсэг болгон хуваана. Гарчгийн мөрөөс дараагийн гарчиг хүртэлх мөрүүд
 * тухайн хэсгийнх. ТАЙЛБАР мөр (болон түүний үргэлжлэл) нь `note`-д, бусад нь `rows`-д.
 */
export function splitSections(grid: Grid): ValuationSection[] {
  const starts: { idx: number; no: string; title: string; label: string }[] = [];
  grid.forEach((row, i) => {
    const no = sectionNumberOf(row);
    if (!no) return;
    starts.push({ idx: i, no, title: firstText(row), label: tableLabelOf(row) });
  });

  const out: ValuationSection[] = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].idx : grid.length;
    const rows: Grid = [];
    const notes: string[] = [];
    let inNote = false;
    for (let i = start.idx + 1; i < end; i++) {
      const row = grid[i];
      if (isNoteRow(row)) {
        inNote = true;
        const t = noteTextOf(row);
        if (t) notes.push(t);
        continue;
      }
      if (!hasContent(row)) continue;
      // ТАЙЛБАР-ын дараах ЗӨВХӨН нэг бичвэр нүдтэй, тоогүй мөрүүд нь тайлбарын үргэлжлэл
      // (Excel дээр урт тайлбарыг доод мөрөнд үргэлжлүүлэн бичсэн байдаг).
      const filled = row.filter((c) => text(c) !== "");
      if (inNote && filled.length === 1 && rows.length > 0) {
        notes.push(text(filled[0]));
        continue;
      }
      inNote = false;
      rows.push(row);
    }
    out.push({
      key: keyOfTitle(start.no, start.title),
      no: start.no,
      title: start.title,
      tableLabel: start.label,
      titleRow: start.idx,
      rows,
      note: notes.join("\n").trim(),
    });
  }
  return out;
}

/**
 * Уг sheet дээр танигдсан хэсэг хэд байгаа (0 = шинэ загвар биш).
 * Хоосон хэсгүүдийг (өгөгдлийн мөргүй) тооцохгүй — хуучин файлд агуулагддаг
 * "ҮТ-загвар" мэт БӨГЛӨӨГҮЙ загвар хуудсыг бодит өгөгдөлтэй хуудастай андуурахгүй.
 */
export function countSections(grid: Grid): number {
  const keys = new Set<ValuationSectionKey>();
  for (const s of splitSections(grid)) {
    if (!s.key) continue;
    const hasData = s.rows.length > 1 || (s.rows.length === 1 && s.note !== "");
    if (hasData || s.note) keys.add(s.key);
  }
  return keys.size;
}

/**
 * Уг sheet нь ШИНЭ (нэг хуудсан) загвар мөн эсэх.
 * Дор хаяж 3 танигдсан хэсэгтэй бол тийм гэж үзнэ.
 */
export function isSingleSheetLayout(grid: Grid): boolean {
  return countSections(grid) >= 3;
}

/** Хэсгийн гарчгаас дугаарыг хасаж, цэвэр нэрийг авна ("3.8 Газар чөлөөлөх зардал" → "Газар чөлөөлөх зардал"). */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/^\d{1,2}\.\d{1,2}\.?\s*/, "")
    .trim();
}
