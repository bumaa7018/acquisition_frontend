/**
 * URL-ын query параметрийг серверээс юу ч дахин татахгүйгээр солино.
 *
 * `history.replaceState`-ийг Next 14.1+ нь `useSearchParams`-тай синк хийдэг
 * ба `router.replace` шиг RSC дахин татахгүй. Replace тул history-д шинэ
 * бичлэг нэмэхгүй (back товч өмнөх хуудас руу явна). Дэлгэрэнгүй хуудасны
 * дотоод табыг ингэж URL-д хадгалснаар өөр хуудас руу ороод буцахад
 * (хуудасны таб, browser-ийн back) орхисон табдаа буцаж ирнэ.
 */
export function replaceQueryParam(
  current: URLSearchParams,
  key: string,
  value: string,
  drop: string[] = [],
): void {
  const params = new URLSearchParams(current.toString());
  params.set(key, value);
  drop.forEach((k) => params.delete(k));
  window.history.replaceState(null, "", `?${params.toString()}`);
}
