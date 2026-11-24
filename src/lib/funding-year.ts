/**
 * Захирамжийн санхүүжилтийн ОН.
 *
 * Санхүүгийн эх үүсвэр захирамжийн төсөлд ОНООР нэмэгдэнэ: нэг эх үүсвэр
 * он бүрт өөр дүнтэй (тусдаа холбоос) байж болно. Backend-ийн муж
 * (domain.ValidFundingYear) — 2000–2100.
 */

export const MIN_FUNDING_YEAR = 2000;
export const MAX_FUNDING_YEAR = 2100;

export function currentFundingYear(now: Date = new Date()): number {
  return now.getFullYear();
}

export function isValidFundingYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_FUNDING_YEAR && year <= MAX_FUNDING_YEAR;
}

/**
 * Сонголтын онууд — одоогийн оноос `back` (анхдагч 5) жил өмнө, 3 жил хойш,
 * мөн өгөгдөлд байгаа онууд (муж дотор). Шинэ нь эхэнд.
 */
export function fundingYearOptions(
  known: Iterable<number | null | undefined> = [],
  now: number = currentFundingYear(),
  back = 5,
): number[] {
  const set = new Set<number>();
  for (let y = now - back; y <= now + 3; y++) set.add(y);
  for (const y of Array.from(known)) if (y != null && isValidFundingYear(y)) set.add(y);
  return Array.from(set)
    .filter(isValidFundingYear)
    .sort((a, b) => b - a);
}

/** «Байгууллага — төрөл · 2026 он» — захирамжийн санхүүжилтийн холбоосын шошго. */
export function fundingLinkLabel(link: {
  organization_name?: string | null;
  source_type?: string | null;
  year?: number | null;
}): string {
  const org = link.organization_name?.trim() ?? "";
  const type = link.source_type?.trim() ?? "";
  const name =
    !type || org.toLocaleLowerCase() === type.toLocaleLowerCase() ? org || type : `${org} — ${type}`;
  return link.year ? `${name} · ${link.year} он` : name;
}
