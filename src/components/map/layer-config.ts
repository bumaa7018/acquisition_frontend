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
  // ГУС-аас ШУУД уншигдах лавлах давхаргууд (appdb-д хуулагддаггүй).
  | 'ca_agreed_parcel'
  | 'ca_sec_parcel'

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
  /**
   * Давхаргыг АСААХАД түүний хүрээ рүү зумлах эсэх (анхдагч: тийм).
   *
   * `false` нь УЛС ДАЯАРЫН давхаргуудад тавигдана. Шалтгаан: зумлалт нь
   * `fitLayerToMap`-аар WFS-ээс геометр татдаг бөгөөд эдгээр давхаргын
   * хариу МАШ ТОМ байдаг (хэмжсэн: au2 = 23 МБ, au3 = 9 МБ, au1 = 7 МБ,
   * ca_sec_parcel = 5.9 МБ). Нүдний товч дарах бүрд ийм хэмжээний өгөгдөл
   * татагдаж, browser-ийн холболтууд дүүрч, зэрэг явж буй API дуудлагууд
   * 30 секундын timeout-д унаж "Серверт холбогдоход алдаа гарлаа" гэсэн
   * анхааруулга гардаг байв.
   *
   * Мөн утгын хувьд ч буруу: "Аймаг/Нийслэл"-ийг асаахад газрын зураг
   * Монгол даяар холдох нь хэрэглэгчийн харж байсан хэсгийг үгүй хийдэг.
   */
  fitOnEnable?: boolean
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
  // Улс даяарын лавлах — асаахад ЗУМЛАХГҮЙ (fitOnEnable-ийн тайлбарыг үз).
  au1: { label: 'Аймаг/Нийслэл', color: '#334155', zIndex: 1, fitOnEnable: false },
  au2: { label: 'Сум/Дүүрэг', color: '#64748b', zIndex: 2, fitOnEnable: false },
  au3: { label: 'Баг/Хороо', color: '#94a3b8', zIndex: 3, fitOnEnable: false },
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
  // ГУС-ийн (ЛМ) давхаргууд — `data_landuse` схемээс GeoServer шууд уншина.
  // Өнгө нь SLD-тэй таарна (ca_agreed_parcel.sld / ca_sec_parcel.sld); энд
  // зөвхөн ТАЙЛБАРын дөрвөлжинд хэрэглэгдэнэ.
  //
  // Эрэмбэ: нэгж талбарын статусын давхаргуудаас (30-35) ДЭЭР — эдгээр нь
  // контекст биш, ХАРЬЦУУЛАХ давхарга (зөвшилцсөн хүрээ ба хамгаалалтын
  // зурвас нь чөлөөлөх талбайтай хэрхэн давхцаж байгааг харах зорилготой).
  // Хоёулаа сийрэг дүүргэлттэй тул доорхыг далдлахгүй.
  ca_agreed_parcel: { label: 'Шинэ зөвшилцсөн зураг', color: '#d946ef', zIndex: 50, opacity: 1, fitOnEnable: false },
  ca_sec_parcel:    { label: 'Хамгаалалтын зурвас',   color: '#dc2626', zIndex: 51, opacity: 1, fitOnEnable: false },
}

/**
 * ГУС-ийн (ЛМ) бүртгэлээс ШУУД уншигдах лавлах давхаргууд.
 *
 * GeoServer-ийн `postgis_gus` датастор нь ГУС-ийн `data_landuse` схем рүү
 * ханддаг — эдгээр давхарга appdb-д хуулагддаггүй тул чөлөөлөлт/төлөвлөгөөгөөр
 * ШҮҮГДЭХГҮЙ (`acquisition_id`, `plan_code` багана байхгүй). Иймд GeoServer
 * proxy дээр гадаад ролид ХААЛТТАЙ (хумих багана байхгүй).
 */
export const GUS_REFERENCE_LAYERS: readonly MapLayerId[] = [
  'ca_agreed_parcel',
  'ca_sec_parcel',
]

const GUS_REFERENCE_SET = new Set<string>(GUS_REFERENCE_LAYERS)

export function isGusReferenceLayer(id: string): boolean {
  return GUS_REFERENCE_SET.has(id)
}

/**
 * Давхаргыг асаахад түүний хүрээ рүү зумлах эсэх.
 *
 * Тодорхойлолтгүй (танихгүй) id дээр `true` — өмнөх зан төлөв хэвээр.
 * `fitOnEnable`-ийн тайлбарыг үз: улс даяарын давхаргууд дээр энэ нь
 * ОЛОН МЕГАБАЙТ WFS татаж, апп-ыг сүлжээгээр боогдуулдаг.
 */
export function shouldFitOnEnable(id: string): boolean {
  const def = MAP_LAYER_STYLES[id as MapLayerId]
  return def?.fitOnEnable !== false
}

/**
 * ДАВХАРГЫН ДОТОРХ ТӨРЛИЙН ӨНГӨНИЙ ТАЙЛБАР.
 *
 * ГУС-ийн хоёр давхарга нь НЭГ өнгөөр бус, ДОТООД төрлөөрөө өнгө ялган
 * зурагддаг (`ca_agreed_parcel` → `work_type`, `ca_sec_parcel` → `explan`).
 * Тухайн ялгааг зурган дээрээс уншихын тулд давхаргын самбарт энэ тайлбар
 * харагдана.
 *
 * ЭХ СУРВАЛЖ нь GeoServer-ийн SLD:
 *   ../government-geoserver/styles/ca_agreed_parcel.sld
 *   ../government-geoserver/styles/ca_sec_parcel.sld
 * Тэдгээрийн Rule бүрийн <Title> ба өнгө нь ДООРХТОЙ ижил байх ёстой —
 * SLD дээрх өнгө сольсон бол ЭНД ч сольно (эс бөгөөс тайлбар зурагтай зөрнө).
 */
export type LayerLegendItem = { label: string; color: string }

export const LAYER_TYPE_LEGEND: Partial<Record<MapLayerId, LayerLegendItem[]>> = {
  // work_type — бүтээн байгуулалтын ажлын төрөл
  ca_agreed_parcel: [
    { label: 'Цахилгаан дамжуулах шугам', color: '#eab308' },
    { label: 'Авто зам, замын байгууламж', color: '#f97316' },
    { label: 'Явган ба дугуйн зам', color: '#fb923c' },
    { label: 'Дулааны шугам', color: '#dc2626' },
    { label: 'Ус хангамж', color: '#06b6d4' },
    { label: 'Үерийн байгууламж, ус зайлуулах', color: '#0ea5e9' },
    { label: 'Ариутгах татуурга', color: '#7c3aed' },
    { label: 'Холбооны шугам', color: '#d946ef' },
    { label: 'Бусад', color: '#94a3b8' },
  ],
  // explan — хамгаалалтын зурвасын төрөл
  ca_sec_parcel: [
    { label: 'Автозам', color: '#f97316' },
    { label: 'Цахилгаан (станц, шугам)', color: '#eab308' },
    { label: 'Усан сан бүхий газар', color: '#0ea5e9' },
    { label: 'Цэвэр ус, үерийн шугам', color: '#06b6d4' },
    { label: 'Ойн сан, ой тэлэн ургах', color: '#16a34a' },
    { label: 'Дулааны станц, шугам', color: '#dc2626' },
    { label: 'Геодезийн цэг, тэмдэгт', color: '#a855f7' },
    { label: 'Бусад', color: '#94a3b8' },
  ],
}

export function legendFor(id: string): LayerLegendItem[] | undefined {
  return LAYER_TYPE_LEGEND[id as MapLayerId]
}

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] }
}

