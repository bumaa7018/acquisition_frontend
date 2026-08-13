"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { decisionDraftApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import {
  DECISION_DRAFT_PROGRESS_CONFIRMING,
  DECISION_DRAFT_PROGRESS_REVIEWING,
} from "@/types";

/**
 * "Захирамжийн явц нэмэх" — захирамжийн дугаар болон огноог бөглөж төслийг
 * баталгаажуулна. Баталгаажсаны дараа засвар, нэгж талбар холбох/хасах бүгд
 * хаагдана (backend: domain.ErrDecisionConfirmed).
 */
export function ConfirmDecisionDialog({
  draftId,
  onClose,
  onConfirmed,
}: {
  draftId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [mode, setMode] = useState<"reviewing" | "confirming">("reviewing");
  const [recipient, setRecipient] = useState("");
  const [progressDate, setProgressDate] = useState("");
  const [note, setNote] = useState("");
  const [decreeNumber, setDecreeNumber] = useState("");
  const [decisionDate, setDecisionDate] = useState("");

  const addProgress = useMutation({
    mutationFn: () =>
      decisionDraftApi.addProgress(draftId, {
        progress_type: DECISION_DRAFT_PROGRESS_REVIEWING,
        recipient: recipient.trim(),
        progress_date: progressDate,
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.success("Явц хадгалагдлаа");
      onConfirmed();
    },
    onError: (err) => toast.error(getApiError(err, "Явц хадгалахад алдаа гарлаа")),
  });

  const confirm = useMutation({
    mutationFn: () =>
      decisionDraftApi.confirm(draftId, {
        decree_number: decreeNumber.trim(),
        decision_date: decisionDate,
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.success("Захирамж баталгаажлаа");
      onConfirmed();
    },
    onError: (err) => toast.error(getApiError(err, "Баталгаажуулахад алдаа гарлаа")),
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const lbl = "text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block";
  const pending = addProgress.isPending || confirm.isPending;

  const isReviewing = mode === DECISION_DRAFT_PROGRESS_REVIEWING;
  const isValid = isReviewing
    ? recipient.trim() !== "" && progressDate !== ""
    : decreeNumber.trim() !== "" && decisionDate !== "";

  function handleSave() {
    if (isReviewing) {
      addProgress.mutate();
    } else {
      confirm.mutate();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">
            Захирамжийн явц нэмэх
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-[#252630]">
            <button
              type="button"
              onClick={() => setMode(DECISION_DRAFT_PROGRESS_REVIEWING)}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors ${
                isReviewing
                  ? "bg-white text-[#02c0ce] shadow-sm dark:bg-[#1e1f27]"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              Хянагдаж буй
            </button>
            <button
              type="button"
              onClick={() => setMode(DECISION_DRAFT_PROGRESS_CONFIRMING)}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors ${
                !isReviewing
                  ? "bg-white text-[#0acf97] shadow-sm dark:bg-[#1e1f27]"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Баталгаажуулах
            </button>
          </div>

          {isReviewing ? (
            <>
              <div>
                <label className={lbl}>Хэнд *</label>
                <input
                  autoFocus
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Хянагч, хэлтэс, байгууллага"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Огноо *</label>
                <input
                  type="date"
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Тайлбар</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Тайлбар"
                  className={`${inp} h-auto min-h-20 py-2 resize-y`}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={lbl}>Захирамжийн дугаар *</label>
                <input
                  autoFocus
                  value={decreeNumber}
                  onChange={(e) => setDecreeNumber(e.target.value)}
                  placeholder="жишээ: А/123"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Захирамжийн огноо *</label>
                <input
                  type="date"
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Тайлбар</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Тайлбар"
                  className={`${inp} h-auto min-h-20 py-2 resize-y`}
                />
              </div>

              <div className="flex gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/25 px-3.5 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Баталгаажсан захирамжийн төсөлд өөрчлөлт орохгүй. Ерөнхий мэдээлэл
                  засварлах, нэгж талбар холбох/хасах боломжгүй болно.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
          >
            Болих
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || pending}
            className={`h-9 px-5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isReviewing ? "bg-[#02c0ce] hover:bg-[#02a3af]" : "bg-[#0acf97] hover:bg-[#09b886]"
            }`}
          >
            {pending ? "Хадгалж байна..." : isReviewing ? "Хадгалах" : "Баталгаажуулах"}
          </button>
        </div>
      </div>
    </div>
  );
}
