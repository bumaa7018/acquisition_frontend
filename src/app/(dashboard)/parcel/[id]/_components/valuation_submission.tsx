"use client";

// Нөхөх олговрын үнэлгээний ИЛГЭЭХ/ЗӨВШӨӨРӨХ төлөвийн UI — нэгж талбарын статусын
// флоугаас ТУСДАА. Мэрг. байгууллага Илгээх → Санхүү Зөвшөөрөх/Буцаах. Бүх шилжилтэд
// тайлбар шаардлагатай ба төлөвийн түүх хадгалагдана.

import { useEffect, useRef, useState } from "react";
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
  Boxes,
  Truck,
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
import {
  VSection,
  VHeadRight,
  VLandValuationTable,
  VAssetsTable,
  VBuildingSpecTable,
  VBuildingCostTable,
  VCostTable,
  VSummaryTable,
  V_COST_GROUPS,
  VPhotoMark,
  VFileChip,
  sectionHeading,
} from "./valuation_view";
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
    desc: "Одоогийн баталгаажсан үнэлгээг түүх болгон хадгалаад, нэгж талбарыг дахин үнэлгээ оруулах төлөвт буцаана. Хүчингүй болгосон ҮНДЭСЛЭЛИЙН PDF заавал хавсаргана.",
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
  // Хавсралт: ИЛГЭЭХ үед = баталгаажаагүй үнэлгээний тайлан (PDF/Word, ЗААВАЛ),
  // буцаах үед = үндэслэлийн PDF (заавал биш), цуцлах үед = PDF (заавал).
  const allowAttachment =
    (action === "submit" || action === "return" || action === "cancel") && !!onFile;
  const attachmentRequired = action === "cancel" || action === "submit";
  const isDraftReport = action === "submit";
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
                {isDraftReport ? "Баталгаажаагүй үнэлгээний тайлан" : "Хавсралт"}{" "}
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
                    accept={
                      isDraftReport
                        ? "application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        : "application/pdf,.pdf"
                    }
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
                {isDraftReport
                  ? "Санхүү хянахдаа уншина. PDF эсвэл Word (.docx). Дахин илгээхэд солигдоно."
                  : attachmentRequired
                    ? "Хүчингүй болгосон үндэслэлийн PDF-ийг заавал хавсаргана."
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

  // ЗӨВХӨН ЭНЭ хүчингүй болсон үнэлгээний файлууд. Эцэг компонентоос
  // (одоогийн урсгалаас) файл АВАХГҮЙ: цуцлалтын дараа шинээр үнэлгээ хийж
  // баталгаажуулбал түүний "Баталгаажсан тайлан" нь хуучин түүхэн бичлэг дээр
  // гарч ирж, өөр үнэлгээний баримтыг энэ үнэлгээнийх мэт харуулж байсан.
  // Цуцлах мөчид энэ үнэлгээнд хамаарч байсан БҮХ файлыг backend нь
  // `snapshot.files`-д хуулж, нэгж талбарын хавсралт/илгээлтээс хасдаг.
  // Хуучин (000039-өөс өмнөх) snapshot-д тэр жагсаалт хоосон тул
  // report_url/source_url багана руу ухарна.
  //
  // ЗУРАГ энд ОРОХГҮЙ: хөрөнгийн зургийг хүснэгтийн "Харах" товчоор нээнэ
  // (snapshot доторх photo_pdf_url).
  const legacyFiles: ValuationHistoryFile[] = [
    ...(snapshot.report_url
      ? [
          {
            label: "Баталгаажсан тайлан",
            name: snapshot.report_name,
            href: snapshot.report_url,
            tone: "emerald" as const,
          },
        ]
      : []),
    ...(snapshot.source_url
      ? [
          {
            label: "Үнэлгээний хүснэгт",
            name: snapshot.source_name,
            href: snapshot.source_url,
          },
        ]
      : []),
  ];
  const detailFiles: ValuationHistoryFile[] = (
    snapshot.files?.length
      ? snapshot.files.map((f) => ({
          label: f.label,
          name: f.name,
          href: f.url,
          tone:
            f.label === "Баталгаажсан тайлан" ? ("emerald" as const) : undefined,
        }))
      : legacyFiles
  ).filter(
    (f, i, arr) => !!f.href && arr.findIndex((x) => x.href === f.href) === i,
  );

  // Барилгын үзүүлэлт/өртгийн багануудыг snapshot доторх spec/calc-аас бэлдэнэ
  // (табтай ИЖИЛ бүтэц: багана = барилга, мөр = үзүүлэлт).
  const snapshotSpecColumns = snapshot.assets
    .filter((a) => a.asset_type === "real_state" && (a.specs ?? []).some((sp) => (sp.value ?? "").trim() !== ""))
    .map((a) => ({
      id: String(a.id ?? ""),
      name: a.asset_name || "Барилга",
      items: [
        { label: "Давхрын тоо", value: a.floor_count ? String(a.floor_count) : "" },
        ...(a.specs ?? []).map((sp) => ({ label: sp.spec_name ?? "", value: sp.value ?? "" })),
        { label: "Талбай", value: formatArea(Number(a.area_m2 ?? 0)) },
      ],
    }));
  const snapshotCostColumns = snapshot.assets
    .filter((a) => a.asset_type === "real_state" && (a.calculations ?? []).some((c) => Number(c.value) !== 0))
    .map((a) => ({
      id: String(a.id ?? ""),
      name: a.asset_name || "Барилга",
      items: [
        { label: "Барилгын талбай", group: "", unit: "м²", value: Number(a.area_m2 ?? 0) || null },
        ...(a.calculations ?? [])
          .filter((c) => Number(c.value) !== 0)
          .map((c) => ({
            label:
              c.calc_name ||
              calcTypes.find((t) => t.id === c.calc_type_id)?.name ||
              "Үзүүлэлт",
            group: c.calc_group ?? calcTypes.find((t) => t.id === c.calc_type_id)?.grp ?? "",
            unit: c.unit ?? "",
            value: Number(c.value),
          })),
      ],
    }));

  // Бусад эд хөрөнгө ба зардлын хүснэгтүүд — табтай ИЖИЛ дүрмээр ангилна.
  const snapshotCostMatched = new Set<string>();
  const snapshotCostSections = V_COST_GROUPS.map((g) => {
    const rows = propertyRows.filter((r) => {
      const hay = `${r.asset.description ?? ""} ${r.asset.notes ?? ""} ${r.asset.asset_name ?? ""}`;
      const hit = g.match.test(hay);
      if (hit) snapshotCostMatched.add(r.asset.id);
      return hit;
    });
    return { key: g.key, title: g.title, rows };
  });
  snapshotCostSections.unshift({
    key: "other_assets" as (typeof V_COST_GROUPS)[number]["key"],
    title: "Бусад эд хөрөнгийн үнэлгээ",
    rows: propertyRows.filter((r) => !snapshotCostMatched.has(r.asset.id)),
  });

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
            {/* Тайлан нь доорх "Хавсаргасан файлууд" хэсэгт бусад файлын
                хамт гарна — толгойд давхардуулахгүй. */}
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

          {/* ХАВСАРГАСАН ФАЙЛУУД — ЗӨВХӨН энэ цуцлалтад хамаарах файлууд
              (Баталгаажсан тайлан, Тайлан, Үнэлгээний хүснэгт). Цуцлах үед
              эдгээр нь parcel_document / илгээлтийн мөрөөс хасагдаж snapshot-д
              холбогддог тул өөр газар (Баримт бичиг, Нөхөх олговор) харагдахгүй.
              Зургийг хүснэгтийн "Харах" товчоор нээнэ. */}
          {detailFiles.length > 0 && (
            <div className="ap-card px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Хавсаргасан файлууд
              </p>
              <div className="flex flex-wrap gap-2">
                {detailFiles.map((f, i) => (
                  <VFileChip key={i} label={f.label} name={f.name} href={f.href} tone={f.tone} />
                ))}
              </div>
            </div>
          )}

          {/* ХҮСНЭГТҮҮД — "Нөхөх олговор" табтай ЯГ ижил бүтэц, ижил компонент
              (valuation_view). Ялгаа нь зөвхөн ЗАСАХ боломжгүй: түүх тул бүх
              нүд зөвхөн уншигдана. */}
          {hasLandValuation && (
            <VSection
              icon={ReceiptText}
              title={sectionHeading("land_valuation").title}
              tone="emerald"
              right={
                <VHeadRight
                  label={sectionHeading("land_valuation").label}
                  extra={
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {money(landTotal)}
                    </span>
                  }
                />
              }
            >
              <VLandValuationTable
                total={landTotal}
                areaCell={<span className="font-semibold">{landArea ? landArea.toLocaleString() : "—"}</span>}
                priceCell={<span className="font-semibold">{landPrice ? landPrice.toLocaleString() : "—"}</span>}
              />
            </VSection>
          )}

          <VSection
            icon={Boxes}
            title={sectionHeading("property_desc").title}
            tone="sky"
            right={
              <VHeadRight
                label={sectionHeading("property_desc").label}
                extra={<span className="text-slate-400">{assets.length} хөрөнгө</span>}
              />
            }
          >
            <VAssetsTable
              rows={[...realStateRows, ...propertyRows].map((row, i) => ({
                id: row.asset.id,
                seq: i + 1,
                name: row.asset.asset_name || ASSET_TYPE_LABELS[row.asset.asset_type],
                kind: row.asset.asset_type,
                unit: row.asset.unit,
                qty: row.asset.area_m2 || null,
                total: row.total,
                description: row.asset.description || "",
                hasPhoto: !!row.asset.photo_pdf_url,
              }))}
              showPhoto
              renderPhoto={(row) => {
                const a = assets.find((x) => x.id === row.id);
                return <VPhotoMark has={!!a?.photo_pdf_url} href={a?.photo_pdf_url} />;
              }}
              emptyText="Хөрөнгө бүртгэгдээгүй"
            />
          </VSection>

          {snapshotSpecColumns.length > 0 && (
            <VSection
              icon={Building2}
              title={sectionHeading("building_spec").title}
              tone="sky"
              right={<VHeadRight label={sectionHeading("building_spec").label} />}
            >
              <VBuildingSpecTable columns={snapshotSpecColumns} />
            </VSection>
          )}

          {snapshotCostColumns.length > 0 && (
            <VSection
              icon={Calculator}
              title={sectionHeading("building_cost").title}
              tone="sky"
              right={<VHeadRight label={sectionHeading("building_cost").label} />}
            >
              <VBuildingCostTable columns={snapshotCostColumns} />
            </VSection>
          )}

          {snapshotCostSections.map(({ key, title, rows }) =>
            rows.length === 0 ? null : (
              <VSection
                key={key}
                icon={key === "other_assets" ? Boxes : Truck}
                title={sectionHeading(key).title || title}
                tone={key === "other_assets" ? "sky" : "amber"}
                right={
                  <VHeadRight
                    label={sectionHeading(key).label}
                    extra={
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {money(sumCompensations(rows.flatMap((r) => r.compensations)))}
                      </span>
                    }
                  />
                }
              >
                <VCostTable
                  rows={rows.map((r) => ({
                    id: r.asset.id,
                    name: r.asset.asset_name || "—",
                    unit: r.asset.unit,
                    qty: r.asset.area_m2 || null,
                    unitPrice: r.asset.unit_price || null,
                    total: r.total,
                    hasPhoto: !!r.asset.photo_pdf_url,
                  }))}
                  showPhoto
                  renderPhoto={(row) => {
                    const a = assets.find((x) => x.id === row.id);
                    return <VPhotoMark has={!!a?.photo_pdf_url} href={a?.photo_pdf_url} />;
                  }}
                />
              </VSection>
            ),
          )}

          {landComps.length > 0 && (
            <VSection
              icon={ReceiptText}
              title="Газрын олговор"
              tone="emerald"
              right={
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {money(totals.landTotal)}
                </span>
              }
            >
              {landComps.map((comp) => (
                <div
                  key={comp.id}
                  className="flex items-center justify-between gap-2 border-b border-slate-50 px-4 py-2.5 text-[12px] last:border-0 dark:border-[#37394d]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-slate-700 dark:text-slate-200">
                      {comp.note?.trim() || COMP_TYPE_LABELS[comp.compensation_type] || comp.compensation_type}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type} ·{" "}
                      {comp.coverage_percent}%
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-white">
                    {money(comp.amount)}
                  </span>
                </div>
              ))}
            </VSection>
          )}

          {(landTotal > 0 || totals.assetTotal > 0) && (
            <VSection
              icon={CircleDollarSign}
              title={sectionHeading("summary").title}
              tone="slate"
              right={
                <VHeadRight
                  label={sectionHeading("summary").label}
                  extra={
                    <span className="font-semibold text-[#02c0ce]">
                      {money(grandTotal || snapshotTotal(snapshot))}
                    </span>
                  }
                />
              }
            >
              <VSummaryTable
                rows={[
                  { label: "Газрын үнэлгээ", value: landTotal },
                  {
                    label: "Үл хөдлөх хөрөнгө",
                    value: sumCompensations(realStateRows.flatMap((r) => r.compensations)),
                  },
                  {
                    label: "Эд хөрөнгө, зардал",
                    value: sumCompensations(propertyRows.flatMap((r) => r.compensations)),
                  },
                ]}
                total={grandTotal || snapshotTotal(snapshot)}
              />
            </VSection>
          )}
        </div>
      </div>
    </div>
  );
}

/** Түүхэн snapshot дээр харуулах хавсаргасан файл (тайлан, эх Excel). */
interface ValuationHistoryFile {
  label: string;
  name?: string;
  href?: string;
  tone?: "sky" | "emerald" | "slate";
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
