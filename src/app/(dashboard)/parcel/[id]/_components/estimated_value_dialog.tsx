"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { ParcelFull } from "@/types";
import { formatArea } from "@/lib/utils";
import { calculateEstimatedValuation, feeArea, initialConfidencePercent } from "@/lib/estimated-valuation";

export function EstimatedValueDialog({ data, pending, onClose, onSave }: {
  data: ParcelFull;
  pending: boolean;
  onClose: () => void;
  onSave: (confidencePercent: number | null, baseFeePerM2?: number) => void;
}) {
  const fees = data.fees ?? [];
  const [confidence, setConfidence] = useState(() => initialConfidencePercent(fees, data.estimated_confidence_percent));
  const [baseFee, setBaseFee] = useState(() => data.estimated_base_fee_per_m2?.toString() ?? "");
  const manual = fees.length === 0;
  const percent = Number(confidence);
  const baseFeePerM2 = Number(baseFee);
  const value = calculateEstimatedValuation(fees, data.acquisition_area_m2, percent, manual ? baseFeePerM2 : undefined);
  const invalidBaseFee = baseFee.trim() !== "" && (!Number.isFinite(baseFeePerM2) || baseFeePerM2 <= 0);
  const totalArea = fees.reduce((sum, fee) => sum + feeArea(fee), 0);
  const invalidConfidence = confidence.trim() !== "" && (!Number.isFinite(percent) || percent <= 0);
  const number = (v: number) => v.toLocaleString("mn-MN", { maximumFractionDigits: 8 });

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
            <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold text-slate-800 dark:text-white">
              <Calculator className="h-5 w-5 text-[#02c0ce]" />Төсөөллийн үнэлгээ
            </Dialog.Title>
            <Dialog.Close disabled={pending} aria-label="Хаах" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); if (value != null && !pending) onSave(percent, manual ? baseFeePerM2 : undefined); }}>
            <div className="space-y-4 px-5 py-4">
              <Dialog.Description className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {manual
                  ? "Суурь төлбөр болон дуудлага худалдааны анхны үнийн итгэлцүүрийг оруулж урьдчилсан үнэлгээг тооцно."
                  : "Дуудлага худалдааны анхны үнийн итгэлцүүрийг өөрчилж урьдчилсан үнэлгээг тохируулна. Ижил итгэлцүүрийг бүх төлбөрийн бүсэд хэрэглэнэ."}
              </Dialog.Description>
              <div className="flex flex-wrap justify-between gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                <span>Нөлөөлөлд өртсөн талбай</span>
                <strong className="tabular-nums">{formatArea(data.acquisition_area_m2)}</strong>
              </div>
              {fees.map((fee, index) => (
                <div key={index} className="space-y-1 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-600 dark:bg-[#252630] dark:text-slate-300">
                  <p className="font-semibold">{fee.zone_name || fee.zone_no || `Бүс ${index + 1}`}</p>
                  <p className="flex justify-between gap-3"><span>Суурь төлбөр /м²/</span><span>{number(fee.base_fee_per_m2)}₮</span></p>
                  <p className="flex justify-between gap-3"><span>Дуудлага худалдааны анхны үнийн итгэлцүүр</span><span className="shrink-0">{number(fee.confidence_percent)}%</span></p>
                  <p className="flex justify-between gap-3"><span>Бүсийн талбай</span><span>{formatArea(feeArea(fee))}</span></p>
                  {fees.length > 1 && totalArea > 0 && (
                    <p className="flex justify-between gap-3"><span>Тооцоонд хуваарилсан талбай</span><span>{formatArea(data.acquisition_area_m2 * feeArea(fee) / totalArea)}</span></p>
                  )}
                </div>
              ))}
              {manual && (
                <div>
                  <label htmlFor="estimated-base-fee" className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">Суурь төлбөр (₮/м²)</label>
                  <input id="estimated-base-fee" type="number" step="any" required value={baseFee} disabled={pending} aria-invalid={invalidBaseFee} aria-describedby="base-fee-help" onChange={(e) => setBaseFee(e.target.value)} placeholder="Суурь төлбөр оруулах…" className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-[13px] text-slate-800 outline-none focus:border-[#02c0ce] disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-200" />
                  <p id="base-fee-help" className={`mt-1 text-[11px] ${invalidBaseFee ? "text-red-500" : "text-slate-400"}`}>Тэгээс их утга оруулна уу.</p>
                </div>
              )}
              {!(data.acquisition_area_m2 > 0) ? (
                <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">Нөлөөлөлд өртсөн талбайг эхлээд оруулна уу.</p>
              ) : fees.some((fee) => !(feeArea(fee) > 0) || !(fee.base_fee_per_m2 > 0)) ? (
                <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">Бүсийн суурь төлбөр эсвэл талбай дутуу байна. Газрын төлбөрийн бодолтыг шинэчилнэ үү.</p>
              ) : null}
              <div>
                <label htmlFor="estimated-confidence" className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">Дуудлага худалдааны анхны үнийн итгэлцүүр (%)</label>
                <input id="estimated-confidence" type="number" step="any" required value={confidence} disabled={pending} aria-invalid={invalidConfidence} aria-describedby="confidence-help" onChange={(e) => setConfidence(e.target.value)} placeholder="Итгэлцүүр оруулах…" className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-[13px] text-slate-800 outline-none focus:border-[#02c0ce] disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-200" />
                <p id="confidence-help" className={`mt-1 text-[11px] ${invalidConfidence ? "text-red-500" : "text-slate-400"}`}>Тэгээс их утга оруулна уу.</p>
              </div>
              <div className="rounded-lg border border-[#02c0ce]/25 bg-[#02c0ce]/[0.07] p-3">
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Төсөөллийн үнэлгээ</p>
                <p aria-live="polite" className="mt-1 text-lg font-bold tabular-nums text-[#02c0ce]">{value != null ? `${number(value)}₮` : "—"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Суурь төлбөр × 100 ÷ итгэлцүүрийг бүхэл төгрөгөөр тоймлож, нөлөөлөлд өртсөн талбайгаар үржүүлнэ.</p>
                {fees.length > 1 && <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Өртсөн талбайг бүсүүдийн бүртгэлтэй талбайн харьцаагаар хуваарилж, дүнг нэгтгэнэ.</p>}
              </div>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              {data.estimated_value != null ? <button type="button" disabled={pending} onClick={() => onSave(null)} className="rounded-lg px-3 text-[13px] font-semibold text-[#f1556c] disabled:opacity-50">Арилгах</button> : <span />}
              <div className="flex gap-2">
                <Dialog.Close asChild><button type="button" disabled={pending} className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] text-slate-600 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300">Болих</button></Dialog.Close>
                <button type="submit" disabled={pending || value == null} className="h-9 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : "Хадгалах"}</button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
