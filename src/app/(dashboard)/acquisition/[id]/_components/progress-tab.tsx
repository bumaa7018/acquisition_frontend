"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Clock, X } from "lucide-react";
import { landApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import { STATUS_LABELS, ACQ_STATUS } from "@/types";
import { STATUS_CFG } from "./shared";

function AdvanceModal({
  id,
  availableStatuses,
  onClose,
}: {
  id: string;
  availableStatuses: { id: number; label: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<number | "">(
    availableStatuses[0]?.id ?? "",
  );
  const [decreeNumber, setDecreeNumber] = useState("");
  const [decreeDate, setDecreeDate] = useState("");
  const sel =
    "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const inp =
    "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const advanceMutation = useMutation({
    mutationFn: () =>
      landApi.advanceStatus(
        id,
        selectedStatus as number,
        note,
        decreeNumber,
        decreeDate || undefined,
      ),
    onSuccess: () => {
      toast.success("Явц шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["land", id] });
      queryClient.invalidateQueries({ queryKey: ["progress", id] });
      queryClient.invalidateQueries({ queryKey: ["available-statuses", id] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Явц шинэчлэхэд алдаа гарлаа")),
  });

  const needsDecree = selectedStatus === ACQ_STATUS.CONFIRMED;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[15px] font-bold text-slate-800 dark:text-white">
            Явц солих
          </p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Шилжүүлэх төлөв
            </p>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(Number(e.target.value))}
              className={sel}
            >
              {availableStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {needsDecree && (
            <>
              <div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
                  НЗД-ын захирамжийн дугаар{" "}
                  <span className="text-red-400">*</span>
                </p>
                <input
                  type="text"
                  value={decreeNumber}
                  onChange={(e) => setDecreeNumber(e.target.value)}
                  placeholder="А/ХХХ-2024"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
                  НЗД-ын захирамжийн огноо{" "}
                  <span className="text-red-400">*</span>
                </p>
                <input
                  type="date"
                  value={decreeDate}
                  onChange={(e) => setDecreeDate(e.target.value)}
                  className={inp}
                />
              </div>
            </>
          )}
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Тайлбар{" "}
              <span className="text-slate-300 dark:text-slate-600">
                (заавал биш)
              </span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Шилжүүлэх шалтгаан..."
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
            >
              Болих
            </button>
            <button
              onClick={() => advanceMutation.mutate()}
              disabled={
                !selectedStatus ||
                (needsDecree && (!decreeNumber || !decreeDate)) ||
                advanceMutation.isPending
              }
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
            >
              {advanceMutation.isPending ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Шилжүүлэх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress tab ─────────────────────────────────────────────────────────────
export function ProgressTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [showModal, setShowModal] = useState(false);

  const { data: acq } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
  });
  const { data: progress = [], isLoading } = useQuery({
    queryKey: ["progress", id],
    queryFn: () => landApi.getProgress(id),
  });
  const { data: availableStatuses = [] } = useQuery({
    queryKey: ["available-statuses", id],
    queryFn: () => landApi.getAvailableStatuses(id),
    enabled: canEdit,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Status card */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">
              Одоогийн төлөв
            </p>
            {acq && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  color: STATUS_CFG[acq.status]?.color,
                  background: STATUS_CFG[acq.status]?.bg,
                }}
              >
                {STATUS_LABELS[acq.status]}
              </span>
            )}
          </div>
          {canEdit && availableStatuses.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
            >
              <ChevronRight className="h-4 w-4" /> Явц солих
            </button>
          )}
          {canEdit && availableStatuses.length === 0 && acq && (
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              Эцсийн шатанд хүрсэн
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <AdvanceModal
          id={id}
          availableStatuses={availableStatuses}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Progress table */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Явцын түүх
          </p>
        </div>
        {isLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
                />
              ))}
            </div>
          ) : !progress.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <Clock className="h-7 w-7 mb-2 opacity-30" />
              <p className="text-[13px]">Явцын бичлэг байхгүй</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                    {[
                      "#",
                      "Өмнөх төлөв",
                      "Шинэ төлөв",
                      "Тайлбар",
                      "Хэрэглэгч",
                      "Огноо",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                  {progress.map((p, i) => {
                    const from = STATUS_CFG[p.from_status] ?? STATUS_CFG[1];
                    const to = STATUS_CFG[p.to_status] ?? STATUS_CFG[1];
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                      >
                        <td className="px-4 py-3 text-[12px] font-mono text-slate-400 dark:text-slate-500">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                            style={{ color: from.color, background: from.bg }}
                          >
                            {STATUS_LABELS[p.from_status] ?? p.from_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                            style={{ color: to.color, background: to.bg }}
                          >
                            {STATUS_LABELS[p.to_status] ?? p.to_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                          {p.note || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {p.changed_by}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(p.changed_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
