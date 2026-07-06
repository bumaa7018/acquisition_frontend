"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera } from "lucide-react";
import { AcquisitionSelect } from "@/app/(dashboard)/parcel/_components/acquisition_select";

const ProgressMap = dynamic(
  () => import("@/components/map/progress-map").then((m) => m.ProgressMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

export default function DronePage() {
  const [acquisitionId, setAcquisitionId] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">
          Дрон зураг
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
          Чөлөөлөлт сонгож дрон зургийг газрын зураг дээр харах
        </p>
      </div>

      <div className="ap-card p-4">
        <AcquisitionSelect
          selectedId={acquisitionId}
          onSelect={(id) => setAcquisitionId(id)}
          onClear={() => setAcquisitionId("")}
          className="w-72"
        />
      </div>

      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Явцын зураг
          </p>
        </div>
        <div className="p-5">
          {acquisitionId ? (
            <ProgressMap acquisitionId={acquisitionId} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Camera className="h-7 w-7 mb-2 opacity-30" />
              <p className="text-[13px]">Эхлээд чөлөөлөлт сонгоно уу</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
