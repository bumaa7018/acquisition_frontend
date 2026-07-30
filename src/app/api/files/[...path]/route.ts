import { NextRequest, NextResponse } from 'next/server'

// Файлын систем (MinIO/S3). Backend файлыг өөр дээрээ хадгалахгүй — бүх файл
// эндээс тараагдана. DB-д хадгалагдсан file_url нь `/api/files/<key>` хэлбэртэй
// ХАРЬЦАНГУЙ зам тул орчин (host/port) солигдоход DB-г хөндөх шаардлагагүй.
const S3_ENDPOINT = process.env.NEXT_S3_ENDPOINT ?? 'http://localhost:9000'
const S3_BUCKET = process.env.NEXT_S3_BUCKET ?? 'gov-files'

// Browser-т дамжуулах header-ууд (файлын төрөл, хэмжээ, кэш, range).
const PASS_THROUGH = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
]

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  // Сегмент бүрийг escape хийнэ — нэрэнд кирилл, зай, '%' орсон файл ч ажиллана.
  const key = path.map((segment) => encodeURIComponent(segment)).join('/')
  const url = `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`

  const fwd = new Headers()
  // Range — том ортофото/PDF-ийг хэсэгчлэн татахад (browser өөрөө шаарддаг).
  for (const h of ['range', 'if-none-match', 'if-modified-since']) {
    const v = req.headers.get(h)
    if (v) fwd.set(h, v)
  }

  const res = await fetch(url, { method: req.method, headers: fwd })

  const headers = new Headers()
  for (const h of PASS_THROUGH) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  // Объект нь дахин бичигддэггүй (нэр нь uuid-тэй) тул урт кэш аюулгүй.
  headers.set('cache-control', 'private, max-age=3600')

  return new NextResponse(res.body, { status: res.status, headers })
}

export const GET = proxy
export const HEAD = proxy
