"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
import WKT from "ol/format/WKT";
import { Fill, Stroke, Style } from "ol/style";
import { SlidersHorizontal } from "lucide-react";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";
import { landApi, droneAcquisitionApi } from "@/lib/api";
import { formatDate, resolveImageUrl } from "@/lib/utils";
import type { BoundaryHistory, DroneAcquisition } from "@/types";
import LayerPanel, { type LayerConfig, type LayerGroupConfig } from "@/components/map/layer-panel";

const PLAN_LAYER_ID = "plan";
const HISTORY_GROUP: LayerGroupConfig = { id: "boundary_history", label: "Хилийн өөрчлөлт", color: "#02c0ce" };
const DRONE_TILE_GROUP: LayerGroupConfig = { id: "drone_tiles", label: "Дрон tile давхарга", color: "#d946ef" };

interface Props {
  acquisitionId: string;
  fullscreen?: boolean;
}

// Dedicated map for the drone_acquisitions (tile pyramid) feature — pulls only from the
// drone_acquisitions table, unlike the shared ProgressMap which also overlays drone_images.
export function DroneAcquisitionMap({ acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const planLayer = useRef<ImageLayer<ImageWMS> | null>(null);
  const historyLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const droneTileLayers = useRef<Record<string, TileLayer<XYZ>>>({});
  const droneTileExtents = useRef<Record<string, number[]>>({});
  const wktFormat = useRef(new WKT());

  const [tileOpacity, setTileOpacity] = useState(1);

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  const { data: boundaryHistory = [] } = useQuery({
    queryKey: ["land-boundary-history", acquisitionId],
    queryFn: () => landApi.getBoundaryHistory(acquisitionId),
    enabled: !!acquisitionId,
  });

  const { data: droneAcquisitions = [] } = useQuery({
    queryKey: ["drone-acquisitions"],
    queryFn: () => droneAcquisitionApi.list(),
  });

  const sortedHistory = useMemo(() => {
    return [...boundaryHistory].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
  }, [boundaryHistory]);

  // Only ready tile pyramids ("acquisition"-type) tied to this specific acquisition.
  const relevantDroneTiles = useMemo(() => {
    return droneAcquisitions
      .filter(
        (acq): acq is DroneAcquisition & { bbox_wkt: string } =>
          !!acq.bbox_wkt &&
          acq.type === "acquisition" &&
          acq.acquisition_id === acquisitionId &&
          acq.status === "ready",
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [droneAcquisitions, acquisitionId]);

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
      ...relevantDroneTiles.map((acq, i) => ({
        id: `tile-${acq.id}`,
        label: `${i + 1}. ${formatDate(acq.created_at)}`,
        color: DRONE_TILE_GROUP.color,
        visible: false,
        group: DRONE_TILE_GROUP.id,
      })),
    ]);
  }, [sortedHistory, relevantDroneTiles]);

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

  const makeDroneTileLayer = useCallback(
    (acq: DroneAcquisition & { bbox_wkt: string }) => {
      const geom = wktFormat.current.readGeometry(acq.bbox_wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      const extent = geom.getExtent();
      droneTileExtents.current[`tile-${acq.id}`] = extent;
      const root = resolveImageUrl(acq.tile_root_path)?.replace(/\/$/, "");
      return new TileLayer({
        visible: false,
        zIndex: 91,
        extent,
        opacity: tileOpacity,
        source: root
          ? new XYZ({
              url: `${root}/{z}/{x}/{y}.png`,
              minZoom: acq.min_zoom,
              maxZoom: acq.max_zoom,
              crossOrigin: "anonymous",
            })
          : undefined,
      });
    },
    [tileOpacity],
  );

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
        } else if (droneTileLayers.current[id]) {
          droneTileLayers.current[id].setVisible(next.visible);
          const extent = droneTileExtents.current[id];
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

  // Base map — created once and kept mounted for the lifetime of this component.
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
        center: fromLonLat([106.917, 47.918]),
        zoom: 11,
        minZoom: 4,
        maxZoom: 20,
      }),
    });

    olMap.current = map;

    const resizeObserver = new ResizeObserver(() => map.updateSize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      olMap.current = null;
    };
  }, []);

  // Plan layer + boundary/tile overlays are rebuilt whenever the selected acquisition changes.
  useEffect(() => {
    const map = olMap.current;
    if (!map) return;

    if (planLayer.current) map.removeLayer(planLayer.current);
    Object.values(historyLayers.current).forEach((l) => map.removeLayer(l));
    Object.values(droneTileLayers.current).forEach((l) => map.removeLayer(l));
    historyLayers.current = {};
    droneTileLayers.current = {};
    droneTileExtents.current = {};

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

  // Tile pyramid layers are added lazily once the relevant (ready, overlapping) list is known.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !relevantDroneTiles.length) return;
    relevantDroneTiles.forEach((acq) => {
      const id = `tile-${acq.id}`;
      if (droneTileLayers.current[id]) return;
      const layer = makeDroneTileLayer(acq);
      droneTileLayers.current[id] = layer;
      map.addLayer(layer);
    });
  }, [relevantDroneTiles, makeDroneTileLayer]);

  // Opacity applies live to whichever tile layers already exist, without rebuilding them.
  useEffect(() => {
    Object.values(droneTileLayers.current).forEach((l) => l.setOpacity(tileOpacity));
  }, [tileOpacity]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]">
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel
        layers={layers}
        groups={[HISTORY_GROUP, DRONE_TILE_GROUP]}
        onToggle={handleToggle}
      />
      {relevantDroneTiles.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-white/90 dark:bg-[#1e1f27]/95 backdrop-blur px-3 py-2 border border-slate-200 dark:border-[#37394d] shadow-lg">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tileOpacity}
            onChange={(e) => setTileOpacity(Number(e.target.value))}
            className="w-24"
            style={{ accentColor: "#d946ef" }}
          />
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-8 text-right">
            {Math.round(tileOpacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
