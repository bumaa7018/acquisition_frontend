"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { AcquisitionSelect } from "@/app/(dashboard)/parcel/_components/acquisition_select";
import { DroneNav } from "../_components/drone-nav";
import { DroneAcquisitionCompare } from "../_components/drone-acquisition/drone-acquisition-compare";
import { DroneAcquisitionList } from "../_components/drone-acquisition/drone-acquisition-list";

const ProgressMap = dynamic(
  () => import("@/components/map/progress-map").then((m) => m.ProgressMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

type FullscreenCard = "map" | "compare" | null;

export default function DroneAcquisitionsPage() {
  return (
    <Suspense fallback={null}>
      <DroneAcquisitionsPageContent />
    </Suspense>
  );
}

function DroneAcquisitionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [acquisitionId, setAcquisitionId] = useState(
    () => searchParams.get("acq") ?? "",
  );
  const [fullscreen, setFullscreen] = useState<FullscreenCard>(null);

  function selectAcquisition(id: string) {
    setAcquisitionId(id);
    const params = new URLSearchParams(searchParams);
    if (id) params.set("acq", id);
    else params.delete("acq");
    router.replace(`/drone/acquisitions${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <button
            onClick={() => setFullscreen(null)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Буцах
          </button>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            {fullscreen === "map" ? "Явцын зураг" : "Tile харьцуулах"}
          </p>
          <div className="w-[92px]" />
        </div>
        <div className="flex-1 min-h-0 p-5">
          {fullscreen === "map" ? (
            <ProgressMap acquisitionId={acquisitionId} fullscreen />
          ) : (
            <DroneAcquisitionCompare acquisitionId={acquisitionId} fullscreen />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">
          Дрон tile давхарга
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
          Чөлөөлөлт сонгож боловсруулагдсан tile давхаргыг газрын зураг дээр харах
        </p>
      </div>

      <DroneNav />

      <div className="ap-card p-4">
        <AcquisitionSelect
          selectedId={acquisitionId}
          onSelect={(id) => selectAcquisition(id)}
          onClear={() => selectAcquisition("")}
          className="w-72"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ap-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
              Явцын зураг
            </p>
            <button
              onClick={() => setFullscreen("map")}
              title="Дэлгэц дүүргэх"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#252630] dark:hover:text-slate-300 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-5 h-[400px]">
            <ProgressMap acquisitionId={acquisitionId} />
          </div>
        </div>

        <div className="ap-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
              Tile харьцуулах
            </p>
            <button
              onClick={() => setFullscreen("compare")}
              title="Дэлгэц дүүргэх"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#252630] dark:hover:text-slate-300 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-5 h-[400px]">
            <DroneAcquisitionCompare acquisitionId={acquisitionId} />
          </div>
        </div>
      </div>

      {acquisitionId && (
        <div className="ap-card overflow-hidden">
          <DroneAcquisitionList acquisitionId={acquisitionId} />
        </div>
      )}
    </div>
  );
}
