import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function resolveImageUrl(url?: string, objectname?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_FILE_URL ?? "";
  const segments = [base.replace(/\/$/, ""), objectname?.replace(/^\/|\/$/g, ""), url.replace(/^\//, "")].filter(Boolean);
  return segments.join("/");
}
