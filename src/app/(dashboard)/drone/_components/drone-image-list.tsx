"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Images, Pencil, Trash2, X, UploadCloud } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import type { DroneImage } from "@/types";
import { DroneImagePicker } from "./drone-image-picker";

interface Props {
  acquisitionId: string;
}

const inp =
  "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

export function DroneImageList({ acquisitionId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DroneImage | null>(null);

  const { data: droneImages = [], isLoading } = useQuery({
    queryKey: ["drone-images"],
    queryFn: () => droneImageApi.list(),
  });

  const relevant = useMemo(() => {
    return droneImages
      .filter((img) => img.type === "acquisition" && img.acquisition_id === acquisitionId)
      .sort(
        (a, b) => new Date(b.captured_at ?? 0).getTime() - new Date(a.captured_at ?? 0).getTime(),
      );
  }, [droneImages, acquisitionId]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => droneImageApi.delete(id),
    onSuccess: () => {
      toast.success("Дрон зураг устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["drone-images"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  if (!acquisitionId) return null;

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Дрон зургийн жагсаалт
        </p>
      </div>

      {isLoading ? (
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      ) : !relevant.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Images className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Дрон зураг байхгүй</p>
        </div>
      ) : (
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {relevant.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-lg border border-slate-200 dark:border-white/[0.08] overflow-hidden bg-slate-100 dark:bg-[#252630]"
            >
              <div className="relative h-32 w-full">
                {img.image_url ? (
                  <img
                    src={img.image_url}
                    alt={img.name ?? ""}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <Images className="h-6 w-6" />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(img)}
                    title="Засах"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/75 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Дрон зураг устгах уу?")) deleteMutation.mutate(img.id);
                    }}
                    title="Устгах"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="px-2.5 py-2">
                <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {img.name || "Нэргүй"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(img.captured_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditDroneImageModal
          image={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditDroneImageModal({ image, onClose }: { image: DroneImage; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [geometryWkt, setGeometryWkt] = useState(image.geometry_wkt ?? "");
  const [capturedAt, setCapturedAt] = useState(
    image.captured_at ? image.captured_at.slice(0, 10) : "",
  );
  const [name, setName] = useState(image.name ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      droneImageApi.update(image.id, {
        file,
        geometry_wkt: geometryWkt.trim() || undefined,
        captured_at: capturedAt || undefined,
        name: name.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Дрон зураг шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["drone-images"] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Дрон зураг засах
          </p>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Зургийн файл <span className="text-slate-300 dark:text-slate-600">(солихгүй бол хоосон)</span>
            </p>
            <DroneImagePicker file={file} onChange={setFile} disabled={updateMutation.isPending} previewHeight={180} />
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Авсан огноо</p>
            <input
              type="date"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Нэр <span className="text-slate-300 dark:text-slate-600">(заавал биш)</span>
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Polygon (WKT)</p>
            <textarea
              value={geometryWkt}
              onChange={(e) => setGeometryWkt(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[12.5px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d] shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] transition-colors"
          >
            Цуцлах
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
