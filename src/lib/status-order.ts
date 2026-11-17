/**
 * Нэгж талбарын төлөвийн задаргааг `parcel_status`-ийн sort_order-оор эрэмбэлнэ.
 *
 * Яагаад: хяналтын самбарын backend задаргаа (`status_breakdown`) нь
 * `ORDER BY p.status` буюу id-аар ирдэг тул «Нэгж талбарын статус» цэсэнд
 * тохируулсан дараалал үл тоогдож, шинээр нэмсэн төлөв (id 110…) үргэлж
 * сүүлд гардаг байв. Бүртгэлийн жагсаалт (`parcel_statuses`) нь аль хэдийн
 * sort_order-оор ирдэг тул тэр жагсаалтын байрлалыг ашиглана.
 *
 * Бүртгэлд байхгүй төлөв — хамгийн сүүлд, id-аараа. Эх массивыг өөрчлөхгүй.
 */
export function sortByStatusOrder<T extends { status_id: number }>(
  breakdown: readonly T[],
  statuses: readonly { id: number }[],
): T[] {
  const rank = new Map<number, number>();
  statuses.forEach((s, i) => rank.set(s.id, i));
  const pos = (id: number) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...breakdown].sort((a, b) => pos(a.status_id) - pos(b.status_id) || a.status_id - b.status_id);
}
