import { NextRequest, NextResponse } from 'next/server'
import { tokenFromRequest, isSessionValid } from '@/lib/server/session-guard'

// ЭХ СИСТЕМИЙН (ГУС) хавсралт руу гарц — MinIO-гоос БҮРЭН ТУСДАА зам.
//
// Хоёр төрлийн хавсралт хоёр өөр байршилтай:
//   • Гараар оруулсан  → MinIO. file_url нь `/api/files/<key>` тул шууд нээгдэнэ.
//   • ГУС-аас татсан   → эх системийн FTP/SFTP сервер. DB-д зөвхөн ЗАМ
//     (mgis/011/…/x.pdf) ба ftp_id хадгалагдана — тэр зам нь ВЭБ хаяг БИШ.
//
// Иймд ГУС-ийн баримтын file_url-ыг <a href> дээр шууд тавьбал browser нь
// түүнийг ОДООГИЙН ХУУДАСТ харьцуулж `/parcel/mgis/011/…pdf` болгож 404 болно.
// Энэ route нь баримтын ID-гаар backend-ийн урсгал дамжуулах маршрут руу
// хандаж, backend нь FTP/SFTP сервертэй холбогдож файлыг урсгалаар буулгана
// (файл MinIO-д ХУУЛАГДАХГҮЙ).
const BACKEND = process.env.NEXT_API_URL ?? 'http://localhost:8080'

// Browser-т дамжуулах header-ууд.
const PASS_THROUGH = [
  'content-type',
  'content-length',
  'content-disposition',
  'accept-ranges',
]

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ parcel_id: string; doc_id: string }> },
) {
  // Танилт — /api/files-тэй ижил дүрэм. Эрхийн (зөвшөөрлийн) шалгалтыг backend
  // маршрут ӨӨРӨӨ хийнэ (land:read / compensation:read + хуваарилалт), тиймээс
  // энд давхардуулахгүй.
  const token = tokenFromRequest(req)
  if (!(await isSessionValid(token))) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
  }

  const { parcel_id, doc_id } = await params

  // Мэргэжлийн байгууллага өөр маршрутаар хандана (/prof/parcels/…) — тэд
  // үндсэн /parcels маршрутад эрхгүй. `prof` нь ЗӨВХӨН маршрут сонгоход
  // хэрэглэгдэх ба эрхийг backend өөрөө шалгана (эрх ОЛГОХГҮЙ).
  const forwarded = new URLSearchParams(req.nextUrl.searchParams)
  const isProf = forwarded.get('prof') === '1'
  forwarded.delete('prof')
  const query = forwarded.toString()

  // Татах/харах сонголтыг backend-д дамжуулна (?download=1 → attachment).
  const prefix = isProf ? '/api/v1/prof/parcels' : '/api/v1/parcels'
  const url =
    `${BACKEND}${prefix}/${encodeURIComponent(parcel_id)}` +
    `/documents/${encodeURIComponent(doc_id)}/file${query ? `?${query}` : ''}`

  let res: Response
  try {
    res = await fetch(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}` },
      // Файл том байж болно — санах ойд бүтнээр авахгүй, урсгалаар дамжина.
      cache: 'no-store',
    })
  } catch (err) {
    console.error(
      `[source-files] ${req.method} ${parcel_id}/${doc_id} → холбогдсонгүй  upstream=${BACKEND}`,
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json(
      { error: 'эх системийн файл серверт холбогдсонгүй' },
      { status: 502 },
    )
  }

  if (!res.ok) {
    // Backend нь шалтгааныг JSON-оор бичдэг (проекц, ftp_id таарахгүй, 404 …)
    // — логлохгүй бол зөвхөн статус л мэдэгдэнэ.
    const detail = await res.clone().text().catch(() => '')
    console.error(
      `[source-files] ${req.method} ${parcel_id}/${doc_id} → ${res.status}  ${detail.slice(0, 400)}`,
    )
    return new NextResponse(res.body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  }

  const headers = new Headers()
  for (const h of PASS_THROUGH) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  // Эх системийн файл тул кэшлэхгүй (тэнд солигдож болно).
  headers.set('cache-control', 'private, no-store')

  return new NextResponse(res.body, { status: res.status, headers })
}

export const GET = proxy
export const HEAD = proxy
