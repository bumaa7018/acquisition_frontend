"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";

interface Props {
  acquisitionId: string;
}

export function DroneUpload({ acquisitionId }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [geometryWkt, setGeometryWkt] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [name, setName] = useState("");

  const inp =
    "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const uploadMutation = useMutation({
    mutationFn: () =>
      droneImageApi.create({
        file: file as File,
        geometry_wkt: geometryWkt.trim(),
        acquisition_id: acquisitionId,
        captured_at: capturedAt || undefined,
        name: name.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Дрон зураг нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["drone-images"] });
      setFile(null);
      setGeometryWkt("");
      setCapturedAt("");
      setName("");
    },
    onError: (err) => toast.error(getApiError(err, "Дрон зураг нэмэхэд алдаа гарлаа")),
  });

  if (!acquisitionId) return null;

  const canSubmit = !!file && !!geometryWkt.trim() && !uploadMutation.isPending;

  return (
    <div className="ap-card p-4 flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
        Дрон зураг нэмэх
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
            Зургийн файл <span className="text-red-400">*</span>
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${inp} pt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 dark:file:bg-[#252630] file:px-2.5 file:py-1 file:text-[12px] file:text-slate-600 dark:file:text-slate-300`}
          />
        </div>
        <div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
            Авсан огноо
          </p>
          <input
            type="date"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
            className={inp}
          />
        </div>
        <div className="md:col-span-2">
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
            Нэр <span className="text-slate-300 dark:text-slate-600">(заавал биш)</span>
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Жишээ: 2026 оны 7-р сарын зураг"
            className={inp}
          />
        </div>
        <div className="md:col-span-2">
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
            Polygon (WKT) <span className="text-red-400">*</span>
          </p>
          <textarea
            value={geometryWkt}
            onChange={(e) => setGeometryWkt(e.target.value)}
            rows={3}
            placeholder="POLYGON((106.9 47.9, 106.91 47.9, 106.91 47.91, 106.9 47.91, 106.9 47.9))"
            className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[12.5px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => uploadMutation.mutate()}
          disabled={!canSubmit}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
        >
          {uploadMutation.isPending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          Хадгалах
        </button>
      </div>
    </div>
  );
}
