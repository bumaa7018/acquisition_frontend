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
  // Шинэ зөвшилцсөн зургийн ДЭД давхаргууд (`code`-оор задалсан) — доорхыг үз.
  | AgreedCodeLayerId
  // Хамгаалалтын зурвасын ДЭД давхаргууд (`code`-оор задалсан).
  | SecCodeLayerId

/**
 * "Шинэ зөвшилцсөн зураг"-ийн ДЭД давхаргууд.
 *
 * GeoServer дээр ЭДГЭЭР НЭР БАЙХГҮЙ: бүгд `ca_agreed_parcel`-ээс `code`
 * баганын CQL шүүлтээр гардаг (MapLayerDef.source / .cql). Давхаргын самбарт
 * тус тусад нь асаах/унтраах бөгөөс нэрээрээ (кодоор биш) харагдана.
 */
/**
 * "Хамгаалалтын зурвас"-ын ДЭД давхаргууд.
 *
 * Зөвшилцсөн зурагтай ИЖИЛ зарчим: GeoServer дээр эдгээр нэр байхгүй, бүгд
 * `ca_sec_parcel`-ээс `code` баганын CQL шүүлтээр гарна. Бүртгэлд байгаа 27
 * код (хэмжсэн) + танигдаагүй кодын "бусад".
 */
export type SecCodeLayerId =
  | 'ca_sec_c1'
  | 'ca_sec_c2'
  | 'ca_sec_c3'
  | 'ca_sec_c4'
  | 'ca_sec_c5'
  | 'ca_sec_c6'
  | 'ca_sec_c7'
  | 'ca_sec_c8'
  | 'ca_sec_c10'
  | 'ca_sec_c11'
  | 'ca_sec_c13'
  | 'ca_sec_c14'
  | 'ca_sec_c15'
  | 'ca_sec_c16'
  | 'ca_sec_c17'
  | 'ca_sec_c18'
  | 'ca_sec_c19'
  | 'ca_sec_c20'
  | 'ca_sec_c21'
  | 'ca_sec_c22'
  | 'ca_sec_c23'
  | 'ca_sec_c24'
  | 'ca_sec_c25'
  | 'ca_sec_c26'
  | 'ca_sec_c45'
  | 'ca_sec_c46'
  | 'ca_sec_c47'
  | 'ca_sec_other'

export type AgreedCodeLayerId =
  | 'ca_agreed_c30'
  | 'ca_agreed_c48'
  | 'ca_agreed_c49'
  | 'ca_agreed_c50'
  | 'ca_agreed_c51'
  | 'ca_agreed_c52'
  | 'ca_agreed_c53'
  | 'ca_agreed_c54'
  | 'ca_agreed_other'

/**
 * GeoServer дээр байгаа ч давхаргын ЖАГСААЛТАД харагдахгүй view-ууд.
 *
 * 'v_acquisition_boundary' (чөлөөлөлтийн геометр) нь одоо төлөвлөгөөний
 * хилийн хуулбар тул хэрэглэгчид ХОЁР ижил давхарга харуулах шаардлагагүй.
 * Гэхдээ газрын зургийн ХҮРЭЭГ олоход хэвээр хэрэглэгдэнэ: хуучин бүртгэлд
 * plan_geom хоосон байж болох ба geometry нь үргэлж дүүрэн байдаг.
 */
/**
 * GeoServer дээр БОДИТООР байгаа давхаргын нэрс.
 *
 * `AgreedCodeLayerId`-ууд ХАСАГДСАН: тэдгээр нь виртуал (нэг GeoServer
 * давхаргыг CQL-ээр хуваасан) тул WMS `LAYERS`/WFS `typeName`-д тэр нэрээр
 * дуудвал GeoServer "No such layer" буцаана. Дуудахын өмнө `geoServerName()`
 * -ээр эх давхарга рүү хөрвүүлнэ — типээр албадав.
 */
export type GeoServerLayerId =
  | Exclude<MapLayerId, AgreedCodeLayerId | SecCodeLayerId>
  | 'v_acquisition_boundary'

/**
 * ТОРЛОЛТЫН ХЭЛБЭР — GeoServer-ийн `shape://<нэр>` тэмдэгтэй ИЖИЛ нэр.
 *
 * Нэг эх сурвалж: SLD дээрх GraphicFill-ийн тэмдэг ба давхаргын самбарын
 * дөрвөлжингийн CSS торлолт хоёулаа үүгээр тодорхойлогдоно.
 */
export type LayerHatch =
  | 'slash'
  | 'backslash'
  | 'times'
  | 'plus'
  | 'vertline'
  | 'horline'
  /** ЦЭГЭН будалт (тор биш) — хамгаалалтын зурвасын дэд төрлүүд. */
  | 'dot'

export type MapLayerDef = {
  id: MapLayerId
  label: string
  color: string
  zIndex: number
  group?: string
  /**
   * GeoServer дээрх ЭХ давхаргын нэр — зөвхөн ВИРТУАЛ дэд давхаргад.
   * Заагаагүй бол `id` өөрөө GeoServer-ийн нэр.
   */
  source?: GeoServerLayerId
  /**
   * Дэд давхаргыг эх давхаргаасаа ялгах ТОГТМОЛ CQL шүүлт (ж: `code=48`).
   *
   * Дуудагч талын динамик шүүлттэй (чөлөөлөлт/он/захиргааны код) `AND`-ээр
   * НЭГТГЭГДЭНЭ — дарж бичихгүй.
   */
  cql?: string
  /**
   * Давхарга зурган дээр ТОРЛОСОН будагддаг бол торны хэлбэр.
   *
   * SLD дэх `shape://<хэлбэр>`-тэй ЯГ ижил нэр — давхаргын самбарын өнгөт
   * дөрвөлжин ч мөн ЭНЭ торлолтоор зурагдана (дүүрэн өнгө нь зурган дээрхтэй
   * зөрж, хэрэглэгч "яагаад зураг нь торлосон, тайлбар нь дүүрэн байна" гэж
   * төөрөгддөг). Заагаагүй бол дөрвөлжин нь дүүрэн өнгөтэй.
   */
  hatch?: LayerHatch
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

/** Давхаргын самбарт зөвшилцсөн зургийн дэд давхаргуудыг агуулах хэсгийн id. */
export const AGREED_GROUP_ID = 'ca_agreed'

export type AgreedCodeLayer = {
  id: AgreedCodeLayerId
  /** `code` баганын утга. `null` = доорх кодуудад ороогүй БҮХЭН (SLD: ElseFilter). */
  code: number | null
  label: string
  /** Хил, торлолт, тайлбарын өнгө — SLD дэх stroke-той ЯГ ижил. */
  color: string
  /** Торны хэлбэр — SLD дэх `shape://<нэр>`-тэй ЯГ ижил. */
  hatch: LayerHatch
}

/**
 * ШИНЭ ЗӨВШИЛЦСӨН ЗУРГИЙН ДЭД ТӨРЛҮҮД — `code` баганын утгаар.
 *
 * ЯАГААД `code` (work_type биш): `work_type` нь чөлөөт текст бөгөөс цэвэр БИШ
 * (ижил төрөл 5-8 хувилбартай, үсгийн алдаатай), харин `code` нь бүхэл тоо
 * (DescribeFeatureType: xsd:int) ба бүртгэлд ердөө 8 утга авдаг (хэмжсэн,
 * 3435 мөр): 49=2035, 48=618, 53=151, 50=151, 52=150, 54=128, 51=106, 30=96.
 *
 * НЭР нь код бүрийн ЗОНХИЛОХ `work_type`-аас гарсан (жишээ: 49 → 2027/2035
 * нь "цахилгаан дамжуулах шугам"). Давхаргын самбарт КОД биш ЭНЭ НЭР
 * харагдана — кодын дугаар нь дэлгэц дээр утга нэмдэггүй.
 *
 * ӨНГӨ нь хэрэглэгчийн ирүүлсэн QGIS-ийн тайлбартай таарна (48 шар-хүрэн,
 * 49 улаан, 50 хурц ногоон, 51 хар цэнхэр, 52 ягаан, 53 ногоон, 54 нил ягаан).
 * Зурган дээр БАЙХГҮЙ кодууд (30 ба "бусад") давхцахгүй өнгө авав.
 *
 * ЭХ СУРВАЛЖ нь GeoServer-ийн SLD:
 *   ../government-geoserver/styles/ca_agreed_parcel.sld
 * Тэнд объектын ГАДНА хил нь ЭНД бичсэн өнгөөр (дүүрэн) зурагдаж, ДОТОР тал
 * нь ижил өнгөөр БҮДЭГ + ТОРЛОСОН (GraphicFill) будагдана.
 * SLD дээрх өнгө сольсон бол ЭНД ч сольно — tests/map-layers.test.mjs барина.
 */
export const AGREED_CODE_LAYERS: readonly AgreedCodeLayer[] = [
  { id: 'ca_agreed_c30', code: 30, label: 'Барилга байгууламж',              color: '#8b5a2b', hatch: 'backslash' },
  { id: 'ca_agreed_c48', code: 48, label: 'Авто зам, замын байгууламж',      color: '#ffa500', hatch: 'slash' },
  // 49 ба 53 нь зурган дээр ч торлосон — тэр хэлбэрийг хэвээр авав.
  { id: 'ca_agreed_c49', code: 49, label: 'Цахилгаан дамжуулах шугам',       color: '#ff0000', hatch: 'times' },
  // 50 ба 53 хоёулаа ногоон тул торны хэлбэрээр (босоо ба тор) ялгагдана.
  { id: 'ca_agreed_c50', code: 50, label: 'Ариутгах татуурга',               color: '#00cc00', hatch: 'vertline' },
  { id: 'ca_agreed_c51', code: 51, label: 'Ус хангамж',                      color: '#0000cd', hatch: 'backslash' },
  { id: 'ca_agreed_c52', code: 52, label: 'Дулааны шугам',                   color: '#ff80b0', hatch: 'horline' },
  { id: 'ca_agreed_c53', code: 53, label: 'Үерийн байгууламж, ус зайлуулах', color: '#2e8b57', hatch: 'plus' },
  { id: 'ca_agreed_c54', code: 54, label: 'Холбооны шугам',                  color: '#cc44cc', hatch: 'slash' },
  // "БУСАД КОД" — дээрх 8-д ороогүй (эсвэл code хоосон) объектууд. Байхгүй
  // бол ГУС дээр ШИНЭ код гарахад тэр өгөгдөл ямар ч дэд давхаргад
  // харагдахгүй, чимээгүй алга болно.
  { id: 'ca_agreed_other', code: null, label: 'Бусад код', color: '#94a3b8', hatch: 'times' },
]

/** Дэд давхаргын CQL: тухайн код, эсвэл "бусад" (танигдсан кодуудаас гадна). */
function agreedCql(code: number | null): string {
  if (code !== null) return `code=${code}`
  const known = AGREED_CODE_LAYERS.map((l) => l.code)
    .filter((c): c is number => c !== null)
    .join(',')
  // Хаалт ЗААВАЛ: дуудагч тал үүнийг өөрийн шүүлттэй AND-ээр нэгтгэдэг тул
  // хаалтгүй бол OR нь AND-аас өмнө бодогдож шүүлт бүхэлдээ эвдэрнэ.
  return `(code NOT IN (${known}) OR code IS NULL)`
}

const AGREED_SUB_STYLES = Object.fromEntries(
  AGREED_CODE_LAYERS.map((l) => [
    l.id,
    {
      label: l.label,
      color: l.color,
      // Эх давхаргатайгаа ИЖИЛ эрэмбэ (50): дэд давхаргуудын шүүлт хоорондоо
      // давхцахгүй тул дотроо дарах зүйл байхгүй, ca_sec_parcel (51) нь
      // өмнөх шигээ тэдгээрийн ДЭЭР үлдэнэ.
      zIndex: 50,
      opacity: 1,
      fitOnEnable: false,
      group: AGREED_GROUP_ID,
      source: 'ca_agreed_parcel',
      cql: agreedCql(l.code),
      hatch: l.hatch,
    },
  ]),
) as Record<AgreedCodeLayerId, Omit<MapLayerDef, 'id'>>

/** Давхаргын самбарт хамгаалалтын зурвасын дэд давхаргуудыг агуулах хэсгийн id. */
export const SEC_GROUP_ID = 'ca_sec'

export type SecCodeLayer = {
  id: SecCodeLayerId
  /**
   * `code` баганын утга. ЭНЭ БАГАНА ТЕКСТ (DescribeFeatureType: xsd:string)
   * тул CQL-д хашилтанд орно (`code='19'`) — зөвшилцсөн зургийн `code` нь
   * бүхэл тоо байсныг эндээс ЯЛГАВАРЛА.
   *
   * `null` = доорх кодуудад ороогүй БҮХЭН (SLD: ElseFilter).
   */
  code: string | null
  label: string
  /** Хил, цэгэн будалт, самбарын дөрвөлжингийн өнгө — SLD дэх stroke-той ижил. */
  color: string
}

/**
 * ХАМГААЛАЛТЫН ЗУРВАСЫН ДЭД ТӨРЛҮҮД — `code` баганын утгаар.
 *
 * Зөвшилцсөн зурагтай ИЖИЛ зарчим (тэндхийн тайлбарыг үз). ЯЛГАА нь ХОЁР:
 *   1) `code` нь ТЕКСТ багана — CQL-д хашилттай;
 *   2) дотор тал нь ТОР биш ЦЭГЭН (hatch: 'dot') — хэрэглэгчийн заасан.
 *
 * НЭР нь код бүрийн ЗОНХИЛОХ `explan`-аас гарсан (хэмжсэн, 90201 мөр). Хоёр
 * `explan`-тай кодуудыг НЭГТГЭВ — `code` нь тэдгээрийг ялгаж чаддаггүй:
 *   1  → "энгийн" (5407) ба "онцгой" (3228) хамгаалалтын бүс
 *   13 → станцын зурвас (117) ба шугамын бүс (16)
 *   14 → гадаад муж (1) ба дотоод муж (1)
 * Мөр хамгийн олон код: 19 = 30295, 20 = 23599, 22 = 10084, 23 = 9508.
 *
 * ӨНГӨ нь хэрэглэгчийн ирүүлсэн QGIS-ийн тайлбарын өнгөний ГЭРЭЭЛ дагасан
 * (ус = цэнхэр, ой = ногоон, цахилгаан = улаан/шар, холбоо = нил ягаан,
 * зам/оршуулга/далан = саарал). 27 төрөл нь өнгөөр Л ялгагддаг тул хоорондоо
 * ХАМГИЙН ХОЛ өнгө сонгосон — зурган дээрх ойролцоо хос өнгийг (ж: 19 ба 23
 * хоёулаа саарал цэгтэй) хуулбарлавал самбарт ялгаж уншигдахгүй болно.
 *
 * ЭХ СУРВАЛЖ нь GeoServer-ийн SLD:
 *   ../government-geoserver/styles/ca_sec_parcel.sld
 * SLD дээрх өнгө сольсон бол ЭНД ч сольно — tests/map-layers.test.mjs барина.
 */
export const SEC_CODE_LAYERS: readonly SecCodeLayer[] = [
  { id: 'ca_sec_c1',  code: '1',  label: 'Усан сан бүхий газар (энгийн, онцгой)', color: '#1d4ed8' },
  { id: 'ca_sec_c2',  code: '2',  label: 'Усан сан бүхий газар (энгийн)',         color: '#3b82f6' },
  { id: 'ca_sec_c3',  code: '3',  label: 'Ундны усны эх үүсвэрийн хориглолт',     color: '#0284c7' },
  { id: 'ca_sec_c4',  code: '4',  label: 'Ундны усны эх үүсвэрийн эрүүл ахуй',    color: '#38bdf8' },
  { id: 'ca_sec_c5',  code: '5',  label: 'Булаг шандын хамгаалалт',               color: '#4f46e5' },
  { id: 'ca_sec_c6',  code: '6',  label: 'Нуур цөөрмийн хамгаалалт',              color: '#0ea5e9' },
  { id: 'ca_sec_c7',  code: '7',  label: 'Ойн сан бүхий газар',                   color: '#15803d' },
  { id: 'ca_sec_c8',  code: '8',  label: 'Ой тэлэн ургах нөөц газар',             color: '#4ade80' },
  { id: 'ca_sec_c10', code: '10', label: 'Бохир усны шугам',                      color: '#84cc16' },
  { id: 'ca_sec_c11', code: '11', label: 'Геодезийн цэг, тэмдэгт',                color: '#059669' },
  { id: 'ca_sec_c13', code: '13', label: 'Дулааны станц, шугам',                  color: '#dc2626' },
  { id: 'ca_sec_c14', code: '14', label: 'Нисэх зурвас (гадаад, дотоод муж)',     color: '#1e3a8a' },
  { id: 'ca_sec_c15', code: '15', label: 'Үерийн ус зайлуулах шугам',             color: '#14b8a6' },
  { id: 'ca_sec_c16', code: '16', label: 'Үерийн далан',                          color: '#475569' },
  { id: 'ca_sec_c17', code: '17', label: 'Холбоо мэдээллийн шугам',               color: '#c026d3' },
  { id: 'ca_sec_c18', code: '18', label: 'Холбоо мэдээллийн станц',               color: '#f0abfc' },
  { id: 'ca_sec_c19', code: '19', label: 'Цахилгаан түгээх шугам /6-10kB/',       color: '#eab308' },
  { id: 'ca_sec_c20', code: '20', label: 'Цахилгаан дамжуулах шугам /35kB/',      color: '#fca5a5' },
  { id: 'ca_sec_c21', code: '21', label: 'Цахилгаан дамжуулах шугам /110kB/',     color: '#b91c1c' },
  { id: 'ca_sec_c22', code: '22', label: 'Цахилгааны дэд станц',                  color: '#ef4444' },
  { id: 'ca_sec_c23', code: '23', label: 'Цахилгаан станц /6-10kB/',              color: '#f59e0b' },
  { id: 'ca_sec_c24', code: '24', label: 'Цэвэрлэх байгууламж',                   color: '#22d3ee' },
  { id: 'ca_sec_c25', code: '25', label: 'Цэвэр усны шугам',                      color: '#06b6d4' },
  { id: 'ca_sec_c26', code: '26', label: 'Усан сангийн хамгаалалт',               color: '#0891b2' },
  { id: 'ca_sec_c45', code: '45', label: 'Автозам',                               color: '#78716c' },
  { id: 'ca_sec_c46', code: '46', label: 'Оршуулгын газар',                       color: '#a8a29e' },
  { id: 'ca_sec_c47', code: '47', label: 'Оршуулгын газрын хамгаалалт',           color: '#57534e' },
  // "БУСАД КОД" — дээрх 27-д ороогүй (эсвэл code хоосон). ГУС дээр шинэ код
  // гарахад тэр өгөгдөл чимээгүй алга болохоос сэргийлнэ.
  { id: 'ca_sec_other', code: null, label: 'Бусад код', color: '#94a3b8' },
]

/** Дэд давхаргын CQL. `code` нь ТЕКСТ багана тул утга ХАШИЛТАНД орно. */
function secCql(code: string | null): string {
  if (code !== null) return `code='${code}'`
  const known = SEC_CODE_LAYERS.map((l) => l.code)
    .filter((c): c is string => c !== null)
    .map((c) => `'${c}'`)
    .join(',')
  // Хаалт ЗААВАЛ (agreedCql-ийн тайлбарыг үз).
  return `(code NOT IN (${known}) OR code IS NULL)`
}

const SEC_SUB_STYLES = Object.fromEntries(
  SEC_CODE_LAYERS.map((l) => [
    l.id,
    {
      label: l.label,
      color: l.color,
      // Эх давхаргатайгаа ИЖИЛ эрэмбэ (51) — зөвшилцсөн зургийн дэд
      // давхаргуудаас (50) ДЭЭР, өмнөх зан төлөв хэвээр.
      zIndex: 51,
      opacity: 1,
      fitOnEnable: false,
      group: SEC_GROUP_ID,
      source: 'ca_sec_parcel',
      cql: secCql(l.code),
      hatch: 'dot',
    },
  ]),
) as Record<SecCodeLayerId, Omit<MapLayerDef, 'id'>>

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
  //
  // `ca_agreed_parcel` нь давхаргын самбарт ӨӨРӨӨ БАЙХГҮЙ: `code` баганаар
  // задарсан дэд давхаргуудаараа (AGREED_CODE_LAYERS) харагдана. Гэхдээ энэ
  // тодорхойлолт хэвээр хэрэгтэй — GeoServer-ийн НЭР (source) ба хэсгийн
  // нэр/өнгө (AGREED_GROUP) эндээс гарна.
  // `ca_sec_parcel` ч мөн адил ӨӨРӨӨ самбарт байхгүй — `code`-оор задарсан
  // дэд давхаргуудаараа (SEC_CODE_LAYERS) орно.
  ca_agreed_parcel: { label: 'Шинэ зөвшилцсөн зураг', color: '#d946ef', zIndex: 50, opacity: 1, fitOnEnable: false },
  ca_sec_parcel:    { label: 'Хамгаалалтын зурвас',   color: '#dc2626', zIndex: 51, opacity: 1, fitOnEnable: false },
  ...AGREED_SUB_STYLES,
  ...SEC_SUB_STYLES,
}

/**
 * Давхаргын самбарын "Шинэ зөвшилцсөн зураг" ХЭСЭГ (дэд давхаргуудын эх).
 *
 * Нэр/өнгө нь эх давхаргаасаа гарна — хоёр газар бичвэл зөрөх магадлалтай.
 * Хэлбэр нь layer-panel-ийн `LayerGroupConfig`-той тохирно (энэ файл нь
 * компонентоос ХАМААРАХГҮЙ байх ёстой тул тэр типийг import хийхгүй).
 */
export const AGREED_GROUP = {
  id: AGREED_GROUP_ID,
  label: MAP_LAYER_STYLES.ca_agreed_parcel.label,
  color: MAP_LAYER_STYLES.ca_agreed_parcel.color,
}

/** Хамгаалалтын зурвасын самбарын ХЭСЭГ — нэр/өнгө нь эх давхаргаасаа. */
export const SEC_GROUP = {
  id: SEC_GROUP_ID,
  label: MAP_LAYER_STYLES.ca_sec_parcel.label,
  color: MAP_LAYER_STYLES.ca_sec_parcel.color,
}

/** Зөвшилцсөн зургийн дэд давхаргын id-ууд — самбарын дараалалд. */
export const AGREED_CODE_LAYER_IDS: readonly AgreedCodeLayerId[] =
  AGREED_CODE_LAYERS.map((l) => l.id)

/** Хамгаалалтын зурвасын дэд давхаргын id-ууд — самбарын дараалалд. */
export const SEC_CODE_LAYER_IDS: readonly SecCodeLayerId[] = SEC_CODE_LAYERS.map((l) => l.id)

/**
 * Давхаргын id-г GeoServer-ийн БОДИТ давхаргын нэр болгоно.
 *
 * Виртуал дэд давхаргууд (зөвшилцсөн зургийн кодууд) нь GeoServer дээр
 * байхгүй — WMS `LAYERS` / WFS `typeName`-д ҮРГЭЛЖ үүнийг дамжуулна.
 */
export function geoServerName(id: MapLayerId): GeoServerLayerId {
  return (MAP_LAYER_STYLES[id]?.source ?? id) as GeoServerLayerId
}

/**
 * Хэд хэдэн CQL шүүлтийг `AND`-ээр нэгтгэнэ (хоосныг алгасана).
 *
 * Хэсэг бүрийг ХААЛТАД оруулна: дэд давхаргын шүүлт `OR` агуулж болох тул
 * (жишээ: "бусад код") хаалтгүй нэгтгэвэл AND/OR-ийн эрэмбээс болж шүүлт
 * бүхэлдээ эвдэрнэ.
 */
export function combineCql(...parts: (string | undefined | null)[]): string {
  const kept = parts.map((p) => (p ?? '').trim()).filter(Boolean)
  if (kept.length <= 1) return kept[0] ?? ''
  return kept.map((p) => `(${p})`).join(' AND ')
}

/**
 * ГУС-ийн (ЛМ) бүртгэлээс ШУУД уншигдах лавлах давхаргууд.
 *
 * GeoServer-ийн `postgis_gus` датастор нь ГУС-ийн `data_landuse` схем рүү
 * ханддаг — эдгээр давхарга appdb-д хуулагддаггүй тул чөлөөлөлт/төлөвлөгөөгөөр
 * ШҮҮГДЭХГҮЙ (`acquisition_id`, `plan_code` багана байхгүй). Иймд GeoServer
 * proxy дээр гадаад ролид ХААЛТТАЙ (хумих багана байхгүй).
 *
 * Зөвшилцсөн зургийн ДЭД давхаргууд ч мөн энд орно: тэдгээр нь ижил
 * `ca_agreed_parcel`-ээс (source) уншигддаг тул ижил хумилтад орно.
 */
export const GUS_REFERENCE_LAYERS: readonly MapLayerId[] = [
  'ca_agreed_parcel',
  'ca_sec_parcel',
  ...AGREED_CODE_LAYER_IDS,
  ...SEC_CODE_LAYER_IDS,
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

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] }
}

