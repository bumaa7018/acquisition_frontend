"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FileSpreadsheet, Loader2, X } from "lucide-react";
import type { ParcelFull } from "@/types";
import {
  computePaymentPerformance,
  PAYMENT_PERFORMANCE_STAGES,
  suggestedStage,
  type PaymentPerformanceStage,
} from "@/lib/payment-performance";

const money = (v: number) => `${Math.round(v).toLocaleString("mn-MN")}₮`;

/**
 * «Төлбөрийн гүйцэтгэл» татахын өмнө гүйцэтгэлийн хувийг (60% / 40% / 100%) сонгоно.
 * Урьд авсан санхүүжилт нь нэгж талбарын ХАДГАЛСАН олголтын гүйцэтгэлээс
 * («Нөхөх олговор олгосон баримт» — 60% / 40% / бүрэн).
 */
export function PaymentPerformanceDialog({
  parcel,
  totals,
  onDownload,
  onClose,
}: {
  parcel?: ParcelFull;
  /** Нийт үнэлгээ — сонгосон урсгалын баталгаажсан нөхөх олговор (ангиллаар) */
  totals: { land: number; realEstate: number; property: number };
  onDownload: (stage: PaymentPerformanceStage) => Promise<void>;
  onClose: () => void;
}) {
  const paid = {
    paid60: !!parcel?.compensation_paid_60,
    paid40: !!parcel?.compensation_paid_40,
    paidFull: !!parcel?.compensation_paid_full,
  };
  const [stage, setStage] = useState<PaymentPerformanceStage>(suggestedStage(paid.paid60, paid.paid40));
  const [pending, setPending] = useState(false);
  const p = computePaymentPerformance({ ...totals, ...paid, stage });
  const paidStages = [
    paid.paidFull && `Бүрэн 100% (${parcel?.compensation_paid_full_at ?? "—"})`,
    paid.paid60 && `60% (${parcel?.compensation_paid_60_at ?? "—"})`,
    paid.paid40 && `40% (${parcel?.compensation_paid_40_at ?? "—"})`,
  ].filter(Boolean);

  const submit = async () => {
    setPending(true);
    try {
      await onDownload(stage);
      onClose();
    } catch {
      // Алдааг дуудагч (toast) мэдэгдэнэ — цонх нээлттэй үлдэж дахин оролдоно.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
            <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold text-slate-800 dark:text-white">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />Төлбөрийн гүйцэтгэл
            </Dialog.Title>
            <Dialog.Close disabled={pending} aria-label="Хаах" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="space-y-4 px-5 py-4">
            <Dialog.Description className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
              Гүйцэтгэлийн хувийг сонгоно — нийт үнэлгээг энэ хувиар бодож файлд бичнэ. Урьд авсан санхүүжилтийг
              нэгж талбарт бүртгэсэн олголтын гүйцэтгэлээс тооцно.
            </Dialog.Description>

            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">Гүйцэтгэлийн хувь</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_PERFORMANCE_STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => setStage(s)}
                    className={`h-10 rounded-lg border text-[14px] font-semibold transition-colors ${
                      stage === s
                        ? "border-[#02c0ce] bg-[#02c0ce] text-white"
                        : "border-slate-200 text-slate-600 hover:border-[#02c0ce] dark:border-white/[0.08] dark:text-slate-300"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Олгосон: {paidStages.length > 0 ? paidStages.join(", ") : "бүртгэгдээгүй"}
            </p>

            <div className="space-y-1.5 rounded-lg border border-[#02c0ce]/25 bg-[#02c0ce]/[0.07] p-3 text-[12.5px] text-slate-600 dark:text-slate-300">
              <p className="flex justify-between gap-3"><span>Нийт үнэлгээ (төсөвт өртөг)</span><strong className="tabular-nums">{money(p.total.budget)}</strong></p>
              <p className="flex justify-between gap-3"><span>Урьд авсан санхүүжилт ({Math.round(p.priorPct * 100)}%)</span><span className="tabular-nums">{money(p.total.prior)}</span></p>
              <p className="flex justify-between gap-3"><span>Тайлант үеийн гүйцэтгэл ({stage}%)</span><strong className="tabular-nums text-[#02a3af] dark:text-[#3fd4df]">{money(p.total.current)}</strong></p>
              <p className="flex justify-between gap-3"><span>Үлдэгдэл санхүүжилт ({Math.round(p.remainingPct * 100)}%)</span><span className="tabular-nums">{money(p.total.remaining)}</span></p>
            </div>
            {p.total.budget === 0 && (
              <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">
                Баталгаажсан нөхөх олговор бүртгэгдээгүй тул дүн 0 байна.
              </p>
            )}
            {(stage === 60 && paid.paid60) || (stage === 40 && paid.paid40) || (stage === 100 && (paid.paid60 || paid.paid40)) || paid.paidFull ? (
              <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">
                Энэ шатны олговор аль хэдийн олгогдсон гэж бүртгэгдсэн байна.
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-[#37394d]">
            <button type="button" onClick={onClose} disabled={pending}
              className="h-9 rounded-lg px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-[#252630]">
              Болих
            </button>
            <button type="button" onClick={() => void submit()} disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-[13px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Татах
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
