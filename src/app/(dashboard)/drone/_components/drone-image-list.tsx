"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Pencil, Plus, Trash2, X, UploadCloud } from "lucide-react";
import { droneImageApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import type { DroneImage } from "@/types";
import { DroneImagePicker } from "./drone-image-picker";

interface Props {
  acquisitionId: string;
}

const inp =
  "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function DroneImageList({ acquisitionId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DroneImage | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

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
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Дрон зургийн жагсаалт
        </p>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Дрон зураг нэмэх
        </button>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      ) : !relevant.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Дрон зураг байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {relevant.map((img) => (
            <div
              key={img.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                <ImageIcon className="h-4 w-4 text-[#02c0ce]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {img.name || "Нэргүй"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(img.captured_at)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditing(img)}
                  title="Засах"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Дрон зураг устгах уу?")) deleteMutation.mutate(img.id);
                  }}
                  title="Устгах"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadForm && (
        <UploadDroneImageModal
          acquisitionId={acquisitionId}
          onClose={() => setShowUploadForm(false)}
        />
      )}

      {editing && (
        <EditDroneImageModal
          image={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function UploadDroneImageModal({ acquisitionId, onClose }: { acquisitionId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [geometryWkt, setGeometryWkt] = useState("");
  const [capturedAt, setCapturedAt] = useState(todayStr);
  const [name, setName] = useState("");

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
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Дрон зураг нэмэхэд алдаа гарлаа")),
  });

  const canSubmit = !!file && !!geometryWkt.trim() && !uploadMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Дрон зураг нэмэх
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
              Зургийн файл <span className="text-red-400">*</span>
            </p>
            <DroneImagePicker file={file} onChange={setFile} disabled={uploadMutation.isPending} previewHeight={180} />
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
          <div>
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
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Polygon (WKT) <span className="text-red-400">*</span>
            </p>
            <textarea
              value={geometryWkt}
              onChange={(e) => setGeometryWkt(e.target.value)}
              rows={8}
              placeholder="POLYGON((106.9 47.9, 106.91 47.9, 106.91 47.91, 106.9 47.91, 106.9 47.9))"
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
            <DroneImagePicker
              file={file}
              onChange={setFile}
              disabled={updateMutation.isPending}
              previewHeight={180}
              existingImageUrl={image.image_url}
            />
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
