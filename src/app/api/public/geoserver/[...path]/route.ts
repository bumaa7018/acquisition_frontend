import { NextRequest, NextResponse } from "next/server";

/**
 * НЭЭЛТТЭЙ (эрх шалгахгүй) GeoServer гарц — ЗӨВХӨН нэг давхаргад
 * (төлөвлөгөөний 2.9.2: бусад системд өгөгдөл холбож харуулах).
 *
 * `land:v_parcel_public` = чөлөөлөлтөд өртсөн БҮХ нэгж талбар, явцын (төлөвийн)
 * нэр ба өнгөтэйгээр. Дүүргээр шүүх: `CQL_FILTER=au2_code='16'`.
 *
 * ЯАГААД ТУСДАА ROUTE:
 *   • GeoServer нь 127.0.0.1-д л нийтлэгддэг (docker-compose) тул гадны систем
 *     шууд хүрч чадахгүй; бүх хандалт proxy-гоор явна.
 *   • `/api/geoserver` нь нэвтрэлт + чөлөөлөлтийн хумилт шалгадаг. Түүнийг
 *     сулруулах нь БҮХ давхаргыг нээх эрсдэлтэй. Иймд нээлттэй хандалтыг
 *     ЭНЭ route-д, ЗӨВХӨН нэг давхаргаар хязгаарлав (fail-closed).
 *
 * ХАМГААЛАЛТ:
 *   • Зам: зөвхөн `land/wms` (GetMap/GetFeatureInfo/GetLegendGraphic) ба
 *     `land/ows` (WFS GetFeature). `rest/*`, `web/*`, `gwc/*` хаалттай.
 *   • Давхарга: LAYERS / typeName-ийг СЕРВЕР ӨӨРӨӨ `v_parcel_public` болгож
 *     дардаг — өөр давхарга дуудах боломжгүй.
 *   • WFS-ийн мөрийн тоо MAX_FEATURES-ээр хумигдана.
 *   • View нь ЗӨВХӨН нээлттэй атрибут агуулна (нэгж талбарын дугаар, засаг
 *     захиргааны нэгж, явцын нэр, өртсөн талбай). Эзэмшигчийн нэр/холбоо
 *     барих, нөхөх олговрын дүн, чөлөөлөлтийн дотоод ID тэнд БАЙХГҮЙ.
 */

const GS_URL = process.env.NEXT_GS_URL ?? "http://localhost:8600";

/** Гадагш нээлттэй ЦОРЫН ГАНЦ давхарга. */
const PUBLIC_LAYER = "v_parcel_public";
const PUBLIC_LAYER_QUALIFIED = `land:${PUBLIC_LAYER}`;

/** WFS-ээр нэг хүсэлтэд буцаах мөрийн дээд хязгаар. */
const MAX_FEATURES = 5000;

/**
 * Зөвшөөрөгдөх ҮЙЛДЛҮҮД (WMS + WFS).
 *
 * Замаар (wms/ows) БИШ, үйлдлээр шүүнэ: GeoServer нь capabilities дотроо
 * WMS-ийн үйлдлүүдийг ч `land/ows` хаягаар сурталчилдаг ба QGIS зэрэг клиент
 * ТЭР хаягаар GetMap дууддаг. Замаар хуваавал стандарт клиент 403 авдаг байв.
 *
 * GetCapabilities — QGIS/ArcGIS давхарга нэмэхэд шаарддаг (хариу нь доор
 * зөвхөн нээлттэй давхаргаар шүүгдэж, хаяг нь энэ гарц рүү заагдана).
 */
const ALLOWED_REQUESTS = new Set([
  "getmap",
  "getfeatureinfo",
  "getlegendgraphic",
  "getcapabilities",
  "getfeature",
  "describefeaturetype",
]);

/** Зөвшөөрөгдөх замууд — GeoServer WMS/WFS-ийг эдгээрээр үйлчилдэг. */
const ALLOWED_PATHS = new Set(["land/wms", "land/ows", "land/wfs"]);

const PASS_THROUGH = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
];

function getParam(params: URLSearchParams, name: string): string {
  const wanted = name.toLowerCase();
  let found = "";
  params.forEach((value, key) => {
    if (!found && key.toLowerCase() === wanted) found = value;
  });
  return found;
}

function setParam(params: URLSearchParams, name: string, value: string) {
  const wanted = name.toLowerCase();
  let existing = "";
  params.forEach((_v, key) => {
    if (!existing && key.toLowerCase() === wanted) existing = key;
  });
  params.set(existing || name, value);
}

function hasParam(params: URLSearchParams, name: string): boolean {
  const wanted = name.toLowerCase();
  let found = false;
  params.forEach((_v, key) => {
    if (key.toLowerCase() === wanted) found = true;
  });
  return found;
}

/**
 * Хүсэлтийн давхаргыг НЭЭЛТТЭЙ давхаргаар дарна.
 *
 * Клиент өөр давхарга (эсвэл олон давхарга) заасан бол ӨӨРЧИЛНӨ — татгалзахгүй:
 * гадны систем ямар нэр бичсэн ч зөвхөн нээлттэй өгөгдөл авна.
 */
function forcePublicLayer(params: URLSearchParams) {
  for (const key of ["layers", "query_layers"]) {
    if (hasParam(params, key)) setParam(params, key, PUBLIC_LAYER_QUALIFIED);
  }
  for (const key of ["typename", "typenames"]) {
    if (hasParam(params, key)) setParam(params, key, PUBLIC_LAYER_QUALIFIED);
  }
  // WMS дээр давхарга заагаагүй GetMap хүсэлтэд ч нээлттэй давхаргыг тавина.
  const request = getParam(params, "request").toLowerCase();
  if (request === "getmap" && !hasParam(params, "layers")) {
    params.set("LAYERS", PUBLIC_LAYER_QUALIFIED);
  }
  if (request === "getlegendgraphic" && !hasParam(params, "layer")) {
    params.set("LAYER", PUBLIC_LAYER_QUALIFIED);
  } else if (hasParam(params, "layer")) {
    setParam(params, "LAYER", PUBLIC_LAYER_QUALIFIED);
  }
  // STYLES-ийг зөвхөн явцын өнгөт style-аар — өөр style дуудахыг хаана.
  if (hasParam(params, "styles")) setParam(params, "STYLES", "");
  if (hasParam(params, "style")) setParam(params, "STYLE", "");
}

/** WFS-ийн мөрийн хязгаарыг хүчээр тавина. */
function capFeatureCount(params: URLSearchParams) {
  for (const key of ["count", "maxfeatures"]) {
    const raw = Number(getParam(params, key));
    if (!Number.isFinite(raw) || raw <= 0 || raw > MAX_FEATURES) {
      setParam(params, key, String(MAX_FEATURES));
    }
  }
  if (!hasParam(params, "count") && !hasParam(params, "maxfeatures")) {
    params.set("count", String(MAX_FEATURES));
  }
}

function deny(reason: string) {
  return NextResponse.json({ error: reason }, { status: 403 });
}

/**
 * Гадны системд харагдах ЭНЭ гарцын бүтэн хаяг.
 *
 * reverse proxy-ийн ард ажиллах тул `x-forwarded-*` толгойг эрхэмлэнэ.
 */
function publicBaseURL(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/public/geoserver`;
}

/**
 * GetCapabilities-ийн ХАРИУГ гадны системд ажиллахаар засна.
 *
 * ЯАГААД ЗААВАЛ: GeoServer нь баримт бичигтээ ӨӨРИЙН дотоод хаягийг
 * (http://localhost:8600/geoserver/...) OnlineResource болгож бичдэг. QGIS,
 * ArcGIS зэрэг клиент нь ДАРААГИЙН хүсэлтээ ТЭР хаягаар явуулдаг тул засахгүй
 * бол давхарга нэмэх үед л ажиллаад, зураг татах үед унана.
 *
 * Мөн зөвхөн НЭЭЛТТЭЙ давхаргыг үлдээж, бусдыг хасна — гадны системд
 * хэрэглэх боломжгүй давхаргын нэрс жагсаагдах нь төөрөгдөл (мөн
 * шаардлагагүй мэдээлэл) төдий.
 */
function rewriteCapabilities(xml: string, baseURL: string): string {
  // 1) Дотоод хаягийг гарцын хаягаар (WMS ба WFS хоёулаа `land/ows`-ыг заана)
  let out = xml.replace(
    /https?:\/\/[^"'\s<>]*?\/geoserver\/(land\/(?:ows|wms|wfs))/gi,
    `${baseURL}/$1`,
  );

  // 2) Зөвхөн нээлттэй давхаргыг үлдээнэ.
  //
  // GeoServer нь ХҮҮ давхарга бүрийг `<Layer queryable="…">` гэж (атрибуттай)
  // бичдэг, харин агуулагч нь ердийн `<Layer>`. Иймд зөвхөн атрибуттайг
  // шүүнэ — агуулагчийг хөндвөл баримт бүтэн эвдэрнэ.
  out = out.replace(/<Layer\s+queryable="[^"]*"[^>]*>[\s\S]*?<\/Layer>/g, (block) =>
    block.includes(`<Name>${PUBLIC_LAYER}</Name>`) ||
    block.includes(`<Name>${PUBLIC_LAYER_QUALIFIED}</Name>`)
      ? block
      : "",
  );

  // 3) Схемийн (XSD) хаяг нь GeoServer-ийн дотоод хаягийг заадаг — стандарт
  //    OGC схемээр солино (зам ижил бөгөөс дотоод хаяг гадагш гарахгүй).
  out = out.replace(
    /https?:\/\/[^"'\s<>]*?\/geoserver\/schemas\//gi,
    "https://schemas.opengis.net/",
  );

  // 4) WFS-ийн <FeatureType> блокууд
  out = out.replace(/<FeatureType(\s[^>]*)?>[\s\S]*?<\/FeatureType>/g, (block) =>
    block.includes(PUBLIC_LAYER) ? block : "",
  );
  return out;
}

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const joined = path.join("/");
  if (!ALLOWED_PATHS.has(joined)) {
    return deny("Зөвхөн land/wms, land/ows, land/wfs зөвшөөрөгдөнө");
  }

  const search = new URLSearchParams(req.nextUrl.search);
  const request = getParam(search, "request").toLowerCase();
  if (!request || !ALLOWED_REQUESTS.has(request)) {
    return deny("Зөвшөөрөгдөөгүй үйлдэл");
  }

  // Хүсэлтийг нээлттэй давхаргаар хумина (GetCapabilities-д давхарга байхгүй).
  if (request !== "getcapabilities") {
    forcePublicLayer(search);
    // Мөрийн хязгаар — ЗӨВХӨН өгөгдөл татах (WFS) хүсэлтэд.
    if (request === "getfeature") capFeatureCount(search);
  }

  // ЖИЧ: NEXT_GS_URL нь GeoServer-ийн ЯЗГУУР (ж: http://geoserver:8080) тул
  // `/geoserver` контекстийн замыг ЭНД залгана (дотоод proxy-тэй ижил).
  const url = `${GS_URL.replace(/\/$/, "")}/geoserver/${joined}?${search.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Газрын зургийн сервер хариу өгсөнгүй" }, { status: 502 });
  }

  const headers = new Headers();
  for (const h of PASS_THROUGH) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Гадны систем/хөтчөөс шууд дуудах боломжтой байх (эрх шалгахгүй давхарга).
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", "public, max-age=60");

  // GetCapabilities — дотоод хаягийг гарцын хаягаар сольж, зөвхөн нээлттэй
  // давхаргыг үлдээнэ (стандарт клиентүүд ингэснээр шууд ажиллана).
  if (request === "getcapabilities" && res.ok) {
    const xml = rewriteCapabilities(await res.text(), publicBaseURL(req));
    headers.delete("content-length");
    return new NextResponse(xml, { status: res.status, headers });
  }

  return new NextResponse(res.body, { status: res.status, headers });
}

export const GET = proxy;
export const HEAD = proxy;

/** CORS preflight — гадны системийн хөтөч дээрх клиентэд. */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}
