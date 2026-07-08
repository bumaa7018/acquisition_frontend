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

export function getApiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}

export function resolveImageUrl(url?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_MOCK_FILES_URL ?? "";
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}
