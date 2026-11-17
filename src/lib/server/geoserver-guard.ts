// GeoServer proxy-уудын (`/api/geoserver`, `/api/public/geoserver`) параметрийн
// хамгаалалт — цэвэр функцууд (тестлэгдэнэ).
//
// Яагаад тусдаа: давхаргын шалгалт өмнө нь `layers`/`typeName`/`typeNames`-ийн
// ЭХНИЙ олдсоныг л уншдаг байв. WFS нь `layers`-ийг үл тоож `typeNames`-ийг
// уншдаг тул `layers=au1&typeNames=land:parcel` нь шалгалтад "au1" харагдаж
// GeoServer `parcel`-ийг буцаадаг байлаа. Мөн `featureID`/`resourceId` нь
// давхаргын нэргүйгээр шууд объект руу хүрдэг, `sld`/`sld_body` нь өөр
// давхаргыг зурагт нэмдэг.

/** Давхаргыг заадаг БҮХ параметр (WMS, WFS 1.x/2.0, legend). */
export const LAYER_PARAMS = ["layers", "query_layers", "layer", "typename", "typenames"] as const;

/**
 * Давхаргын нэргүйгээр объект/давхарга руу хүрдэг, эсвэл серверт гадаад
 * баримт татуулдаг параметрүүд — proxy-д хэзээ ч дамжуулахгүй.
 *  - featureid / resourceid — WFS-д объектын ID-аар (давхаргын нэр шаардахгүй)
 *  - storedquery_id — серверт тодорхойлсон асуулга
 *  - filter — XML шүүлт (<ResourceId> агуулж болно)
 *  - sld / sld_body — өөр давхаргыг (NamedLayer) зурагт нэмэх, гадаад хаяг татуулах
 *  - viewparams — SQL view-ийн параметр
 */
export const FORBIDDEN_PARAMS = [
  "featureid",
  "resourceid",
  "storedquery_id",
  "filter",
  "sld",
  "sld_body",
  "viewparams",
] as const;

function keysOf(params: URLSearchParams): string[] {
  const keys: string[] = [];
  params.forEach((_v, k) => keys.push(k));
  return keys;
}

/** `land:v_parcel_status` эсвэл `v_parcel_status` → `v_parcel_status`. */
export function bareLayerName(value: string): string {
  const trimmed = value.trim();
  const colon = trimmed.indexOf(":");
  return colon === -1 ? trimmed : trimmed.slice(colon + 1);
}

/**
 * Хүсэлтийн БҮХ давхаргын параметрийн утгыг цуглуулна (давтагдсан түлхүүр,
 * том/жижиг үсгийн ялгаа, таслалаар салгасан жагсаалтыг оролцуулан).
 */
export function collectLayers(params: URLSearchParams): string[] {
  const out: string[] = [];
  params.forEach((value, key) => {
    if (!(LAYER_PARAMS as readonly string[]).includes(key.toLowerCase())) return;
    for (const part of value.split(",")) {
      const name = bareLayerName(part);
      if (name) out.push(name);
    }
  });
  return out;
}

/** Хориотой параметр байгаа эсэх (том/жижиг үсэг үл хамаарна). */
export function hasForbiddenParam(params: URLSearchParams): boolean {
  return keysOf(params).some((k) =>
    (FORBIDDEN_PARAMS as readonly string[]).includes(k.toLowerCase()),
  );
}

/** Хориотой параметрүүдийг устгана (нээлттэй гарцад — татгалзахгүй, хасна). */
export function stripForbiddenParams(params: URLSearchParams): void {
  for (const k of keysOf(params)) {
    if ((FORBIDDEN_PARAMS as readonly string[]).includes(k.toLowerCase())) params.delete(k);
  }
}

/** Тухайн нэртэй (том/жижиг үсэг үл хамаарна) БҮХ параметрийг нэг утгаар солино. */
export function setParamEverywhere(params: URLSearchParams, name: string, value: string): void {
  const wanted = name.toLowerCase();
  for (const k of keysOf(params)) {
    if (k.toLowerCase() === wanted) params.delete(k);
  }
  params.set(name, value);
}

/**
 * Хэрэглэгчийн CQL шүүлтийг `(<шүүлт>) AND <хумилт>` хэлбэрт аюулгүй
 * хавсаргаж болох эсэх.
 *
 * Хаалт тэнцвэргүй шүүлт (`1=1) OR (1=1`) нь хумилтыг OR-ын нэг талд гаргаж
 * хүчингүй болгодог; `;` нь GeoServer-т давхарга тус бүрийн шүүлтийг
 * салгадаг. Тэмдэгт мөр ('...', '' нь escape) доторх тэмдэгтийг тооцохгүй.
 */
export function isSafeCqlFragment(cql: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < cql.length; i++) {
    const ch = cql[i];
    if (inString) {
      if (ch === "'") {
        if (cql[i + 1] === "'") i++;
        else inString = false;
      }
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth < 0) return false;
    } else if (ch === ";") return false;
  }
  return depth === 0 && !inString;
}

/**
 * Удирдах параметр (request, service, cql_filter …) том/жижиг үсгээр ялгаатай
 * хоёр удаа ирсэн эсэх. Proxy нь эхнийхийг нь шалгаж/хумиад, GeoServer
 * НӨГӨӨГ нь хэрэглэвэл (жишээ нь `CQL_FILTER=…&cql_filter=1=1`) хумилт
 * тойрогдоно — ийм хүсэлтийг бүхэлд нь татгалзана.
 */
export const SINGLE_VALUE_PARAMS = ["request", "service", "version", "cql_filter", "count", "maxfeatures", "feature_count", "env"] as const;

export function hasDuplicateControlParam(params: URLSearchParams): boolean {
  const seen = new Set<string>();
  for (const k of keysOf(params)) {
    const key = k.toLowerCase();
    if (!(SINGLE_VALUE_PARAMS as readonly string[]).includes(key)) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
