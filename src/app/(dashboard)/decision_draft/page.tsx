"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  decisionDraftApi,
  decisionWorkTypeApi,
  decisionBudgetApi,
} from "@/lib/api";
import {
  DECISION_DRAFT_STATUS_LABELS,
  DECISION_DRAFT_STATUS_STYLES,
  DECISION_DRAFT_STATUS_DRAFT,
} from "@/types";
import type { DecisionDraft } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import { canCreateDecisionDraft, canViewDecisionDrafts } from "@/lib/role-utils";
import { Search, X, Plus, Gavel, Download } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { authStorage } from "@/lib/auth";
import { notifyNavStart } from "@/lib/blocking-loader-state";
import { DecisionDraftForm, type DecisionDraftFormValue } from "./_components/decision_draft_form";
import { AcquisitionSelect } from "../parcel/_components/acquisition_select";

const EMPTY_FILTER = {
  proposal_no: "",
  decree_number: "",
  acquisition_id: "",
  location: "",
  parcel_id: "",
  duration_year: "",
  status: 0,
};

const PAGE_SIZE = 20;
const SUMMARY_PAGE_SIZE = 500;
const REMAINING_COLOR = "#e2e8f0";
const OVER_COLOR = "#f43f5e";
const CHART_COLORS = ["#02c0ce", "#0acf97", "#7c3aed", "#f59e0b", "#2563eb", "#db2777", "#14b8a6"];

type FundingSummary = {
  source: string;
  budget: number;
  issued: number;
  reviewing: number;
  used: number;
  balance: number;
};

function addAmount(target: Record<string, number>, source?: Record<string, number>) {
  Object.entries(source ?? {}).forEach(([key, value]) => {
    const name = key.trim();
    if (!name) return;
    target[name] = (target[name] ?? 0) + (Number(value) || 0);
  });
}

function buildFundingSummary(rows: DecisionDraft[]): FundingSummary[] {
  const budgets: Record<string, number> = {};
  const issued: Record<string, number> = {};
  const reviewing: Record<string, number> = {};
  const sourceNames = new Set<string>();

  rows.forEach((row) => {
    addAmount(budgets, row.funding_source_amounts);
    Object.keys(row.funding_source_amounts ?? {}).forEach((key) => sourceNames.add(key.trim()));
    Object.keys(row.funding_source_compensation_amounts ?? {}).forEach((key) => sourceNames.add(key.trim()));

    const target = row.status === 2 || row.current_progress_type === "confirming" ? issued : reviewing;
    addAmount(target, row.funding_source_compensation_amounts);
  });

  return Array.from(sourceNames)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "mn"))
    .map((source) => {
      const used = (issued[source] ?? 0) + (reviewing[source] ?? 0);
      return {
        source,
        budget: budgets[source] ?? 0,
        issued: issued[source] ?? 0,
        reviewing: reviewing[source] ?? 0,
        used,
        balance: (budgets[source] ?? 0) - used,
      };
    });
}

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("mn-MN")}₮`;
}

function formatBillion(value: number) {
  return `${(value / 1_000_000_000).toLocaleString("mn-MN", { maximumFractionDigits: 3 })} тэрбум`;
}

function sourceColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function pieData(item: FundingSummary, color: string) {
  const used = Math.max(item.used, 0);
  const budget = Math.max(item.budget, 0);
  if (budget <= 0 && used <= 0) {
    return [{ name: "Мэдээлэлгүй", value: 1, color: REMAINING_COLOR }];
  }
  if (used > budget) {
    return [
      { name: "Ашигласан", value: budget, color },
      { name: "Хэтэрсэн", value: used - budget, color: OVER_COLOR },
    ].filter((entry) => entry.value > 0);
  }
  return [
    { name: "Ашигласан", value: used, color },
    { name: "Үлдэгдэл", value: budget - used, color: REMAINING_COLOR },
  ].filter((entry) => entry.value > 0);
}

export default function DecisionDraftListPage() {
  const [draft, setDraft] = useState(EMPTY_FILTER);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [searchTick, setSearchTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();

  // Эрх нь token-оос (localStorage) уншигдана — зөвхөн mount-ийн дараа тодорхой.
  const [ready, setReady] = useState(false);
  const [perms, setPerms] = useState({ view: false, create: false });

  useEffect(() => {
    setPerms({ view: canViewDecisionDrafts(), create: canCreateDecisionDraft() });
    setReady(true);
  }, []);

  function applySearch() {
    setFilter({ ...draft });
    setPage(1);
    setSearchTick((t) => t + 1);
  }

  function clearAll() {
    setDraft(EMPTY_FILTER);
    setFilter(EMPTY_FILTER);
    setPage(1);
    setSearchTick((t) => t + 1);
  }

  async function downloadReport() {
    const token = authStorage.getAccessToken();
    if (!token) {
      toast.error("Нэвтрэх шаардлагатай");
      return;
    }

    const q = new URLSearchParams();
    if (filter.proposal_no) q.set("proposal_no", filter.proposal_no);
    if (filter.decree_number) q.set("decree_number", filter.decree_number);
    if (filter.acquisition_id) q.set("acquisition_id", filter.acquisition_id);
    if (filter.location) q.set("location", filter.location);
    if (filter.parcel_id) q.set("parcel_id", filter.parcel_id);
    if (filter.duration_year) q.set("duration_year", filter.duration_year);
    if (filter.status) q.set("status", String(filter.status));

    setIsDownloading(true);
    try {
      const res = await fetch(`/api/decision-draft/report?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      a.href = url;
      a.download = match?.[1] ?? "decision_report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Тайлан татахад алдаа гарлаа");
    } finally {
      setIsDownloading(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["decision-drafts", filter, page, searchTick],
    queryFn: () =>
      decisionDraftApi.list({
        page,
        page_size: PAGE_SIZE,
        proposal_no: filter.proposal_no || undefined,
        decree_number: filter.decree_number || undefined,
        acquisition_id: filter.acquisition_id || undefined,
        location: filter.location || undefined,
        parcel_id: filter.parcel_id || undefined,
        duration_year: filter.duration_year ? Number(filter.duration_year) : undefined,
        status: filter.status || undefined,
      }),
    // decision:read эрхгүй бол 403 болох тул дуудахгүй
    enabled: ready && perms.view,
  });

  const { data: summaryRows = [], isLoading: summaryLoading } = useQuery({
    queryKey: ["decision-drafts-summary", filter, searchTick],
    queryFn: async () => {
      const params = {
        page: 1,
        page_size: SUMMARY_PAGE_SIZE,
        proposal_no: filter.proposal_no || undefined,
        decree_number: filter.decree_number || undefined,
        acquisition_id: filter.acquisition_id || undefined,
        location: filter.location || undefined,
        parcel_id: filter.parcel_id || undefined,
        duration_year: filter.duration_year ? Number(filter.duration_year) : undefined,
        status: filter.status || undefined,
      };
      const first = await decisionDraftApi.list(params);
      const pages =
        first.total_pages > 1
          ? await Promise.all(
              Array.from({ length: first.total_pages - 1 }, (_, i) =>
                decisionDraftApi.list({ ...params, page: i + 2 }),
              ),
            )
          : [];
      return [first, ...pages].flatMap((result) => result.data ?? []);
    },
    enabled: ready && perms.view,
  });

  const fundingSummary = useMemo(() => buildFundingSummary(summaryRows), [summaryRows]);
  const summaryTotals = useMemo(
    () =>
      fundingSummary.reduce(
        (acc, item) => ({
          budget: acc.budget + item.budget,
          issued: acc.issued + item.issued,
          reviewing: acc.reviewing + item.reviewing,
          used: acc.used + item.used,
          balance: acc.balance + item.balance,
        }),
        { budget: 0, issued: 0, reviewing: 0, used: 0, balance: 0 },
      ),
    [fundingSummary],
  );
  const helperSummaryRows = useMemo(
    () => [
      {
        label: "Батлагдсан төсөв",
        values: fundingSummary.map((item) => item.budget),
        total: summaryTotals.budget,
      },
      {
        label: "Захирамж гарсан",
        values: fundingSummary.map((item) => item.issued),
        total: summaryTotals.issued,
      },
      {
        label: "Захирамжийн төсөлд хянагдаж байгаа",
        values: fundingSummary.map((item) => item.reviewing),
        total: summaryTotals.reviewing,
      },
      {
        label: "БҮГД",
        values: fundingSummary.map((item) => item.used),
        total: summaryTotals.used,
      },
      {
        label: "Зөрүү дүн",
        values: fundingSummary.map((item) => item.balance),
        total: summaryTotals.balance,
      },
    ],
    [fundingSummary, summaryTotals],
  );

  // Сонголтын жагсаалтууд — шүүлтүүр болон үүсгэх формд хамт хэрэглэнэ
  const { data: workTypes = [] } = useQuery({
    queryKey: ["decision-work-types"],
    queryFn: () => decisionWorkTypeApi.list(),
    enabled: ready && perms.view,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["decision-budgets"],
    queryFn: () => decisionBudgetApi.list(),
    enabled: ready && perms.view,
  });
  const createMutation = useMutation({
    mutationFn: (value: DecisionDraftFormValue) =>
      decisionDraftApi.create({
        proposal_no: value.proposal_no.trim(),
        location: value.location.trim(),
        duration_year: value.duration_year ? Number(value.duration_year) : null,
        work_type_id: value.work_type_id || null,
        budget_id: value.budget_id || null,
      }),
    onSuccess: () => {
      toast.success("Захирамжийн төсөл үүслээ");
      queryClient.invalidateQueries({ queryKey: ["decision-drafts"] });
      setShowCreate(false);
    },
    onError: (err) => toast.error(getApiError(err, "Үүсгэхэд алдаа гарлаа")),
  });

  const inp =
    "h-9 w-full min-w-0 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const hasFilter =
    draft.proposal_no ||
    draft.decree_number ||
    draft.acquisition_id ||
    draft.location ||
    draft.parcel_id ||
    draft.duration_year ||
    draft.status !== 0;

  const canCreate = perms.create;

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      {/* Header */}
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Захирамжийн төсөл</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Саналын хуудаснаас захирамж болтол явагдах бүртгэл
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[13px] text-slate-400 dark:text-slate-500">
            Нийт:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{data?.total ?? 0}</span>
          </div>
          <button
            onClick={downloadReport}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200 dark:hover:bg-[#252630]"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Татаж байна" : "Тайлан татах"}
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
            >
              {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showCreate ? "Болих" : "Шинээр үүсгэх"}
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            Шинэ захирамжийн төсөл
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mb-4">
            Захирамжийн дугаар болон огноог &quot;Явц нэмэх&quot; үед бөглөнө.
          </p>
          <DecisionDraftForm
            workTypes={workTypes}
            budgets={budgets}
            submitLabel="Үүсгэх"
            isPending={createMutation.isPending}
            onSubmit={(v) => createMutation.mutate(v)}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      <div className="ap-card w-full min-w-0 overflow-hidden">
        <div className="grid min-w-0 grid-cols-1 divide-y divide-slate-100 dark:divide-[#37394d] xl:grid-cols-[minmax(520px,1.12fr)_minmax(340px,0.78fr)] xl:divide-x xl:divide-y-0">
          <div className="order-2 min-w-0 p-5 xl:order-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                  Санхүүгийн эх үүсвэрийн ашиглалт
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                  Хайлтын үр дүнд гарсан {summaryRows.length.toLocaleString("mn-MN")} захирамж
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                Нийт {formatBillion(summaryTotals.budget)}
              </span>
            </div>

            {summaryLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.05]" />
                ))}
              </div>
            ) : fundingSummary.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-slate-400 dark:text-slate-500">
                Санхүүгийн эх үүсвэрийн мэдээлэл алга
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 2xl:grid-cols-2">
                {fundingSummary.map((item, index) => {
                  const accent = sourceColor(index);
                  const chartData = pieData(item, accent);
                  const usedPercent = item.budget > 0 ? Math.round((item.used / item.budget) * 100) : 0;
                  return (
                    <div
                      key={item.source}
                      className="min-w-0 rounded-lg border bg-white/60 p-3 shadow-sm dark:bg-white/[0.03]"
                      style={{ borderColor: `${accent}55` }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-24 w-24 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={25}
                                outerRadius={39}
                                paddingAngle={2}
                              >
                                {chartData.map((entry) => (
                                  <Cell key={`${item.source}-${entry.name}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value) => formatMoney(Number(value))}
                                contentStyle={{
                                  borderRadius: 8,
                                  border: "1px solid rgba(148,163,184,0.25)",
                                  fontSize: 12,
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
                            <p className="truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200" title={item.source}>
                              {item.source}
                            </p>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Нийт санхүүжилт</p>
                          <p className="text-[13px] font-bold tabular-nums text-slate-800 dark:text-white">
                            {formatMoney(item.budget)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Ашигласан</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{ color: accent }}>
                            {formatMoney(item.used)}
                          </p>
                          <p className={`mt-1 text-[11px] font-semibold tabular-nums ${item.balance < 0 ? "text-rose-500" : "text-slate-400 dark:text-slate-500"}`}>
                            {item.budget > 0 ? `${usedPercent.toLocaleString("mn-MN")}% ашигласан` : "Төсөвгүй"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="order-1 min-w-0 p-5 xl:order-1">
            <div className="mb-4">
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                Туслах хүснэгт
              </p>
              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                Санхүүгийн эх үүсвэр бүрийн батлагдсан болон зарцуулсан дүн
              </p>
            </div>

            {summaryLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-slate-100 dark:bg-white/[0.05]" />
                ))}
              </div>
            ) : fundingSummary.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-slate-400 dark:text-slate-500">
                Хүснэгтийн мэдээлэл алга
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#02c0ce]/10 dark:border-[#37394d] dark:bg-[#02c0ce]/10">
                      <th className="sticky left-0 z-10 min-w-[190px] bg-[#02c0ce]/10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#028995] dark:text-[#7ddfe7]">
                        Үзүүлэлт
                      </th>
                      {fundingSummary.map((item, index) => (
                        <th
                          key={item.source}
                          className="min-w-[150px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: sourceColor(index) }}
                        >
                          <p className="truncate" title={item.source}>{item.source}</p>
                        </th>
                      ))}
                      <th className="min-w-[130px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Бүгд
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                    {helperSummaryRows.map((row) => (
                      <tr
                        key={row.label}
                        className={`${
                          row.label === "Батлагдсан төсөв"
                            ? "bg-amber-50/70 dark:bg-amber-400/10"
                            : row.label === "БҮГД"
                              ? "bg-emerald-50/80 font-bold dark:bg-emerald-400/10"
                              : row.label === "Зөрүү дүн"
                                ? "bg-sky-50/70 dark:bg-sky-400/10"
                                : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 px-3 py-2 font-semibold ${
                            row.label === "Батлагдсан төсөв"
                              ? "bg-amber-50 text-amber-700 dark:bg-[#2d2515] dark:text-amber-300"
                              : row.label === "БҮГД"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-[#172821] dark:text-emerald-300"
                                : row.label === "Зөрүү дүн"
                                  ? "bg-sky-50 text-sky-700 dark:bg-[#142532] dark:text-sky-300"
                                  : "bg-white text-slate-700 dark:bg-[#1e1f27] dark:text-slate-200"
                          }`}
                        >
                          {row.label}
                        </td>
                        {row.values.map((value, i) => (
                          <td
                            key={`${row.label}-${fundingSummary[i]?.source ?? i}`}
                            className={`px-3 py-2 text-right tabular-nums ${
                              row.label === "Зөрүү дүн" && value < 0
                                ? "font-semibold text-rose-500"
                                : row.label === "БҮГД"
                                  ? "font-bold text-slate-800 dark:text-white"
                                  : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {formatMoney(value)}
                          </td>
                        ))}
                        <td
                          className={`px-3 py-2 text-right font-bold tabular-nums ${
                            row.label === "Зөрүү дүн" && row.total < 0 ? "text-rose-500" : "text-slate-800 dark:text-white"
                          }`}
                        >
                          {formatMoney(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ap-card w-full min-w-0 p-4">
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,0.62fr)_minmax(0,0.75fr)_auto_auto] items-center gap-2">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Саналын хуудасны дугаар"
              value={draft.proposal_no}
              onChange={(e) => setDraft((f) => ({ ...f, proposal_no: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className={`${inp} pl-8`}
            />
          </div>
          <input
            type="text"
            placeholder="Захирамжийн дугаар"
            value={draft.decree_number}
            onChange={(e) => setDraft((f) => ({ ...f, decree_number: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className={inp}
          />
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Нэгж талбарын дугаар"
              value={draft.parcel_id}
              onChange={(e) => setDraft((f) => ({ ...f, parcel_id: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className={`${inp} pl-8`}
            />
          </div>
          <AcquisitionSelect
            selectedId={draft.acquisition_id}
            onSelect={(id) => setDraft((f) => ({ ...f, acquisition_id: id }))}
            onClear={() => setDraft((f) => ({ ...f, acquisition_id: "" }))}
            className="min-w-0"
          />
          <input
            type="text"
            placeholder="Байршил"
            value={draft.location}
            onChange={(e) => setDraft((f) => ({ ...f, location: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className={inp}
          />
          <input
            type="number"
            placeholder="Хугацаа (он)"
            value={draft.duration_year}
            onChange={(e) => setDraft((f) => ({ ...f, duration_year: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className={inp}
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft((f) => ({ ...f, status: Number(e.target.value) }))}
            className={inp}
          >
            <option value={0}>Төлөв</option>
            {Object.entries(DECISION_DRAFT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <button
            onClick={applySearch}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90"
          >
            <Search className="h-3.5 w-3.5" />
            Хайх
          </button>

          {hasFilter && (
            <button
              onClick={clearAll}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 text-[12px] font-medium text-rose-500 transition-colors hover:border-rose-400 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-400 dark:hover:border-rose-400/60 dark:hover:bg-rose-400/20"
            >
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="ap-card w-full min-w-0 overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <Gavel className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
            <p className="text-[13px]">Захирамжийн төсөл олдсонгүй</p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  <th className="w-[22%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:w-[10%]">
                    Саналын хуудас
                  </th>
                  <th className="hidden w-[9%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 md:table-cell">
                    Захирамжийн дугаар
                  </th>
                  <th className="hidden w-[9%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 xl:table-cell">
                    Огноо
                  </th>
                  <th className="hidden w-[12%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 lg:table-cell">
                    Байршил
                  </th>
                  <th className="hidden w-[7%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 2xl:table-cell">
                    Хугацаа
                  </th>
                  <th className="w-[18%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:w-[9%]">
                    Төлөв
                  </th>
                  <th className="w-[30%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:w-[13%]">
                    Одоогийн явц
                  </th>
                  <th className="hidden w-[11%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 xl:table-cell">
                    Санхүүгийн эх үүсвэр
                  </th>
                  <th className="hidden w-[10%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 2xl:table-cell">
                    Ажлын төрөл
                  </th>
                  <th className="hidden w-[6%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 2xl:table-cell">
                    Төсөв
                  </th>
                  <th className="hidden w-[5%] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 lg:table-cell">
                    Нэгж талбар
                  </th>
                  <th className="w-[92px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {data.data.map((d) => {
                  const sc = DECISION_DRAFT_STATUS_STYLES[d.status] ?? DECISION_DRAFT_STATUS_STYLES[DECISION_DRAFT_STATUS_DRAFT];
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-3 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                        <p className="truncate" title={d.proposal_no}>{d.proposal_no}</p>
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 md:table-cell">
                        <p className="truncate" title={d.decree_number}>{d.decree_number || "—"}</p>
                      </td>
                      <td className="hidden px-3 py-3 text-slate-500 dark:text-slate-400 xl:table-cell">
                        {d.decision_date ? formatDate(d.decision_date) : "—"}
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        <p className="text-slate-600 dark:text-slate-300 truncate">{d.location || "—"}</p>
                        {d.acquisition_name && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            {d.acquisition_name}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-300 tabular-nums 2xl:table-cell">
                        {d.duration_year ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: sc.color, background: sc.bg }}
                        >
                          <span className="truncate">{DECISION_DRAFT_STATUS_LABELS[d.status] ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-700 dark:text-slate-200 font-medium truncate">
                          {d.current_progress_type_name || "Төсөл"}
                        </p>
                        {(d.current_progress_recipient || d.current_progress_date) && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            {d.current_progress_recipient || "—"}
                            {d.current_progress_date ? ` · ${formatDate(d.current_progress_date)}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 xl:table-cell">
                        <p className="text-slate-600 dark:text-slate-300 truncate" title={d.funding_source_names}>
                          {d.funding_source_names || "—"}
                        </p>
                        {d.funding_source_count > 1 && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {d.funding_source_count} эх үүсвэр
                          </p>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-300 2xl:table-cell">
                        <p className="truncate">{d.work_type_name || "—"}</p>
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-300 2xl:table-cell">
                        <p className="truncate">{d.budget_name || "—"}</p>
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#252630] text-slate-600 dark:text-slate-300 tabular-nums">
                          {d.parcel_count}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/decision_draft/${d.id}`}
                          onClick={notifyNavStart}
                          className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2 py-1 text-[11px] font-medium transition-colors"
                        >
                          <span className="truncate">Дэлгэрэнгүй</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-[#37394d]">
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} / {data.total}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
              >
                Өмнөх
              </button>
              <span className="text-[12px] text-slate-500 px-2">
                {page} / {data.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
              >
                Дараах
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
