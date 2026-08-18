"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Pencil, Plus, Trash2, X, Save, Upload, AlertTriangle, RefreshCw } from "lucide-react";
import { droneAcquisitionApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { DroneAcquisition, DroneAcquisitionStatus } from "@/types";

interface Props {
  acquisitionId: string;
}

const inp =
  "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<DroneAcquisitionStatus, string> = {
  processing: "Боловсруулж байна",
  ready: "Бэлэн",
  failed: "Амжилтгүй",
};

const STATUS_BADGE: Record<DroneAcquisitionStatus, string> = {
  processing: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ready: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-50 dark:bg-red-500/10 text-red-500",
};

/**
 * Дроны зургийн ХАМГИЙН ИХ хэмжээ — backend-ийн (шинэ, шууд байршуулах
 * урсгалын) хязгаартай ижил (internal/service/land_drone.go-ийн
 * maxDroneSizeBytes). Файл нь backend-ээр дамждаггүй ч хязгааргүй байлгаж
 * болохгүй тул frontend талд урьдчилан мэдэгдэнэ.
 */
const MAX_DRONE_SIZE = 500 * 1024 * 1024;
const MAX_DRONE_SIZE_LABEL = "500 MB";

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function validateDroneFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".tif") && !lower.endsWith(".tiff")) {
    return "Зөвхөн GeoTIFF (.tif / .tiff) файл байршуулна";
  }
  if (file.size > MAX_DRONE_SIZE) {
    return `Зургийн хэмжээ хэтэрсэн — ${formatSize(file.size)}. Дээд хязгаар ${MAX_DRONE_SIZE_LABEL}.`;
  }
  return null;
}

export function DroneAcquisitionList({ acquisitionId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DroneAcquisition | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: droneAcquisitions = [], isLoading } = useQuery({
    queryKey: ["drone-acquisitions"],
    queryFn: () => droneAcquisitionApi.list(),
  });

  const relevant = useMemo(() => {
    return droneAcquisitions
      .filter((acq) => acq.type === "acquisition" && acq.acquisition_id === acquisitionId)
      .sort(
        (a, b) =>
          new Date(b.captured_at ?? b.created_at).getTime() -
          new Date(a.captured_at ?? a.created_at).getTime(),
      );
  }, [droneAcquisitions, acquisitionId]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => droneAcquisitionApi.delete(id),
    onSuccess: () => {
      toast.success("Явцын зураг устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  // GeoServer-т нийтлэгдээгүй (эсвэл нийтлэлт бүтэлгүйтсэн) шинэ урсгалын
  // зурагт зориулсан дахин оролдох товч — location-tab.tsx-ийн
  // refreshMutation-той ижил зорилготой.
  const refreshMutation = useMutation({
    mutationFn: (id: number) => droneAcquisitionApi.refresh(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
      if (updated?.published) {
        toast.success("GeoServer шинэчлэгдлээ");
      } else {
        toast.warning("GeoServer-т давхарга үүсгэж чадсангүй", {
          description: updated?.publish_error,
          duration: 15000,
        });
      }
    },
    onError: (err) => toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  if (!acquisitionId) return null;

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Явцын зургийн жагсаалт
        </p>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Явцын зураг нэмэх
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
          <Layers className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Явцын зураг байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {relevant.map((acq) => {
            // Шинэ (шууд байршуулах) урсгалаар үүссэн зураг GeoServer-т
            // нийтлэгдээгүй бол зөвхөн энд шалгаж болно — status нь ийм
            // мөрүүдэд үргэлж "ready" (файл хадгалагдсан гэсэн үг, нийтлэлт
            // тусдаа).
            const unpublished = !!acq.file_name && !acq.published;
            return (
              <div
                key={acq.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                  <Layers className="h-4 w-4 text-[#02c0ce]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                    {formatDate(acq.captured_at ?? acq.created_at)}
                  </p>
                </div>
                {unpublished ? (
                  <button
                    onClick={() => refreshMutation.mutate(acq.id)}
                    disabled={refreshMutation.isPending}
                    title={acq.publish_error || "GeoServer шинэчлэх"}
                    className="shrink-0 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {refreshMutation.isPending && refreshMutation.variables === acq.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    Нийтлэгдээгүй
                  </button>
                ) : (
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${STATUS_BADGE[acq.status]}`}
                  >
                    {STATUS_LABEL[acq.status]}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditing(acq)}
                    title="Засах"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Явцын зураг устгах уу?")) deleteMutation.mutate(acq.id);
                    }}
                    title="Устгах"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateForm && (
        <CreateDroneAcquisitionModal
          acquisitionId={acquisitionId}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editing && (
        <EditDroneAcquisitionModal
          acquisition={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function CreateDroneAcquisitionModal({ acquisitionId, onClose }: { acquisitionId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Явцын зураг нэмэх
          </p>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <TifUploadForm acquisitionId={acquisitionId} onClose={onClose} />
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#252630] overflow-hidden">
        <div
          className="h-full bg-[#02c0ce] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-1.5">
        Файл байршуулж байна ({progress}%). Цонхыг бүү хаа.
      </p>
    </div>
  );
}

function TifUploadForm({ acquisitionId, onClose }: { acquisitionId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [capturedAt, setCapturedAt] = useState(todayStr);
  const [progress, setProgress] = useState<number | null>(null);

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const error = validateDroneFile(picked);
    if (error) {
      toast.error(error, {
        description: "Ортофотог жижиглэж хуваах, эсвэл COG болгон шахаж (gdal_translate -co COMPRESS=DEFLATE) оруулна уу.",
        duration: 10000,
      });
      return;
    }
    setFile(picked);
  }

  // Гурван алхам: 1. upload URL авах 2. файлыг ШУУД файлын систем рүү PUT
  // хийх (backend-ээр дамжихгүй) 3. backend объектыг шалгаж GeoServer-т
  // нийтэлж бүртгэнэ.
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no file selected");
      setProgress(0);
      const ticket = await droneAcquisitionApi.createUploadUrl(file.name);
      await droneAcquisitionApi.putFileDirect(ticket, file, setProgress);
      const created = await droneAcquisitionApi.register({
        stored_name: ticket.stored_name,
        original_name: file.name,
        owner_id: user?.id ?? "",
        type: "acquisition",
        acquisition_id: acquisitionId,
        captured_at: capturedAt || undefined,
      });
      setProgress(null);
      return created;
    },
    onSuccess: (created) => {
      toast.success("Явцын зураг үүслээ");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
      if (created && !created.published) {
        toast.warning("GeoServer-т давхарга үүсгэж чадсангүй", {
          description: created.publish_error
            ? `${created.publish_error} — жагсаалтын "Нийтлэгдээгүй" товчоор дахин оролдоно уу.`
            : 'Жагсаалтын "Нийтлэгдээгүй" товчийг дарна уу.',
          duration: 15000,
        });
      }
      onClose();
    },
    onError: (err) => {
      setProgress(null);
      toast.error(getApiError(err, "Файл байршуулахад алдаа гарлаа"));
    },
  });

  const canSubmit = !!file && !!user?.id && !uploadMutation.isPending;

  return (
    <>
      <div className="p-6 space-y-4 overflow-y-auto">
        <div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
            GeoTIFF файл <span className="text-red-400">*</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tif,.tiff"
            className="hidden"
            onChange={onFileChosen}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="w-full flex items-center gap-2.5 h-11 px-3 rounded-lg border border-dashed border-slate-300 dark:border-white/[0.12] text-[13px] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{file ? file.name : "Файл сонгох (.tif, .tiff)"}</span>
          </button>
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
        {progress != null && <ProgressBar progress={progress} />}
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d] shrink-0">
        <button
          onClick={onClose}
          disabled={uploadMutation.isPending}
          className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] transition-colors disabled:opacity-50"
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
            <Upload className="h-4 w-4" />
          )}
          Оруулах
        </button>
      </div>
    </>
  );
}

function EditDroneAcquisitionModal({
  acquisition,
  onClose,
}: {
  acquisition: DroneAcquisition;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [capturedAt, setCapturedAt] = useState(
    acquisition.captured_at ? acquisition.captured_at.slice(0, 10) : todayStr(),
  );
  const [progress, setProgress] = useState<number | null>(null);

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const error = validateDroneFile(picked);
    if (error) {
      toast.error(error, {
        description: "Ортофотог жижиглэж хуваах, эсвэл COG болгон шахаж (gdal_translate -co COMPRESS=DEFLATE) оруулна уу.",
        duration: 10000,
      });
      return;
    }
    setFile(picked);
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        // Файл сонгоогүй бол зөвхөн огноог JSON-аар шинэчилнэ — байршуулсан
        // файл/давхаргад хөндөгдөхгүй.
        return droneAcquisitionApi.update(acquisition.id, {
          captured_at: capturedAt || undefined,
        });
      }
      setProgress(0);
      const ticket = await droneAcquisitionApi.createUploadUrl(file.name);
      await droneAcquisitionApi.putFileDirect(ticket, file, setProgress);
      const updated = await droneAcquisitionApi.registerUpdate(acquisition.id, {
        stored_name: ticket.stored_name,
        original_name: file.name,
        captured_at: capturedAt || undefined,
      });
      setProgress(null);
      return updated;
    },
    onSuccess: (updated) => {
      toast.success(file ? "Шинэ .tif байршуулагдлаа" : "Мэдээлэл шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
      if (file && updated && !updated.published) {
        toast.warning("GeoServer-т давхарга үүсгэж чадсангүй", {
          description: updated.publish_error
            ? `${updated.publish_error} — жагсаалтын "Нийтлэгдээгүй" товчоор дахин оролдоно уу.`
            : 'Жагсаалтын "Нийтлэгдээгүй" товчийг дарна уу.',
          duration: 15000,
        });
      }
      onClose();
    },
    onError: (err) => {
      setProgress(null);
      toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа"));
    },
  });

  const canSubmit = !updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Явцын зураг засах
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
              Шинэ GeoTIFF файл <span className="text-slate-400">(заавал биш)</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".tif,.tiff"
              className="hidden"
              onChange={onFileChosen}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={updateMutation.isPending}
              className="w-full flex items-center gap-2.5 h-11 px-3 rounded-lg border border-dashed border-slate-300 dark:border-white/[0.12] text-[13px] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">{file ? file.name : "Файл сонгох (.tif, .tiff)"}</span>
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              {file
                ? "Шинэ .tif файл хуучныг нь орлоно. GeoServer давхарга шинэчлэгдэнэ, шинэ давхарга бэлэн болсны дараа хуучин нь устгагдана."
                : "Файл сонгохгүй бол зөвхөн доорх огноо шинэчлэгдэнэ."}
            </p>
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
          {progress != null && <ProgressBar progress={progress} />}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d] shrink-0">
          <button
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] transition-colors disabled:opacity-50"
          >
            Цуцлах
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!canSubmit}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
