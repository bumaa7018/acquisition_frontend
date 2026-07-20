"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Pencil, Plus, Trash2, X, Save } from "lucide-react";
import { droneAcquisitionApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { DroneAcquisition, DroneAcquisitionStatus } from "@/types";

interface Props {
  acquisitionId: string;
}

const inp =
  "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

const STATUS_OPTIONS: DroneAcquisitionStatus[] = ["processing", "ready", "failed"];

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
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [droneAcquisitions, acquisitionId]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => droneAcquisitionApi.delete(id),
    onSuccess: () => {
      toast.success("Tile давхарга устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  if (!acquisitionId) return null;

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Tile давхаргын жагсаалт
        </p>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Tile давхарга нэмэх
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
          <p className="text-[13px]">Tile давхарга байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {relevant.map((acq) => (
            <div
              key={acq.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                <Layers className="h-4 w-4 text-[#02c0ce]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {acq.tile_root_path || "Замгүй"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(acq.created_at)}</p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${STATUS_BADGE[acq.status]}`}
              >
                {STATUS_LABEL[acq.status]}
              </span>
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
                    if (confirm("Tile давхарга устгах уу?")) deleteMutation.mutate(acq.id);
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tileRootPath, setTileRootPath] = useState("");
  const [minZoom, setMinZoom] = useState("");
  const [maxZoom, setMaxZoom] = useState("");
  const [bboxWkt, setBboxWkt] = useState("");
  const [status, setStatus] = useState<DroneAcquisitionStatus>("processing");

  const createMutation = useMutation({
    mutationFn: () =>
      droneAcquisitionApi.create({
        owner_id: user?.id ?? "",
        tile_root_path: tileRootPath.trim(),
        min_zoom: minZoom ? Number(minZoom) : undefined,
        max_zoom: maxZoom ? Number(maxZoom) : undefined,
        bbox_wkt: bboxWkt.trim() || undefined,
        status,
        type: "acquisition",
        acquisition_id: acquisitionId,
      }),
    onSuccess: () => {
      toast.success("Tile давхарга нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа")),
  });

  const canSubmit = !!tileRootPath.trim() && !!user?.id && !createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Tile давхарга нэмэх
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
              Tile root зам <span className="text-red-400">*</span>
            </p>
            <input
              type="text"
              value={tileRootPath}
              onChange={(e) => setTileRootPath(e.target.value)}
              placeholder="drone-tiles/acq-123"
              className={`${inp} font-mono`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Min zoom</p>
              <input
                type="number"
                value={minZoom}
                onChange={(e) => setMinZoom(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Max zoom</p>
              <input
                type="number"
                value={maxZoom}
                onChange={(e) => setMaxZoom(e.target.value)}
                className={inp}
              />
            </div>
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Төлөв</p>
            <select value={status} onChange={(e) => setStatus(e.target.value as DroneAcquisitionStatus)} className={inp}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Хамрах хүрээ (bbox WKT)
            </p>
            <textarea
              value={bboxWkt}
              onChange={(e) => setBboxWkt(e.target.value)}
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
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? (
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

function EditDroneAcquisitionModal({
  acquisition,
  onClose,
}: {
  acquisition: DroneAcquisition;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tileRootPath, setTileRootPath] = useState(acquisition.tile_root_path ?? "");
  const [minZoom, setMinZoom] = useState(acquisition.min_zoom?.toString() ?? "");
  const [maxZoom, setMaxZoom] = useState(acquisition.max_zoom?.toString() ?? "");
  const [bboxWkt, setBboxWkt] = useState(acquisition.bbox_wkt ?? "");
  const [status, setStatus] = useState<DroneAcquisitionStatus>(acquisition.status);

  const updateMutation = useMutation({
    mutationFn: () =>
      droneAcquisitionApi.update(acquisition.id, {
        tile_root_path: tileRootPath.trim() || undefined,
        min_zoom: minZoom ? Number(minZoom) : undefined,
        max_zoom: maxZoom ? Number(maxZoom) : undefined,
        bbox_wkt: bboxWkt.trim() || undefined,
        status,
      }),
    onSuccess: () => {
      toast.success("Tile давхарга шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["drone-acquisitions"] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
            Tile давхарга засах
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
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Tile root зам</p>
            <input
              type="text"
              value={tileRootPath}
              onChange={(e) => setTileRootPath(e.target.value)}
              className={`${inp} font-mono`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Min zoom</p>
              <input
                type="number"
                value={minZoom}
                onChange={(e) => setMinZoom(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Max zoom</p>
              <input
                type="number"
                value={maxZoom}
                onChange={(e) => setMaxZoom(e.target.value)}
                className={inp}
              />
            </div>
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Төлөв</p>
            <select value={status} onChange={(e) => setStatus(e.target.value as DroneAcquisitionStatus)} className={inp}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Хамрах хүрээ (bbox WKT)
            </p>
            <textarea
              value={bboxWkt}
              onChange={(e) => setBboxWkt(e.target.value)}
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
              <Save className="h-4 w-4" />
            )}
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
