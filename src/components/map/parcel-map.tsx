"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import WKT from "ol/format/WKT";
import { Fill, Stroke, Style } from "ol/style";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import LayerPanel, { type LayerConfig } from "./layer-panel";
import { fitLayerToMap, layerDef, type MapLayerDef } from "./layers";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";
import { landApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { isProfessionalOrg } from "@/lib/role-utils";
import { PARCEL_STATUS_STYLES } from "@/types";

const WMS_LAYER_DEFS: (MapLayerDef & {
  defaultVisible: boolean;
  cqlType?: "acquisition" | "parcel";
})[] = [
  { ...layerDef("au1"), defaultVisible: false },
  { ...layerDef("au2"), defaultVisible: false },
  { ...layerDef("au3"), defaultVisible: true },
  { ...layerDef("v_acquisition_plan"),     defaultVisible: true,  cqlType: "acquisition" },
  { ...layerDef("v_acquisition_boundary"), defaultVisible: true,  cqlType: "acquisition" },
  { ...layerDef("building"),               defaultVisible: true,  cqlType: "parcel" },
];

const VECTOR_LAYER_DEFS: MapLayerDef[] = [
  layerDef("v_parcel_acquisition"),
  layerDef("parcel"),
];

const ALL_LAYER_DEFS = [...WMS_LAYER_DEFS, ...VECTOR_LAYER_DEFS];

function parcelStyle(feature: { get: (k: string) => unknown }): Style {
  const sid = (feature.get("status_id") as number) ?? 0;
  const s = PARCEL_STATUS_STYLES[sid] ?? PARCEL_STATUS_STYLES[0];
  return new Style({
    stroke: new Stroke({ color: s.color, width: 1.5 }),
    fill:   new Fill({ color: `${s.color}22` }),
  });
}

const VECTOR_STYLES: Record<string, Style | ((f: { get: (k: string) => unknown }) => Style)> = {
  v_parcel_acquisition: parcelStyle,
  parcel: new Style({
    stroke: new Stroke({ color: "#22c55e", width: 2.5 }),
    fill:   new Fill({ color: "rgba(34,197,94,0.2)" }),
  }),
};

interface Props {
  parcelId: string;
  acquisitionId?: string;
}

export function ParcelMap({ parcelId, acquisitionId }: Props) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const olMap        = useRef<OLMap | null>(null);
  const wmsLayers    = useRef<Record<string, ImageLayer<ImageWMS>>>({});
  const vectorLayers = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const wktFormat    = useRef(new WKT());

  const acqCql    = acquisitionId ? `acquisition_id='${acquisitionId}'` : undefined;
  const parcelCql = parcelId      ? `parcel_id='${parcelId}'`            : undefined;

  const [layers, setLayers] = useState<LayerConfig[]>(
    ALL_LAYER_DEFS.map((d) => ({
      id: d.id,
      label: d.label,
      color: d.color,
      visible: ("defaultVisible" in d ? d.defaultVisible : true) as boolean,
    })),
  );

  const handleToggle = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, visible: !l.visible };
          if (vectorLayers.current[id]) {
            vectorLayers.current[id].setVisible(next.visible);
            return next;
          }
          wmsLayers.current[id]?.setVisible(next.visible);
          const def = WMS_LAYER_DEFS.find((d) => d.id === id);
          if (next.visible && def && olMap.current) {
            void fitLayerToMap({
              map: olMap.current,
              wfsUrl: GS_WFS,
              layerId: def.id,
              cqlFilter: def.cqlType === "acquisition" ? acqCql : def.cqlType === "parcel" ? parcelCql : undefined,
              padding: [60, 60, 60, 60],
              maxZoom: 18,
            });
          }
          return next;
        }),
      );
    },
    [acqCql, parcelCql],
  );

  useEffect(() => {
    if (!mapRef.current || olMap.current || !parcelId) return;

    const wmsRecord: Record<string, ImageLayer<ImageWMS>> = {};
    WMS_LAYER_DEFS.forEach((d) => {
      const cql = d.cqlType === "acquisition" ? acqCql : d.cqlType === "parcel" ? parcelCql : undefined;
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
            ...(cql ? { CQL_FILTER: cql } : {}),
          },
          ratio: 1,
          serverType: "geoserver",
          imageLoadFunction: wmsPostLoad,
        }),
      });
    });
    wmsLayers.current = wmsRecord;

    const vRecord: Record<string, VectorLayer<VectorSource>> = {};
    VECTOR_LAYER_DEFS.forEach((d) => {
      const src   = new VectorSource();
      const zIdx  = d.id === "parcel" ? 50 : d.zIndex;
      const layer = new VectorLayer({
        source: src,
        visible: true,
        zIndex: zIdx,
        style: VECTOR_STYLES[d.id],
      });
      vRecord[d.id] = layer;
    });
    vectorLayers.current = vRecord;

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
        ...WMS_LAYER_DEFS.map((d) => wmsRecord[d.id]),
        ...VECTOR_LAYER_DEFS.map((d) => vRecord[d.id]),
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
      vectorLayers.current = {};
    };
  }, [acqCql, acquisitionId, parcelCql, parcelId]);

  useEffect(() => {
    if (!acquisitionId) return;

    const fmt = wktFormat.current;

    ;(async () => {
      try {
        const resp    = await (isProfessionalOrg()
          ? profApi.profListParcels(acquisitionId, { page_size: 500 })
          : landApi.getParcels(acquisitionId, { page_size: 500 }));
        const parcels = resp?.data ?? [];

        const thisParcel = parcels.find((p) => p.parcel_id === parcelId);

        const makeFeature = (wkt: string, statusId?: number) => {
          try {
            const feat = fmt.readFeature(wkt, {
              dataProjection: "EPSG:4326",
              featureProjection: "EPSG:3857",
            });
            if (statusId !== undefined) feat.set("status_id", statusId);
            return feat;
          } catch { return null; }
        };

        const wkt = thisParcel?.geometry_wkt;
        const acqFeat    = wkt ? makeFeature(wkt, thisParcel!.status) : null;
        const parcelFeat = wkt ? makeFeature(wkt) : null;

        const vAllSrc = vectorLayers.current["v_parcel_acquisition"]?.getSource();
        if (vAllSrc) { vAllSrc.clear(); if (acqFeat) vAllSrc.addFeature(acqFeat); }

        const vParcelSrc = vectorLayers.current["parcel"]?.getSource();
        if (vParcelSrc) { vParcelSrc.clear(); if (parcelFeat) vParcelSrc.addFeature(parcelFeat); }

        if (parcelFeat && olMap.current) {
          const extent = vectorLayers.current["parcel"]?.getSource()?.getExtent();
          if (extent) {
            olMap.current.getView().fit(extent, {
              padding: [60, 60, 60, 60],
              maxZoom: 18,
              duration: 1000,
            });
          }
        }
      } catch {
        // Geometry fetch failed — layers stay empty
      }
    })();
  }, [acquisitionId, parcelId]);

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
