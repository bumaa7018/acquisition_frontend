"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2 } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DroneImage } from "@/types";

interface Props {
  acquisitionId: string;
  fullscreen?: boolean;
}

const select =
  "h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-colors";

function Placeholder({ text, fullscreen }: { text: string; fullscreen?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500"
      style={fullscreen ? { height: "100%" } : { height: 360 }}
    >
      <Columns2 className="h-7 w-7 mb-2 opacity-30" />
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

export function DroneCompare({ acquisitionId, fullscreen }: Props) {
  const [splitPercent, setSplitPercent] = useState(50);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  useEffect(() => {
    setLeftId("");
    setRightId("");
  }, [acquisitionId]);

  const { data: droneImages = [] } = useQuery({
    queryKey: ["drone-images"],
    queryFn: () => droneImageApi.list(),
  });

  const relevant = useMemo(() => {
    return droneImages
      .filter(
        (img): img is DroneImage & { image_url: string } =>
          !!img.image_url && img.type === "acquisition" && img.acquisition_id === acquisitionId,
      )
      .sort(
        (a, b) => new Date(a.captured_at ?? 0).getTime() - new Date(b.captured_at ?? 0).getTime(),
      );
  }, [droneImages, acquisitionId]);

  if (!acquisitionId)
    return <Placeholder text="Эхлээд чөлөөлөлт сонгоно уу" fullscreen={fullscreen} />;

  if (relevant.length < 2)
    return (
      <Placeholder text="Харьцуулах дрон зураг хүрэлцэхгүй байна" fullscreen={fullscreen} />
    );

  const defaultFirst = relevant[0];
  const defaultLast = relevant[relevant.length - 1];
  const left = relevant.find((img) => String(img.id) === leftId) ?? defaultFirst;
  const right = relevant.find((img) => String(img.id) === rightId) ?? defaultLast;

  function optionLabel(img: DroneImage, i: number) {
    return `${i + 1}. ${formatDate(img.captured_at)}${img.name ? ` · ${img.name}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-2" style={fullscreen ? { height: "100%" } : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          className={select}
        >
          <option value="">{`Эхний огноо (${formatDate(defaultFirst.captured_at)})`}</option>
          {relevant.map((img, i) => (
            <option key={img.id} value={img.id}>
              {optionLabel(img, i)}
            </option>
          ))}
        </select>
        <span className="text-slate-300 dark:text-slate-600">→</span>
        <select
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          className={select}
        >
          <option value="">{`Сүүлийн огноо (${formatDate(defaultLast.captured_at)})`}</option>
          {relevant.map((img, i) => (
            <option key={img.id} value={img.id}>
              {optionLabel(img, i)}
            </option>
          ))}
        </select>
      </div>

      <div
        className="relative w-full flex-1 min-h-0 select-none overflow-hidden rounded-xl bg-slate-100 dark:bg-[#252630]"
        style={fullscreen ? undefined : { height: 360 }}
      >
        {/* base — right-side image, fills the whole frame */}
        <img
          src={right.image_url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {/* overlay — left-side image, clipped to the left portion up to the slider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
        >
          <img
            src={left.image_url}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>

        <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(left.captured_at)}
        </span>
        <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
          {formatDate(right.captured_at)}
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
