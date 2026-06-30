import type ImageWrapper from "ol/Image";

export const GS_WMS = '/api/geoserver/land/wms'
export const GS_WFS = '/api/geoserver/land/ows'

export function wmsPostLoad(image: ImageWrapper, src: string) {
  const qIdx = src.indexOf('?')
  const img = image.getImage() as HTMLImageElement
  if (qIdx === -1) { img.src = src; return }
  fetch(src.slice(0, qIdx), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: src.slice(qIdx + 1),
  })
    .then(r => r.blob())
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob)
      img.onload  = () => URL.revokeObjectURL(objectUrl)
      img.onerror = () => URL.revokeObjectURL(objectUrl)
      img.src = objectUrl
    })
    .catch(() => { img.src = '' })
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
