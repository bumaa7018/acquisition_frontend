import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatArea(m2?: number): string {
  if (!m2) return "—";
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} га`;
  return `${m2.toFixed(2)} м²`;
}

/**
 * Мөнгөн дүнг ТЭРБУМААР харуулна: 12_500_000_000 → "12.5 тэрбум₮".
 *
 * Санхүүжилтийн дүнгүүд тэрбумаар хэмжигддэг тул бүтэн тоогоор
 * ("12,500,000,000₮") харуулахад уншиж, харьцуулахад хүндрэлтэй. Бутархайг
 * САЯ хүртэл (3 орон) үлдээж нарийвчилна — 0.001 тэрбум = 1 сая төгрөг.
 * Яг утгыг нь `formatMoneyExact`-аар title/tooltip дээр харуулна.
 */
export function formatBillion(value?: number | null): string {
  const amount = Number(value) || 0;
  return `${(amount / 1_000_000_000).toLocaleString("mn-MN", {
    maximumFractionDigits: 3,
  })} тэрбум₮`;
}

/** Бүтэн дүн (мянгатын тусгаарлагчтай) — тэрбумаар харуулсан дүнгийн тайлбарт. */
export function formatMoneyExact(value?: number | null): string {
  return `${Math.round(Number(value) || 0).toLocaleString("mn-MN")}₮`;
}

export function getApiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}
