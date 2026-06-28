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
  } catch {
    return null;
  }
}

export function calcAreaFromWkt(wkt: string): number | null {
  try {
    const cleaned = wkt.replace(/^SRID=\d+;/i, "");
    const match = cleaned.match(/POLYGON\s*\(\((.+?)\)\)/i);
    if (!match) return null;

    const coords = match[1].split(",").map((p) => {
      const [x, y] = p.trim().split(/\s+/).map(Number);
      return [x, y] as [number, number];
    });
    if (coords.length < 3 || coords.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
      return null;
    }

    const isGeographic = coords.every(([x, y]) => x >= -180 && x <= 180 && y >= -90 && y <= 90);

    if (isGeographic) {
      const R = 6378137;
      const toRad = (d: number) => (d * Math.PI) / 180;
      let area = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[(i + 1) % coords.length];
        area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
      }
      return Math.abs((area * R * R) / 2);
    }

    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[(i + 1) % coords.length];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  } catch {
    return null;
  }
}
