import { NextRequest, NextResponse } from "next/server";
import { tokenFromRequest } from "@/lib/server/session-guard";

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
const GS_URL = process.env.NEXT_GS_URL ?? "http://localhost:8600";
const TILE_MATRIX_SET = "EPSG:900913";
const MAX_ZOOM = 30;

type DroneImage = {
  id: string;
  layer_name?: string;
  published?: boolean;
};

type ApiResponse<T> = {
  data?: T;
};

type LayerCacheEntry = { layerName: string; exp: number };
const LAYER_CACHE_TTL_MS = 30_000;
const LAYER_CACHE_MAX = 2000;
const layerCache = new Map<string, LayerCacheEntry>();

function validId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function parseTileCoord(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function validateTile(zRaw: string, xRaw: string, yRaw: string) {
  const z = parseTileCoord(zRaw);
  const x = parseTileCoord(xRaw);
  const y = parseTileCoord(yRaw.replace(/\.png$/i, ""));
  if (z == null || x == null || y == null) return null;
  if (z < 0 || z > MAX_ZOOM) return null;
  const max = 2 ** z;
  if (x < 0 || y < 0 || x >= max || y >= max) return null;
  return { z, x, y };
}

function cacheKey(token: string, acquisitionId: string, imageId: string): string {
  return `${token}:${acquisitionId}:${imageId}`;
}

function pruneCache(now: number) {
  if (layerCache.size <= LAYER_CACHE_MAX) return;
  layerCache.forEach((entry, key) => {
    if (entry.exp <= now) layerCache.delete(key);
  });
  while (layerCache.size > LAYER_CACHE_MAX) {
    const oldest = layerCache.keys().next().value;
    if (!oldest) break;
    layerCache.delete(oldest);
  }
}

async function findAuthorizedLayerName(
  token: string,
  acquisitionId: string,
  imageId: string,
): Promise<{ status: number; layerName?: string }> {
  const now = Date.now();
  const key = cacheKey(token, acquisitionId, imageId);
  const hit = layerCache.get(key);
  if (hit && hit.exp > now) return { status: 200, layerName: hit.layerName };

  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/v1/land-acquisitions/${acquisitionId}/drone-images`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      // Node-ийн fetch анхдагчаар хугацаагаар таслахгүй. Энэ лавлагаа нь
      // tile хүсэлт БҮРИЙГ хаалгалдаг тул backend гацвал зэрэг явж буй
      // хэдэн арван tile browser-ийн бүх холболтыг эзэлж, апп гацна.
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { status: 502 };
  }

  if (res.status === 401) return { status: 401 };
  if (res.status === 403) return { status: 403 };
  if (!res.ok) return { status: 502 };

  const json = (await res.json().catch(() => null)) as ApiResponse<DroneImage[]> | null;
  const image = (json?.data ?? []).find((item) => item.id === imageId);
  if (!image?.published || !image.layer_name) return { status: 404 };

  layerCache.set(key, { layerName: image.layer_name, exp: now + LAYER_CACHE_TTL_MS });
  pruneCache(now);
  return { status: 200, layerName: image.layer_name };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ acquisitionId: string; imageId: string; z: string; x: string; y: string }> },
) {
  const { acquisitionId, imageId, z: zRaw, x: xRaw, y: yRaw } = await params;
  if (!validId(acquisitionId) || !validId(imageId)) {
    return NextResponse.json({ error: "Хүчингүй хүсэлт" }, { status: 400 });
  }

  const tile = validateTile(zRaw, xRaw, yRaw);
  if (!tile) {
    return NextResponse.json({ error: "Хүчингүй tile" }, { status: 400 });
  }

  const token = tokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const authorized = await findAuthorizedLayerName(token, acquisitionId, imageId);
  if (authorized.status !== 200 || !authorized.layerName) {
    return NextResponse.json(
      {
        error:
          authorized.status === 404
            ? "Дроны зураг олдсонгүй"
            : authorized.status === 502
              ? "Зургийн серверт холбогдсонгүй"
              : "Хандах эрхгүй",
      },
      { status: authorized.status },
    );
  }

  const q = new URLSearchParams({
    Service: "WMTS",
    Version: "1.0.0",
    Request: "GetTile",
    Layer: authorized.layerName,
    Style: "",
    Format: "image/png",
    TileMatrixSet: TILE_MATRIX_SET,
    TileMatrix: `${TILE_MATRIX_SET}:${tile.z}`,
    TileRow: String(tile.y),
    TileCol: String(tile.x),
  });

  let gs: Response;
  try {
    gs = await fetch(`${GS_URL}/geoserver/gwc/service/wmts?${q.toString()}`, {
      headers: { accept: req.headers.get("accept") ?? "image/*" },
    });
  } catch {
    return NextResponse.json({ error: "Зургийн серверт холбогдсонгүй" }, { status: 502 });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "etag", "last-modified"]) {
    const v = gs.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(gs.body, { status: gs.status, headers });
}
