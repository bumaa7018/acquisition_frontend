"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { ConfirmDialog, type PendingConfirm } from "./_components/confirm-dialog";
import { STATUS_CFG, hasPermission, isSeniorSpecialist } from "./_components/shared";
import { GeneralTab } from "./_components/general-tab";
import { AttachmentsTab } from "./_components/attachments-tab";
import { ProgressTab } from "./_components/progress-tab";
import { AssigneesTab } from "./_components/assignees-tab";
import { ParcelsTab } from "./_components/parcels-tab";
import { STATUS_LABELS, ACQ_STATUS } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import {
  canAccessAcquisition,
  isExternalSpecialRole,
  isProfessionalOrg,
} from "@/lib/role-utils";
import {
  ArrowLeft,
  MapPin,
  RefreshCw,
  Trash2,
  Pencil,
  X,
  LayoutList,
  Paperclip,
  Activity,
  Map,
  ReceiptText,
  Plus,
  FileDown,
  Calculator,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const AcquisitionMap = dynamic(
  () => import("@/components/map/acquisition-map").then((m) => m.AcquisitionMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

type Tab =
  | "general"
  | "attachments"
  | "progress"
  | "parcels"
  | "assignees"
  | "map"
  | "financing";

// ─── Financing tab ────────────────────────────────────────────────────────────
function FinancingTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const isSenior = isSeniorSpecialist() && canEdit;

  const EMPTY_FORM = { organization_name: "", source_type: "", amount: "", currency: "MNT", note: "" };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["funding-sources", id],
    queryFn: () => landApi.listFundingSources(id),
  });

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        organization_name: form.organization_name,
        source_type: form.source_type,
        amount: form.amount ? Number(form.amount) : undefined,
        currency: form.currency || undefined,
        note: form.note || undefined,
      };
      return editId
        ? landApi.updateFundingSource(id, editId, body)
        : landApi.createFundingSource(id, body);
    },
    onSuccess: () => {
      toast.success(editId ? "Мэдээлэл шинэчлэгдлээ" : "Санхүүжилтын эх үүсвэр нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["funding-sources", id] });
      closeForm();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (srcId: string) => landApi.deleteFundingSource(id, srcId),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["funding-sources", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const inp = "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  return (
    <div className="flex flex-col gap-5">
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Санхүүжилтын эх үүсвэрүүд
          </p>
          {isSenior && !showForm && (
            <button
              onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-3 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Нэмэх
            </button>
          )}
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-3">
              {editId ? "Засварлах" : "Шинэ санхүүжилтын эх үүсвэр"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилт хийх байгууллага *</p>
                <input
                  value={form.organization_name}
                  onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
                  placeholder="Байгууллагын нэр..."
                  className={inp}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилтын эх үүсвэрийн төрөл *</p>
                <input
                  value={form.source_type}
                  onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
                  placeholder="Улсын төсөв / Гадаадын зээл / Орон нутгийн төсөв..."
                  className={inp}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилтын дүн</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className={inp}
                  />
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="h-9 w-24 shrink-0 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                  >
                    <option value="MNT">MNT</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Тайлбар</p>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Нэмэлт тайлбар..."
                  className={inp}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.organization_name.trim() || !form.source_type.trim()}
                className="h-9 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
              <button
                onClick={closeForm}
                className="h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] px-4 text-[13px] text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
              >
                Болих
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-5 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !sources.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <ReceiptText className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Санхүүжилтын эх үүсвэр бүртгэгдээгүй</p>
            {isSenior && <p className="text-[12px] mt-1 text-slate-400">&ldquo;Нэмэх&rdquo; товч дарж бүртгэнэ үү</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                  {["#", "Байгууллага", "Эх үүсвэрийн төрөл", "Дүн", "Тайлбар", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                {sources.map((src, i) => (
                  <tr key={src.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{src.organization_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{src.source_type || "—"}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {src.amount != null ? `${src.amount.toLocaleString()} ${src.currency ?? "MNT"}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{src.note || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {isSenior && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditId(src.id);
                              setForm({
                                organization_name: src.organization_name,
                                source_type: src.source_type,
                                amount: src.amount != null ? String(src.amount) : "",
                                currency: src.currency ?? "MNT",
                                note: src.note ?? "",
                              });
                              setShowForm(true);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 dark:border-white/[0.08] px-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Засах
                          </button>
                          <button
                            onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(src.id); }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {sources.some((s) => s.amount != null) && (
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                    <td colSpan={3} className="px-4 py-3 text-right text-[12px] font-semibold text-slate-500">Нийт дүн</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white tabular-nums">
                      {sources.reduce((s, src) => s + (src.amount ?? 0), 0).toLocaleString()} MNT
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
async function generateReport(acqId: string) {
  const { authStorage } = await import("@/lib/auth");
  const token = authStorage.getAccessToken();

  const res = await fetch(`/api/report/acquisition/${acqId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Report generation failed");

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, ""))
    : "2010_тайлан.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam as Tab) ?? "general";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tabKey, setTabKey] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();

  function handleTabClick(key: Tab) {
    setTab(key);
    setTabKey((k) => k + 1);
  }
  const canEditBase = hasPermission("acquisition.create");

  const { data: acq, isLoading, error } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
    retry: (failCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return failCount < 2;
    },
  });

  const { data: accessParcels, isLoading: accessParcelsLoading } = useQuery({
    queryKey: ["land-parcels-access", id],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 1000 }),
    enabled: isExternal && isProfOrg && !!acq,
  });

  if (isLoading || accessParcelsLoading)
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
        <div className="h-12 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
        <div className="h-64 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
      </div>
    );

  const errStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  if (errStatus === 403)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтэд ажиллах эрх танд олгогдоогүй байна.
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
            Ахлах мэргэжилтэнтэй холбогдоно уу.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  if (!acq)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
        Олдсонгүй
      </div>
    );

  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1];
  const canAccessCurrentAcquisition = canAccessAcquisition(
    acq.professional_org_id,
    accessParcels?.data,
  );

  if (!canAccessCurrentAcquisition)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтөд таны байгууллага холбогдоогүй байна.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const isAcqLocked = acq?.status === ACQ_STATUS.CONFIRMED;

  // Баталгаажсан чөлөөлөлтийн дэлгэрэнгүйд гадаад байгуулгуудын хандалтыг хаана
  if (isExternal && isAcqLocked)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Дэлгэрэнгүй мэдээлэл хаалттай
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Энэ чөлөөлөлт <strong className="text-slate-600 dark:text-slate-300">Баталгаажсан</strong> төлөвтэй тул зөвхөн систем администратор харах боломжтой.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const canEdit = canEditBase && !isAcqLocked;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general",
      label: "Ерөнхий мэдээлэл",
      icon: <LayoutList className="h-4 w-4" />,
    },
    {
      key: "attachments",
      label: "Хавсралт",
      icon: <Paperclip className="h-4 w-4" />,
    },
    {
      key: "parcels",
      label: "Нэгж талбарууд",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: "financing",
      label: "Санхүүжилт",
      icon: <Calculator className="h-4 w-4" />,
    },
    { key: "progress", label: "Явц", icon: <Activity className="h-4 w-4" /> },
    {
      key: "assignees",
      label: "Ажилтнууд",
      icon: <Users className="h-4 w-4" />,
    },
    { key: "map", label: "Байршил", icon: <Map className="h-4 w-4" /> },
  ];
  const visibleTabs = isExternal
    ? TABS.filter((item) => item.key === "general" || item.key === "parcels")
    : TABS;
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : "general";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/acquisition"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {acq.acquisition_name || acq.plan_code}
            </h1>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: sc.color, background: sc.bg }}
            >
              {STATUS_LABELS[acq.status] ?? "Тодорхойгүй"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {acq.plan_code}
            {acq.plan_name ? ` · ${acq.plan_name}` : ""}
          </p>
        </div>
        {!isExternal && (
          <button
            disabled={reportLoading}
            onClick={async () => {
              setReportLoading(true);
              try {
                await generateReport(id);
              } catch {
                toast.error("Тайлан үүсгэхэд алдаа гарлаа");
              } finally {
                setReportLoading(false);
              }
            }}
            className="flex shrink-0 items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-50 transition-colors"
          >
            {reportLoading ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Тайлан татах
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[100px] whitespace-nowrap transition-all select-none
                ${
                  active
                    ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"
                }`}
            >
              {/* active indicator — top border */}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span
                className={`transition-colors ${active ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}`}
              >
                {t.icon}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-wide transition-colors ${active ? "text-[#02c0ce]" : ""}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content — key changes on every click (incl. re-click) → remount → fresh fetch */}
      {isAcqLocked && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3">
          <span className="text-amber-500 shrink-0">🔒</span>
          <p className="text-[13px] text-amber-700 dark:text-amber-400 font-medium">
            Энэ чөлөөлөлт <strong>Баталгаажсан</strong> төлөвтэй байгаа тул ямар нэгэн засвар хийх боломжгүй.
          </p>
        </div>
      )}
      {activeTab === "general" && <GeneralTab key={tabKey} id={id} canEdit={canEdit && !isExternal} />}
      {activeTab === "attachments" && <AttachmentsTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "progress" && <ProgressTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "parcels" && (
        <ParcelsTab
          key={tabKey}
          id={id}
          acquisitionProfOrgId={acq.professional_org_id}
          isAcqLocked={isAcqLocked}
        />
      )}
      {activeTab === "assignees" && <AssigneesTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "financing" && <FinancingTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "map" && (
        <div key={tabKey} className="ap-card p-5">
          <AcquisitionMap acquisitionId={id} aus={acq.aus} />
        </div>
      )}
    </div>
  );
}
