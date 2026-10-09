"use client";
import { useEffect, useRef, useState } from "react";
import type { ChronosData } from "@/lib/chronos";
import { DEFAULT_BASEMAP_MAX_ZOOM, DEFAULT_BASEMAP_URLS, getBasemapSetting, isBasemapActive } from "../basemap-config";
import { ChronosRenderer, DARK_MAP_MAX_ZOOM, DARK_MAP_TILES, LIGHT_MAP_TILES, type ChronosBasemap } from "./chronos-renderer";

/** Хиймэл дагуул — одоогийн суурь зургийн xyz тохиргоо, үгүй бол үндсэн. */
function imageryTiles(): { urls: string[]; maxZoom: number } {
  const setting = getBasemapSetting();
  if (isBasemapActive(setting) && setting?.type === "xyz" && setting.url) {
    return { urls: [setting.url], maxZoom: setting.max_zoom || DEFAULT_BASEMAP_MAX_ZOOM };
  }
  return { urls: [...DEFAULT_BASEMAP_URLS], maxZoom: DEFAULT_BASEMAP_MAX_ZOOM };
}

function basemapTiles(mode: ChronosBasemap): { urls: string[]; maxZoom: number } {
  if (mode === "dark") return { urls: DARK_MAP_TILES, maxZoom: DARK_MAP_MAX_ZOOM };
  if (mode === "light") return { urls: LIGHT_MAP_TILES, maxZoom: DARK_MAP_MAX_ZOOM };
  return imageryTiles();
}

/**
 * Суурь зургийн жижиг урьдчилсан харагдац — Улаанбаатарын төвийн нэг tile
 * (z15). Сонголтын товчинд тухайн зураг ямар харагдахыг төсөөлүүлнэ.
 */
export function basemapThumb(mode: ChronosBasemap): string {
  const { urls } = basemapTiles(mode);
  const [z, x, y] = [15, 26115, 11399];
  return (urls[0] ?? "")
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{-y}", String(2 ** z - 1 - y))
    .replace("{y}", String(y));
}

/**
 * «Он цагийн зураг» — изометр зураг — газрын зургийн хайрцаг ДОТОР (дашбоард). Чирж
 * зөөх, дугуйгаар томруулах, нэгж талбар дарж сонгох. Анимэйшн/зурах нь
 * ChronosRenderer-т.
 */
export function ChronosCanvas({
  data,
  months,
  asOf,
  basemap,
  selected,
  onSelect,
}: {
  data?: ChronosData;
  months: string[];
  asOf: number;
  basemap: ChronosBasemap;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ChronosRenderer | null>(null);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = new ChronosRenderer(canvas, reduced);
    rendererRef.current = r;
    const resize = () => r.resize(wrap.clientWidth, wrap.clientHeight, window.devicePixelRatio || 1);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    setReady((n) => n + 1);
    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setData(data?.parcels ?? [], months, data?.statuses ?? []);
  }, [data, months, ready]);
  useEffect(() => rendererRef.current?.setAsOf(asOf), [asOf, data, months, ready]);
  useEffect(() => {
    const { urls, maxZoom } = basemapTiles(basemap);
    rendererRef.current?.setBasemap(basemap, urls, maxZoom);
  }, [basemap, ready]);
  useEffect(() => rendererRef.current?.setSelected(selected), [selected, ready]);

  // Чирж зөөх / дарж сонгох / hover (кадр тутамд нэг hit-test).
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hoverAt = useRef<[number, number] | null>(null);
  const hoverRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(hoverRaf.current), []);
  // Дугуйгаар томруулах — passive БИШ: дашбоардын хуудас хамт гүйлгэгдэхгүй.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      rendererRef.current?.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);
  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };

  return (
    <div ref={wrapRef} className={`absolute inset-0 ${basemap === "light" ? "bg-[#E9E9E9]" : "bg-[#07090D]"}`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = rendererRef.current;
          if (!r) return;
          if (drag.current) {
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
            if (drag.current.moved) {
              r.panBy(dx, dy);
              drag.current.x = e.clientX;
              drag.current.y = e.clientY;
            }
            return;
          }
          hoverAt.current = [...local(e)] as [number, number];
          if (hoverRaf.current) return;
          hoverRaf.current = requestAnimationFrame(() => {
            hoverRaf.current = 0;
            const rr = rendererRef.current;
            if (!rr || !hoverAt.current) return;
            const id = rr.hitTest(hoverAt.current[0], hoverAt.current[1]);
            rr.setHover(id);
            if (canvasRef.current) canvasRef.current.style.cursor = id ? "pointer" : "grab";
          });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const [x, y] = local(e);
            onSelect(rendererRef.current?.hitTest(x, y) ?? null);
          }
        }}
        onPointerLeave={() => rendererRef.current?.setHover(null)}
      />
    </div>
  );
}
