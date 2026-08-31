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
  | 'v_plan_acquisition'
  | 'parcel'
  | 'building'
  | 'v_parcel_acquisition'
  | 'v_parcel_s0'
  | 'v_parcel_s1'
  | 'v_parcel_s2'
  | 'v_parcel_s3'
  | 'v_parcel_s4'
  | 'v_parcel_s5'

/**
 * GeoServer дээр байгаа ч давхаргын ЖАГСААЛТАД харагдахгүй view-ууд.
 *
 * 'v_acquisition_boundary' (чөлөөлөлтийн геометр) нь одоо төлөвлөгөөний
 * хилийн хуулбар тул хэрэглэгчид ХОЁР ижил давхарга харуулах шаардлагагүй.
 * Гэхдээ газрын зургийн ХҮРЭЭГ олоход хэвээр хэрэглэгдэнэ: хуучин бүртгэлд
 * plan_geom хоосон байж болох ба geometry нь үргэлж дүүрэн байдаг.
 */
export type GeoServerLayerId = MapLayerId | 'v_acquisition_boundary'

export type MapLayerDef = {
  id: MapLayerId
  label: string
  color: string
  zIndex: number
  group?: string
  /** WMS растер давхаргын ерөнхий opacity (0-1). Заагаагүй бол 0.9 хэрэглэгдэнэ. */
  opacity?: number
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
  // Засаг захиргааны хилийн өнгө нь GeoServer-ийн SLD-тэй ЯГ ТААРНА
  // (au1_boundary/au2_boundary/au3_boundary — саарал өнгөний шатлал).
  // Өмнө нь энд ягаан бичигдсэн байсан тул давхаргын самбарын өнгөт
  // дөрвөлжин зурагтай зөрж, хэрэглэгчийг төөрөгдүүлж байв.
  au1: { label: 'Аймаг/Нийслэл', color: '#334155', zIndex: 1 },
  au2: { label: 'Сум/Дүүрэг', color: '#64748b', zIndex: 2 },
  au3: { label: 'Баг/Хороо', color: '#94a3b8', zIndex: 3 },
  // Чөлөөлөлтийн хил нь ТӨЛӨВЛӨГӨӨНИЙ хилийн хуулбар болсон тул давхаргын
  // жагсаалтад зөвхөн НЭГ хил үлдэнэ: 'v_acquisition_boundary' (Чөлөөлөх
  // бүсийн хил) нь энэ давхаргатай яг давхцах тул хасагдсан.
  // ҮНДСЭН ТӨЛӨВЛӨЛТИЙН ХИЛ — нэг төлөвлөгөөний ДУГААРТ хамаарах БҮХ
  // чөлөөлөлтийн хил (v_plan_acquisition, plan_code-оор шүүнэ). Тухайн
  // чөлөөлөлтийн өөрийн хилээс ДООР зурагдана (zIndex 9 < 10) — контекст
  // давхарга тул дээр нь гарч ирэх ёсгүй.
  // Будалт/тунгалаг нь ТӨЛӨВЛӨГӨӨНИЙ ХИЛТЭЙ ижил: давхаргын opacity 0.95,
  // SLD дэх fill-opacity 0.10. Зөвхөн ӨНГӨӨРӨӨ ялгарна.
  v_plan_acquisition:     { label: 'Үндсэн төлөвлөлтийн хил', color: '#6b3f1d', zIndex: 9, opacity: 0.95 },
  v_acquisition_plan:     { label: 'Төлөвлөгөөний хил',   color: '#ff7a00', zIndex: 10, opacity: 0.95 },
  parcel:                 { label: 'Чөлөөлөх талбай',      color: '#22c55e', zIndex: 30 },
  building:               { label: 'Барилгын хил',         color: '#06b6d4', zIndex: 40 },
  // НЭГЖ ТАЛБАРУУД: дүүргэлт SLD-д 70% (fill-opacity 0.7).
  // Давхаргын opacity-г 1 болгосон — үгүй бол өгөгдмөл 0.9-тэй үржиж 63%
  // болж, SLD дэх тохиргоо зурган дээр таарахгүй.
  v_parcel_acquisition:   { label: 'Нэгж талбар',          color: '#94a3b8', zIndex: 40, opacity: 1 },
  v_parcel_s0: { label: 'Хүлээгдэж буй',        color: '#64748b', zIndex: 30, group: 'parcel_status', opacity: 1 },
  v_parcel_s1: { label: 'Зөвшилцөх шатандаа',  color: '#facc15', zIndex: 31, group: 'parcel_status', opacity: 1 },
  v_parcel_s2: { label: 'Үнэлгээ хийх',         color: '#f97316', zIndex: 32, group: 'parcel_status', opacity: 1 },
  v_parcel_s3: { label: 'Нөлөөлөгдсөн гарсан', color: '#3b82f6', zIndex: 33, group: 'parcel_status', opacity: 1 },
  v_parcel_s4: { label: 'Татгалзсан',          color: '#ef4444', zIndex: 34, group: 'parcel_status', opacity: 1 },
  v_parcel_s5: { label: 'Чөлөөлсөн',          color: '#22c55e', zIndex: 35, group: 'parcel_status', opacity: 1 },
}

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] }
}

