"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import LayerPanel, { type LayerConfig } from "./map/layer-panel";
import { fitLayerToMap, layerDef, type MapLayerDef } from "./map/layers";

const GS_WMS = "/geoserver/land/wms";
const GS_WFS = "/geoserver/land/ows";

const LAYER_DEFS: (MapLayerDef & {
  defaultVisible: boolean;
  filter?: "parcel" | "acquisition";
})[] = [
  { ...layerDef("au1"), defaultVisible: false },
  { ...layerDef("au2"), defaultVisible: false },
  { ...layerDef("au3"), defaultVisible: true },
  { ...layerDef("v_acquisition_plan"), defaultVisible: true },
  {
    ...layerDef("v_acquisition_boundary"),
    defaultVisible: true,
    filter: "acquisition",
  },
  { ...layerDef("parcel"), defaultVisible: true, filter: "parcel" },
  { ...layerDef("building"), defaultVisible: true, filter: "parcel" },
];

interface Props {
  parcelId: string;
  acquisitionId?: string;
}

export function ParcelMap({ parcelId, acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const wmsLayers = useRef<Record<string, ImageLayer<ImageWMS>>>({});

  const [layers, setLayers] = useState<LayerConfig[]>(
    LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      visible: d.defaultVisible,
    })),
  );
  const parcelFilter = `parcel_id='${parcelId}'`;
  const acquisitionFilter = acquisitionId
    ? `acquisition_id='${acquisitionId}'`
    : undefined;

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
              cqlFilter:
                def.filter === "parcel"
                  ? parcelFilter
                  : def.filter === "acquisition"
                    ? acquisitionFilter
                    : undefined,
              padding: [60, 60, 60, 60],
              maxZoom: 18,
            });
          }
          return next;
        }),
      );
    },
    [acquisitionFilter, parcelFilter],
  );

  useEffect(() => {
    if (!mapRef.current || olMap.current || !parcelId) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};

    LAYER_DEFS.forEach((d) => {
      wmsRecord[d.id] = new ImageLayer({
        visible: d.defaultVisible,
        opacity: 0.85,
        zIndex: d.zIndex,
        source: new ImageWMS({
          url: GS_WMS,
          params: {
            LAYERS: `land:${d.id}`,
            FORMAT: "image/png",
            TRANSPARENT: true,
            ...(d.filter === "parcel" ? { CQL_FILTER: parcelFilter } : {}),
            ...(d.filter === "acquisition" && acquisitionFilter
              ? { CQL_FILTER: acquisitionFilter }
              : {}),
          },
          ratio: 1,
          serverType: "geoserver",
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

    // Fit to the parcel's bbox via WFS
    const params = new URLSearchParams({
      service: "WFS",
      version: "1.1.0",
      request: "GetFeature",
      typeName: "land:parcel",
      CQL_FILTER: parcelFilter,
      outputFormat: "application/json",
      propertyName: "geometry",
      maxFeatures: "1",
    });
    fetch(`${GS_WFS}?${params}`)
      .then((r) => r.json())
      .then((json) => {
        const bbox: number[] | undefined =
          json?.features?.[0]?.geometry?.bbox ?? json?.bbox;
        if (bbox?.length === 4) {
          const ext = transformExtent(bbox, "EPSG:4326", "EPSG:3857");
          map.getView().fit(ext, {
            padding: [60, 60, 60, 60],
            maxZoom: 18,
            duration: 1000,
          });
        }
      })
      .catch(() => {
        /* keep default view */
      });

    return () => {
      map.setTarget(undefined);
      olMap.current = null;
    };
  }, [acquisitionFilter, acquisitionId, parcelFilter, parcelId]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
      style={{ height: 480 }}
    >
      <div ref={mapRef} className="h-full w-full" />
      <LayerPanel layers={layers} onToggle={handleToggle} />
    </div>
  );
}
