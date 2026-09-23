"use client";

// САНХҮҮГИЙН мэргэжилтний хяналтын самбар.
//
// Зарчим: газрын зураг/байршил ХАРУУЛАХГҮЙ — зөвхөн мөнгөн дүн ба тоон
// үзүүлэлт. Бүх өгөгдөл НЭГ хөнгөн endpoint-оос (`/dashboard/finance`) ирнэ:
// backend талд нэг асуулгаар нэгтгэгддэг тул жагсаалт татаж client дээр
// нэгтгэх шаардлагагүй (том өгөгдөлд ачаалал өгөхгүй).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Hourglass, Landmark, MapPinned, X } from "lucide-react";

import { dashboardApi } from "@/lib/api";
import type { FinanceBucket } from "@/types";
import { YearMultiSelect } from "@/components/ui/year-multi-select";
import { AcquisitionSelect } from "@/app/(dashboard)/parcel/_components/acquisition_select";

const TOOLTIP_STYLE = {
  background: "#1e1f27",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e2e8f0",
} as const;

const SELECT_CLS =
  "h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200";

const COLORS = {
  amount: "#02c0ce",
  granted: "#10b981",
  pending: "#f59e0b",
  parcels: "#6366f1",
  property: "#f59e0b",
  muted: "#94a3b8",
} as const;

function money(value: number): string {
  return `${Math.round(value).toLocaleString()}₮`;
}

/** Тэрбумаар, аравтын нэг орноор — бүх дүн нэг нэгжтэй байж харьцуулагдана. */
function billions(value: number): string {
  return `${(value / 1_000_000_000).toFixed(1)} тэрбум₮`;
}

function Tile({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Banknote;
  tone: string;
}) {
  return (
    <div className="ap-card flex items-center gap-3 px-4 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${tone}1a`, color: tone }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="truncate text-[16px] font-bold tabular-nums text-slate-800 dark:text-white">
          {value}
        </p>
        {hint && <p className="truncate text-[11px] tabular-nums text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

/** Дүн + тоог нэг мөрөнд харуулах задаргааны жагсаалт. */
function BucketList({
  rows,
  total,
  emptyText,
  onPick,
  activeKey,
}: {
  rows: FinanceBucket[];
  total: number;
  emptyText: string;
  onPick?: (key: string) => void;
  activeKey?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[12px] text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
      {rows.map((row) => {
        const share = total > 0 ? (row.amount / total) * 100 : 0;
        const active = activeKey === row.key;
        return (
          <button
            key={row.key}
            type="button"
            onClick={onPick ? () => onPick(active ? "" : row.key) : undefined}
            className={`flex w-full items-center gap-3 px-1 py-1.5 text-left transition-colors ${
              onPick ? "hover:bg-slate-50 dark:hover:bg-[#252630]" : "cursor-default"
            } ${active ? "bg-[#02c0ce]/8" : ""}`}
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 dark:text-slate-300">
              {row.name}
            </span>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
              {row.parcels.toLocaleString()} т.
            </span>
            <span
              className="w-24 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-800 dark:text-white"
              title={money(row.amount)}
            >
              {billions(row.amount)}
            </span>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
              {share.toFixed(1)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FinanceDashboard() {
  const [years, setYears] = useState<number[]>([]);
  const [district, setDistrict] = useState("");
  const [acquisitionId, setAcquisitionId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "finance", years, district, acquisitionId],
    queryFn: () =>
      dashboardApi.finance({
        years: years.length ? years : undefined,
        au2_code: district || undefined,
        acquisition_id: acquisitionId || undefined,
      }),
    staleTime: 60_000,
  });

  const byYear = useMemo(() => data?.by_year ?? [], [data]);
  const byDistrict = data?.by_district ?? [];
  const topAcquisitions = data?.top_acquisitions ?? [];
  const statusCards = data?.acquisition_status ?? [];
  const budgetCards = data?.acquisition_budgets ?? [];
  // ЯВЖ БУЙ (баталгаажаагүй) чөлөөлөлтүүд — үнэлгээний дүнгээр буурахаар,
  // хажууд нь олгосон дүн. Нэр урт байдаг тул тэнхлэгт богиносгоно.
  const acquisitionChart = topAcquisitions.map((row) => ({
    name: row.name.length > 26 ? `${row.name.slice(0, 25)}…` : row.name,
    "Үнэлгээний дүн": row.amount,
    Олгосон: row.granted,
  }));
  const totalAmount = data?.total_amount ?? 0;
  const districtName =
    byDistrict.find((row) => row.key === district)?.name || district;

  // Чөлөөлөлтийн "Санхүүжилт" табтай ИЖИЛ задаргаа.
  const stageRows = [
    { name: "Олгогдсон", count: data?.stage_granted.count ?? 0, amount: data?.stage_granted.amount ?? 0, color: COLORS.granted },
    { name: "Үнэлгээ баталгаажсан", count: data?.stage_approved.count ?? 0, amount: data?.stage_approved.amount ?? 0, color: COLORS.amount },
    { name: "Үнэлгээ хүлээгдэж буй", count: data?.stage_submitted.count ?? 0, amount: data?.stage_submitted.amount ?? 0, color: COLORS.property },
    { name: "Үнэлгээ хийгээгүй", count: data?.stage_pending.count ?? 0, amount: data?.stage_pending.amount ?? 0, color: COLORS.muted },
  ];
  const stageTotal = stageRows.reduce((sum, row) => sum + row.count, 0);
  const stagePct = (v: number) => (stageTotal > 0 ? (v / stageTotal) * 100 : 0);
  const structureRows = [
    { name: "Газрын үнэлгээ", value: data?.land_amount ?? 0, color: COLORS.amount },
    { name: "Үл хөдлөх", value: data?.real_state_amount ?? 0, color: COLORS.parcels },
    { name: "Эд хөрөнгө, зардал", value: data?.property_amount ?? 0, color: COLORS.property },
  ].filter((row) => row.value > 0);
  const fundingTypes = data?.funding_by_type ?? [];

  const yearChart = byYear.map((row) => ({
    name: row.name,
    Батлагдсан: row.amount,
    Олгосон: row.granted,
    "Хүлээгдэж буй": row.pending,
  }));
  // БҮХ дүүрэг/сумыг харуулна — өндрийг мөрийн тоогоор тохируулж гүйлгэнэ.
  const districtChart = byDistrict.map((row) => ({ name: row.name, value: row.amount }));
  const districtChartHeight = Math.max(200, districtChart.length * 28 + 24);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-slate-800 dark:text-white">
            Санхүүгийн хяналтын самбар
          </h1>
          <p className="text-[12px] text-slate-400">
            Нөхөх олговрын дүн, олголтын явц — он, дүүрэг, хороогоор
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearMultiSelect value={years} onChange={setYears} className="w-36" />
          {/* ДҮҮРЭГ — бүрэн жагсаалт (шүүлтээс хамаарахгүй). */}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Бүх дүүрэг / сум</option>
            {(data?.district_options ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
          <AcquisitionSelect
            selectedId={acquisitionId}
            onSelect={(id) => setAcquisitionId(id)}
            onClear={() => setAcquisitionId("")}
            className="w-56"
          />
          {(district || acquisitionId || years.length > 0) && (
            <button
              onClick={() => {
                setDistrict("");
                setAcquisitionId("");
                setYears([]);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
            >
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      ) : (
        <>
          {/* ЧӨЛӨӨЛӨЛТИЙН МЭДЭЭЛЭЛ — нийт, төлөвөөр ба захирамжийн төсвөөр. */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="ap-card px-4 py-3">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Нийт чөлөөлөлт
              </p>
              <p className="text-[20px] font-bold tabular-nums text-slate-800 dark:text-white">
                {(data?.total_acquisitions ?? 0).toLocaleString()}
              </p>
              <p className="truncate text-[11px] tabular-nums text-slate-400" title={money(totalAmount)}>
                {billions(totalAmount)}
              </p>
            </div>
            {statusCards.map((row) => (
              <div key={row.key} className="ap-card px-4 py-3">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {row.name}
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[20px] font-bold tabular-nums text-slate-800 dark:text-white">
                    {row.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {row.parcels.toLocaleString()} т.
                  </span>
                </p>
                <p className="truncate text-[11px] tabular-nums text-slate-400" title={money(row.amount)}>
                  {billions(row.amount)}
                </p>
              </div>
            ))}
          </div>

          {budgetCards.length > 0 && (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {budgetCards.map((row) => (
                <div key={row.key} className="ap-card px-4 py-3">
                  <p className="mb-0.5 inline-flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS.parcels }} />
                    Төсөв: {row.name}
                  </p>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold tabular-nums text-slate-800 dark:text-white">
                      {billions(row.amount)}
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {row.count.toLocaleString()} чөлөөлөлт
                    </span>
                  </p>
                  <p className="truncate text-[11px] tabular-nums text-slate-400" title={money(row.granted)}>
                    Олгосон: {billions(row.granted)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ҮНЭЛГЭЭНИЙ АНГИЛАЛ — чөлөөлөлтийн "Санхүүжилт" табтай ижил. */}
          <div className="ap-card grid grid-cols-1 divide-y divide-slate-100 overflow-hidden dark:divide-[#37394d] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { label: "Газрын үнэлгээ", value: data?.land_amount ?? 0, color: COLORS.amount },
              { label: "Үл хөдлөх хөрөнгө", value: data?.real_state_amount ?? 0, color: COLORS.parcels },
              { label: "Эд хөрөнгө, зардал", value: data?.property_amount ?? 0, color: COLORS.property },
            ].map((row) => (
              <div key={row.label} className="min-w-0 px-4 py-3">
                <p className="mb-1 inline-flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                  {row.label}
                </p>
                <p
                  className="truncate text-[15px] font-bold tabular-nums text-slate-800 dark:text-white"
                  title={money(row.value)}
                >
                  {billions(row.value)}
                </p>
                <p className="truncate text-[11px] tabular-nums text-slate-400">
                  {totalAmount > 0 ? `${Math.round((row.value / totalAmount) * 100)}%` : "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              label="Нийт үнэлгээний дүн"
              value={billions(totalAmount)}
              hint={money(totalAmount)}
              Icon={Landmark}
              tone={COLORS.amount}
            />
            <Tile
              label="Олгосон дүн"
              value={billions(data?.granted_amount ?? 0)}
              hint={
                totalAmount > 0
                  ? `${Math.round(((data?.granted_amount ?? 0) / totalAmount) * 100)}% гүйцэтгэл`
                  : undefined
              }
              Icon={Banknote}
              tone={COLORS.granted}
            />
            <Tile
              label="Хүлээгдэж буй дүн"
              value={billions(data?.pending_amount ?? 0)}
              hint={money(data?.pending_amount ?? 0)}
              Icon={Hourglass}
              tone={COLORS.pending}
            />
            <Tile
              label="Нэгж талбар"
              value={(data?.total_parcels ?? 0).toLocaleString()}
              hint="Олговортой нэгж талбарын тоо"
              Icon={MapPinned}
              tone={COLORS.parcels}
            />
          </div>

          {/* НЭГЖ ТАЛБАРЫН ГҮЙЦЭТГЭЛ — дөрвөн тасархай шат (тоо + дүн + хувь). */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stageRows.map((row) => (
              <div key={row.name} className="ap-card flex items-start gap-3 px-4 py-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {row.name}
                  </p>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold tabular-nums text-slate-800 dark:text-white">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: row.color }}>
                      {stagePct(row.count).toFixed(1)}%
                    </span>
                  </p>
                  <p className="truncate text-[11px] tabular-nums text-slate-500 dark:text-slate-400" title={money(row.amount)}>
                    {billions(row.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* ҮНЭЛГЭЭНИЙ БҮТЭЦ */}
            <div className="ap-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Үнэлгээний бүтэц
                </p>
                <p className="text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200" title={money(totalAmount)}>
                  {billions(totalAmount)}
                </p>
              </div>
              {structureRows.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-400">Баталгаажсан үнэлгээ алга</p>
              ) : (
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={structureRows} layout="vertical" margin={{ top: 4, bottom: 4, left: 4, right: 92 }} barCategoryGap="14%">
                      <XAxis type="number" hide domain={[0, "dataMax"]} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={116}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} contentStyle={TOOLTIP_STYLE} formatter={(value) => money(Number(value ?? 0))} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                        {structureRows.map((row) => (
                          <Cell key={row.name} fill={row.color} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(value: unknown) => billions(Number(value ?? 0))}
                          style={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* САНХҮҮЖИЛТИЙН ТӨРЛӨӨР */}
            <div className="ap-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Санхүүжилтийн төрлөөр
                </p>
                <p className="text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200" title={money(data?.funding_total ?? 0)}>
                  {billions(data?.funding_total ?? 0)}
                </p>
              </div>
              {fundingTypes.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-400">
                  Санхүүжилтийн эх үүсвэр бүртгэгдээгүй
                </p>
              ) : (
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fundingTypes} dataKey="amount" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3}>
                        {fundingTypes.map((row, i) => (
                          <Cell key={row.key} fill={Object.values(COLORS)[i % Object.values(COLORS).length]} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => money(Number(value ?? 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ОНООР — дүнгийн явц (баталгаажсан / олгосон / хүлээгдэж буй). */}
          <div className="ap-card px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Оноор
            </p>
            {yearChart.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-slate-400">Өгөгдөл алга</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearChart} margin={{ top: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(1)}`}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      label={{ value: "тэрбум₮", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => money(Number(value ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Батлагдсан" fill={COLORS.amount} radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="Олгосон" fill={COLORS.granted} radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="Хүлээгдэж буй" fill={COLORS.pending} radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* ДҮҮРЭГ/СУМААР — дарж шүүлт болгоно. */}
            <div className="ap-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Дүүрэг / сумаар
                </p>
                <p className="text-[11px] text-slate-400">{byDistrict.length} нэгж</p>
              </div>
              {/* Бүх дүүрэг багтахаар өндөр нь мөрийн тоогоор; хэт урт бол гүйлгэнэ. */}
              {districtChart.length > 0 && (
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  <div style={{ height: districtChartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtChart} layout="vertical" margin={{ left: 4, right: 76 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.08)" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => money(Number(value ?? 0))}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={16}>
                        {districtChart.map((row) => (
                          <Cell key={row.name} fill={COLORS.amount} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(value: unknown) => billions(Number(value ?? 0))}
                          style={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              )}
              <BucketList
                rows={byDistrict}
                total={totalAmount}
                emptyText="Дүүргийн мэдээлэл алга"
                onPick={(key) => setDistrict(key)}
                activeKey={district}
              />
            </div>

            {/* ЧӨЛӨӨЛӨЛТӨӨР — хамгийн их дүнтэй 10 чөлөөлөлт. */}
            <div className="ap-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Явж буй чөлөөлөлтүүд
                </p>
                <p className="text-[11px] text-slate-400">
                  Нийт {(data?.total_acquisitions ?? 0).toLocaleString()} чөлөөлөлт
                </p>
              </div>
              {topAcquisitions.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-400">Өгөгдөл алга</p>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
                  <div style={{ height: Math.max(200, topAcquisitions.length * 30 + 24) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={acquisitionChart} layout="vertical" margin={{ left: 4, right: 76 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={150}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(148,163,184,0.08)" }}
                          contentStyle={TOOLTIP_STYLE}
                          formatter={(value) => money(Number(value ?? 0))}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Үнэлгээний дүн" radius={[0, 5, 5, 0]} barSize={11} fill={COLORS.amount}>
                          <LabelList
                            dataKey="Үнэлгээний дүн"
                            position="right"
                            formatter={(value: unknown) => billions(Number(value ?? 0))}
                            style={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                          />
                        </Bar>
                        <Bar dataKey="Олгосон" radius={[0, 5, 5, 0]} barSize={11} fill={COLORS.granted} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
