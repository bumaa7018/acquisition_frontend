"use client";

import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Clock, History, Paperclip, Trash2, X } from "lucide-react";
import { landApi } from "@/lib/api";
import { formatArea, formatDate } from "@/lib/utils";

/**
 * ТӨСӨӨЛЛИЙН ҮНЭЛГЭЭНИЙ ӨӨРЧЛӨЛТИЙН ТҮҮХ.
 *
 * `parcel` дээр зөвхөн ХАМГИЙН СҮҮЛИЙН утга хадгалагддаг тул "хэн, хэзээ, ямар
 * итгэлцүүр/жишиг үнээр тооцсон" гэдгийг ЗӨВХӨН эндээс уншина. Мөр тус бүр нь
 * тухайн үеийн хавсралттайгаа (жишиг үнийн лавлагаа г.м.) хамт харагдана —
 * дараагийн тооцоолол хавсралтыг дарж бичихгүй.
 *
 * Дуудлага нь цонх нээгдэхэд Л явна (enabled) — товч дарахгүй бол ачаалал алга.
 */
export function EstimatedValueHistoryDialog({
  acquisitionId,
  parcelUuid,
  onClose,
}: {
  acquisitionId: string;
  /** parcel.id (UUID) */
  parcelUuid: string;
  onClose: () => void;
}) {
  const enabled = !!acquisitionId && !!parcelUuid;
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["parcel-estimated-value-history", acquisitionId, parcelUuid],
    queryFn: () => landApi.listParcelEstimatedValueHistory(acquisitionId, parcelUuid),
    enabled,
    retry: false,
  });

  const money = (v: number) => `${Math.round(v).toLocaleString("mn-MN")}₮`;
  const number = (v: number) => v.toLocaleString("mn-MN", { maximumFractionDigits: 8 });

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
            <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold text-slate-800 dark:text-white">
              <History className="h-5 w-5 text-[#02c0ce]" />Төсөөллийн үнэлгээний түүх
            </Dialog.Title>
            <Dialog.Close aria-label="Хаах" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200/60 dark:bg-white/10" />
                ))}
              </div>
            ) : isError ? (
              <p role="status" className="py-8 text-center text-[13px] text-slate-500">
                Түүхийг ачаалж чадсангүй.
              </p>
            ) : rows.length === 0 ? (
              <p role="status" className="py-8 text-center text-[13px] text-slate-500">
                Төсөөллийн үнэлгээ хараахан тооцоогүй байна.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((h, idx) => (
                  <div
                    key={h.id}
                    className="rounded-lg bg-slate-50 p-3 dark:bg-[#252630]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {/* value=null → тэр үйлдлээр үнэлгээ АРИЛГАГДСАН. */}
                      {h.value != null ? (
                        <span className="text-[14px] font-bold tabular-nums text-[#02c0ce]">{money(h.value)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#f1556c]">
                          <Trash2 className="h-3.5 w-3.5" />Арилгасан
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="rounded-md bg-[#02c0ce]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#02c0ce]">
                          Одоогийн
                        </span>
                      )}
                    </div>

                    {h.value != null && (
                      <div className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-600 dark:text-slate-300">
                        {/* Итгэлцүүргүй = ӨМЧЛӨХ эрхийн газар (жишиг үнэ × талбай). */}
                        <p className="flex justify-between gap-3">
                          <span>Итгэлцүүр</span>
                          <span className="tabular-nums">
                            {h.confidence_percent != null ? `${number(h.confidence_percent)}%` : "хэрэглээгүй (өмчлөл)"}
                          </span>
                        </p>
                        {h.base_fee_per_m2 != null && (
                          <p className="flex justify-between gap-3">
                            <span>{h.confidence_percent != null ? "Суурь төлбөр /м²/" : "Зах зээлийн жишиг үнэ /м²/"}</span>
                            <span className="tabular-nums">{number(h.base_fee_per_m2)}₮</span>
                          </p>
                        )}
                        {h.area_m2 > 0 && (
                          <p className="flex justify-between gap-3">
                            <span>Нөлөөлөлд өртсөн талбай</span>
                            <span className="tabular-nums">{formatArea(h.area_m2)}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {h.attachment_url && (
                      <a
                        href={h.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#02c0ce] ring-1 ring-slate-200 hover:bg-[#02c0ce]/5 dark:bg-[#1e1f27] dark:ring-white/[0.08]"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{h.attachment_name || "Хавсралт"}</span>
                      </a>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {h.created_at ? formatDate(h.created_at) : "—"}
                      </span>
                      {h.created_by && <span className="truncate">{h.created_by}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
