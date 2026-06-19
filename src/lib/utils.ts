import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatArea(m2?: number): string {
  if (!m2) return '—'
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} га`
  return `${m2.toFixed(2)} м²`
}
