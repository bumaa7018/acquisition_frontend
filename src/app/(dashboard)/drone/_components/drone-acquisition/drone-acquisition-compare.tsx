"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2, ZoomOut } from "lucide-react";
import { droneAcquisitionApi } from "@/lib/api";
import { formatDate, resolveImageUrl } from "@/lib/utils";
import type { DroneAcquisition } from "@/types";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DOUBLE_CLICK_ZOOM = 2.5;

function clampZoom(scale: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

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

function CompareImage({
  src,
  className,
  style,
}: {
  src?: string;
  className: string;
  style?: React.CSSProperties;
}) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 dark:bg-[#252630]`}>
        <p className="text-[12px] text-slate-400 dark:text-slate-500">Зураг ачаалагдсангүй</p>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setError(true)}
      className={className}
      style={style}
    />
  );
}

type ReadyAcquisition = DroneAcquisition & { preview_image_path: string };

export function DroneAcquisitionCompare({ acquisitionId }: Props) {
  const [splitPercent, setSplitPercent] = useState(50);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    setLeftId("");
    setRightId("");
  }, [acquisitionId]);

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, [leftId, rightId, acquisitionId]);

  // Callback ref (not useEffect+useRef) so the non-passive wheel listener attaches
  // correctly even when this div only mounts after an early-return placeholder state.
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const nextScale = clampZoom(v.scale * factor);
        if (nextScale === v.scale) return v;
        if (nextScale === MIN_ZOOM) return { scale: MIN_ZOOM, x: 0, y: 0 };
        const nx = px - ((px - v.x) * nextScale) / v.scale;
        const ny = py - ((py - v.y) * nextScale) / v.scale;
        return { scale: nextScale, x: nx, y: ny };
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    wheelCleanupRef.current = () => el.removeEventListener("wheel", handleWheel);
  }, []);

  function handleDoubleClick(e: React.MouseEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setView((v) => {
      if (v.scale > 1) return { scale: 1, x: 0, y: 0 };
      const nextScale = DOUBLE_CLICK_ZOOM;
      return { scale: nextScale, x: px - px * nextScale, y: py - py * nextScale };
    });
  }

  function handlePanStart(e: React.MouseEvent) {
    if (view.scale <= 1 || e.target === sliderRef.current) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
  }

  function handlePanMove(e: React.MouseEvent) {
    const pan = panRef.current;
    if (!pan) return;
    setView((v) => ({
      ...v,
      x: pan.origX + (e.clientX - pan.startX),
      y: pan.origY + (e.clientY - pan.startY),
    }));
  }

  function handlePanEnd() {
    panRef.current = null;
  }

  const { data: droneAcquisitions = [] } = useQuery({
    queryKey: ["drone-acquisitions"],
    queryFn: () => droneAcquisitionApi.list(),
  });

  const relevant = useMemo(() => {
    return droneAcquisitions
      .filter(
        (acq): acq is ReadyAcquisition =>
          !!acq.preview_image_path &&
          acq.type === "acquisition" &&
          acq.acquisition_id === acquisitionId &&
          acq.status === "ready",
      )
      .sort(
        (a, b) =>
          new Date(b.captured_at ?? b.created_at).getTime() -
          new Date(a.captured_at ?? a.created_at).getTime(),
      );
  }, [droneAcquisitions, acquisitionId]);

  if (!acquisitionId) return <Placeholder text="Эхлээд чөлөөлөлт сонгоно уу" />;

  if (relevant.length < 2)
    return <Placeholder text="Харьцуулах бэлэн явцын зураг олдсонгүй" />;

  const defaultFirst = relevant[relevant.length - 1];
  const defaultLast = relevant[0];
  const left = relevant.find((acq) => String(acq.id) === leftId) ?? defaultFirst;
  const right = relevant.find((acq) => String(acq.id) === rightId) ?? defaultLast;

  function optionLabel(acq: DroneAcquisition) {
    return formatDate(acq.captured_at ?? acq.created_at);
  }

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
          {relevant.map((acq) =>
            String(acq.id) === String(right.id) ? null : (
              <option key={acq.id} value={acq.id}>
                {optionLabel(acq)}
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
          {relevant.map((acq) =>
            String(acq.id) === String(left.id) ? null : (
              <option key={acq.id} value={acq.id}>
                {optionLabel(acq)}
              </option>
            ),
          )}
        </select>
      </div>

      <div
        ref={setContainerRef}
        className="relative w-full flex-1 min-h-0 select-none overflow-hidden rounded-xl bg-slate-100 dark:bg-[#252630]"
        style={{ cursor: view.scale > 1 ? "grab" : undefined }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {/* base — right-side image, fills the whole frame */}
        <CompareImage
          key={right.id}
          src={resolveImageUrl(right.preview_image_path)}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
        />
        {/* overlay — left-side image, clipped to the left portion up to the slider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
        >
          <CompareImage
            key={left.id}
            src={resolveImageUrl(left.preview_image_path)}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
          />
        </div>

        <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(left.captured_at ?? left.created_at)}
        </span>
        <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(right.captured_at ?? right.created_at)}
        </span>

        {view.scale > 1 && (
          <button
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
            title="Томруулгыг арилгах"
            className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white hover:bg-black/75 transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" /> {Math.round(view.scale * 100)}%
          </button>
        )}

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)] pointer-events-none z-10"
          style={{ left: `${splitPercent}%` }}
        />
        <input
          ref={sliderRef}
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
