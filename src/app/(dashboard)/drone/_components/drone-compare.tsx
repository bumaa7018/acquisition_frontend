"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2 } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DroneImage } from "@/types";

interface Props {
  acquisitionId: string;
  fullscreen?: boolean;
}

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

  const first = relevant[0];
  const last = relevant[relevant.length - 1];
  if (!first || !last || first.id === last.id)
    return (
      <Placeholder text="Харьцуулах дрон зураг хүрэлцэхгүй байна" fullscreen={fullscreen} />
    );

  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-xl bg-slate-100 dark:bg-[#252630]"
      style={fullscreen ? { height: "100%" } : { height: 360 }}
    >
      {/* base — most recent image, fills the whole frame */}
      <img
        src={last.image_url}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* overlay — earliest image, clipped to the left portion up to the slider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
      >
        <img
          src={first.image_url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
        {formatDate(first.captured_at)}
      </span>
      <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 backdrop-blur px-2 py-1 text-[11px] font-medium text-white">
        {formatDate(last.captured_at)}
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
  );
}
