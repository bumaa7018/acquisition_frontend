import type OLMap from "ol/Map";
import { transformExtent } from "ol/proj";

export type MapLayerId =
  | "au1"
  | "au2"
  | "au3"
  | "v_acquisition_plan"
  | "v_acquisition_boundary"
  | "parcel"
  | "building"
  | "v_parcel_acquisition";

export type MapLayerDef = {
  id: MapLayerId;
  label: string;
  color: string;
  zIndex: number;
};

export const MAP_LAYER_STYLES: Record<MapLayerId, Omit<MapLayerDef, "id">> = {
  au1: { label: "Аймаг/Нийслэл", color: "#6366f1", zIndex: 1 },
  au2: { label: "Сум/Дүүрэг", color: "#8b5cf6", zIndex: 2 },
  au3: { label: "Баг/Хороо", color: "#a78bfa", zIndex: 3 },
  v_acquisition_plan: {
    label: "Төлөвлөгөөний хил",
    color: "#ef4444",
    zIndex: 10,
  },
  v_acquisition_boundary: {
    label: "Чөлөөлөх бүсийн хил",
    color: "#f59e0b",
    zIndex: 20,
  },
  parcel: { label: "Нэгж талбарын хил", color: "#22c55e", zIndex: 30 },
  building: { label: "Барилгын хил", color: "#06b6d4", zIndex: 40 },
  v_parcel_acquisition: { label: "Давхцал", color: "#f97316", zIndex: 35 },
};

export function layerDef(id: MapLayerId): MapLayerDef {
  return { id, ...MAP_LAYER_STYLES[id] };
}

type FitLayerOptions = {
  map: OLMap;
  wfsUrl: string;
  layerId: MapLayerId;
  cqlFilter?: string;
  padding?: [number, number, number, number];
  maxZoom?: number;
};

export async function fitLayerToMap({
  map,
  wfsUrl,
  layerId,
  cqlFilter,
  padding = [64, 64, 64, 64],
  maxZoom = 17,
}: FitLayerOptions) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: `land:${layerId}`,
    outputFormat: "application/json",
    propertyName: "geometry",
    maxFeatures: "500",
  });
  if (cqlFilter) params.set("CQL_FILTER", cqlFilter);

  try {
    const res = await fetch(`${wfsUrl}?${params}`);
    const json = await res.json();
    const bbox: number[] | undefined =
      json?.bbox ?? json?.features?.[0]?.geometry?.bbox;
    if (
      bbox?.length !== 4 ||
      bbox.some((v) => typeof v !== "number" || Number.isNaN(v))
    )
      return;

    const extent = transformExtent(bbox, "EPSG:4326", "EPSG:3857");
    map.getView().fit(extent, { padding, maxZoom, duration: 1000 });
  } catch {
    // Keep the current view when a layer has no feature or WFS is unavailable.
  }
}
