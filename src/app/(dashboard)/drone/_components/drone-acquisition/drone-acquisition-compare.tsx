"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2 } from "lucide-react";
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

function CompareImage({ src, className }: { src?: string; className: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 dark:bg-[#252630]`}>
        <p className="text-[12px] text-slate-400 dark:text-slate-500">Зураг ачаалагдсангүй</p>
      </div>
    );
  }
  return <img src={src} alt="" draggable={false} onError={() => setError(true)} className={className} />;
}

type ReadyAcquisition = DroneAcquisition & { preview_image_path: string };

export function DroneAcquisitionCompare({ acquisitionId }: Props) {
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
          {relevant.map((acq, i) =>
            String(acq.id) === String(right.id) ? null : (
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
            String(acq.id) === String(left.id) ? null : (
              <option key={acq.id} value={acq.id}>
                {optionLabel(acq, i)}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="relative w-full flex-1 min-h-0 select-none overflow-hidden rounded-xl bg-slate-100 dark:bg-[#252630]">
        {/* base — right-side image, fills the whole frame */}
        <CompareImage
          key={right.id}
          src={resolveImageUrl(right.preview_image_path)}
          className="absolute inset-0 h-full w-full object-contain"
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
          />
        </div>

        <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(left.captured_at ?? left.created_at)}
        </span>
        <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(right.captured_at ?? right.created_at)}
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
