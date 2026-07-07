"use client";

// Нөхөх олговрын үнэлгээний ИЛГЭЭХ/ЗӨВШӨӨРӨХ төлөвийн UI — нэгж талбарын статусын
// флоугаас ТУСДАА. Мэрг. байгууллага Илгээх → Санхүү Зөвшөөрөх/Буцаах. Бүх шилжилтэд
// тайлбар шаардлагатай ба төлөвийн түүх хадгалагдана.

import { useEffect, useRef, useState } from "react";
import { Send, CheckCircle2, Undo2, Clock, X, History, ShieldCheck, Loader2, AlertTriangle, Ban } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  type ValuationStatus,
  type ValuationSubmission,
  type ValuationSubmissionHistory,
  VALUATION_STATUS_LABELS,
} from "@/types";

type Action = "submit" | "approve" | "return";

const STATUS_STYLE: Record<ValuationStatus, { dot: string; chip: string; Icon: typeof Clock }> = {
  draft: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    Icon: Clock,
  },
  submitted: {
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    Icon: Send,
  },
  approved: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    Icon: ShieldCheck,
  },
  returned: {
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    Icon: Undo2,
  },
  rejected: {
    dot: "bg-red-400",
    chip: "bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400",
    Icon: Ban,
  },
};

export function ValuationSubmissionBar({
  status,
  submission,
  typeLabel,
  isSelected,
  hasSelected,
  canSubmit,
  canReview,
  pending,
  onAction,
  onHistory,
}: {
  status: ValuationStatus;
  submission: ValuationSubmission | null;
  typeLabel?: string;
  isSelected?: boolean;
  hasSelected?: boolean;
  canSubmit: boolean;
  canReview: boolean;
  pending: boolean;
  onAction: (action: Action) => void;
  onHistory: () => void;
}) {
  const st = STATUS_STYLE[status];
  // Энэ урсгал үндсэнд сонгогдоогүй мөртлөө өөр урсгал сонгогдсон бол "идэвхгүй" гэж үзнэ.
  const inactive = hasSelected && !isSelected;
  return (
    <div className="ap-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {typeLabel ? `${typeLabel} — төлөв` : "Нөхөх олговрын төлөв"}
          </span>
          {inactive ? (
            // Баталгаажаагүй үлдсэн урсгал — ямар төлөвтэй байснаас үл хамааран
            // зөвхөн "Идэвхгүй" гэж харуулна.
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-400 dark:bg-slate-500/15 dark:text-slate-400">
              <Ban className="h-3.5 w-3.5" /> Идэвхгүй
            </span>
          ) : (
            <>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${st.chip}`}>
                <st.Icon className="h-3.5 w-3.5" />
                {VALUATION_STATUS_LABELS[status]}
              </span>
              {isSelected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#02c0ce]/12 px-2.5 py-1 text-[11px] font-semibold text-[#02c0ce]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Үндсэн үнэлгээ
                </span>
              )}
            </>
          )}
        </div>
        {!inactive && status === "submitted" && (
          <span className="hidden text-[11px] text-slate-400 sm:inline">Санхүүгийн хяналт хүлээгдэж байна</span>
        )}
        {!inactive && status === "returned" && submission?.last_note && (
          <span className="hidden max-w-[280px] truncate text-[11px] text-rose-500 sm:inline" title={submission.last_note}>
            Буцаасан шалтгаан: {submission.last_note}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onHistory}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
        >
          <History className="h-3.5 w-3.5" /> Түүх
        </button>

        {canSubmit && (
          <button
            onClick={() => onAction("submit")}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Илгээх
          </button>
        )}

        {canReview && (
          <>
            <button
              onClick={() => onAction("return")}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
            >
              <Undo2 className="h-3.5 w-3.5" /> Буцаах
            </button>
            <button
              onClick={() => onAction("approve")}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[12px] font-semibold text-white hover:bg-emerald-600/90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Нөхөх олговор баталгаажуулах
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const ACTION_META: Record<Action, { title: string; desc: string; label: string; color: string; Icon: typeof Send }> = {
  submit: {
    title: "Нөхөх олговрыг илгээх",
    desc: "Илгээсний дараа үнэлгээ засах боломжгүй болж, санхүүгийн хяналтад орно.",
    label: "Илгээх",
    color: "#02c0ce",
    Icon: Send,
  },
  approve: {
    title: "Нөхөх олговрыг баталгаажуулах",
    desc: "Баталгаажсаны дараа өөрчлөх боломжгүй бөгөөд нэгж талбар дараагийн явц руу шилжиж болно.",
    label: "Зөвшөөрөх",
    color: "#059669",
    Icon: CheckCircle2,
  },
  return: {
    title: "Нөхөх олговрыг буцаах",
    desc: "Буцаасны дараа мэргэжлийн байгууллага дахин засаж, дахин илгээх боломжтой болно.",
    label: "Буцаах",
    color: "#f1556c",
    Icon: Undo2,
  },
};

export function ValuationTransitionModal({
  action,
  note,
  pending,
  onNote,
  onConfirm,
  onClose,
}: {
  action: Action;
  note: string;
  pending: boolean;
  onNote: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const meta = ACTION_META[action];
  const noteEmpty = note.trim().length === 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <meta.Icon className="h-5 w-5" style={{ color: meta.color }} />
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">{meta.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{meta.desc}</span>
          </div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">
            Тайлбар <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Шилжилтийн тайлбар бичнэ үү…"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
          >
            Болих
          </button>
          <button
            onClick={onConfirm}
            disabled={pending || noteEmpty}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: meta.color }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <meta.Icon className="h-4 w-4" />}
            {meta.label}
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = { submit: "Илгээсэн", approve: "Баталгаажуулсан", return: "Буцаасан", reject: "Татгалзсан" };

export function ValuationHistoryModal({
  loader,
  onClose,
}: {
  loader: () => Promise<ValuationSubmissionHistory[]>;
  onClose: () => void;
}) {
  const [list, setList] = useState<ValuationSubmissionHistory[] | null>(null);

  // loader нь эцэг компонентод мөр бүрт шинээр үүсдэг тул түүнийг ref-т барьж,
  // зөвхөн mount дээр НЭГ л удаа дуудна (эс тэгвэл effect давтагдаж loop үүснэ).
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    loaderRef.current()
      .then((l) => {
        if (alive) setList(l);
      })
      .catch(() => {
        if (alive) setList([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#02c0ce]" />
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Нөхөх олговрын төлөвийн түүх</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {list === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="mb-3 h-8 w-8 text-slate-200 dark:text-slate-700" />
              <p className="text-[13px] text-slate-400">Түүх байхгүй</p>
            </div>
          ) : (
            <ol className="relative ml-1 border-l-2 border-slate-100 dark:border-[#37394d]">
              {list.map((h, idx) => {
                const to = (h.to_status as ValuationStatus) in VALUATION_STATUS_LABELS
                  ? VALUATION_STATUS_LABELS[h.to_status as ValuationStatus]
                  : h.to_status;
                const st = STATUS_STYLE[h.to_status as ValuationStatus] ?? STATUS_STYLE.draft;
                return (
                  <li key={h.id} className="ml-4 pb-5 last:pb-0">
                    <span className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#1e1f27] ${st.dot}`} />
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-[#37394d] dark:bg-[#1a1d20]">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
                          {ACTION_LABEL[h.action] ?? h.action} · {to}
                        </span>
                        {idx === 0 && (
                          <span className="rounded-md bg-[#02c0ce]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#02c0ce]">
                            Одоогийн
                          </span>
                        )}
                      </div>
                      {h.note && <p className="mt-1.5 text-[12px] text-slate-600 dark:text-slate-300">{h.note}</p>}
                      <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {h.created_at ? formatDate(h.created_at) : "—"}
                        </span>
                        <span>{h.created_by === "system" ? "Систем" : h.created_by}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
