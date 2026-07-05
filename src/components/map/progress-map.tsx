"use client";
import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { GS_WMS, GS_WFS, wmsPostLoad } from "@/lib/geoserver";

interface Props {
  acquisitionId: string;
}

export function ProgressMap({ acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);

  const acqFilter = `acquisition_id='${acquisitionId}'`;

  useEffect(() => {
    if (!mapRef.current || olMap.current || !acquisitionId) return;

    const planLayer = new ImageLayer({
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
        planLayer,
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
    };
  }, [acqFilter, acquisitionId]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#37394d]"
      style={{ height: 360 }}
    >
      <div ref={mapRef} className="h-full w-full" />
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-[#1e1f27]/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow">
        <span className="h-2.5 w-2.5 rounded-sm border-2 border-[#a855f7]" />
        Төлөвлөгөөний хил
      </div>
    </div>
  );
}
