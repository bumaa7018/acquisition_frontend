import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/server/session-guard'

// Файлын систем (MinIO/S3) руу гарц. Backend файлыг өөр дээрээ хадгалахгүй —
// бүх файл эндээс тараагдаж, эндээр байршина. DB-д хадгалагдсан file_url нь
// `/api/files/<key>` хэлбэртэй ХАРЬЦАНГУЙ зам тул орчин (host/port) солигдоход
// DB-г хөндөх шаардлагагүй.
//
// ЯАГААД БАЙРШУУЛАЛТ ЧУ ЭНДЭЭР ЯВНА: browser MinIO-руу ШУУД хандвал MinIO-ийн
// порт гадаад сүлжээнд нээлттэй байх, CORS ажиллах, presigned URL-ийн host
// browser-т хүрэх гэсэн 3 нөхцөл шаардагдана — сервер дээр яг тэр (presigned
// URL нь дотоод `minio:9000`-ыг заасан) эвдрэл гарсан. Энэ route нь Next
// server дээр ажилладаг ба gov_network-оос `minio:9000`-д хүрдэг тул browser
// ЗӨВХӨН өөрийн origin-той харилцана.
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
  // ЭРХ ШАЛГАЛТ: өмнө нь энэ route эрх шалгадаггүй "хоолой" байсан ба MinIO-ийн
  // bucket policy anonymous read байсан тул хэн ч нэвтрэлтгүйгээр бүх баримт,
  // үнэлгээний тайлан, ортофотог татаж чаддаг байв (аудитаар батлагдсан).
  // Одоо нэвтэрсэн хэрэглэгчийг session cookie/Bearer-ээр шаардана. Browser-ийн
  // <img>/<a>/tile хүсэлт cookie-г автоматаар зөөнө; upload PUT (presigned) мөн
  // ижил origin тул cookie явна.
  if (!(await requireSession(req))) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
  }

  const { path } = await params
  // Сегмент бүрийг escape хийнэ — нэрэнд кирилл, зай, '%' орсон файл ч ажиллана.
  const key = path.map((segment) => encodeURIComponent(segment)).join('/')
  // Query-г ХЭВЭЭР дамжуулна: байршуулах эрхийг presigned гарын үсэг (X-Amz-*)
  // агуулдаг ба түүнийг MinIO ӨӨРӨӨ шалгана. Иймд энэ route нь эрх шалгадаггүй
  // "хоолой" — гарын үсэггүй PUT-ыг MinIO 403-аар татгалздаг (bucket policy нь
  // зөвхөн s3:GetObject-ыг нээсэн).
  const url = `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}${req.nextUrl.search}`

  const fwd = new Headers()
  // Range — том ортофото/PDF-ийг хэсэгчлэн татахад (browser өөрөө шаарддаг).
  for (const h of ['range', 'if-none-match', 'if-modified-since']) {
    const v = req.headers.get(h)
    if (v) fwd.set(h, v)
  }

  const init: RequestInit = { method: req.method, headers: fwd }
  if (req.method === 'PUT') {
    const ct = req.headers.get('content-type')
    if (ct) fwd.set('content-type', ct)
    const cl = req.headers.get('content-length')
    if (cl) fwd.set('content-length', cl)
    // Биеийг УРСГАЛААР дамжуулна — хэдэн GB ортофотог санах ойд авахгүй.
    init.body = req.body
    // duplex: стрийм бие явуулахад Node-ийн fetch шаарддаг (тайпд ороогүй).
    Reflect.set(init, 'duplex', 'half')
  }

  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    // Холболт огт хийгдээгүй (DNS, refused, timeout). ЛОГЛОХГҮЙ бол Next нь
    // production дээр хүсэлтийг логлодоггүй тул `docker logs` дээр юу ч
    // харагдахгүй — асуудлыг олох боломжгүй болно.
    console.error(
      `[files] ${req.method} ${key} → холбогдсонгүй  upstream=${S3_ENDPOINT}`,
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json(
      { error: 'файлын серверт холбогдсонгүй', upstream: S3_ENDPOINT },
      { status: 502 },
    )
  }

  if (!res.ok) {
    // Upstream-ийн алдааг ХАРАГДАХУЙЦ болгоно: MinIO нь шалтгааныг XML биед
    // бичдэг (SignatureDoesNotMatch, MissingContentLength, AccessDenied г.м.)
    // — түүнийг логлохгүй бол зөвхөн статус л мэдэгдэнэ.
    const detail = await res.clone().text().catch(() => '')
    console.error(
      `[files] ${req.method} ${key} → ${res.status}  upstream=${S3_ENDPOINT}  ` +
        `len=${req.headers.get('content-length') ?? '-'}  ${detail.slice(0, 400)}`,
    )
  }

  const headers = new Headers()
  for (const h of PASS_THROUGH) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  if (req.method === 'PUT') {
    // Байршуулалтын хариуг кэшлэхгүй
    headers.set('cache-control', 'no-store')
    return new NextResponse(res.body, { status: res.status, headers })
  }
  // Объект нь дахин бичигддэггүй (нэр нь uuid-тэй) тул урт кэш аюулгүй.
  headers.set('cache-control', 'private, max-age=3600')

  return new NextResponse(res.body, { status: res.status, headers })
}

export const GET = proxy
export const HEAD = proxy
export const PUT = proxy
