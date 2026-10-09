/**
 * Газрын зургийн загвар — Snazzy Maps «Shades of Grey» (https://snazzymaps.com/style/38,
 * хар theme) ба «Masik WWW» (https://snazzymaps.com/style/6376, цагаан theme).
 * Google Maps-ийн style JSON-ийг Google-ийн raster tile-ийн `apistyle`
 * параметр болгон хувиргаж «Он цагийн зураг»-ийн суурь болгоно (хиймэл
 * дагуултай адил mt*.google.com tile — JS API/түлхүүргүй).
 */

export interface MapStyleRule {
  featureType: string;
  elementType: string;
  stylers: Record<string, string | number>[];
}

export const SHADES_OF_GREY: MapStyleRule[] = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ saturation: 36 }, { color: "#000000" }, { lightness: 40 }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ visibility: "on" }, { color: "#000000" }, { lightness: 16 }] },
  { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.fill", stylers: [{ color: "#000000" }, { lightness: 20 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#000000" }, { lightness: 17 }, { weight: 1.2 }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 20 }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 21 }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#000000" }, { lightness: 17 }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#000000" }, { lightness: 29 }, { weight: 0.2 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 18 }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 16 }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 19 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }, { lightness: 17 }] },
];

export const MASIK_WWW: MapStyleRule[] = [
  { featureType: "administrative.province", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels", stylers: [{ lightness: "-8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#000000" }] },
  { featureType: "administrative.locality", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", elementType: "all", stylers: [{ color: "#acacac" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#484848" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.stroke", stylers: [{ color: "#ff0000" }, { visibility: "off" }] },
  { featureType: "administrative.land_parcel", elementType: "all", stylers: [{ lightness: "-3" }] },
  { featureType: "landscape", elementType: "all", stylers: [{ saturation: -100 }, { lightness: "72" }, { visibility: "on" }] },
  { featureType: "landscape", elementType: "labels", stylers: [{ lightness: "23" }] },
  { featureType: "poi", elementType: "all", stylers: [{ saturation: -100 }, { lightness: "30" }, { visibility: "off" }] },
  { featureType: "road", elementType: "all", stylers: [{ lightness: "-19" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ lightness: "2" }, { gamma: "1.21" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ visibility: "off" }, { saturation: "15" }, { hue: "#ff0000" }] },
  { featureType: "road", elementType: "labels", stylers: [{ lightness: "-43" }] },
  { featureType: "road", elementType: "labels.text", stylers: [{ visibility: "on" }, { lightness: "22" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ weight: "0.12" }, { lightness: "-23" }, { visibility: "on" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ visibility: "off" }, { lightness: "71" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { featureType: "road.highway", elementType: "all", stylers: [{ saturation: -100 }, { visibility: "simplified" }] },
  { featureType: "road.arterial", elementType: "all", stylers: [{ saturation: -100 }, { lightness: 30 }, { visibility: "on" }] },
  { featureType: "road.local", elementType: "all", stylers: [{ saturation: -100 }, { lightness: 40 }, { visibility: "on" }] },
  { featureType: "transit", elementType: "all", stylers: [{ saturation: -100 }, { visibility: "simplified" }] },
  { featureType: "transit", elementType: "geometry.fill", stylers: [{ saturation: "5" }, { visibility: "on" }, { lightness: "5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ hue: "#ffff00" }, { lightness: "-24" }, { saturation: -97 }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ saturation: "-88" }, { lightness: "-23" }, { visibility: "on" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "on" }, { lightness: -25 }, { saturation: -100 }] },
  { featureType: "water", elementType: "labels.text", stylers: [{ weight: "0.01" }, { lightness: "9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ lightness: "-32" }, { gamma: "2.99" }] },
];

/** Google tile-ийн дотоод кодууд (featureType → s.t, elementType → s.e). */
const FEATURE: Record<string, number> = {
  administrative: 1, poi: 2, road: 3, transit: 4, landscape: 5, water: 6,
  "administrative.country": 17, "administrative.province": 18, "administrative.locality": 19,
  "administrative.neighborhood": 20, "administrative.land_parcel": 21,
  "road.highway": 49, "road.arterial": 50, "road.local": 51,
};
const ELEMENT: Record<string, string> = {
  all: "a", geometry: "g", "geometry.fill": "g.f", "geometry.stroke": "g.s",
  labels: "l", "labels.text": "l.t", "labels.text.fill": "l.t.f", "labels.text.stroke": "l.t.s", "labels.icon": "l.i",
};

/** Style JSON → `apistyle` утга (URL-encode хийгдсэн). */
export function googleApiStyle(rules: MapStyleRule[]): string {
  const out = rules.map((r) => {
    const parts: string[] = [];
    if (r.featureType !== "all" && FEATURE[r.featureType] !== undefined) parts.push(`s.t:${FEATURE[r.featureType]}`);
    parts.push(`s.e:${ELEMENT[r.elementType] ?? "a"}`);
    for (const s of r.stylers) {
      const [k, v] = Object.entries(s)[0] ?? [];
      if (k === "color") parts.push(`p.c:#ff${String(v).replace("#", "")}`);
      else if (k === "lightness") parts.push(`p.l:${v}`);
      else if (k === "saturation") parts.push(`p.s:${v}`);
      else if (k === "visibility") parts.push(`p.v:${v}`);
      else if (k === "weight") parts.push(`p.w:${v}`);
      else if (k === "gamma") parts.push(`p.g:${v}`);
      else if (k === "hue") parts.push(`p.h:#ff${String(v).replace("#", "")}`);
    }
    return parts.join("|");
  });
  return encodeURIComponent(out.join(","));
}

/** Загвартай Google tile — 4 дэд домэйн, @2x (scale=2), монгол шошго. */
const styledTiles = (rules: MapStyleRule[]) =>
  [0, 1, 2, 3].map(
    (n) => `https://mt${n}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2&hl=mn&apistyle=${googleApiStyle(rules)}`,
  );

export const SHADES_OF_GREY_TILES = styledTiles(SHADES_OF_GREY);
export const MASIK_WWW_TILES = styledTiles(MASIK_WWW);
