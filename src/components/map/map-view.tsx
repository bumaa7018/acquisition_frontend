"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import type { Coordinate } from "ol/coordinate";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";

import LayerPanel, { LayerConfig, LayerGroupConfig } from "./layer-panel";
import FeaturePopup from "./feature-popup";
import { fitLayerToMap, layerDef, type MapLayerDef } from "./layers";

const GS_BASE = "/geoserver/land/wms";
const GS_WFS = "/geoserver/land/ows";

const LAYER_DEFS: MapLayerDef[] = [
  layerDef("au1"),
  layerDef("au2"),
  layerDef("au3"),
  layerDef("v_acquisition_plan"),
  layerDef("v_acquisition_boundary"),
  layerDef("building"),
  layerDef("v_parcel_s1"),
  layerDef("v_parcel_s2"),
  layerDef("v_parcel_s3"),
  layerDef("v_parcel_s4"),
  layerDef("v_parcel_s5"),
];

const PARCEL_STATUS_LAYERS = [
  "v_parcel_s1",
  "v_parcel_s2",
  "v_parcel_s3",
  "v_parcel_s4",
  "v_parcel_s5",
] as const;
const ACQUISITION_FILTERED_LAYERS = [
  ...PARCEL_STATUS_LAYERS,
  "v_acquisition_boundary",
  "v_acquisition_plan",
] as const;

const DEFAULT_VISIBLE = new Set<string>([
  "v_acquisition_boundary",
  ...PARCEL_STATUS_LAYERS,
]);

const PARCEL_GROUP: LayerGroupConfig = {
  id: "parcel_status",
  label: "Нэгж талбарын хил",
  color: "#22c55e",
};

interface PopupState {
  layer: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

interface MapViewProps {
  acquisitionIds?: string[];
}

export default function MapView({ acquisitionIds }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const wmsLayers = useRef<Record<string, ImageLayer<ImageWMS>>>({});

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      visible: DEFAULT_VISIBLE.has(d.id),
      group: d.group,
    })),
  );
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [loading, setLoading] = useState(false);

  const makeWmsLayer = useCallback(
    (id: string, visible: boolean) =>
      new ImageLayer({
        visible,
        opacity: 0.75,
        zIndex: LAYER_DEFS.find((l) => l.id === id)?.zIndex ?? 0,
        source: new ImageWMS({
          url: GS_BASE,
          params: {
            LAYERS: `land:${id}`,
            FORMAT: "image/png",
            TRANSPARENT: true,
          },
          ratio: 1,
          serverType: "geoserver",
        }),
      }),
    [],
  );

  /* ── Map init (once) ── */
  useEffect(() => {
    if (!mapRef.current || olMap.current) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};
    LAYER_DEFS.forEach((d) => {
      wmsRecord[d.id] = makeWmsLayer(d.id, DEFAULT_VISIBLE.has(d.id));
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
        ...Object.values(wmsRecord),
      ],
      view: new View({
        center: fromLonLat([104.9, 47.9]),
        zoom: 5,
        minZoom: 4,
        maxZoom: 18,
      }),
    });

    map.on("singleclick", async (evt) => {
      const pixelCoord = evt.coordinate as Coordinate;
      const viewRes = map.getView().getResolution() ?? 1;
      const projection = map.getView().getProjection();
      const pixel = evt.pixel as [number, number];

      const visibleIds = LAYER_DEFS.filter((d) => wmsRecord[d.id]?.getVisible())
        .sort((a, b) => b.zIndex - a.zIndex)
        .map((d) => d.id);

      if (!visibleIds.length) return;
      setLoading(true);
      setPopup(null);

      for (const id of visibleIds) {
        const lyr = wmsRecord[id];
        const url = lyr
          .getSource()
          ?.getFeatureInfoUrl(pixelCoord, viewRes, projection, {
            INFO_FORMAT: "application/json",
            FEATURE_COUNT: 1,
          });
        if (!url) continue;
        try {
          const res = await fetch(url);
          const json = await res.json();
          const features: { properties: Record<string, unknown> }[] =
            json.features ?? [];
          if (features.length > 0) {
            setPopup({
              layer: id,
              properties: features[0].properties ?? {},
              position: { x: pixel[0], y: pixel[1] },
            });
            break;
          }
        } catch {
          /* skip layer */
        }
      }
      setLoading(false);
    });

    olMap.current = map;
    return () => {
      map.setTarget(undefined);
      olMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Apply acquisition filter to parcel status + boundary layers ── */
  useEffect(() => {
    let filter = "";
    if (acquisitionIds && acquisitionIds.length > 0) {
      filter =
        acquisitionIds.length === 1
          ? `acquisition_id = '${acquisitionIds[0]}'`
          : `acquisition_id IN (${acquisitionIds.map((id) => `'${id}'`).join(",")})`;
    }
    ACQUISITION_FILTERED_LAYERS.forEach((id) => {
      wmsLayers.current[id]?.getSource()?.updateParams({ CQL_FILTER: filter });
    });
  }, [acquisitionIds]);

  /* ── Layer toggle ── */
  const handleToggle = useCallback((id: string) => {
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
            padding: [64, 64, 64, 64],
            maxZoom: 17,
          });
        }
        return next;
      }),
    );
    setPopup(null);
  }, []);

  const standaloneL = layers.filter((l) => !l.group);
  const groupedL = layers.filter((l) => l.group === PARCEL_GROUP.id);
  const panelLayers = [...standaloneL, ...groupedL];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel
        layers={panelLayers}
        groups={[PARCEL_GROUP]}
        onToggle={handleToggle}
      />
      {popup && (
        <FeaturePopup
          layer={popup.layer}
          properties={popup.properties}
          position={popup.position}
          onClose={() => setPopup(null)}
        />
      )}
      {loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur text-sm px-3 py-1.5 rounded-full shadow border">
          Мэдээлэл ачааллаж байна...
        </div>
      )}
    </div>
  );
}
