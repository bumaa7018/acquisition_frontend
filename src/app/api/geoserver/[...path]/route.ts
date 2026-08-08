import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/server/session-guard'

const GS_URL = process.env.NEXT_GS_URL ?? 'http://localhost:8600'

// Зөвшөөрөгдсөн замын эхний сегмент (whitelist). Frontend зөвхөн эдгээрийг
// ашигладаг: `land/wms`, `land/ows` (WFS). Бусад (`rest/*` = админ REST,
// `web/*` = админ UI, `gwc/*` = layer_name-ээр шууд tile авах гарц) хаагдана.
// Дроны tile нь per-image эрх шалгадаг `/api/drone-tiles/...` route-оор явна.
const ALLOWED_ROOTS = new Set(['land'])

// Enumerate-ийн вектор: GetCapabilities нь БҮХ давхарга/workspace-ийг жагсаадаг.
// Frontend давхаргын нэрийг hardcode хийдэг тул шаардлагагүй — хаана.
function isBlockedOperation(search: string): boolean {
  return /request=getcapabilities/i.test(search)
}

function getParamCaseInsensitive(params: URLSearchParams, name: string): string {
  const wanted = name.toLowerCase()
  let found = ''
  params.forEach((value, key) => {
    if (found) return
    if (key.toLowerCase() === wanted) found = value
  })
  return found
}

function requestName(search: string, body?: string): string {
  const fromQuery = getParamCaseInsensitive(new URLSearchParams(search), 'request')
  if (fromQuery) return fromQuery.toLowerCase()
  if (!body) return ''
  return getParamCaseInsensitive(new URLSearchParams(body), 'request').toLowerCase()
}

function isAllowedOperation(path: string[], search: string, body?: string): boolean {
  const joined = path.join('/')
  const request = requestName(search, body)
  if (joined === 'land/wms') return request === 'getmap'
  if (joined === 'land/ows') return request === 'getfeature'
  return false
}

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params

  // ЭРХ ШАЛГАЛТ: өмнө нь энэ proxy эрх шалгадаггүй байсан тул хэн ч
  // нэвтрэлтгүйгээр нэгж талбарын бодит geometry/атрибутыг WFS-ээр уншиж
  // чаддаг байв (аудитаар батлагдсан). Session cookie/Bearer шаардана.
  if (!(await requireSession(req))) {
    return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
  }

  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await req.text()

  // Гадаргуу хумих: зөвшөөрөгдсөн workspace/tile зам + GetCapabilities хориг.
  const root = path[0] ?? ''
  if (
    !ALLOWED_ROOTS.has(root) ||
    isBlockedOperation(req.nextUrl.search) ||
    !isAllowedOperation(path, req.nextUrl.search, body)
  ) {
    return NextResponse.json({ error: 'Хориотой' }, { status: 403 })
  }

  const url = `${GS_URL}/geoserver/${path.join('/')}${req.nextUrl.search}`

  const fwdHeaders = new Headers()
  const accept = req.headers.get('accept')
  if (accept) fwdHeaders.set('accept', accept)
  const contentType = req.headers.get('content-type')
  if (contentType) fwdHeaders.set('content-type', contentType)

  const gs = await fetch(url, { method: req.method, headers: fwdHeaders, body })

  return new NextResponse(gs.body, {
    status: gs.status,
    headers: {
      'content-type': gs.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'no-store',
    },
  })
}

export const GET  = proxy
export const POST = proxy
