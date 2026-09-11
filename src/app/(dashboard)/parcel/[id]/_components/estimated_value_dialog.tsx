"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Calculator, Paperclip, X } from "lucide-react";
import type { ParcelFull } from "@/types";
import { formatArea } from "@/lib/utils";
import { calculateEstimatedValuation, feeArea, initialConfidencePercent } from "@/lib/estimated-valuation";

/**
 * ӨМЧЛӨХ эрхийн газарт (right_type=3) итгэлцүүр ХЭРЭГЛЭХГҮЙ: суурь үнэ нь
 * газрын зах зээлийн жишиг үнэ (₮/м²) бөгөөс өртсөн талбайгаар шууд
 * үржигдэнэ. Бусад эрхийн төрөл нь ЯГ ижил бодолттой боловч дуудлага
 * худалдааны анхны үнийн итгэлцүүрээр хувиргагдана.
 *
 * Backend ч эрхийн төрлөөр ижил дүрэм барьдаг (land_estimated_value.go) —
 * иймд цонхон дээрх урьдчилсан дүн хадгалагдсан дүнтэй таарна.
 */
const RIGHT_TYPE_OWNERSHIP = 3;

export function EstimatedValueDialog({ data, pending, onClose, onSave }: {
  data: ParcelFull;
  pending: boolean;
  onClose: () => void;
  /** confidencePercent: тоо = итгэлцүүртэй, undefined = итгэлцүүргүй (өмчлөл), null = арилгах */
  onSave: (confidencePercent: number | null | undefined, baseFeePerM2?: number, file?: File | null) => void;
}) {
  const fees = data.fees ?? [];
  const ownership = data.right_type === RIGHT_TYPE_OWNERSHIP;
  const [confidence, setConfidence] = useState(() => initialConfidencePercent(fees, data.estimated_confidence_percent));
  const [baseFee, setBaseFee] = useState(() => data.estimated_base_fee_per_m2?.toString() ?? "");
  // ХАВСРАЛТ — тооцооллыг гэрчлэх баримт (ЗААВАЛ БИШ). Хадгалах бүрд шинээр
  // сонгоно: өмнөх хавсралт нь ӨӨРЧЛӨЛТИЙН ТҮҮХЭН дээрээ үлдэнэ.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const manual = fees.length === 0;
  const percent = ownership ? null : Number(confidence);
  const baseFeePerM2 = Number(baseFee);
  const value = calculateEstimatedValuation(fees, data.acquisition_area_m2, percent, manual ? baseFeePerM2 : undefined);
  const invalidBaseFee = baseFee.trim() !== "" && (!Number.isFinite(baseFeePerM2) || baseFeePerM2 <= 0);
  const totalArea = fees.reduce((sum, fee) => sum + feeArea(fee), 0);
  const invalidConfidence = !ownership && confidence.trim() !== "" && !(Number(confidence) > 0);
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
          <form onSubmit={(event) => { event.preventDefault(); if (value != null && !pending && !fileError) onSave(percent ?? undefined, manual ? baseFeePerM2 : undefined, file); }}>
            <div className="space-y-4 px-5 py-4">
              <Dialog.Description className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {ownership
                  ? "Өмчлөх эрхийн газарт итгэлцүүр хэрэглэхгүй — газрын зах зээлийн жишиг үнийг нөлөөлөлд өртсөн талбайгаар үржүүлж тооцно."
                  : manual
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
                  {!ownership && <p className="flex justify-between gap-3"><span>Дуудлага худалдааны анхны үнийн итгэлцүүр</span><span className="shrink-0">{number(fee.confidence_percent)}%</span></p>}
                  <p className="flex justify-between gap-3"><span>Бүсийн талбай</span><span>{formatArea(feeArea(fee))}</span></p>
                  {fees.length > 1 && totalArea > 0 && (
                    <p className="flex justify-between gap-3"><span>Тооцоонд хуваарилсан талбай</span><span>{formatArea(data.acquisition_area_m2 * feeArea(fee) / totalArea)}</span></p>
                  )}
                </div>
              ))}
              {manual && (
                <div>
                  <label htmlFor="estimated-base-fee" className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">{ownership ? "Газрын зах зээлийн жишиг үнэ (₮/м²)" : "Суурь төлбөр (₮/м²)"}</label>
                  <input id="estimated-base-fee" type="number" step="any" required value={baseFee} disabled={pending} aria-invalid={invalidBaseFee} aria-describedby="base-fee-help" onChange={(e) => setBaseFee(e.target.value)} placeholder={ownership ? "Жишиг үнэ оруулах…" : "Суурь төлбөр оруулах…"} className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-[13px] text-slate-800 outline-none focus:border-[#02c0ce] disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-200" />
                  <p id="base-fee-help" className={`mt-1 text-[11px] ${invalidBaseFee ? "text-red-500" : "text-slate-400"}`}>Тэгээс их утга оруулна уу.</p>
                </div>
              )}
              {!(data.acquisition_area_m2 > 0) ? (
                <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">Нөлөөлөлд өртсөн талбайг эхлээд оруулна уу.</p>
              ) : fees.some((fee) => !(feeArea(fee) > 0) || !(fee.base_fee_per_m2 > 0)) ? (
                <p role="status" className="text-[12px] text-amber-700 dark:text-amber-400">Бүсийн суурь төлбөр эсвэл талбай дутуу байна. Газрын төлбөрийн бодолтыг шинэчилнэ үү.</p>
              ) : null}
              {/* Итгэлцүүр — ӨМЧЛӨХ эрхийн газарт ОГТ харагдахгүй (тэнд
                  хэрэглэгддэггүй тул хоосон талбар нь төөрөгдөл өгнө). */}
              {!ownership && (
                <div>
                  <label htmlFor="estimated-confidence" className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">Дуудлага худалдааны анхны үнийн итгэлцүүр (%)</label>
                  <input id="estimated-confidence" type="number" step="any" required value={confidence} disabled={pending} aria-invalid={invalidConfidence} aria-describedby="confidence-help" onChange={(e) => setConfidence(e.target.value)} placeholder="Итгэлцүүр оруулах…" className="h-9 w-full rounded-lg border border-slate-200 bg-transparent px-3 text-[13px] text-slate-800 outline-none focus:border-[#02c0ce] disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-200" />
                  <p id="confidence-help" className={`mt-1 text-[11px] ${invalidConfidence ? "text-red-500" : "text-slate-400"}`}>Тэгээс их утга оруулна уу.</p>
                </div>
              )}
              <div>
                <label htmlFor="estimated-file" className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  Хавсралт (заавал биш)
                </label>
                <input
                  id="estimated-file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  disabled={pending}
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    // 50MB — backend-ийн хязгаартай ижил (илүүг сервер хаяна).
                    if (picked && picked.size > 50 * 1024 * 1024) {
                      setFile(null);
                      setFileError("Файл 50MB-аас их байна.");
                      e.target.value = "";
                      return;
                    }
                    setFileError("");
                    setFile(picked);
                  }}
                  className="block w-full text-[12px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#02c0ce]/10 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-[#02c0ce] hover:file:bg-[#02c0ce]/20 disabled:opacity-50 dark:text-slate-300"
                />
                <p className={`mt-1 text-[11px] ${fileError ? "text-red-500" : "text-slate-400"}`}>
                  {fileError || "PDF эсвэл зураг (JPEG/PNG). Жишиг үнийн лавлагаа, судалгаа хавсаргана."}
                </p>
                {file && (
                  <p className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-[#02c0ce]">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-[#02c0ce]/25 bg-[#02c0ce]/[0.07] p-3">
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Төсөөллийн үнэлгээ</p>
                <p aria-live="polite" className="mt-1 text-lg font-bold tabular-nums text-[#02c0ce]">{value != null ? `${number(value)}₮` : "—"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{ownership ? "Газрын зах зээлийн жишиг үнийг бүхэл төгрөгөөр тоймлож, нөлөөлөлд өртсөн талбайгаар үржүүлнэ (итгэлцүүр хэрэглэхгүй)." : "Суурь төлбөр × 100 ÷ итгэлцүүрийг бүхэл төгрөгөөр тоймлож, нөлөөлөлд өртсөн талбайгаар үржүүлнэ."}</p>
                {fees.length > 1 && <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Өртсөн талбайг бүсүүдийн бүртгэлтэй талбайн харьцаагаар хуваарилж, дүнг нэгтгэнэ.</p>}
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Хадгалсан өөрчлөлт бүр хавсралттайгаа түүхэнд бүртгэгдэнэ — “Дэлгэрэнгүй” товчоор харна.</p>
              </div>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              {data.estimated_value != null ? <button type="button" disabled={pending} onClick={() => onSave(null)} className="rounded-lg px-3 text-[13px] font-semibold text-[#f1556c] disabled:opacity-50">Арилгах</button> : <span />}
              <div className="flex gap-2">
                <Dialog.Close asChild><button type="button" disabled={pending} className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] text-slate-600 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300">Болих</button></Dialog.Close>
                <button type="submit" disabled={pending || value == null || !!fileError} className="h-9 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : "Хадгалах"}</button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
