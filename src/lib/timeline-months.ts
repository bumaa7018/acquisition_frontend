/** Цагийн графикийн нэг цэг — `YYYY.MM` ба тухайн сарын тоо. */
export type MonthPoint = { date: string; count: number };

/** Backend-ээс ирэх түүхий цэг — `YYYY.MM.DD` нарийвчлалтай. */
export type RawTimelinePoint = { date?: string; count?: number };

/**
 * Түүхий огноон цэгүүдийг САРААР нэгтгэж, сонгосон ОНЫ БҮХ САРЫГ гаргана.
 *
 * ЯАГААД: backend нь чөлөөлөлтийн эхлэх огноо тутамд нэг цэг буцаадаг тул
 * графикт ӨГӨГДӨЛ БАЙГАА эхний өдрөөс л эхэлдэг байв — хайлтад 2024 оныг
 * сонгосон ч бүх бичлэг 2026 онд байвал график 2026-аас эхэлж, сонгосон
 * хугацааны эхлэл харагддаггүй.
 *
 * Дүрэм:
 *   • Он сонгосон бол — хамгийн эртний оны 1-р сараас хамгийн сүүлийн оны
 *     12-р сар хүртэл БҮХ сар гарна (өгөгдөлгүй сар 0).
 *   • Он сонгоогүй бол — өгөгдлийн хүрээгээр.
 *   • Он сонгосон бол тэр он тэнхлэгийг ТОДОРХОЙЛНО: гадуурх сар гарахгүй.
 *     (Оны шүүлт нь төлөвийн оноор, график нь эхлэх огноогоор явдаг тул
 *      сунгавал тэнхлэг сонгосон оноос өмнө эхэлж, төөрөгдөл үүсгэнэ.)
 *
 * Шошго нь оноо агуулдаг (`2026.01`) тул олон жил сонгоход сарууд
 * хоорондоо андуурагдахгүй.
 */
export function monthlyTimeline(
  raw: RawTimelinePoint[],
  selectedYears: number[],
  /** Он ч сонгоогүй, өгөгдөл ч байхгүй үед харуулах он (анхдагч: энэ он). */
  fallbackYear: number = new Date().getFullYear(),
): MonthPoint[] {
  const byMonth = new Map<string, number>();
  for (const pt of raw ?? []) {
    const key = String(pt?.date ?? "").slice(0, 7); // "YYYY.MM"
    if (!/^\d{4}\.\d{2}$/.test(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (pt.count ?? 0));
  }

  const keys: string[] = [];
  byMonth.forEach((_v, k) => keys.push(k));
  keys.sort();

  const yearOf = (k: string) => Number(k.slice(0, 4));
  const monthOf = (k: string) => Number(k.slice(5, 7));

  const years = (selectedYears ?? []).filter((y) => Number.isFinite(y) && y > 0);

  let loY: number;
  let loM: number;
  let hiY: number;
  let hiM: number;

  if (years.length > 0) {
    loY = Math.min(...years);
    loM = 1;
    hiY = Math.max(...years);
    hiM = 12;
  } else if (keys.length > 0) {
    loY = yearOf(keys[0]);
    loM = monthOf(keys[0]);
    hiY = yearOf(keys[keys.length - 1]);
    hiM = monthOf(keys[keys.length - 1]);
  } else {
    // Он сонгоогүй БӨГӨӨД өгөгдөл огт байхгүй — график бүхэлдээ алга болж
    // "мэдээлэл байхгүй" гэсэн ганц мөр үлддэг байв. Оны хуваарийг нь
    // харуулах нь дээр: хугацааны хүрээ ойлгогдож, тэр хугацаанд бичлэг
    // байхгүй нь тодорхой харагдана.
    loY = fallbackYear;
    loM = 1;
    hiY = fallbackYear;
    hiM = 12;
  }

  // Он СОНГООГҮЙ үед л хүрээг өгөгдөл рүү тааруулна. Он сонгосон бол тэр
  // он ТЭНХЛЭГИЙГ ТОДОРХОЙЛНО — хүрээг өгөгдөл рүү сунгахгүй.
  //
  // ЯАГААД: дашбоардын оны шүүлт нь нэгж талбарын СҮҮЛИЙН ТӨЛӨВИЙН оноор
  // ажилладаг ч энэ график нь чөлөөлөлтийн ЭХЛЭХ огноогоор байдаг — тэр хоёр
  // өөр. Иймд 2026 сонгоход эхлэх огноо нь 2024 байсан чөлөөлөлтүүд багтаж,
  // хүрээг сунгавал тэнхлэг 2024-өөс эхэлж, "сонгосон он тоосонгүй" мэт
  // харагдана. Сонгосон хугацаанаас гадуурх сар одоо тэнхлэгт гарахгүй.
  if (years.length === 0 && keys.length > 0) {
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (yearOf(first) < loY || (yearOf(first) === loY && monthOf(first) < loM)) {
      loY = yearOf(first);
      loM = monthOf(first);
    }
    if (yearOf(last) > hiY || (yearOf(last) === hiY && monthOf(last) > hiM)) {
      hiY = yearOf(last);
      hiM = monthOf(last);
    }
  }

  const out: MonthPoint[] = [];
  let y = loY;
  let m = loM;
  // Хамгаалалт: буруу оролтод мөнхийн давталт үүсгэхгүй (100 жил = 1200 сар).
  for (let guard = 0; guard < 1200; guard++) {
    if (y > hiY || (y === hiY && m > hiM)) break;
    const key = `${y}.${String(m).padStart(2, "0")}`;
    out.push({ date: key, count: byMonth.get(key) ?? 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
