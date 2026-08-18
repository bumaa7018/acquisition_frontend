import { NextRequest, NextResponse } from 'next/server'
import {
  tokenFromRequest,
  sessionRoles,
  isExternalRoleSet,
  externalAcquisitionScope,
} from '@/lib/server/session-guard'

const GS_URL = process.env.NEXT_GS_URL ?? 'http://localhost:8600'

// Зөвшөөрөгдсөн замын эхний сегмент (whitelist). Frontend зөвхөн эдгээрийг
// ашигладаг: `land/wms`, `land/ows` (WFS). Бусад (`rest/*` = админ REST,
// `web/*` = админ UI, `gwc/*` = layer_name-ээр шууд tile авах гарц) хаагдана.
// Дроны tile нь per-image эрх шалгадаг `/api/drone-tiles/...` route-оор явна.
const ALLOWED_ROOTS = new Set(['land'])

// Давхаргын цагаан жагсаалт. Урьд нь `land` workspace-ийн ЯМАР Ч давхаргыг
// дуудаж болдог байсан. GeoServer-т нийтлэгдсэн давхаргууд тогтмол тул энд
// хатуу бүртгэв.
//
// ШИНЭ ДАВХАРГА нэмэгдвэл ЗААВАЛ энд ангилж бүртгэнэ — бүртгэлгүй давхарга
// хаагдана (fail-closed). Тухайлбал frontend-ийн parcel-map дээр дурдагдсан
// `building` давхарга GeoServer-т нийтлэгдээгүй тул энд БАЙХГҮЙ; нийтлэх
// тохиолдолд `acquisition_id` баганатай эсэхээр нь дараах хоёрын алинд нь
// хамаарахыг тодорхойлж нэмнэ.
const PARCEL_STATUS_LAYERS = [
  'v_parcel_s0', 'v_parcel_s1', 'v_parcel_s2',
  'v_parcel_s3', 'v_parcel_s4', 'v_parcel_s5',
]
// Чөлөөлөлтөөр хумигдах давхаргууд — бүгд `acquisition_id` баганатай
// (DescribeFeatureType-ээр `parcel` дээр шалгасан; views нь client-ийн
// `acquisition_id=...` CQL-ээр аль хэдийн шүүгддэг).
const ACQUISITION_SCOPED_NAMES = [
  ...PARCEL_STATUS_LAYERS,
  'v_acquisition_boundary',
  'v_acquisition_plan',
  'v_parcel_acquisition',
  'parcel',
]
// Захиргааны нэгжийн хил — нэгж талбарын мэдээлэл агуулаагүй лавлах давхарга.
const REFERENCE_NAMES = ['au1', 'au2', 'au3']

const ACQUISITION_SCOPED_LAYERS = new Set(ACQUISITION_SCOPED_NAMES)
const ALLOWED_LAYERS = new Set(ACQUISITION_SCOPED_NAMES.concat(REFERENCE_NAMES))

// WFS-ээр нэг хүсэлтэд татах мөрийн дээд хязгаар — бөөнөөр татахаас сэргийлнэ.
const MAX_FEATURES = 5000

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

function setParamCaseInsensitive(params: URLSearchParams, name: string, value: string) {
  const wanted = name.toLowerCase()
  let existing = ''
  params.forEach((_v, key) => {
    if (!existing && key.toLowerCase() === wanted) existing = key
  })
  params.set(existing || name, value)
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

/** `land:v_parcel_s0` эсвэл `v_parcel_s0` → `v_parcel_s0`. */
function bareLayerName(value: string): string {
  const trimmed = value.trim()
  const colon = trimmed.indexOf(':')
  return colon === -1 ? trimmed : trimmed.slice(colon + 1)
}

/** Хүсэлтийн зорилтот давхаргууд (WMS `LAYERS`, WFS `typeName(s)`). */
function requestedLayers(params: URLSearchParams): string[] {
  const raw =
    getParamCaseInsensitive(params, 'layers') ||
    getParamCaseInsensitive(params, 'typename') ||
    getParamCaseInsensitive(params, 'typenames')
  if (!raw) return []
  return raw.split(',').map(bareLayerName).filter(Boolean)
}

/**
 * Гадаад ролийн хүсэлтэд чөлөөлөлтийн хумилтыг CQL_FILTER дээр НЭМНЭ.
 *
 * Client-ийн илгээсэн CQL-ийг устгахгүй — `AND`-ээр хавсаргана. Ингэснээр
 * client өөрийн шүүлтээ (нэгж талбарын код г.м.) ашиглах боловч өөрт
 * хамааралгүй чөлөөлөлт рүү СЭМЖИХ боломжгүй болно.
 *
 * Олон давхарга нэг хүсэлтэд ирвэл GeoServer нь CQL_FILTER-ийг цэг таслалаар
 * давхарга бүрд тааруулдаг. Frontend үргэлж НЭГ давхаргаар дууддаг тул олон
 * давхаргатай хүсэлтийг гадаад ролид зүгээр л хаана (буруу тааруулснаас дээр).
 */
function applyScope(
  params: URLSearchParams,
  layers: string[],
  allowedAcquisitionIds: string[],
): boolean {
  const scoped = layers.filter((l) => ACQUISITION_SCOPED_LAYERS.has(l))
  if (scoped.length === 0) return true // зөвхөн лавлах давхарга — хумих зүйлгүй
  if (layers.length !== 1) return false
  if (allowedAcquisitionIds.length === 0) return false

  const scope = `acquisition_id IN (${allowedAcquisitionIds.map((id) => `'${id}'`).join(',')})`
  const existing = getParamCaseInsensitive(params, 'cql_filter').trim()
  setParamCaseInsensitive(params, 'CQL_FILTER', existing ? `(${existing}) AND ${scope}` : scope)
  return true
}

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params

  // ЭРХ ШАЛГАЛТ. Өмнө нь энэ proxy эрх шалгадаггүй байсан тул хэн ч
  // нэвтрэлтгүйгээр нэгж талбарын бодит geometry/атрибутыг WFS-ээр уншиж
  // чаддаг байв. Дараа нь session шалгалт нэмэгдсэн ч ЗӨВХӨН танилт байсан —
  // нэвтэрсэн гадаад байгууллага бүх чөлөөлөлтийн нэгж талбарыг уншсаар байв.
  const token = tokenFromRequest(req)
  const roles = await sessionRoles(token)
  if (!roles) {
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

  // WMS-GetMap болон WFS-ийг frontend POST-оор (form-urlencoded) илгээдэг;
  // WFS-ийн зарим дуудлага GET-ээр ирдэг тул хоёуланг нь дэмжинэ.
  const isBodyParams = body !== undefined && body.length > 0
  const qs = new URLSearchParams(isBodyParams ? body : req.nextUrl.search)

  const layers = requestedLayers(qs)
  if (layers.length === 0 || !layers.every((l) => ALLOWED_LAYERS.has(l))) {
    return NextResponse.json({ error: 'Хориотой давхарга' }, { status: 403 })
  }

  // Бөөнөөр татахаас сэргийлж мөрийн тоог хатуу хязгаарлана (бүх ролид).
  // WFS 2.0 нь `count`, 1.x нь `maxFeatures` гэсэн өөр нэр ашигладаг.
  if (requestName(req.nextUrl.search, body) === 'getfeature') {
    const limitParam = getParamCaseInsensitive(qs, 'version').startsWith('2.')
      ? 'count'
      : 'maxFeatures'
    const current = Number(getParamCaseInsensitive(qs, limitParam))
    if (!Number.isFinite(current) || current <= 0 || current > MAX_FEATURES) {
      setParamCaseInsensitive(qs, limitParam, String(MAX_FEATURES))
    }
  }

  if (isExternalRoleSet(roles)) {
    const scope = await externalAcquisitionScope(token, roles)
    if (scope === null) {
      return NextResponse.json({ error: 'Эрх тодорхойлж чадсангүй' }, { status: 403 })
    }
    if (!applyScope(qs, layers, scope)) {
      return NextResponse.json({ error: 'Хориотой' }, { status: 403 })
    }
  }

  const rewritten = qs.toString()
  const url = isBodyParams
    ? `${GS_URL}/geoserver/${path.join('/')}`
    : `${GS_URL}/geoserver/${path.join('/')}?${rewritten}`

  const fwdHeaders = new Headers()
  const accept = req.headers.get('accept')
  if (accept) fwdHeaders.set('accept', accept)
  const contentType = req.headers.get('content-type')
  if (contentType) fwdHeaders.set('content-type', contentType)

  const gs = await fetch(url, {
    method: req.method,
    headers: fwdHeaders,
    body: isBodyParams ? rewritten : body,
  })

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
