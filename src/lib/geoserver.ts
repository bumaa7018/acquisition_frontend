import type ImageWrapper from "ol/Image";
import { logger } from "./logger";
import { authStorage } from "./auth";

// GeoServer proxy-ийн эрхийн header. WMS-POST/WFS нь fetch тул header зөөж
// чадна — session cookie тохироогүй байсан ч (mount дараах race) энэ header-ээр
// эрх дамжина. (XYZ дроны tile нь <img> тул зөвхөн cookie-гоор явна.)
export function gsAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = authStorage.getAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

export const GS_WMS = '/api/geoserver/land/wms'
export const GS_WFS = '/api/geoserver/land/ows'

/**
 * Дроны ортофотог ТАЙЛААР дуудах URL загвар (OpenLayers XYZ source).
 *
 * `/api/drone-tiles/...` нь сервер талдаа эрх шалгаад GeoWebCache-ийн WMTS рүү
 * дамжуулна — ингэснээр тайл GeoServer дээр КЭШЛЭГДЭНЭ.
 * Хэмжсэн: нэг тайл MISS 10.5 сек → HIT 0.27 сек (39 дахин хурдан).
 *
 * ЯАГААД шууд `/api/geoserver/gwc/...` биш тусдаа route вэ:
 *   - client GeoServer-ийн layer_name-г tile URL-д ил гаргахгүй.
 *   - route нь imageId/acquisitionId-аар backend authorization шалгана.
 *
 * Сервер талдаа WMTS-ийн KVP (query) хэлбэр ашигладаг:
 *   - WMTS-ийн REST хэлбэр (`/wmts/rest/<layer>//EPSG:900913/...`) нь хоосон
 *     style-ийн улмаас ХОЁР ЗУРААС агуулах ба Next-ийн proxy түүнийг
 *     нормчилж 308 redirect буцаана — тайл ирэхгүй.
 *   - Ердийн WMS дээр `TILED=true` тавих нь GWC-ийг ЗААВАЛ хэрэглүүлэхгүй:
 *     GeoServer-ийн "direct WMS integration" анхдагчаар УНТРААЛТТАЙ тул
 *     хүсэлт кэшгүй рендер руу явдаг (`geowebcache-cache-result` header
 *     буцахгүйгээр батлагдсан).
 *
 * `EPSG:900913` нь Web Mercator-ийн хуучин нэр — GWC давхарга бүрийг ЭНЭ
 * gridset-ээр өөрөө бүртгэдэг ба тор нь OL-ийн анхдагч EPSG:3857 тортой
 * (256px, зүүн-дээд origin) ЯГ тохирдог тул {z}/{x}/{y} шууд таарна.
 */
export const GS_GWC_MAX_ZOOM = 30 // EPSG:900913 gridset-ийн түвшин: 0..30

export function droneTileUrl(acquisitionId: string, imageId: string): string {
  return `/api/drone-tiles/${encodeURIComponent(acquisitionId)}/${encodeURIComponent(imageId)}/{z}/{x}/{y}`
}

export function wmsPostLoad(image: ImageWrapper, src: string) {
  const qIdx = src.indexOf('?')
  const img = image.getImage() as HTMLImageElement
  if (qIdx === -1) { img.src = src; return }
  fetch(src.slice(0, qIdx), {
    method: 'POST',
    headers: gsAuthHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: src.slice(qIdx + 1),
  })
    .then(r => r.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob)
      img.onload  = () => URL.revokeObjectURL(objectUrl)
      img.onerror = () => URL.revokeObjectURL(objectUrl)
      img.src = objectUrl
    })
    .catch((err) => {
      logger.warn('wms tile load failed', { src: src.split('?')[0], error: String(err) })
      img.src = ''
    })
}

export function buildAcqCql(acquisitionIds?: string[]): string {
  if (!acquisitionIds || acquisitionIds.length === 0) return ''
  return acquisitionIds.length === 1
    ? `acquisition_id = '${acquisitionIds[0]}'`
    : `acquisition_id IN (${acquisitionIds.map(id => `'${id}'`).join(',')})`
}

export function buildParcelStatusCql(acquisitionIds?: string[], years?: number[], employeeId?: string): string {
  const parts: string[] = []
  const acqPart = buildAcqCql(acquisitionIds)
  if (acqPart) parts.push(acqPart)
  if (years && years.length > 0)
    parts.push(years.length === 1 ? `status_year = ${years[0]}` : `status_year IN (${years.join(',')})`)
  if (employeeId)
    parts.push(`assignee_user_ids LIKE '%,${employeeId},%'`)
  return parts.join(' AND ')
}

export function buildCodeCql(codes: string[], col: string): string {
  if (codes.length === 0) return `${col} = '__none__'`
  return codes.length === 1
    ? `${col} = '${codes[0]}'`
    : `${col} IN (${codes.map(c => `'${c}'`).join(',')})`
}
