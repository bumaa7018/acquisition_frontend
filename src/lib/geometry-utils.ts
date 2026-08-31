import { logger } from "./logger.ts";

type Position = [number, number] | number[];

function closeRing(points: Position[]): Position[] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

function ringToWkt(points: Position[]) {
  return closeRing(points)
    .map((point) => `${Number(point[0])} ${Number(point[1])}`)
    .join(",");
}

export function geoJsonToWkt(input: unknown): string | null {
  const root = input as any;
  const geometry =
    root?.type === "FeatureCollection"
      ? root.features?.[0]?.geometry
      : root?.type === "Feature"
        ? root.geometry
        : root;

  if (geometry?.type === "Polygon" && Array.isArray(geometry.coordinates?.[0])) {
    return `POLYGON((${ringToWkt(geometry.coordinates[0])}))`;
  }

  if (
    geometry?.type === "MultiPolygon" &&
    Array.isArray(geometry.coordinates?.[0]?.[0])
  ) {
    return `POLYGON((${ringToWkt(geometry.coordinates[0][0])}))`;
  }

  return null;
}

export function layerTextToWkt(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (/^(SRID=\d+;)?POLYGON\s*\(\(/i.test(trimmed)) {
    return trimmed.replace(/^SRID=\d+;/i, "");
  }

  try {
    return geoJsonToWkt(JSON.parse(trimmed));
  } catch (err) {
    logger.warn("layer text to wkt parse failed", { error: String(err) });
    return null;
  }
}

/* ТАЛБАЙГ ЭНД ТООЦООЛОХГҮЙ.
 *
 * Өмнө нь энд `calcAreaFromWkt` байсан — дэлхийг төгс бөмбөрцөг (R = 6378137)
 * гэж үзсэн ойролцоолол. ГУС нь талбайг UTM проекц дээр (base.calculate_area_utm)
 * боддог, бид нь эллипсоид дээр гэсэн үг — иймд нэг л полигон дээр гурван өөр
 * тоо гардаг байв (өргөрөг/уртрагаас хамаарч 0.03-0.12% зөрүү).
 *
 * Одоо талбайг ЗӨВХӨН backend бодно: `landApi.computeGeometryArea(wkt)` →
 * `POST /geometry/area` → `public.calculate_area_utm` (ГУС-ийн функцийн
 * хуулбар). Ингэснээр "Хилээс тооцоолох" товч болон нэгж талбар татах хоёр
 * ижил тоо өгнө.
 */
