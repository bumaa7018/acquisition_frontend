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
import type { AU, BoundaryHistory } from "@/types";
import { landApi } from "@/lib/api";
import LayerPanel, { type LayerConfig } from "./layer-panel";
import { fitLayerToMap, layerDef, type MapLayerDef } from "./layers";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";

const LAYER_DEFS: (MapLayerDef & {
  defaultVisible: boolean;
  filtered?: boolean;
})[] = [
  { ...layerDef("au1"), defaultVisible: false },
  { ...layerDef("au2"), defaultVisible: false },
  { ...layerDef("au3"), defaultVisible: true },
  { ...layerDef("v_acquisition_plan"), defaultVisible: true },
  { ...layerDef("v_acquisition_boundary"), defaultVisible: true, filtered: true },
  { ...layerDef("parcel"), defaultVisible: false },
  { ...layerDef("building"), defaultVisible: true, filtered: true },
];

interface Props {
  acquisitionId: string;
  aus?: AU[];
}

export function AcquisitionMap({ acquisitionId, aus = [] }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const olMap       = useRef<OLMap | null>(null);
  const wmsLayers   = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const historyLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const wktFormat   = useRef(new WKT());

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      visible: d.defaultVisible,
    })),
  );
  const [visibleHistoryIds, setVisibleHistoryIds] = useState<Set<string>>(() => new Set());

  const { data: boundaryHistory = [] } = useQuery({
    queryKey: ["land-boundary-history", acquisitionId],
    queryFn: () => landApi.getBoundaryHistory(acquisitionId),
    enabled: !!acquisitionId,
  });

  const acqFilter = `acquisition_id='${acquisitionId}'`;

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

  const toggleHistory = useCallback(
    (history: BoundaryHistory) => {
      const map = olMap.current;
      if (!map) return;

      if (historyLayers.current[history.id]) {
        map.removeLayer(historyLayers.current[history.id]);
        delete historyLayers.current[history.id];
        setVisibleHistoryIds((prev) => {
          const next = new Set(prev);
          next.delete(history.id);
          return next;
        });
        return;
      }

      const layer = makeHistoryLayer(history);
      historyLayers.current[history.id] = layer;
      map.addLayer(layer);
      setVisibleHistoryIds((prev) => new Set(prev).add(history.id));

      const extent = layer.getSource()?.getExtent();
      if (extent) {
        map.getView().fit(extent, { padding: [56, 56, 56, 56], maxZoom: 17, duration: 500 });
      }
    },
    [makeHistoryLayer],
  );

  const handleToggle = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, visible: !l.visible };
          wmsLayers.current[id]?.setVisible(next.visible);
          const def = LAYER_DEFS.find((d) => d.id === id);
          if (next.visible && def && olMap.current) {
            void fitLayerToMap({
              map: olMap.current,
              wfsUrl: GS_WFS,
              layerId: def.id,
              cqlFilter: def.filtered ? acqFilter : undefined,
              padding: [56, 56, 56, 56],
              maxZoom: 17,
            });
          }
          return next;
        }),
      );
    },
    [acqFilter],
  );

  useEffect(() => {
    if (!mapRef.current || olMap.current || !acquisitionId) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};
    LAYER_DEFS.forEach((d) => {
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: 0.8,
        zIndex: d.zIndex,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${d.id}`,
            FORMAT: "image/png",
            TRANSPARENT: true,
            ...(d.filtered ? { CQL_FILTER: acqFilter } : {}),
          },
          ratio: 1,
          serverType: "geoserver",
          imageLoadFunction: wmsPostLoad,
        }),
      });
    });
    wmsLayers.current = wmsRecord;

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
        ...LAYER_DEFS.map((d) => wmsRecord[d.id]),
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
      typeName: "land:v_acquisition_boundary",
      CQL_FILTER: acqFilter,
      outputFormat: "application/json",
      propertyName: "geometry",
      maxFeatures: "1",
    });
    fetch(GS_WFS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
      .then((r) => r.json())
      .then((json) => {
        const bbox: number[] | undefined = json?.features?.[0]?.geometry?.bbox ?? json?.bbox;
        if (bbox?.length === 4) {
          const ext = transformExtent(bbox, "EPSG:4326", "EPSG:3857");
          map.getView().fit(ext, { padding: [48, 48, 48, 48], maxZoom: 17, duration: 1000 });
        }
      })
      .catch(() => { /* keep default view */ });

    return () => {
      map.setTarget(undefined);
      olMap.current = null;
      historyLayers.current = {};
    };
  }, [acqFilter, acquisitionId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        {boundaryHistory.length > 0 && (
          <div className="w-full lg:w-56 shrink-0">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
              Хилийн өөрчлөлт
            </p>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {boundaryHistory.map((history, index) => {
                const visible = visibleHistoryIds.has(history.id);
                return (
                  <div
                    key={history.id}
                    className="rounded-lg border border-slate-100 dark:border-[#37394d] bg-slate-50 dark:bg-[#252630] p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                          #{boundaryHistory.length - index}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(history.changed_at).toLocaleString("mn-MN")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleHistory(history)}
                        className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                          visible
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20"
                        }`}
                      >
                        {visible ? "Нуух" : "Харах"}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-0.5 w-4 border-t-2 border-dashed border-red-500" />
                        Хуучин
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-0.5 w-4 rounded bg-[#02c0ce]" />
                        Шинэ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <div
            className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
            style={{ height: 480 }}
          >
            <div ref={mapRef} className="h-full w-full" />
            <LayerPanel layers={layers} onToggle={handleToggle} />
          </div>
        </div>
      </div>

      {Array.isArray(aus) && aus.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Давхцаж буй нутаг дэвсгэр
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {aus.map((au) => (
              <div
                key={au.au3_code}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#252630] border border-slate-100 dark:border-[#37394d]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {au.au3_name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {au.au2_name} · {au.au1_name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#1e1f27] px-1.5 py-0.5 rounded">
                    {au.au3_code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
