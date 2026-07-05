"use client";
import { useEffect, useRef, useState, useCallback } from "react";
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
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";
import { landApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { BoundaryHistory } from "@/types";
import LayerPanel, { type LayerConfig } from "./layer-panel";

const PLAN_LAYER_ID = "plan";

interface Props {
  acquisitionId: string;
}

export function ProgressMap({ acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const planLayer = useRef<ImageLayer<ImageWMS> | null>(null);
  const historyLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const wktFormat = useRef(new WKT());

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  const { data: boundaryHistory = [] } = useQuery({
    queryKey: ["land-boundary-history", acquisitionId],
    queryFn: () => landApi.getBoundaryHistory(acquisitionId),
    enabled: !!acquisitionId,
  });

  const sortedHistory = [...boundaryHistory].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: PLAN_LAYER_ID, label: "Төлөвлөгөөний хил", color: "#a855f7", visible: true },
  ]);

  useEffect(() => {
    setLayers([
      { id: PLAN_LAYER_ID, label: "Төлөвлөгөөний хил", color: "#a855f7", visible: true },
      ...sortedHistory.map((h, i) => ({
        id: h.id,
        label: `${i + 1}. ${formatDate(h.changed_at)}`,
        color: "#02c0ce",
        visible: false,
      })),
    ]);
  }, [sortedHistory]);

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

  const handleToggle = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, visible: !l.visible };

        if (id === PLAN_LAYER_ID) {
          planLayer.current?.setVisible(next.visible);
        } else {
          const layer = historyLayers.current[id];
          layer?.setVisible(next.visible);
          if (next.visible && layer && olMap.current) {
            const extent = layer.getSource()?.getExtent();
            if (extent) {
              olMap.current.getView().fit(extent, {
                padding: [48, 48, 48, 48],
                maxZoom: 17,
                duration: 500,
              });
            }
          }
        }
        return next;
      }),
    );
  }, []);

  useEffect(() => {
    if (!mapRef.current || olMap.current || !acquisitionId) return;

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
        plan,
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 20,
      }),
    });

    olMap.current = map;

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

    return () => {
      map.setTarget(undefined);
      olMap.current = null;
      historyLayers.current = {};
    };
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

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
      style={{ height: 360 }}
    >
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel layers={layers} onToggle={handleToggle} />
    </div>
  );
}
