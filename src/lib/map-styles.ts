/**
 * Газрын зургийн загвар — Snazzy Maps «Shades of Grey» (https://snazzymaps.com/style/38).
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

/** Google tile-ийн дотоод кодууд (featureType → s.t, elementType → s.e). */
const FEATURE: Record<string, number> = {
  administrative: 1, poi: 2, road: 3, transit: 4, landscape: 5, water: 6,
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
    }
    return parts.join("|");
  });
  return encodeURIComponent(out.join(","));
}

/** «Shades of Grey» tile — 4 дэд домэйн, @2x (scale=2), монгол шошго. */
export const SHADES_OF_GREY_TILES = [0, 1, 2, 3].map(
  (n) => `https://mt${n}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2&hl=mn&apistyle=${googleApiStyle(SHADES_OF_GREY)}`,
);
