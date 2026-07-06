"use client";
import dynamic from "next/dynamic";

const ProgressMap = dynamic(
  () => import("@/components/map/progress-map").then((m) => m.ProgressMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

export function DroneTab({ id }: { id: string }) {
  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Явцын зураг
        </p>
      </div>
      <div className="p-5">
        <ProgressMap acquisitionId={id} />
      </div>
    </div>
  );
}
