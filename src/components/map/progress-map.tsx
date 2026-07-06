"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageWMS from "ol/source/ImageWMS";
import ImageStatic from "ol/source/ImageStatic";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
import { extend as extendExtent, type Extent } from "ol/extent";
import WKT from "ol/format/WKT";
import { Fill, Stroke, Style } from "ol/style";
import type RenderEvent from "ol/render/Event";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { Columns2, X } from "lucide-react";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";
import { landApi, droneImageApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { BoundaryHistory, DroneImage } from "@/types";
import LayerPanel, { type LayerConfig, type LayerGroupConfig } from "./layer-panel";

const PLAN_LAYER_ID = "plan";
const HISTORY_GROUP: LayerGroupConfig = { id: "boundary_history", label: "Хилийн өөрчлөлт", color: "#02c0ce" };
const DRONE_GROUP: LayerGroupConfig = { id: "drone_images", label: "Дрон зураг", color: "#f59e0b" };

interface Props {
  acquisitionId: string;
}

export function ProgressMap({ acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const planLayer = useRef<ImageLayer<ImageWMS> | null>(null);
  const historyLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const droneLayers = useRef<Record<string, ImageLayer<ImageStatic>>>({});
  const droneExtents = useRef<Record<string, number[]>>({});
  const wktFormat = useRef(new WKT());

  const [compareMode, setCompareMode] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const splitPercentRef = useRef(50);
  splitPercentRef.current = splitPercent;

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  const { data: boundaryHistory = [] } = useQuery({
    queryKey: ["land-boundary-history", acquisitionId],
    queryFn: () => landApi.getBoundaryHistory(acquisitionId),
    enabled: !!acquisitionId,
  });

  const { data: droneImages = [] } = useQuery({
    queryKey: ["drone-images"],
    queryFn: () => droneImageApi.list(),
  });

  const sortedHistory = useMemo(() => {
    return [...boundaryHistory].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
  }, [boundaryHistory]);

  // Only "acquisition"-type drone images tied to this specific acquisition.
  const relevantDroneImages = useMemo(() => {
    return droneImages
      .filter(
        (img): img is DroneImage & { geometry_wkt: string } =>
          !!img.geometry_wkt && img.type === "acquisition" && img.acquisition_id === acquisitionId,
      )
      .sort(
        (a, b) => new Date(a.captured_at ?? 0).getTime() - new Date(b.captured_at ?? 0).getTime(),
      );
  }, [droneImages, acquisitionId]);

  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: PLAN_LAYER_ID, label: "Төлөвлөгөөний хил", color: "#a855f7", visible: true },
  ]);

  useEffect(() => {
    setLayers([
      { id: PLAN_LAYER_ID, label: "Төлөвлөгөөний хил", color: "#a855f7", visible: true },
      ...sortedHistory.map((h, i) => ({
        id: h.id,
        label: `${i + 1}. ${formatDate(h.changed_at)}`,
        color: HISTORY_GROUP.color,
        visible: false,
        group: HISTORY_GROUP.id,
      })),
      ...relevantDroneImages.map((img, i) => ({
        id: String(img.id),
        label: `${i + 1}. ${formatDate(img.captured_at)}`,
        color: DRONE_GROUP.color,
        visible: false,
        group: DRONE_GROUP.id,
      })),
    ]);
  }, [sortedHistory, relevantDroneImages]);

  const makeHistoryLayer = useCallback((history: BoundaryHistory) => {
    const features = [];
    if (history.old_geometry_wkt) {
      const oldFeature = wktFormat.current.readFeature(history.old_geometry_wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      oldFeature.set("boundary_kind", "old");
      features.push(oldFeature);
    }
    if (history.new_geometry_wkt) {
      const newFeature = wktFormat.current.readFeature(history.new_geometry_wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      newFeature.set("boundary_kind", "new");
      features.push(newFeature);
    }

    return new VectorLayer({
      source: new VectorSource({ features }),
      visible: false,
      zIndex: 100,
      style: (feature) => {
        const isOld = feature.get("boundary_kind") === "old";
        return new Style({
          stroke: new Stroke({
            color: isOld ? "#ef4444" : "#02c0ce",
            width: isOld ? 2 : 3,
            lineDash: isOld ? [8, 6] : undefined,
          }),
          fill: new Fill({
            color: isOld ? "rgba(239, 68, 68, 0.08)" : "rgba(2, 192, 206, 0.10)",
          }),
        });
      },
    });
  }, []);

  const makeDroneLayer = useCallback((img: DroneImage & { geometry_wkt: string }) => {
    const geom = wktFormat.current.readGeometry(img.geometry_wkt, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    const extent = geom.getExtent();
    droneExtents.current[String(img.id)] = extent;
    return new ImageLayer({
      visible: false,
      zIndex: 90,
      source: img.image_url
        ? new ImageStatic({
            url: img.image_url,
            imageExtent: extent,
            projection: "EPSG:3857",
            crossOrigin: "anonymous",
          })
        : undefined,
    });
  }, []);

  const handleToggle = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, visible: !l.visible };

        if (id === PLAN_LAYER_ID) {
          planLayer.current?.setVisible(next.visible);
        } else if (historyLayers.current[id]) {
          const layer = historyLayers.current[id];
          layer.setVisible(next.visible);
          const extent = layer.getSource()?.getExtent();
          if (next.visible && extent && olMap.current) {
            olMap.current.getView().fit(extent, {
              padding: [48, 48, 48, 48],
              maxZoom: 17,
              duration: 500,
            });
          }
        } else if (droneLayers.current[id]) {
          droneLayers.current[id].setVisible(next.visible);
          const extent = droneExtents.current[id];
          if (next.visible && extent && olMap.current) {
            olMap.current.getView().fit(extent, {
              padding: [48, 48, 48, 48],
              maxZoom: 17,
              duration: 500,
            });
          }
        }
        return next;
      }),
    );
  }, []);

  // Base map — created once and kept mounted regardless of whether an acquisition is selected.
  useEffect(() => {
    if (!mapRef.current || olMap.current) return;

    const map = new OLMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            urls: [
              "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
              "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            ],
            maxZoom: 20,
            crossOrigin: "anonymous",
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 20,
      }),
    });

    olMap.current = map;

    return () => {
      map.setTarget(undefined);
      olMap.current = null;
    };
  }, []);

  // Plan layer + boundary/drone overlays are rebuilt whenever the selected acquisition changes,
  // since the same map instance can now be reused across different selections (e.g. on the drone page).
  useEffect(() => {
    const map = olMap.current;
    if (!map) return;

    if (planLayer.current) map.removeLayer(planLayer.current);
    Object.values(historyLayers.current).forEach((l) => map.removeLayer(l));
    Object.values(droneLayers.current).forEach((l) => map.removeLayer(l));
    historyLayers.current = {};
    droneLayers.current = {};
    droneExtents.current = {};

    const plan = new ImageLayer({
      opacity: 0.85,
      source: new ImageWMS({
        url: GS_WMS,
        params: {
          LAYERS: "land:v_acquisition_plan",
          FORMAT: "image/png",
          TRANSPARENT: true,
          CQL_FILTER: acqFilter,
        },
        ratio: 1,
        serverType: "geoserver",
        imageLoadFunction: wmsPostLoad,
      }),
    });
    planLayer.current = plan;
    map.addLayer(plan);

    if (!acquisitionId) return;

    const params = new URLSearchParams({
      service: "WFS",
      version: "1.1.0",
      request: "GetFeature",
      typeName: "land:v_acquisition_plan",
      CQL_FILTER: acqFilter,
      outputFormat: "application/json",
      propertyName: "geometry",
      maxFeatures: "1",
    });
    fetch(GS_WFS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
      .then((r) => r.json())
      .then((json) => {
        const bbox: number[] | undefined =
          json?.features?.[0]?.geometry?.bbox ?? json?.bbox;
        if (bbox?.length === 4) {
          const ext = transformExtent(bbox, "EPSG:4326", "EPSG:3857");
          map.getView().fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 1000 });
        }
      })
      .catch(() => {
        /* keep default view */
      });
  }, [acqFilter, acquisitionId]);

  // History layers are added lazily once boundary history has loaded.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !sortedHistory.length) return;
    sortedHistory.forEach((h) => {
      if (historyLayers.current[h.id]) return;
      const layer = makeHistoryLayer(h);
      historyLayers.current[h.id] = layer;
      map.addLayer(layer);
    });
  }, [sortedHistory, makeHistoryLayer]);

  // Drone image layers are added lazily once the relevant (overlapping) list is known.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !relevantDroneImages.length) return;
    relevantDroneImages.forEach((img) => {
      const id = String(img.id);
      if (droneLayers.current[id]) return;
      const layer = makeDroneLayer(img);
      droneLayers.current[id] = layer;
      map.addLayer(layer);
    });
  }, [relevantDroneImages, makeDroneLayer]);

  const canCompare = relevantDroneImages.length >= 2;
  const firstDroneImage = relevantDroneImages[0];
  const lastDroneImage = relevantDroneImages[relevantDroneImages.length - 1];

  // Split-swipe compare: clips the "after" (latest) image so it only covers the left
  // portion of the map, revealing the "before" (earliest) image underneath on the right.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !compareMode || !canCompare || !firstDroneImage || !lastDroneImage) return;

    const beforeId = String(firstDroneImage.id);
    const afterId = String(lastDroneImage.id);
    const beforeLayer = droneLayers.current[beforeId];
    const afterLayer = droneLayers.current[afterId];
    if (!beforeLayer || !afterLayer) return;

    const prevVisibility = {
      plan: planLayer.current?.getVisible() ?? true,
      history: Object.fromEntries(
        Object.entries(historyLayers.current).map(([id, l]) => [id, l.getVisible()]),
      ) as Record<string, boolean>,
      drone: Object.fromEntries(
        Object.entries(droneLayers.current).map(([id, l]) => [id, l.getVisible()]),
      ) as Record<string, boolean>,
    };

    planLayer.current?.setVisible(false);
    Object.values(historyLayers.current).forEach((l) => l.setVisible(false));
    Object.entries(droneLayers.current).forEach(([id, l]) =>
      l.setVisible(id === beforeId || id === afterId),
    );
    beforeLayer.setZIndex(90);
    afterLayer.setZIndex(91);

    const clip = (event: RenderEvent) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const size = map.getSize();
      if (!ctx || !size) return;
      const width = size[0] * (splitPercentRef.current / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, size[1]);
      ctx.clip();
    };
    const unclip = (event: RenderEvent) => {
      (event.context as CanvasRenderingContext2D).restore();
    };
    afterLayer.on("prerender", clip);
    afterLayer.on("postrender", unclip);

    const beforeExtent = droneExtents.current[beforeId];
    const afterExtent = droneExtents.current[afterId];
    if (beforeExtent && afterExtent) {
      const combined = extendExtent(beforeExtent.slice() as Extent, afterExtent);
      map.getView().fit(combined, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 500 });
    }
    map.render();

    return () => {
      afterLayer.un("prerender", clip);
      afterLayer.un("postrender", unclip);
      planLayer.current?.setVisible(prevVisibility.plan);
      Object.entries(historyLayers.current).forEach(([id, l]) =>
        l.setVisible(prevVisibility.history[id] ?? false),
      );
      Object.entries(droneLayers.current).forEach(([id, l]) =>
        l.setVisible(prevVisibility.drone[id] ?? false),
      );
      map.render();
    };
  }, [compareMode, canCompare, firstDroneImage, lastDroneImage]);

  useEffect(() => {
    olMap.current?.render();
  }, [splitPercent]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
      style={{ height: 360 }}
    >
      <div ref={mapRef} className="h-full w-full" />

      {compareMode && canCompare && firstDroneImage && lastDroneImage ? (
        <>
          <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur px-3 py-2 text-[11.5px] font-medium text-white">
            <span>{formatDate(firstDroneImage.captured_at)}</span>
            <button
              onClick={() => setCompareMode(false)}
              className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 hover:bg-white/25 transition-colors"
            >
              <X className="h-3 w-3" /> Гарах
            </button>
            <span>{formatDate(lastDroneImage.captured_at)}</span>
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)] pointer-events-none z-10"
            style={{ left: `${splitPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={splitPercent}
            onChange={(e) => setSplitPercent(Number(e.target.value))}
            className="absolute left-0 w-full z-20 cursor-ew-resize"
            style={{ top: "50%", accentColor: "#02c0ce" }}
          />
        </>
      ) : (
        <>
          {canCompare && (
            <button
              onClick={() => setCompareMode(true)}
              title="Эхний болон сүүлийн зургийг харьцуулах"
              className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:bg-black/75 transition-colors"
            >
              <Columns2 className="h-3.5 w-3.5" /> Харьцуулах
            </button>
          )}
          <LayerPanel layers={layers} groups={[HISTORY_GROUP, DRONE_GROUP]} onToggle={handleToggle} />
        </>
      )}
    </div>
  );
}
