"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelApi, landApi } from "@/lib/api";
import { getApiError, formatDate } from "@/lib/utils";
import { getParcelStatusStyle } from "@/types";
import { Plus, Clock, User, CheckCircle2, X, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { ParcelStatus } from "@/types";

type ModalState = "closed" | "picking" | "confirming";
const EVALUATION_STATUS_NAME = "Үнэлгээ хийх";
const RELEASED_STATUS_NAME = "Чөлөөлсөн";

export function ProgressTab({ acqId, parcelId, isLocked = false }: { acqId: string; parcelId: string; isLocked?: boolean }) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>("closed");
  const [selected, setSelected] = useState<ParcelStatus | null>(null);

  const { data: parcelFull } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const parcelCode = parcelFull?.parcel_id ?? "";
  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId],
    queryFn: () => landApi.listCompensations(acqId),
    enabled: !!acqId && !!parcelCode,
  });
  // Нөхөх олговрын үндсэн (санхүү сонгосон) урсгал — түүнийхээ олговрыг л тооцно.
  const selectedType = parcelFull?.selected_valuation_type ?? null;
  const parcelComps = parcelCode
    ? allComps.filter((c) => c.parcel_id === parcelCode && c.valuation_type === (selectedType ?? "asset"))
    : [];
  const hasApprovedReport = parcelComps.some(
    (c) => c.status === "approved" && !!c.valuation_report_url,
  );

  const { data: availableStatuses = [] } = useQuery({
    queryKey: ["parcel-available-statuses", acqId, parcelId],
    queryFn: () => parcelApi.getAvailableStatuses(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  // Нөхөх олговор баталгаажсан = санхүү аль нэг урсгалыг зөвшөөрч үндсэн болгосон.
  const compApproved = !!selectedType;

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["parcel-status-history", acqId, parcelId],
    queryFn: () => parcelApi.listStatusHistory(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (statusId: number) => parcelApi.updateStatus(acqId, parcelId, statusId),
    onSuccess: () => {
      toast.success("Статус амжилттай шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
      queryClient.invalidateQueries({ queryKey: ["parcel-available-statuses", acqId, parcelId] });
      queryClient.invalidateQueries({ queryKey: ["parcel-status-history", acqId, parcelId] });
      closeModal();
    },
    onError: (err) => toast.error(getApiError(err, "Статус солиход алдаа гарлаа")),
  });

  function openPicker() {
    setSelected(null);
    setModal("picking");
  }

  function closeModal() {
    setModal("closed");
    setSelected(null);
  }

  function handleSelectStatus(s: ParcelStatus) {
    setSelected(s);
    setModal("confirming");
  }

  function handleBackToPicker() {
    setSelected(null);
    setModal("picking");
  }

  function handleConfirm() {
    if (selected) updateStatusMutation.mutate(selected.id);
  }

  const currentStatusId = parcelFull?.status_id ?? parcelFull?.status;
  const currentStatusName = parcelFull?.status_name;
  const currentStyle = getParcelStatusStyle(currentStatusId, currentStatusName ?? "");
  const isMovingFromEvaluationToReleased =
    currentStatusName === EVALUATION_STATUS_NAME && selected?.name === RELEASED_STATUS_NAME;
  const blocksForUnapprovedCompensation = isMovingFromEvaluationToReleased && !compApproved;

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Current status card */}
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Одоогийн статус
            </p>
            {!isLocked && availableStatuses.length > 0 && (
              <button
                onClick={openPicker}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Явц нэмэх
              </button>
            )}
          </div>
          <div className="px-5 py-4">
            {currentStatusName ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold"
                style={{ color: currentStyle.color, background: currentStyle.bg }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {currentStatusName}
              </span>
            ) : (
              <span className="text-[13px] text-slate-400">Уншиж байна...</span>
            )}
            {availableStatuses.length === 0 && currentStatusName && (
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                Боломжтой шилжилт байхгүй
              </p>
            )}
          </div>
        </div>

        {/* History timeline */}
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Явцын түүх
            </p>
          </div>

          {historyLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-[#252630]" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-8 w-8 text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-[13px] text-slate-400 dark:text-slate-500">
                Явцын түүх байхгүй
              </p>
            </div>
          ) : (
            <div className="p-5">
              <ol className="relative border-l-2 border-slate-100 dark:border-[#37394d] space-y-0">
                {history.map((h, idx) => {
                  const style = getParcelStatusStyle(h.status_id, h.status_name);
                  const isLatest = idx === 0;
                  return (
                    <li key={h.id} className="ml-5 pb-6 last:pb-0">
                      <span
                        className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#1e1f27]"
                        style={{
                          background: isLatest ? style.color : style.bg,
                          border: `2px solid ${style.color}`,
                        }}
                      >
                        {isLatest && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <div className="rounded-lg border border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20] px-4 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[12px] font-semibold"
                              style={{ color: style.color, background: style.bg }}
                            >
                              {h.status_name}
                            </span>
                            {isLatest && (
                              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[#02c0ce]/10 text-[#02c0ce]">
                                Одоогийн
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(h.status_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {h.created_by === "system" ? "Систем" : h.created_by}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Modal backdrop */}
      {modal !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Status picker */}
          {modal === "picking" && (
            <div className="w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
                <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                  Явц сонгох
                </p>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#2a2d3a] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 space-y-1.5">
                {availableStatuses.map((s) => {
                  const style = getParcelStatusStyle(s.id, s.name);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStatus(s)}
                      className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors group"
                    >
                      <span
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold"
                        style={{ color: style.color, background: style.bg }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: style.color }}
                        />
                        {s.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-[#37394d]">
                <button
                  onClick={closeModal}
                  className="w-full rounded-xl py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                >
                  Болих
                </button>
              </div>
            </div>
          )}

          {/* Confirmation dialog */}
          {modal === "confirming" && selected && (
            <div className="w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
                <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                  Баталгаажуулах
                </p>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#2a2d3a] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 mt-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 p-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Нэгж талбарын явцыг
                    {currentStatusName && (
                      <>
                        {" "}
                        <strong className="text-slate-800 dark:text-slate-100">{currentStatusName}</strong>
                        {" → "}
                      </>
                    )}{" "}
                    <strong className="text-slate-800 dark:text-slate-100">{selected.name}</strong>{" "}
                    болгох уу?
                  </p>
                </div>

                {(() => {
                  const style = getParcelStatusStyle(selected.id, selected.name);
                  return (
                    <div
                      className="rounded-xl px-4 py-3 flex items-center gap-2"
                      style={{ background: style.bg }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ background: style.color }}
                      />
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: style.color }}
                      >
                        {selected.name}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {blocksForUnapprovedCompensation && (
                <div className="mx-5 mb-4 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">
                    Нөхөх олговрын үнэлгээ хараахан <strong>баталгаажаагүй</strong> байна. Дараагийн явц руу шилжихийн өмнө
                    санхүүгийн мэргэжилтэн нөхөх олговрыг зөвшөөрч баталгаажуулах шаардлагатай.
                  </p>
                </div>
              )}

              {selected.name === RELEASED_STATUS_NAME && !hasApprovedReport && (
                <div className="mx-5 mb-4 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">
                    Нэгж талбарыг &ldquo;Чөлөөлсөн&rdquo; болгохын өмнө зөвшөөрөгдсөн нөхөн төлбөрт үнэлгээний тайлан хавсаргасан байх шаардлагатай.
                  </p>
                </div>
              )}

              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={handleBackToPicker}
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 rounded-xl py-2.5 text-[13px] font-medium border border-slate-200 dark:border-[#37394d] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors disabled:opacity-50"
                >
                  Буцах
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={
                    updateStatusMutation.isPending ||
                    blocksForUnapprovedCompensation ||
                    (selected.name === RELEASED_STATUS_NAME && !hasApprovedReport)
                  }
                  className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateStatusMutation.isPending ? "Хадгалж байна..." : "Тийм, хадгалах"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
