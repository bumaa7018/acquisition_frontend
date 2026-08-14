/**
 * ГУС-ийн баримтын ҮҮРГИЙН кодыг "Мэдээлэл татах" цонхны бүлгүүдтэй ЯГ ИЖИЛ
 * байдлаар бүлэглэнэ (Кадастр / Төлбөр үнэлгээ / Мониторинг).
 *
 * Кодгүй буюу энд жагсаагаагүй кодтой (ж: "Бусад холбоотой хавсралт"-аар
 * татагдсан) баримт нь КАДАСТР бүлэгт багтана.
 *
 * ЭНЭ кодууд манай document_type.id-тай ХАМААРАЛГҮЙ — дугаарлалт нь огт өөр
 * (ж: ГУС 11 = Кадастрын зураг, манай document_type 11 = Нас барсны гэрчилгээ).
 */
export const DOCUMENT_GROUPS = [
  {
    key: 'cadastral',
    label: 'Кадастрын мэдээлэл',
    color: '#3b82f6',
    codes: ['1', '2', '11', '64', '52', '8'],
  },
  {
    key: 'valuation',
    label: 'Төлбөр үнэлгээний мэдээлэл',
    color: '#f59e0b',
    codes: ['101'],
  },
  {
    key: 'monitoring',
    label: 'Дүгнэлтийн мэдээлэл',
    color: '#10b981',
    codes: ['71', '12', '516'],
  },
] as const

export type DocumentGroupKey = (typeof DOCUMENT_GROUPS)[number]['key']

/** Баримтын кодоор бүлгийн түлхүүр олно. Тодорхойгүй бол кадастр. */
export function groupKeyForDocCode(code?: string): DocumentGroupKey {
  const trimmed = (code ?? '').trim()
  for (const group of DOCUMENT_GROUPS) {
    if ((group.codes as readonly string[]).includes(trimmed)) return group.key
  }
  return 'cadastral'
}
