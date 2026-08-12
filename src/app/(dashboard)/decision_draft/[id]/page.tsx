"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Gavel,
  Pencil,
  Plus,
  Link2,
  X,
  History,
  CheckCircle2,
  Download,
} from "lucide-react";
import {
  decisionDraftApi,
  decisionWorkTypeApi,
  decisionBudgetApi,
} from "@/lib/api";
import {
  DECISION_DRAFT_STATUS_LABELS,
  DECISION_DRAFT_STATUS_STYLES,
  DECISION_DRAFT_STATUS_DRAFT,
  DECISION_DRAFT_STATUS_CONFIRMED,
  getParcelStatusStyle,
} from "@/types";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import { canUpdateDecisionDraft, canViewDecisionDrafts } from "@/lib/role-utils";
import { notifyNavStart } from "@/lib/blocking-loader-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DecisionDraftForm,
  type DecisionDraftFormValue,
} from "../_components/decision_draft_form";
import { LinkParcelDialog } from "./_components/link_parcel_dialog";
import { ConfirmDecisionDialog } from "./_components/confirm_decision_dialog";
import { FundingSourcesCard } from "./_components/funding_sources_card";

export default function DecisionDraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; parcelId: string } | null>(null);
  // Холбогдсон нэгж талбарын эх үүсвэрийг мөрөн дотор солино
  const [fundingEditRow, setFundingEditRow] = useState<string | null>(null);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);

  // Эрх нь token-оос (localStorage) уншигдана — зөвхөн mount-ийн дараа тодорхой.
  const [ready, setReady] = useState(false);
  const [perms, setPerms] = useState({ view: false, update: false });

  useEffect(() => {
    setPerms({ view: canViewDecisionDrafts(), update: canUpdateDecisionDraft() });
    setReady(true);
  }, []);
  // decision:read эрхгүй бол бүх дуудалт 403 болох тул хийхгүй
  const canLoad = ready && perms.view;

  const { data: item, isLoading } = useQuery({
    queryKey: ["decision-draft", id],
    queryFn: () => decisionDraftApi.get(id),
    enabled: canLoad,
  });

  const { data: parcels = [], isLoading: parcelsLoading } = useQuery({
    queryKey: ["decision-draft-parcels", id],
    queryFn: () => decisionDraftApi.listParcels(id),
    enabled: canLoad,
  });
  const { data: progressHistory = [], isLoading: progressLoading } = useQuery({
    queryKey: ["decision-draft-progress-history", id],
    queryFn: () => decisionDraftApi.listProgressHistory(id),
    enabled: canLoad,
  });

  const { data: workTypes = [] } = useQuery({
    queryKey: ["decision-work-types"],
    queryFn: () => decisionWorkTypeApi.list(),
    enabled: canLoad,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["decision-budgets"],
    queryFn: () => decisionBudgetApi.list(),
    enabled: canLoad,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["decision-draft", id] });
    queryClient.invalidateQueries({ queryKey: ["decision-draft-parcels", id] });
    queryClient.invalidateQueries({ queryKey: ["decision-draft-progress-history", id] });
    queryClient.invalidateQueries({ queryKey: ["decision-drafts"] });
  }

  async function downloadDocx() {
    const token = authStorage.getAccessToken();
    if (!token) {
      toast.error("Нэвтрэх шаардлагатай");
      return;
    }

    setIsDownloadingDocx(true);
    try {
      const res = await fetch(`/api/decision-draft/${encodeURIComponent(id)}/docx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
      a.href = url;
      a.download = match?.[1] ? decodeURIComponent(match[1]) : match?.[2] ?? "decision_draft.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Төсөл татахад алдаа гарлаа");
    } finally {
      setIsDownloadingDocx(false);
    }
  }

  const updateMutation = useMutation({
    mutationFn: (v: DecisionDraftFormValue) =>
      decisionDraftApi.update(id, {
        proposal_no: v.proposal_no.trim(),
        location: v.location.trim(),
        duration_year: v.duration_year ? Number(v.duration_year) : null,
        work_type_id: v.work_type_id || null,
        budget_id: v.budget_id || null,
      }),
    onSuccess: () => {
      toast.success("Амжилттай шинэчиллээ");
      setEditing(false);
      refresh();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const setParcelFundingMutation = useMutation({
    mutationFn: ({ linkId, fundingLinkId }: { linkId: string; fundingLinkId: string }) =>
      decisionDraftApi.setParcelFundingSource(id, linkId, fundingLinkId),
    onSuccess: () => {
      toast.success("Санхүүгийн эх үүсвэр солигдлоо");
      setFundingEditRow(null);
      refresh();
    },
    onError: (err) => toast.error(getApiError(err, "Солиход алдаа гарлаа")),
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => decisionDraftApi.unlinkParcel(id, linkId),
    onSuccess: () => {
      toast.success("Нэгж талбар хасагдлаа");
      setUnlinkTarget(null);
      refresh();
    },
    onError: (err) => toast.error(getApiError(err, "Хасахад алдаа гарлаа")),
  });

  if (ready && !perms.view) {
    return (
      <div className="ap-card p-8 text-center">
        <Gavel className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-[#37394d]" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Энэ хуудсыг харах эрх байхгүй байна.
        </p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          Захирамжийн төсөл харахад <code>decision:read</code> эрх шаардлагатай.
        </p>
      </div>
    );
  }

  if (!ready || isLoading) {
    return (
      <div className="ap-card p-5 space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="ap-card flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Gavel className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
        <p className="text-[13px]">Захирамжийн төсөл олдсонгүй</p>
      </div>
    );
  }

  const isConfirmed = item.status === DECISION_DRAFT_STATUS_CONFIRMED;
  const canUpdate = perms.update;
  const sc =
    DECISION_DRAFT_STATUS_STYLES[item.status] ??
    DECISION_DRAFT_STATUS_STYLES[DECISION_DRAFT_STATUS_DRAFT];

  const active = parcels.filter((p) => !p.removed_at);
  const removed = parcels.filter((p) => p.removed_at);
  const acquisitionNames = Array.from(
    new Set(active.map((p) => p.acquisition_name?.trim()).filter(Boolean)),
  );
  // Захирамжид нэмэгдсэн эх үүсвэрүүд — холбох/солих сонголтод хэрэглэнэ
  const fundingSources = item.funding_sources ?? [];
  const editable = canUpdate && !isConfirmed;
  const currentProgressLabel = item.current_progress_type_name || "Төсөл";
  const currentProgressDetail = [
    item.current_progress_recipient,
    item.current_progress_date ? formatDate(item.current_progress_date) : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/decision_draft")}
            className="mt-1 rounded-lg border border-slate-200 dark:border-[#37394d] p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                {item.proposal_no}
              </h1>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                style={{ color: sc.color, background: sc.bg }}
              >
                {DECISION_DRAFT_STATUS_LABELS[item.status] ?? "—"}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
              {item.decree_number
                ? `Захирамж ${item.decree_number}${item.decision_date ? ` · ${formatDate(item.decision_date)}` : ""}`
                : "Захирамжийн дугаар хараахан олгогдоогүй"}
            </p>
            <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">
              Одоогийн явц: <span className="font-semibold">{currentProgressLabel}</span>
              {currentProgressDetail ? ` · ${currentProgressDetail}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadDocx}
            disabled={isDownloadingDocx}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/10 text-[13px] font-semibold text-[#0299a5] hover:bg-[#02c0ce]/15 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            {isDownloadingDocx ? "Татаж байна..." : "Төсөл татах"}
          </button>
          {canUpdate && !isConfirmed && (
            <>
            <button
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 dark:border-[#37394d] text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
            >
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Болих" : "Засварлах"}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#0acf97] text-white text-[13px] font-semibold hover:bg-[#09b886] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Явц нэмэх
            </button>
            </>
          )}
        </div>
      </div>

      {isConfirmed && (
        <div className="ap-card flex items-center gap-2.5 px-4 py-3 border-l-4 border-l-[#0acf97]">
          <CheckCircle2 className="h-4 w-4 text-[#0acf97]" />
          <p className="text-[12px] text-slate-600 dark:text-slate-300">
            Энэ захирамж баталгаажсан тул өөрчлөлт оруулах боломжгүй.
            {item.confirmed_at && ` Баталгаажсан: ${formatDate(item.confirmed_at)}`}
          </p>
        </div>
      )}

      {/* Ерөнхий мэдээлэл */}
      <div className="ap-card p-5">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
          Ерөнхий мэдээлэл
        </p>

        {editing ? (
          <DecisionDraftForm
            initial={item}
            workTypes={workTypes}
            budgets={budgets}
            submitLabel="Хадгалах"
            isPending={updateMutation.isPending}
            onSubmit={(v) => updateMutation.mutate(v)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Саналын хуудасны дугаар" value={item.proposal_no} mono />
            <Field label="Захирамжийн дугаар" value={item.decree_number || "—"} mono />
            <Field
              label="Огноо"
              value={item.decision_date ? formatDate(item.decision_date) : "—"}
            />
            <Field label="Байршил" value={item.location || "—"} />
            <Field label="Хугацаа (он)" value={item.duration_year?.toString() ?? "—"} />
            <Field
              label="Одоогийн явц"
              value={`${currentProgressLabel}${currentProgressDetail ? ` · ${currentProgressDetail}` : ""}`}
            />
            <Field label="Ажлын төрөл" value={item.work_type_name || "—"} />
            <Field label="Төсөв" value={item.budget_name || "—"} />
            <Field
              label="Газар чөлөөлөлт"
              value={
                acquisitionNames.length > 0
                  ? acquisitionNames.join(", ")
                  : item.acquisition_name || "— (нэгж талбар холбоход тодорхойлогдоно)"
              }
            />
          </dl>
        )}
      </div>

      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
              Явцын түүх
            </p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
              {progressHistory.length} бичлэг
            </p>
          </div>
        </div>

        {progressLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : progressHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <History className="h-8 w-8 text-slate-300 dark:text-[#37394d] mb-2" />
            <p className="text-[13px]">Явцын түүх бүртгэгдээгүй байна</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["Явцын төрөл", "Хэнд", "Огноо", "Тайлбар"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {progressHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {h.progress_type_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {h.recipient || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(h.progress_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <p className="whitespace-pre-wrap break-words">{h.note || "—"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Санхүүгийн эх үүсвэр — үүсгэсний дараа олноор нэмнэ */}
      <FundingSourcesCard
        draftId={id}
        items={fundingSources}
        editable={editable}
        onChanged={refresh}
      />

      {/* Нэгж талбарууд */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
              Нэгж талбар
            </p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
              Идэвхтэй {active.length}
              {removed.length > 0 && ` · Хасагдсан ${removed.length}`}
            </p>
          </div>
          {canUpdate && !isConfirmed && (
            <button
              onClick={() => {
                // Нэгж талбар бүр эх үүсвэртэй холбогддог тул эхлээд эх
                // үүсвэр нэмсэн байх ёстой (backend мөн шалгана).
                if (fundingSources.length === 0) {
                  toast.error("Эхлээд санхүүгийн эх үүсвэр нэмнэ үү");
                  return;
                }
                setShowLink(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02a3af] transition-colors"
            >
              <Link2 className="h-4 w-4" />
              Нэгж талбар холбох
            </button>
          )}
        </div>

        {parcelsLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : parcels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
            <p className="text-[13px]">Холбогдсон нэгж талбар алга</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {[
                    "Дугаар",
                    "Чөлөөлөлт",
                    "Талбай",
                    "Зориулалт",
                    "Нөхөх олговор",
                    "Санхүүгийн эх үүсвэр",
                    "Төлөв",
                    "Холбосон",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {parcels.map((p) => {
                  const isRemoved = !!p.removed_at;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isRemoved
                          ? "opacity-50 bg-slate-50/40 dark:bg-[#1a1d20]/60"
                          : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5">
                          {p.parcel_id}
                          {isRemoved && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-[#252630] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              <History className="h-2.5 w-2.5" /> Хасагдсан
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-slate-600 dark:text-slate-300 truncate">
                          {p.acquisition_name || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatArea(p.area_m2)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {p.landuse || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatMoney(p.compensation_amount)}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {fundingEditRow === p.id ? (
                          <select
                            autoFocus
                            defaultValue={p.funding_link_id ?? ""}
                            onChange={(e) =>
                              e.target.value &&
                              setParcelFundingMutation.mutate({
                                linkId: p.id,
                                fundingLinkId: e.target.value,
                              })
                            }
                            onBlur={() => setFundingEditRow(null)}
                            className="h-8 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15"
                          >
                            <option value="">— Сонгох —</option>
                            {fundingSources.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.organization_name} — {f.source_type}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-slate-600 dark:text-slate-300">
                              {p.funding_organization
                                ? `${p.funding_organization} — ${p.funding_source_type}`
                                : "—"}
                            </span>
                            {editable && !isRemoved && (
                              <button
                                onClick={() => setFundingEditRow(p.id)}
                                title="Санхүүгийн эх үүсвэр солих"
                                className="shrink-0 rounded p-1 text-slate-400 hover:text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.parcel_status_name ? (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                            style={getParcelStatusStyle(p.parcel_status, p.parcel_status_name)}
                          >
                            {p.parcel_status_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(p.linked_at)}
                        {isRemoved && p.removed_at && (
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                            Хассан: {formatDate(p.removed_at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/parcel/${p.parcel_uuid}?acq=${p.acquisition_id}`}
                            onClick={notifyNavStart}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap"
                          >
                            Дэлгэрэнгүй
                          </Link>
                          {canUpdate && !isConfirmed && !isRemoved && (
                            <button
                              onClick={() =>
                                setUnlinkTarget({ id: p.id, parcelId: p.parcel_id })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-400/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-400/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap"
                            >
                              <X className="h-3 w-3" /> Хасах
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showLink && (
        <LinkParcelDialog
          draftId={id}
          fundingSources={fundingSources}
          onClose={() => setShowLink(false)}
          onLinked={() => {
            setShowLink(false);
            refresh();
          }}
        />
      )}

      {showConfirm && (
        <ConfirmDecisionDialog
          draftId={id}
          onClose={() => setShowConfirm(false)}
          onConfirmed={() => {
            setShowConfirm(false);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!unlinkTarget}
        title="Нэгж талбарыг хасах уу?"
        description={`${unlinkTarget?.parcelId ?? ""} — хасагдсан бичлэг түүхэнд үлдэж, тухайн нэгж талбар өөр захирамжид холбогдох боломжтой болно.`}
        confirmLabel="Хасах"
        onConfirm={() => unlinkTarget && unlinkMutation.mutate(unlinkTarget.id)}
        onClose={() => setUnlinkTarget(null)}
      />
    </div>
  );
}

function formatMoney(value?: number): string {
  const amount = Number(value) || 0;
  if (amount <= 0) return "—";
  return `${amount.toLocaleString("mn-MN", { maximumFractionDigits: 0 })}₮`;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-slate-400 dark:text-slate-500 mb-1">
        {label}
      </dt>
      <dd
        className={`text-[13px] text-slate-700 dark:text-slate-200 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
