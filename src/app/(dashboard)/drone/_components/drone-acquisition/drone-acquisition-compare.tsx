"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2 } from "lucide-react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import WKT from "ol/format/WKT";
import { fromLonLat } from "ol/proj";
import { getRenderPixel } from "ol/render";
// @ts-ignore: CSS side-effect import for OpenLayers styles
import "ol/ol.css";
import { droneAcquisitionApi } from "@/lib/api";
import { formatDate, resolveImageUrl } from "@/lib/utils";
import type { DroneAcquisition } from "@/types";

interface Props {
  acquisitionId: string;
  fullscreen?: boolean;
}

const select =
  "h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-colors";

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
      <Columns2 className="h-7 w-7 mb-2 opacity-30" />
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

type ReadyAcquisition = DroneAcquisition & { bbox_wkt: string };

function makeTileLayer(acq: ReadyAcquisition, zIndex: number) {
  const root = resolveImageUrl(acq.tile_root_path, "drone-image")?.replace(/\/$/, "");
  return new TileLayer({
    zIndex,
    source: root
      ? new XYZ({
          url: `${root}/{z}/{x}/{y}.png`,
          minZoom: acq.min_zoom,
          maxZoom: acq.max_zoom,
          crossOrigin: "anonymous",
        })
      : undefined,
  });
}

export function DroneAcquisitionCompare({ acquisitionId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMap = useRef<OLMap | null>(null);
  const leftLayer = useRef<TileLayer<XYZ> | null>(null);
  const rightLayer = useRef<TileLayer<XYZ> | null>(null);
  const wktFormat = useRef(new WKT());

  const [splitPercent, setSplitPercent] = useState(50);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  useEffect(() => {
    setLeftId("");
    setRightId("");
  }, [acquisitionId]);

  const { data: droneAcquisitions = [] } = useQuery({
    queryKey: ["drone-acquisitions"],
    queryFn: () => droneAcquisitionApi.list(),
  });

  const relevant = useMemo(() => {
    return droneAcquisitions
      .filter(
        (acq): acq is ReadyAcquisition =>
          !!acq.bbox_wkt &&
          acq.type === "acquisition" &&
          acq.acquisition_id === acquisitionId &&
          acq.status === "ready",
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [droneAcquisitions, acquisitionId]);

  const defaultFirst = relevant[relevant.length - 1];
  const defaultLast = relevant[0];
  const left = relevant.find((acq) => String(acq.id) === leftId) ?? defaultFirst;
  const right = relevant.find((acq) => String(acq.id) === rightId) ?? defaultLast;

  function optionLabel(acq: DroneAcquisition, i: number) {
    return `${i + 1}. ${formatDate(acq.created_at)}`;
  }

  // Base map — created once and kept mounted for the lifetime of this component.
  useEffect(() => {
    if (!mapRef.current || olMap.current) return;

    const map = new OLMap({
      target: mapRef.current,
      layers: [],
      view: new View({
        center: fromLonLat([106.917, 47.918]),
        zoom: 11,
        minZoom: 4,
        maxZoom: 22,
      }),
      controls: [],
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

  // Rebuild left/right tile layers whenever the compared acquisitions change.
  useEffect(() => {
    const map = olMap.current;
    if (!map || !left || !right) return;

    if (rightLayer.current) map.removeLayer(rightLayer.current);
    if (leftLayer.current) map.removeLayer(leftLayer.current);

    const newRight = makeTileLayer(right, 10);
    const newLeft = makeTileLayer(left, 11);
    map.addLayer(newRight);
    map.addLayer(newLeft);
    rightLayer.current = newRight;
    leftLayer.current = newLeft;

    const geom = wktFormat.current.readGeometry(right.bbox_wkt, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    map.getView().fit(geom.getExtent(), { padding: [24, 24, 24, 24], maxZoom: 20, duration: 400 });

    return () => {
      map.removeLayer(newLeft);
      map.removeLayer(newRight);
    };
  }, [left?.id, right?.id]);

  // Clip the left (overlay) layer to the swipe position on render, OL's standard layer-swipe technique.
  useEffect(() => {
    const map = olMap.current;
    const layer = leftLayer.current;
    if (!map || !layer) return;

    function handlePrerender(event: import("ol/render/Event").default) {
      const ctx = event.context as CanvasRenderingContext2D;
      const mapSize = map!.getSize();
      if (!mapSize) return;
      const width = mapSize[0] * (splitPercent / 100);
      const tl = getRenderPixel(event, [width, 0]);
      const tr = getRenderPixel(event, [mapSize[0], 0]);
      const bl = getRenderPixel(event, [width, mapSize[1]]);
      const br = getRenderPixel(event, [mapSize[0], mapSize[1]]);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tl[0], tl[1]);
      ctx.lineTo(bl[0], bl[1]);
      ctx.lineTo(br[0], br[1]);
      ctx.lineTo(tr[0], tr[1]);
      ctx.closePath();
      ctx.clip();
    }
    function handlePostrender(event: import("ol/render/Event").default) {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    }

    layer.on("prerender", handlePrerender);
    layer.on("postrender", handlePostrender);
    map.render();

    return () => {
      layer.un("prerender", handlePrerender);
      layer.un("postrender", handlePostrender);
    };
  }, [splitPercent, left?.id, right?.id]);

  if (!acquisitionId) return <Placeholder text="Эхлээд чөлөөлөлт сонгоно уу" />;

  if (relevant.length < 2)
    return <Placeholder text="Харьцуулах бэлэн tile давхарга олдсонгүй" />;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <select
          value={leftId}
          onChange={(e) => {
            const value = e.target.value;
            setLeftId(value);
            if (value && value === rightId) setRightId("");
          }}
          className={select}
        >
          {relevant.map((acq, i) =>
            String(acq.id) === String(right?.id) ? null : (
              <option key={acq.id} value={acq.id}>
                {optionLabel(acq, i)}
              </option>
            ),
          )}
        </select>
        <span className="text-slate-300 dark:text-slate-600">→</span>
        <select
          value={rightId}
          onChange={(e) => {
            const value = e.target.value;
            setRightId(value);
            if (value && value === leftId) setLeftId("");
          }}
          className={select}
        >
          {relevant.map((acq, i) =>
            String(acq.id) === String(left?.id) ? null : (
              <option key={acq.id} value={acq.id}>
                {optionLabel(acq, i)}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="relative w-full flex-1 min-h-0 select-none overflow-hidden rounded-xl bg-slate-100 dark:bg-[#252630]">
        <div ref={mapRef} className="absolute inset-0 h-full w-full" />

        <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(left?.created_at)}
        </span>
        <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(right?.created_at)}
        </span>

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
      </div>
    </div>
  );
}
