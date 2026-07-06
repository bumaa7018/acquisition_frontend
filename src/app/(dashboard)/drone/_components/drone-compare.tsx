"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Columns2, ArrowRight } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DroneImage } from "@/types";

interface Props {
  acquisitionId: string;
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500"
      style={{ height: 360 }}
    >
      <Columns2 className="h-7 w-7 mb-2 opacity-30" />
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

function Panel({ label, image }: { label: string; image: DroneImage & { image_url: string } }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-[#252630]">
      <img
        src={image.image_url}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent px-2.5 py-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-white/80">
          {label}
        </span>
        <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {formatDate(image.captured_at)}
        </span>
      </div>
    </div>
  );
}

export function DroneCompare({ acquisitionId }: Props) {
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

  if (!acquisitionId) return <Placeholder text="Эхлээд чөлөөлөлт сонгоно уу" />;

  const first = relevant[0];
  const last = relevant[relevant.length - 1];
  if (!first || !last || first.id === last.id)
    return <Placeholder text="Харьцуулах дрон зураг хүрэлцэхгүй байна" />;

  return (
    <div className="flex items-stretch gap-2" style={{ height: 360 }}>
      <Panel label="Эхний зураг" image={first} />
      <div className="flex shrink-0 items-center text-slate-300 dark:text-slate-600">
        <ArrowRight className="h-5 w-5" />
      </div>
      <Panel label="Сүүлийн зураг" image={last} />
    </div>
  );
}
