"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelApi, landApi } from "@/lib/api";
import { documentAcceptFor } from "@/lib/document-types";
import { COMPENSATION_RECEIPT_TYPE, PAYMENT_STAGE_OPTIONS, todayISO } from "@/lib/payment-stage";
import type { DocumentPaymentInput } from "@/lib/api";
import { getApiError, formatDate } from "@/lib/utils";
import { useParcelStatusStyle } from "@/lib/use-parcel-status-style";
import { Plus, Clock, User, CheckCircle2, X, ChevronRight, AlertCircle, Paperclip, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ParcelStatus } from "@/types";

type ModalState = "closed" | "picking" | "confirming";
const EVALUATION_STATUS_NAME = "Үнэлгээ хийх";
const RELEASED_STATUS_NAME = "Чөлөөлсөн";

export function ProgressTab({ acqId, parcelId, isLocked = false, beforeFieldStage = false }: {
  acqId: string;
  parcelId: string;
  isLocked?: boolean;
  /** Чөлөөлөлт "Шинэ" төлөвт — явц солих боломжгүй (backend ч хаана). */
  beforeFieldStage?: boolean;
}) {
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
  // «Чөлөөлсөн» болгох нөхцөл — backend-ийн UpdateParcelStatus шалгалттай ижил:
  // сонгосон урсгалд зөвшөөрөгдсөн олговортой байх. Үнэлгээний ТАЙЛАН нь
  // «Нэгж ажлын урсгал»-ын заавал хавсралтаар (доорх requirements) шалгагдана.
  const hasApprovedComp = parcelComps.some((c) => c.status === "approved");

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

  // Төлөв солих ШАЛТГААН — "Нөлөөлөгдсөн гарсан"/"Татгалзсан" үед заавал
  // (backend ч мөн 400 буцаана), бусад төлөвт хоосон байж болно. Газрын
  // зургийн нэгж талбарын цонхонд энэ шалтгаан харагдана.
  const [statusReason, setStatusReason] = useState("");
  // ХАВСРАЛТ — "Татгалзсан" төлөвт ЗААВАЛ (backend ч 422 буцаана). Файл нь
  // нэгж талбарын БАРИМТ болж бүртгэгдээд "Хавсралт" хэсэгт харагдана, мөн
  // явцын түүхэн дээр холбоосоороо гарна.
  const [statusFile, setStatusFile] = useState<File | null>(null);
  // Хавсралтын ХАРАГДАХ нэр — файл сонгоход файлын нэрээр САНАЛ БОЛГОНО,
  // хэрэглэгч засаж болно ("2024-05-12 иргэний өргөдөл" г.м.). Физик файл нь
  // анхны нэрээрээ хадгалагдана — зөвхөн жагсаалт/түүхэнд харагдах нэр өөрчлөгдөнө.
  const [statusFileName, setStatusFileName] = useState("");
  const [fileError, setFileError] = useState("");

  // ЗААВАЛ ХАВСРАЛТ — «Нэгж ажлын урсгал»-д тухайн явцад тохируулсан
  // хавсралтын төрөл бүр нэгж талбарт байх ёстой (backend ч 422 буцаана).
  // Орсон бол ногоон, байхгүй бол эндээс шууд нэгж талбарын баримт болгон оруулна.
  const requirementsKey = ["parcel-status-requirements", acqId, parcelId, selected?.id];
  const { data: requirements = [], isFetching: requirementsLoading, isError: requirementsError } = useQuery({
    queryKey: requirementsKey,
    queryFn: () => parcelApi.getStatusRequirements(acqId, parcelId, selected!.id),
    enabled: modal === "confirming" && !!selected,
  });
  const missingRequirements = requirements.filter((r) => !r.present);
  const [uploadingType, setUploadingType] = useState<number | null>(null);
  // «Нөхөх олговор олгосон баримт» — олголтын шат ба огноо (хавсралтын табтай ижил).
  const [receiptStage, setReceiptStage] = useState<DocumentPaymentInput["stage"] | "">("");
  const [receiptDate, setReceiptDate] = useState(todayISO());
  async function uploadRequirement(documentTypeId: number, typeCode: string, file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Файл 20MB-аас их байна.");
      return;
    }
    const isReceipt = typeCode === COMPENSATION_RECEIPT_TYPE;
    if (isReceipt && (!receiptStage || !receiptDate)) {
      toast.error("Олговрын олголтын шат (60%, 40%, бүрэн) ба огноог сонгоно уу");
      return;
    }
    setUploadingType(documentTypeId);
    try {
      await parcelApi.uploadDocument(parcelId, file, documentTypeId, undefined,
        isReceipt && receiptStage ? { stage: receiptStage, date: receiptDate } : undefined);
      toast.success("Хавсралт орлоо");
      await queryClient.invalidateQueries({ queryKey: requirementsKey });
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
      if (isReceipt) {
        // Олголтын гүйцэтгэл нэгж талбарт хадгалагддаг — жагсаалт, дэлгэрэнгүйг шинэчилнэ.
        queryClient.invalidateQueries({ queryKey: ["parcel-full"] });
        queryClient.invalidateQueries({ queryKey: ["land-parcels"] });
        queryClient.invalidateQueries({ queryKey: ["global-parcels"] });
      }
    } catch (err) {
      toast.error(getApiError(err, "Хавсралт оруулахад алдаа гарлаа"));
    } finally {
      setUploadingType(null);
    }
  }
  const updateStatusMutation = useMutation({
    mutationFn: (statusId: number) => parcelApi.updateStatus(acqId, parcelId, statusId, statusReason.trim(), statusFile, statusFileName),
    onSuccess: () => {
      toast.success("Статус амжилттай шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
      queryClient.invalidateQueries({ queryKey: ["parcel-available-statuses", acqId, parcelId] });
      queryClient.invalidateQueries({ queryKey: ["parcel-status-history", acqId, parcelId] });
      // Хавсралт нь баримт болж нэмэгдсэн тул "Хавсралт" хэсгийг ч шинэчилнэ.
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
      queryClient.invalidateQueries({ queryKey: ["parcel-status-requirements", acqId, parcelId] });
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
    setStatusReason("");
    setStatusFile(null);
    setStatusFileName("");
    setFileError("");
    setReceiptStage("");
    setReceiptDate(todayISO());
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

  // Төлөвийн өнгө нь `parcel_status` БҮРТГЭЛЭЭС. Хатуу хүснэгтэд зөвхөн
  // анхны 6 төлөв байдаг тул шинэ төлөв саарлаар харагддаг байв.
  const statusStyle = useParcelStatusStyle();

  const currentStatusId = parcelFull?.status_id ?? parcelFull?.status;
  const currentStatusName = parcelFull?.status_name;
  const currentStyle = statusStyle(currentStatusId, currentStatusName);
  const isMovingFromEvaluationToReleased =
    currentStatusName === EVALUATION_STATUS_NAME && selected?.name === RELEASED_STATUS_NAME;
  const blocksForUnapprovedCompensation = isMovingFromEvaluationToReleased && !compApproved;
  // Эцсийн СӨРӨГ хоёр төлөвт шалтгаан заавал.
  const reasonRequired =
    selected?.name === "Нөлөөлөгдсөн гарсан" || selected?.name === "Татгалзсан";
  const reasonMissing = reasonRequired && !statusReason.trim();
  const requirementsBlocking = requirementsLoading || requirementsError || missingRequirements.length > 0;

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Current status card */}
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Одоогийн статус
            </p>
            {!isLocked && !beforeFieldStage && availableStatuses.length > 0 && (
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
            {beforeFieldStage ? (
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Чөлөөлөлт &ldquo;Шинэ&rdquo; төлөвт байна. Нэгж талбарын бүрдэл дуусч
                &ldquo;Хээрийн судалгаа&rdquo; болсны дараа явц солино.
              </p>
            ) : availableStatuses.length === 0 && currentStatusName ? (
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                Боломжтой шилжилт байхгүй
              </p>
            ) : null}
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
                  const style = statusStyle(h.status_id, h.status_name);
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
                        {/* ШАЛТГААН ба ХАВСРАЛТ — татгалзсан/нөлөөлөгдсөн гарсан
                            шилжилтийг дараа нь тайлбарлах цорын ганц мөр. */}
                        {h.reason && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-[12px] text-slate-600 dark:text-slate-300">
                            {h.reason}
                          </p>
                        )}
                        {h.attachment_url && (
                          <a
                            href={h.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#02c0ce] ring-1 ring-slate-200 hover:bg-[#02c0ce]/5 dark:bg-[#1e1f27] dark:ring-white/[0.08]"
                          >
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <span className="truncate">{h.attachment_name || "Хавсралт"}</span>
                          </a>
                        )}
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
                  const style = statusStyle(s.id, s.name);
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
                  const style = statusStyle(selected.id, selected.name);
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

              {/* ШАЛТГААН — сөрөг эцсийн 2 төлөвт заавал, бусдад заавал бус */}
              <div className="px-5 pb-4">
                <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Шалтгаан {reasonRequired && <span className="text-red-400">*</span>}
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  rows={2}
                  placeholder={
                    reasonRequired
                      ? "Шалтгааныг бичнэ үү (заавал)"
                      : "Шалтгаан (заавал биш)"
                  }
                  className={`w-full resize-none rounded-xl border px-3 py-2 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${
                    reasonMissing
                      ? "border-red-400 bg-red-50/30"
                      : "border-slate-200 dark:border-[#37394d] bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15"
                  }`}
                />
                {reasonMissing && (
                  <p className="mt-1 text-[11px] text-red-400">
                    Энэ төлөвт шилжихэд шалтгаан бичих шаардлагатай
                  </p>
                )}
              </div>

              {/* ЗААВАЛ ХАВСРАЛТ — «Нэгж ажлын урсгал»-ын тохиргоогоор */}
              {requirementsError && (
                <p className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800/40 dark:bg-red-900/15 dark:text-red-400">
                  Заавал хавсралтыг шалгаж чадсангүй — цонхоо хаагаад дахин оролдоно уу.
                </p>
              )}
              {(requirementsLoading || requirements.length > 0) && (
                <div className="px-5 pb-4">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Заавал хавсралт <span className="text-red-400">*</span>
                  </label>
                  {requirementsLoading && requirements.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Шалгаж байна...
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {requirements.map((r) =>
                        r.present ? (
                          <div
                            key={r.document_type_id}
                            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">{r.document_type_name}</p>
                              {r.document_url ? (
                                <a href={r.document_url} target="_blank" rel="noreferrer"
                                  className="block truncate text-[11px] text-emerald-700/80 underline-offset-2 hover:underline dark:text-emerald-300/80">
                                  {r.document_name || "Орсон"}
                                </a>
                              ) : (
                                <p className="truncate text-[11px] text-emerald-700/80 dark:text-emerald-300/80">{r.document_name || "Орсон"}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={r.document_type_id}
                            className="rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 dark:border-red-800/40 dark:bg-red-900/15"
                          >
                            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {r.document_type_name}
                            </p>
                            {r.document_type_code === COMPENSATION_RECEIPT_TYPE && (
                              <div className="mt-1.5 space-y-1.5">
                                <div className="grid grid-cols-3 gap-1.5">
                                  {PAYMENT_STAGE_OPTIONS.map((o) => (
                                    <button
                                      key={o.value}
                                      type="button"
                                      onClick={() => setReceiptStage(o.value)}
                                      className={`h-8 rounded-lg border text-[12px] font-semibold transition-colors ${
                                        receiptStage === o.value
                                          ? "border-[#02c0ce] bg-[#02c0ce] text-white"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#252630] dark:text-slate-300"
                                      }`}
                                    >
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                                <label className="flex items-center gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                                  Олгосон огноо
                                  <input
                                    type="date"
                                    value={receiptDate}
                                    max={todayISO()}
                                    onChange={(e) => setReceiptDate(e.target.value)}
                                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#252630] dark:text-slate-200"
                                  />
                                </label>
                              </div>
                            )}
                            <label
                              className={`mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#02c0ce]/10 px-3 py-1.5 text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/20 ${
                                uploadingType !== null ||
                                (r.document_type_code === COMPENSATION_RECEIPT_TYPE && !receiptStage)
                                  ? "pointer-events-none opacity-50"
                                  : ""
                              }`}
                            >
                              {uploadingType === r.document_type_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {uploadingType === r.document_type_id ? "Оруулж байна..." : "Хавсралт оруулах"}
                              <input
                                type="file"
                                className="hidden"
                                accept={documentAcceptFor(r.document_type_code)}
                                disabled={uploadingType !== null}
                                onChange={(e) => {
                                  const picked = e.target.files?.[0];
                                  e.target.value = "";
                                  if (picked) void uploadRequirement(r.document_type_id, r.document_type_code, picked);
                                }}
                              />
                            </label>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ХАВСРАЛТ — заавал бус (заавал хавсралтыг дээрх хэсгээс оруулна) */}
              <div className="px-5 pb-4">
                <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Хавсралт
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    // 20MB — backend-ийн хязгаартай ижил.
                    if (picked && picked.size > 20 * 1024 * 1024) {
                      setStatusFile(null);
                      setStatusFileName("");
                      setFileError("Файл 20MB-аас их байна.");
                      e.target.value = "";
                      return;
                    }
                    setFileError("");
                    setStatusFile(picked);
                    // Нэрийг САНАЛ БОЛГОНО — хэрэглэгч гараас засна.
                    setStatusFileName(picked?.name ?? "");
                  }}
                  className="block w-full text-[12px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#02c0ce]/10 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-[#02c0ce] hover:file:bg-[#02c0ce]/20 dark:text-slate-300"
                />
                {statusFile && (
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Хавсралтын нэр
                    </label>
                    <input
                      type="text"
                      value={statusFileName}
                      onChange={(e) => setStatusFileName(e.target.value)}
                      placeholder={statusFile.name}
                      className="h-9 w-full rounded-xl border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                    />
                    <p className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-slate-400">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{statusFile.name}</span>
                    </p>
                  </div>
                )}
                <p className={`mt-1 text-[11px] ${fileError ? "text-red-400" : "text-slate-400"}`}>
                  {fileError || "PDF. Хавсралт нь нэгж талбарын баримт болж бүртгэгдэнэ."}
                </p>
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

              {selected.name === RELEASED_STATUS_NAME && !hasApprovedComp && (
                <div className="mx-5 mb-4 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15 px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">
                    Нэгж талбарыг &ldquo;Чөлөөлсөн&rdquo; болгохын өмнө нөхөн төлбөр зөвшөөрөгдсөн байх шаардлагатай.
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
                    reasonMissing ||
                    requirementsBlocking ||
                    uploadingType !== null ||
                    !!fileError ||
                    blocksForUnapprovedCompensation ||
                    (selected.name === RELEASED_STATUS_NAME && !hasApprovedComp)
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
