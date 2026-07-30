/**
 * Газрын зургийн давхаргын ТОХИРГОО — OpenLayers-ээс хамааралгүй.
 *
 * Яагаад тусдаа файл: эрэмбийг (zIndex) Node тестээр хамгаалдаг ба layers.ts нь
 * `ol/*`-ыг bundler-ийн хэлбэрээр (өргөтгөлгүй) import хийдэг тул Node шууд
 * уншиж чаддаггүй.
 */
export type MapLayerId =
  | 'au1'
  | 'au2'
  | 'au3'
  | 'v_acquisition_plan'
  | 'v_acquisition_boundary'
  | 'parcel'
  | 'building'
  | 'v_parcel_acquisition'
  | 'v_parcel_s0'
  | 'v_parcel_s1'
  | 'v_parcel_s2'
  | 'v_parcel_s3'
  | 'v_parcel_s4'
  | 'v_parcel_s5'

export type MapLayerDef = {
  id: MapLayerId
  label: string
  color: string
  zIndex: number
  group?: string
}

/**
 * Давхаргын эрэмбэ (OpenLayers zIndex).
 *
 * Дроны ортофото нь СУУРЬ зургийн дээр, харин давхаргын хэсэгт байгаа БҮХ
 * давхаргын ДООР байх ёстой — хил, нэгж талбар, төлөвийн давхаргууд ортофотод
 * дарагдахгүй.
 *
 * Яагаад сөрөг тоо: доорх MAP_LAYER_STYLES нь 1-ээс (au1) эхэлдэг тул дрон
 * ямар ч эерэг тоотой байвал хамгийн доод давхаргуудыг дардаг (өмнө нь дрон 5
 * байхад au1/au2/au3 нь 1/2/3 тул дарагдаж байсан). Суурь зурагт мөн zIndex
 * тодорхой заана — заагаагүй бол 0 болж эрэмбэ бүрхэг болно.
 *
 * ЭРЭМБИЙГ tests/map-layers.test.mjs хамгаалж байна.
 */
export const BASE_Z_INDEX = -10
export const DRONE_Z_INDEX = -5

export const MAP_LAYER_STYLES: Record<MapLayerId, Omit<MapLayerDef, 'id'>> = {
  au1: { label: 'Аймаг/Нийслэл', color: '#6366f1', zIndex: 1 },
  au2: { label: 'Сум/Дүүрэг', color: '#8b5cf6', zIndex: 2 },
  au3: { label: 'Баг/Хороо', color: '#a78bfa', zIndex: 3 },
  v_acquisition_plan:     { label: 'Төлөвлөгөөний хил',   color: '#a855f7', zIndex: 10 },
  v_acquisition_boundary: { label: 'Чөлөөлөх бүсийн хил', color: '#3b82f6', zIndex: 20 },
  parcel:                 { label: 'Чөлөөлөх талбай',      color: '#22c55e', zIndex: 30 },
  building:               { label: 'Барилгын хил',         color: '#06b6d4', zIndex: 40 },
  v_parcel_acquisition:   { label: 'Нэгж талбар',          color: '#94a3b8', zIndex: 40 },
  v_parcel_s0: { label: 'Хүлээгдэж буй',        color: '#64748b', zIndex: 30, group: 'parcel_status' },
  v_parcel_s1: { label: 'Зөвшилцөх шатандаа',  color: '#eab308', zIndex: 31, group: 'parcel_status' },
  v_parcel_s2: { label: 'Үнэлгээ хийх',         color: '#f97316', zIndex: 32, group: 'parcel_status' },
  v_parcel_s3: { label: 'Нөлөөлөгдсөн гарсан', color: '#ec4899', zIndex: 33, group: 'parcel_status' },
  v_parcel_s4: { label: 'Татгалзсан',          color: '#ef4444', zIndex: 34, group: 'parcel_status' },
  v_parcel_s5: { label: 'Чөлөөлсөн',          color: '#22c55e', zIndex: 35, group: 'parcel_status' },
}

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] }
}

