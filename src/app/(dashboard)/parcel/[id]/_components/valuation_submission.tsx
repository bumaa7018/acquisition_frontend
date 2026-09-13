"use client";

// Нөхөх олговрын үнэлгээний ИЛГЭЭХ/ЗӨВШӨӨРӨХ төлөвийн UI — нэгж талбарын статусын
// флоугаас ТУСДАА. Мэрг. байгууллага Илгээх → Санхүү Зөвшөөрөх/Буцаах. Бүх шилжилтэд
// тайлбар шаардлагатай ба төлөвийн түүх хадгалагдана.

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Building2,
  Calculator,
  Send,
  CheckCircle2,
  CheckCheck,
  Undo2,
  Clock,
  X,
  History,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Ban,
  Paperclip,
  FileText,
  Camera,
  ReceiptText,
  CircleDollarSign,
  XCircle,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { formatArea, formatDate } from "@/lib/utils";
import {
  type Asset,
  type AssetCalcType,
  type AssetCalculation,
  type Compensation,
  type LandValuation,
  type ValuationStatus,
  type ValuationSubmission,
  type ValuationSubmissionHistory,
  type ValuationSnapshot,
  VALUATION_STATUS_LABELS,
  VALUATION_TYPE_LABELS,
} from "@/types";
import { COMP_TYPE_LABELS, ASSET_TYPE_LABELS } from "./constants";
import {
  assetValuationRows,
  parcelValuations,
  sumCompensations,
  valuationTotals,
} from "@/lib/valuation-summary";

type Action = "submit" | "approve" | "return" | "cancel";

const STATUS_STYLE: Record<
  ValuationStatus,
  { dot: string; chip: string; Icon: typeof Clock }
> = {
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
  canCancel,
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
  canCancel: boolean;
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
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${st.chip}`}
              >
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
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            Санхүүгийн хяналт хүлээгдэж байна
          </span>
        )}
        {!inactive && status === "returned" && submission?.last_note && (
          <span
            className="hidden max-w-[280px] truncate text-[11px] text-rose-500 sm:inline"
            title={submission.last_note}
          >
            Буцаасан шалтгаан: {submission.last_note}
          </span>
        )}
        {/* Буцаалтын ХАВСРАЛТ — шалтгааны хажууд шууд татаж харна.
            Хоосон бол огт харагдахгүй (хавсралт ЗААВАЛ БИШ). */}
        {!inactive && status === "returned" && submission?.attachment_url && (
          <a
            href={submission.attachment_url}
            target="_blank"
            rel="noreferrer"
            title={submission.attachment_name || "Хавсралт"}
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-rose-50 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500/25"
          >
            <Paperclip className="h-3 w-3" />
            Хавсралт
          </a>
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
              <CheckCircle2 className="h-3.5 w-3.5" /> Нөхөх олговор
              баталгаажуулах
            </button>
          </>
        )}

        {canCancel && (
          <button
            onClick={() => onAction("cancel")}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3.5 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
          >
            <Ban className="h-3.5 w-3.5" /> Хүчингүй болгох
          </button>
        )}
      </div>
    </div>
  );
}

const ACTION_META: Record<
  Action,
  {
    title: string;
    desc: string;
    label: string;
    color: string;
    Icon: typeof Send;
  }
> = {
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
  cancel: {
    title: "Баталгаажсан үнэлгээг хүчингүй болгох",
    desc: "Одоогийн баталгаажсан үнэлгээг түүх болгон хадгалаад, нэгж талбарыг дахин үнэлгээ оруулах төлөвт буцаана. Цуцлах тайлангийн PDF хавсралт заавал.",
    label: "Хүчингүй болгох",
    color: "#dc2626",
    Icon: Ban,
  },
};

export function ValuationTransitionModal({
  action,
  note,
  file,
  pending,
  onNote,
  onFile,
  onConfirm,
  onClose,
}: {
  action: Action;
  note: string;
  /** Буцаах үед заавал биш, цуцлах үед заавал PDF хавсралт. */
  file?: File | null;
  pending: boolean;
  onNote: (v: string) => void;
  onFile?: (f: File | null) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const meta = ACTION_META[action];
  // Хавсралт нь буцаалт/цуцлалтад хамаарна: илгээх/зөвшөөрөх дээр файл
  // асуувал тэр файл хаана хадгалагдахыг хэрэглэгч андуурна (backend ч хаядаг).
  const allowAttachment =
    (action === "return" || action === "cancel") && !!onFile;
  const attachmentRequired = action === "cancel";
  const noteEmpty = note.trim().length === 0;
  const attachmentMissing = attachmentRequired && !file;
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
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
              {meta.title}
            </p>
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

          {allowAttachment && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                Хавсралт{" "}
                {attachmentRequired ? (
                  <span className="text-rose-500">*</span>
                ) : (
                  <span className="font-normal text-slate-400">
                    (заавал биш, PDF)
                  </span>
                )}
              </label>
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-[#252630]">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span
                    className="min-w-0 flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => onFile?.(null)}
                    disabled={pending}
                    title="Хавсралтыг хасах"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-50 dark:hover:bg-[#37394d]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12px] text-slate-500 transition-colors hover:border-[#02c0ce] hover:text-[#02c0ce] dark:border-white/[0.12] dark:text-slate-400">
                  <Paperclip className="h-3.5 w-3.5" />
                  Файл сонгох
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={pending}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      // Ижил файлыг дахин сонгож болохын тулд input-ыг цэвэрлэнэ.
                      e.target.value = "";
                      onFile?.(f);
                    }}
                  />
                </label>
              )}
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                {attachmentRequired
                  ? "Цуцлах үндэслэл болон тайлангийн PDF хавсралт заавал хавсаргана."
                  : "Залруулга шаардсан хуудас, дүнгийн зөрүүний хүснэгт зэргийг хавсаргаж болно."}
              </p>
            </div>
          )}
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
            disabled={pending || noteEmpty || attachmentMissing}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: meta.color }}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <meta.Icon className="h-4 w-4" />
            )}
            {meta.label}
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  submit: "Илгээсэн",
  approve: "Баталгаажуулсан",
  return: "Буцаасан",
  reject: "Татгалзсан",
  cancel: "Хүчингүй болгосон",
};

function money(v?: number | null) {
  return `${Math.round(Number(v) || 0).toLocaleString()}₮`;
}

function snapshotTotal(snapshot: ValuationSnapshot) {
  const total = Number(snapshot.total_amount || 0);
  if (total > 0) return total;
  return snapshot.compensations.reduce(
    (sum, c) => sum + Number(c.amount ?? 0),
    0,
  );
}

type SnapshotAsset = Asset & {
  calculations?: Array<Partial<AssetCalculation>>;
};

function snapshotAssets(snapshot: ValuationSnapshot): SnapshotAsset[] {
  return snapshot.assets.map((asset, idx) => ({
    id: String(asset.id || `${snapshot.id}-asset-${idx}`),
    acquisition_id: String(asset.acquisition_id || snapshot.acquisition_id),
    parcel_id: String(asset.parcel_id || snapshot.parcel_id),
    valuation_type: asset.valuation_type || snapshot.valuation_type,
    asset_number: String(asset.asset_number || ""),
    asset_type: asset.asset_type === "property" ? "property" : "real_state",
    asset_name: String(asset.asset_name || ""),
    floor_count: Number(asset.floor_count || 0),
    area_m2: Number(asset.area_m2 || 0),
    owner_name: String(asset.owner_name || ""),
    address: String(asset.address || ""),
    notes: String(asset.notes || ""),
    unit: String(asset.unit || ""),
    capacity: String(asset.capacity || ""),
    description: String(asset.description || ""),
    unit_price: Number(asset.unit_price || 0),
    photo_pdf_url: asset.photo_pdf_url,
    photo_pdf_name: asset.photo_pdf_name,
    calculations: asset.calculations ?? [],
    created_at: String(asset.created_at || snapshot.cancelled_at || ""),
    updated_at: String(asset.updated_at || snapshot.cancelled_at || ""),
  }));
}

function snapshotCompensations(snapshot: ValuationSnapshot): Compensation[] {
  return snapshot.compensations.map((comp, idx) => ({
    id: String(comp.id || `${snapshot.id}-comp-${idx}`),
    acquisition_id: String(comp.acquisition_id || snapshot.acquisition_id),
    target_type: comp.target_type === "parcel" ? "parcel" : "asset",
    valuation_type: comp.valuation_type || snapshot.valuation_type,
    parcel_id: String(comp.parcel_id || snapshot.parcel_id),
    asset_id: comp.asset_id ? String(comp.asset_id) : undefined,
    compensation_type:
      comp.compensation_type === "land_grant" ? "land_grant" : "cash",
    coverage_percent: Number(comp.coverage_percent ?? 100),
    amount: Number(comp.amount ?? 0),
    compensation_date: comp.compensation_date,
    note: comp.note,
    grant: comp.grant,
    status:
      comp.status === "pending" || comp.status === "rejected"
        ? comp.status
        : "approved",
    review_note: comp.review_note,
    reviewed_by: comp.reviewed_by,
    reviewed_at: comp.reviewed_at,
    valuation_report_url: comp.valuation_report_url,
    valuation_report_name: comp.valuation_report_name,
    created_at: String(comp.created_at || snapshot.cancelled_at || ""),
    created_by: comp.created_by,
    updated_at: String(comp.updated_at || snapshot.cancelled_at || ""),
  }));
}

function snapshotLandValuation(
  snapshot: ValuationSnapshot,
): Partial<LandValuation> {
  return snapshot.land_valuation || {};
}

function compensationLabel(comp: Compensation) {
  return (
    comp.note?.trim() ||
    COMP_TYPE_LABELS[comp.compensation_type] ||
    comp.compensation_type
  );
}

type SnapshotTone = {
  card: string;
  header: string;
  tableHead: string;
  footer: string;
  icon: string;
};

const SNAPSHOT_LAND_TONE: SnapshotTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-emerald-200 dark:border-l-emerald-500/40",
  header: "bg-emerald-50/70 dark:bg-emerald-500/10",
  tableHead: "bg-emerald-50/55 dark:bg-emerald-500/10",
  footer: "bg-emerald-50/70 dark:bg-emerald-500/10",
  icon: "text-emerald-500",
};

const SNAPSHOT_REAL_ESTATE_TONE: SnapshotTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-sky-200 dark:border-l-sky-500/40",
  header: "bg-sky-50/70 dark:bg-sky-500/10",
  tableHead: "bg-sky-50/55 dark:bg-sky-500/10",
  footer: "bg-sky-50/70 dark:bg-sky-500/10",
  icon: "text-sky-500",
};

const SNAPSHOT_PROPERTY_TONE: SnapshotTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-amber-200 dark:border-l-amber-500/40",
  header: "bg-amber-50/70 dark:bg-amber-500/10",
  tableHead: "bg-amber-50/55 dark:bg-amber-500/10",
  footer: "bg-amber-50/70 dark:bg-amber-500/10",
  icon: "text-amber-500",
};

function SnapshotStatusBadge({ status }: { status?: string }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
        <CheckCheck className="h-3 w-3" />
        Зөвшөөрсөн
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        Татгалзсан
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
      <Clock className="h-3 w-3" />
      Хүлээгдэж байна
    </span>
  );
}

function SnapshotCompensationRows({
  compensations,
  emptyText,
  showStatus = true,
  actionColumn = false,
}: {
  compensations: Compensation[];
  emptyText: string;
  showStatus?: boolean;
  actionColumn?: boolean;
}) {
  if (!compensations.length) {
    return (
      <tr>
        <td
          colSpan={5 + (showStatus ? 1 : 0) + (actionColumn ? 1 : 0)}
          className="px-3 py-4 text-center text-slate-400"
        >
          {emptyText}
        </td>
      </tr>
    );
  }
  return (
    <>
      {compensations.map((comp) => (
        <tr key={comp.id}>
          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
            {compensationLabel(comp)}
          </td>
          <td className="px-3 py-2.5 text-slate-500">
            {COMP_TYPE_LABELS[comp.compensation_type] ??
              comp.compensation_type}
          </td>
          <td className="px-3 py-2.5 tabular-nums text-slate-500">
            {comp.coverage_percent}%
          </td>
          <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {money(comp.amount)}
          </td>
          <td className="px-3 py-2.5 text-slate-400">
            {comp.compensation_date ? formatDate(comp.compensation_date) : "—"}
            {/* Архивын ҮНЭЛГЭЭНИЙ ТАЙЛАН — олговрын мөр устсан ч файл нь
                хадгалалтад үлдэнэ. */}
            {comp.valuation_report_url && (
              <a
                href={comp.valuation_report_url}
                target="_blank"
                rel="noreferrer"
                title={comp.valuation_report_name || "Үнэлгээний тайлан"}
                className="mt-1 flex max-w-[150px] items-center gap-1 text-[10px] font-semibold text-[#02c0ce] hover:underline"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {comp.valuation_report_name || "Үнэлгээний тайлан"}
                </span>
              </a>
            )}
          </td>
          {showStatus && (
            <td className="px-3 py-2.5">
              <div className="flex flex-col gap-1">
                <SnapshotStatusBadge status={comp.status} />
                {comp.review_note && comp.status === "approved" && (
                  <p
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 max-w-[160px] truncate"
                    title={comp.review_note}
                  >
                    {comp.review_note}
                  </p>
                )}
                {comp.review_note && comp.status === "rejected" && (
                  <p
                    className="text-[10px] text-red-500 dark:text-red-400 max-w-[160px] truncate"
                    title={comp.review_note}
                  >
                    {comp.review_note}
                  </p>
                )}
              </div>
            </td>
          )}
          {actionColumn && <td className="px-3 py-2.5" />}
        </tr>
      ))}
    </>
  );
}

function SnapshotAssetTable({
  title,
  rows,
  emptyText,
  tone,
}: {
  title: string;
  rows: ReturnType<typeof assetValuationRows>;
  emptyText: string;
  tone: SnapshotTone;
}) {
  const total = sumCompensations(rows.flatMap((row) => row.compensations));
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  return (
    <div className={tone.card}>
      <div
        className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${tone.header}`}
      >
        <div className="flex items-center gap-2">
          <Building2 className={`h-4 w-4 ${tone.icon}`} />
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            {title}
          </p>
        </div>
        <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">
          {money(total)}
        </p>
      </div>
      {!rows.length ? (
        <div className="px-5 py-7 text-center text-[12px] text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr
                className={`border-b border-slate-100 dark:border-[#37394d] ${tone.tableHead}`}
              >
                {[
                  "Хөрөнгө",
                  "Дугаар",
                  "Талбай",
                  "Эзэмшигч",
                  "Нийт үнэлгээ",
                  "",
                ].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    >
                      {head}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
              {rows.map(({ asset, compensations, total: assetTotal }) => {
                const expanded = expandedAssetId === asset.id;
                return (
                  <Fragment key={asset.id}>
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630]/50">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                        {asset.asset_name ||
                          ASSET_TYPE_LABELS[asset.asset_type]}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {asset.asset_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatArea(asset.area_m2)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {asset.owner_name || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {money(assetTotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Архивын ЗУРАГ — хөрөнгийн мөр устсан ч файл нь
                              хадгалалтад үлдэнэ. Зөвхөн харах (засах биш). */}
                          {asset.photo_pdf_url && (
                            <a
                              href={asset.photo_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              title={asset.photo_pdf_name || "Зураг харах"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630]"
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() =>
                              setExpandedAssetId(expanded ? null : asset.id)
                            }
                            title={expanded ? "Хаах" : "Засах"}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                              expanded
                                ? "bg-[#02c0ce]/10 text-[#02c0ce]"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630]"
                            }`}
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr
                        key={`${asset.id}-details`}
                        className="bg-slate-50/60 dark:bg-[#1a1d20]"
                      >
                        <td colSpan={6} className="px-4 py-4">
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#1e1f27]">
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-[#37394d]">
                                  {[
                                    "Үнэлсэн хэсэг",
                                    "Хэлбэр",
                                    "Хувь",
                                    "Дүн",
                                    "Огноо",
                                    "Статус",
                                    "",
                                  ].map((head) => (
                                    <th
                                      key={head}
                                      className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                                    >
                                      {head}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                                <SnapshotCompensationRows
                                  compensations={compensations}
                                  emptyText="Үнэлгээний задаргаа бүртгэгдээгүй"
                                  actionColumn
                                />
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SnapshotBuildingCostSection({
  assets,
  calcTypes,
}: {
  assets: SnapshotAsset[];
  calcTypes: AssetCalcType[];
}) {
  const calcTypeByID = new Map(calcTypes.map((type) => [type.id, type]));
  const cols = assets
    .map((asset) => ({
      asset,
      calcs: (asset.calculations ?? [])
        .map((calc, idx) => {
          const calcTypeID = Number(calc.calc_type_id || 0);
          const calcType = calcTypeByID.get(calcTypeID);
          return {
            id: String(calc.id || `${asset.id}-calc-${idx}`),
            asset_id: String(calc.asset_id || asset.id),
            calc_type_id: calcTypeID,
            calc_code: String(calc.calc_code || calcType?.code || ""),
            calc_name: String(calc.calc_name || calcType?.name || ""),
            calc_group: calc.calc_group || calcType?.grp || "",
            unit: String(calc.unit || calcType?.default_unit || ""),
            value: Number(calc.value || 0),
          };
        })
        .filter((calc) => calc.calc_name && Number(calc.value) !== 0),
    }))
    .filter((x) => x.calcs.length > 0);
  if (!cols.length) return null;

  // Эгнээний тодорхойлолт: calc төрлүүдийн нэгдэл (эхнийхээс эрэмбэ хадгална)
  const rowDefs: { name: string; unit: string; group: string }[] = [];
  const seen = new Set<string>();
  for (const { calcs } of cols)
    for (const c of calcs)
      if (!seen.has(c.calc_name)) {
        seen.add(c.calc_name);
        rowDefs.push({
          name: c.calc_name,
          unit: c.unit,
          group: c.calc_group ?? "",
        });
      }
  const groupedRowDefs: typeof rowDefs = [];
  const emittedGroups = new Set<string>();
  for (const row of rowDefs) {
    if (!row.group) {
      groupedRowDefs.push(row);
      continue;
    }
    if (emittedGroups.has(row.group)) continue;
    emittedGroups.add(row.group);
    groupedRowDefs.push(...rowDefs.filter((item) => item.group === row.group));
  }
  const valOf = (calcs: (typeof cols)[number]["calcs"], name: string) => {
    const c = calcs.find((x) => x.calc_name === name);
    return c ? Number(c.value).toLocaleString() : "—";
  };
  // Бүлэг (Итгэлцүүр г.м)-ийн rowspan-г тооцоолно
  const groupSpan = new Map<number, number>();
  const groupCovered = new Set<number>();
  for (let i = 0; i < groupedRowDefs.length;) {
    const g = groupedRowDefs[i].group;
    if (g) {
      let j = i;
      while (
        j + 1 < groupedRowDefs.length &&
        groupedRowDefs[j + 1].group === g
      )
        j++;
      groupSpan.set(i, j - i + 1);
      for (let k = i + 1; k <= j; k++) groupCovered.add(k);
      i = j + 1;
    } else i++;
  }

  return (
    <div className={SNAPSHOT_REAL_ESTATE_TONE.card}>
      <div
        className={`flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_REAL_ESTATE_TONE.header}`}
      >
        <Calculator className={`h-4 w-4 ${SNAPSHOT_REAL_ESTATE_TONE.icon}`} />
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Барилгын өртгийн хандлага
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead>
            <tr
              className={`border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_REAL_ESTATE_TONE.tableHead}`}
            >
              <th
                colSpan={2}
                className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                Үзүүлэлт
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Хэмжих нэгж
              </th>
              {cols.map(({ asset }) => (
                <th
                  key={asset.id}
                  className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  {asset.asset_name || "Барилга"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
            <tr>
              <td
                colSpan={2}
                className="px-4 py-2.5 text-slate-700 dark:text-slate-200"
              >
                Барилгын талбай
              </td>
              <td className="px-4 py-2.5 text-slate-500">м²</td>
              {cols.map(({ asset }) => (
                <td
                  key={asset.id}
                  className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100"
                >
                  {formatArea(asset.area_m2)}
                </td>
              ))}
            </tr>
            {groupedRowDefs.map((rd, idx) => (
              <tr key={rd.name}>
                {rd.group ? (
                  <>
                    {groupSpan.has(idx) && (
                      <td
                        rowSpan={groupSpan.get(idx)}
                        className="px-4 py-2.5 align-top font-medium text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-[#37394d]"
                      >
                        {rd.group}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      {rd.name}
                    </td>
                  </>
                ) : (
                  <td
                    colSpan={2}
                    className="px-4 py-2.5 text-slate-700 dark:text-slate-200"
                  >
                    {rd.name}
                  </td>
                )}
                <td className="px-4 py-2.5 text-slate-500">{rd.unit}</td>
                {cols.map(({ asset, calcs }) => (
                  <td
                    key={asset.id}
                    className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100"
                  >
                    {valOf(calcs, rd.name)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SnapshotDetailModal({
  snapshot,
  calcTypes,
  onClose,
}: {
  snapshot: ValuationSnapshot;
  calcTypes: AssetCalcType[];
  onClose: () => void;
}) {
  const assets = snapshotAssets(snapshot);
  const compensations = snapshotCompensations(snapshot);
  const land = snapshotLandValuation(snapshot);
  const realStateAssets = assets.filter(
    (asset) => asset.asset_type === "real_state",
  );
  const realStateRows = assetValuationRows(assets, compensations, "real_state");
  const propertyRows = assetValuationRows(assets, compensations, "property");
  const landComps = parcelValuations(compensations, snapshot.parcel_id).filter(
    (comp) => comp.note !== "Газрын үнэлгээ",
  );
  const totals = valuationTotals(assets, compensations, snapshot.parcel_id);
  const landArea = Number(land.land_area_m2 || 0);
  const landPrice = Number(land.base_price_per_m2 || 0);
  const landTotal = Number(land.total_value || 0) || landArea * landPrice;
  const grandTotal = landTotal + totals.assetTotal;
  const hasLandValuation = landArea > 0 || landPrice > 0 || landTotal > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div>
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
              Хүчингүй болсон үнэлгээний дэлгэрэнгүй
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {VALUATION_TYPE_LABELS[snapshot.valuation_type] ??
                snapshot.valuation_type}{" "}
              · {snapshot.cancelled_at ? formatDate(snapshot.cancelled_at) : "—"} ·{" "}
              {snapshot.cancelled_by || "Систем"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Тухайн үнэлгээний ТАЙЛАН — хавсралтаас хасагдсан ч эндээс
                татагдана. */}
            {snapshot.report_url && (
              <a
                href={snapshot.report_url}
                target="_blank"
                rel="noreferrer"
                title={snapshot.report_name || "Үнэлгээний тайлан"}
                className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/5 dark:border-white/[0.08]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {snapshot.report_name || "Үнэлгээний тайлан"}
                </span>
              </a>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="ap-card grid grid-cols-3 divide-x divide-slate-100 overflow-hidden dark:divide-[#37394d]">
            {[
              { label: "Газрын үнэлгээ", value: landTotal, Icon: ReceiptText },
              { label: "Хөрөнгийн үнэлгээ", value: totals.assetTotal, Icon: Building2 },
              { label: "Нэгдсэн дүн", value: grandTotal || snapshotTotal(snapshot), Icon: CircleDollarSign },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="flex min-w-0 items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 shrink-0 text-[#02c0ce]" />
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="truncate text-[14px] font-bold tabular-nums text-slate-800 dark:text-white">
                    {money(value)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {snapshot.note && (
            <p className="rounded-lg border border-red-100 bg-red-50/40 px-4 py-3 text-[12px] text-slate-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-slate-200">
              {snapshot.note}
            </p>
          )}

          {hasLandValuation && (
            <div className={SNAPSHOT_LAND_TONE.card}>
              <div
                className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.header}`}
              >
                <div className="flex items-center gap-2">
                  <ReceiptText
                    className={`h-4 w-4 ${SNAPSHOT_LAND_TONE.icon}`}
                  />
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                    Газрын үнэлгээ
                  </p>
                </div>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">
                  {money(landTotal)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr
                      className={`border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.tableHead}`}
                    >
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Үзүүлэлт
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Хэмжих нэгж
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Утга
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                    <tr>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        Чөлөөлөлтөнд өртсөн газрын хэмжээ
                      </td>
                      <td className="px-4 py-3 text-slate-500">м²</td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                          {landArea ? landArea.toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        Газрын 1 м² талбайн суурь үнэ
                      </td>
                      <td className="px-4 py-3 text-slate-500">Төгрөг</td>
                      <td className="px-4 py-3">
                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                          {landPrice ? landPrice.toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr
                      className={`border-t-2 border-slate-200 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.footer}`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                        Газрын үнэлгээ
                      </td>
                      <td />
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-white">
                        {money(landTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {(land.appraiser_org_name ||
                land.ownership_cert_no ||
                land.source_file_name) && (
                <div className="grid gap-x-6 gap-y-1.5 border-t border-slate-100 px-5 py-3 text-[12px] dark:border-[#37394d] md:grid-cols-2 lg:grid-cols-3">
                  {land.ownership_cert_no && (
                    <div>
                      <span className="text-slate-400">
                        Өмчлөх эрхийн гэрчилгээ:{" "}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.ownership_cert_no}
                      </span>
                    </div>
                  )}
                  {land.appraiser_org_name && (
                    <div>
                      <span className="text-slate-400">
                        Үнэлгээний байгууллага:{" "}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.appraiser_org_name}
                      </span>
                    </div>
                  )}
                  {land.appraiser_director && (
                    <div>
                      <span className="text-slate-400">Захирал: </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.appraiser_director}
                      </span>
                    </div>
                  )}
                  {land.appraiser_reg_no && (
                    <div>
                      <span className="text-slate-400">Регистр: </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.appraiser_reg_no}
                      </span>
                    </div>
                  )}
                  {land.appraiser_contact && (
                    <div>
                      <span className="text-slate-400">Холбоо барих: </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.appraiser_contact}
                      </span>
                    </div>
                  )}
                  {land.source_file_name && (
                    <div>
                      <span className="text-slate-400">Эх файл: </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {land.source_file_name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {landComps.length > 0 && (
            <div className={SNAPSHOT_LAND_TONE.card}>
              <div
                className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.header}`}
              >
                <div className="flex items-center gap-2">
                  <ReceiptText
                    className={`h-4 w-4 ${SNAPSHOT_LAND_TONE.icon}`}
                  />
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                    Газрын олговор
                  </p>
                </div>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">
                  {money(totals.landTotal)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[12px]">
                  <thead>
                    <tr
                      className={`border-b border-slate-100 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.tableHead}`}
                    >
                      {["Үнэлгээ", "Хэлбэр", "Хувь", "Дүн", "Огноо"].map(
                        (head) => (
                          <th
                            key={head}
                            className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                          >
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                    <SnapshotCompensationRows
                      compensations={landComps}
                      emptyText="Газрын олговор бүртгэгдээгүй"
                      showStatus={false}
                    />
                  </tbody>
                  <tfoot>
                    <tr
                      className={`border-t border-slate-200 dark:border-[#37394d] ${SNAPSHOT_LAND_TONE.footer}`}
                    >
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-right font-semibold text-slate-500"
                      >
                        Нийт газрын олговор
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {money(totals.landTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <SnapshotAssetTable
            title="Үл хөдлөх хөрөнгийн үнэлгээ"
            rows={realStateRows}
            emptyText="Үл хөдлөх хөрөнгө бүртгэгдээгүй"
            tone={SNAPSHOT_REAL_ESTATE_TONE}
          />
          {realStateRows.length > 0 && (
            <SnapshotBuildingCostSection
              assets={realStateAssets}
              calcTypes={calcTypes}
            />
          )}
          <SnapshotAssetTable
            title="Эд хөрөнгийн үнэлгээ"
            rows={propertyRows}
            emptyText="Эд хөрөнгө бүртгэгдээгүй"
            tone={SNAPSHOT_PROPERTY_TONE}
          />

          {(landTotal > 0 || totals.assetTotal > 0) && (
            <div className="ap-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-[#37394d]">
                <CircleDollarSign className="h-4 w-4 text-[#02c0ce]" />
                <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                  Нэгтгэл
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
                      <th className="w-12 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Д/д
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Үнэлэгдсэн хөрөнгийн төрөл
                      </th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Мөнгөн дүн /₮/
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                    {[
                      { label: "Газар", value: landTotal },
                      {
                        label: "Үл хөдлөх хөрөнгө",
                        value: sumCompensations(
                          realStateRows.flatMap((row) => row.compensations),
                        ),
                      },
                      {
                        label: "Эд хөрөнгө",
                        value: sumCompensations(
                          propertyRows.flatMap((row) => row.compensations),
                        ),
                      },
                    ].map((row, idx) => (
                      <tr key={row.label}>
                        <td className="px-4 py-2.5 text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                          {row.label}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                          {money(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/70 dark:border-[#37394d] dark:bg-[#1a1d20]">
                      <td />
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                        Нөхөн олговрын нийт дүн
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                        {money(grandTotal || snapshotTotal(snapshot))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ValuationHistoryModal({
  loader,
  snapshotLoader,
  calcTypes = [],
  onClose,
}: {
  loader: () => Promise<ValuationSubmissionHistory[]>;
  snapshotLoader?: () => Promise<ValuationSnapshot[]>;
  calcTypes?: AssetCalcType[];
  onClose: () => void;
}) {
  const [list, setList] = useState<ValuationSubmissionHistory[] | null>(null);
  const [snapshots, setSnapshots] = useState<ValuationSnapshot[] | null>(
    snapshotLoader ? null : [],
  );
  const [detail, setDetail] = useState<ValuationSnapshot | null>(null);

  // loader нь эцэг компонентод мөр бүрт шинээр үүсдэг тул түүнийг ref-т барьж,
  // зөвхөн mount дээр НЭГ л удаа дуудна (эс тэгвэл effect давтагдаж loop үүснэ).
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const snapshotLoaderRef = useRef(snapshotLoader);
  snapshotLoaderRef.current = snapshotLoader;

  useEffect(() => {
    let alive = true;
    loaderRef
      .current()
      .then((l) => {
        if (alive) setList(l);
      })
      .catch(() => {
        if (alive) setList([]);
      });
    snapshotLoaderRef
      .current?.()
      .then((l) => {
        if (alive) setSnapshots(l);
      })
      .catch(() => {
        if (alive) setSnapshots([]);
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
      <div className="flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#02c0ce]" />
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
              Нөхөх олговрын төлөвийн түүх
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {snapshots && snapshots.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-[12px] font-semibold text-slate-500">
                Хүчингүй болгосон үнэлгээ
              </p>
              <div className="space-y-2">
                {snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-red-100 bg-red-50/40 px-3.5 py-3 dark:border-red-500/20 dark:bg-red-500/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-red-700 dark:text-red-400">
                          {VALUATION_TYPE_LABELS[s.valuation_type] ??
                            s.valuation_type}{" "}
                          · {money(snapshotTotal(s))}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {s.cancelled_at ? formatDate(s.cancelled_at) : "—"} ·{" "}
                          {s.cancelled_by || "Систем"}
                        </p>
                      </div>
                      <button
                        onClick={() => setDetail(s)}
                        className="h-8 rounded-lg border border-red-200 px-3 text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                      >
                        Дэлгэрэнгүй
                      </button>
                    </div>
                    {s.note && (
                      <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300">
                        {s.note}
                      </p>
                    )}
                    {/* ҮНЭЛГЭЭНИЙ ТАЙЛАН — цуцлалтын дараа нэгж талбарын
                        хавсралтаас хасагдаж ЗӨВХӨН эндээс татагдана.
                        Хуучин (тайлангаа хадгалж эхлэхээс өмнөх) snapshot-д
                        хоосон байж болно. */}
                    {s.report_url && (
                      <a
                        href={s.report_url}
                        target="_blank"
                        rel="noreferrer"
                        title={s.report_name || "Үнэлгээний тайлан"}
                        className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 dark:bg-[#1e1f27] dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {s.report_name || "Үнэлгээний тайлан"}
                        </span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {list === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]"
                />
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
                const to =
                  (h.to_status as ValuationStatus) in VALUATION_STATUS_LABELS
                    ? VALUATION_STATUS_LABELS[h.to_status as ValuationStatus]
                    : h.to_status;
                const st =
                  STATUS_STYLE[h.to_status as ValuationStatus] ??
                  STATUS_STYLE.draft;
                return (
                  <li key={h.id} className="ml-4 pb-5 last:pb-0">
                    <span
                      className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#1e1f27] ${st.dot}`}
                    />
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-[#37394d] dark:bg-[#1a1d20]">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}
                        >
                          {ACTION_LABEL[h.action] ?? h.action} · {to}
                        </span>
                        {idx === 0 && (
                          <span className="rounded-md bg-[#02c0ce]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#02c0ce]">
                            Одоогийн
                          </span>
                        )}
                      </div>
                      {h.note && (
                        <p className="mt-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                          {h.note}
                        </p>
                      )}
                      {/* Тухайн үйлдлийн ХАВСРАЛТ. Түүх нь эх сурвалж: дараагийн
                          буцаалт картны хавсралтыг дарж бичсэн ч энд үлдэнэ. */}
                      {h.attachment_url && (
                        <a
                          href={h.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#02c0ce] ring-1 ring-slate-200 hover:bg-[#02c0ce]/5 dark:bg-[#1e1f27] dark:ring-white/[0.08]"
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {h.attachment_name || "Хавсралт"}
                          </span>
                        </a>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-[10.5px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {h.created_at ? formatDate(h.created_at) : "—"}
                        </span>
                        <span>
                          {h.created_by === "system" ? "Систем" : h.created_by}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      {detail && (
        <SnapshotDetailModal
          snapshot={detail}
          calcTypes={calcTypes}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
