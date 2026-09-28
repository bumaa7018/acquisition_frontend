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

/** Чөлөөлөлтийн төлөвийн өнгө (1 Шинэ, 2 Хээрийн судалгаа, 3 Баталгаажсан, 4 Цуцлагдсан). */
const ACQ_STATUS_COLORS: Record<string, string> = {
  "1": "#6366f1",
  "2": "#f59e0b",
  "3": "#10b981",
  "4": "#94a3b8",
};

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

/** Чартын өнгөний дараалал (төсөв, эх үүсвэр г.м. олон утгатай задаргаанд). */
const PALETTE = ["#02c0ce", "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9"];

/**
 * Дугуй (donut) чарт + баруун талдаа задаргаа.
 *
 * Карт өрөх оронд НЭГ зурагт: төвд нийт тоо, тойрогт хувь хэмжээ, хажууд нь
 * мөр бүрийн тоо/дүн. Ингэснээр аль төлөв давамгайлж байгаа нь шууд харагдана.
 */
function DonutCard({
  title,
  rows,
  centerValue,
  centerLabel,
  emptyText,
}: {
  /** Section дотор хэрэглэхэд гарчиг нь дээр нь байдаг тул заавал биш. */
  title?: string;
  rows: { name: string; value: number; color: string; hint?: string }[];
  centerValue: string;
  centerLabel: string;
  emptyText: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const shown = rows.filter((row) => row.value > 0);
  return (
    <div className={title ? "ap-card px-4 py-3" : ""}>
      {title && (
        <p className="mb-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </p>
      )}
      {total === 0 ? (
        <p className="py-14 text-center text-[12px] text-slate-400">{emptyText}</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shown} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={2}>
                  {shown.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) =>
                    `${Number(value ?? 0).toLocaleString()} (${((Number(value ?? 0) / total) * 100).toFixed(1)}%) · ${name}`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Төвийн НИЙТ утга — чартын гол мессеж. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[17px] font-bold tabular-nums text-slate-800 dark:text-white">
                {centerValue}
              </span>
              <span className="text-[10px] text-slate-400">{centerLabel}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                  {row.name}
                </span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: row.color }}>
                  {row.value.toLocaleString()}
                </span>
                {row.hint && (
                  <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-slate-400">
                    {row.hint}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Өнгөөр ялгасан жижиг карт: гарчиг · том утга · дэд мөр. */
function MiniCard({
  label,
  value,
  sub,
  color,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  title?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col justify-center gap-1 rounded-xl border border-slate-100 bg-slate-50/40 px-3.5 py-3 dark:border-[#37394d] dark:bg-white/[0.02]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate text-[20px] font-bold leading-none tabular-nums" style={{ color }} title={title}>
        {value}
      </p>
      {sub && <p className="truncate text-[11px] tabular-nums text-slate-400">{sub}</p>}
    </div>
  );
}

/**
 * БҮЛЭГ — зүүн талд өнгөөр ялгасан картууд, баруун талд харгалзах чарт.
 * Карт нь ТОО, чарт нь ХАРЬЦААГ хэлнэ: хоёулаа нэг хайрцагт байх тул ямар
 * тоо ямар зурагт хамаарах нь эргэлзээгүй.
 */
function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ap-card px-5 py-4">
      <p className="mb-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* auto-rows-min — карт нь чартын өндрөөр СУНАХГҮЙ (текст дээд буланд
            наалдаж, доор нь хоосон зай үлдэхээс сэргийлнэ). */}
        <div className="grid auto-rows-min grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
        {right}
      </div>
    </div>
  );
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
    <div
      className="ap-card flex items-center gap-3.5 border-l-4 px-5 py-4"
      style={{ borderLeftColor: tone }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${tone}1a`, color: tone }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {/* Утгыг ӨӨРИЙН өнгөөр — бүх карт ижил харагдахаас сэргийлнэ. */}
        <p className="truncate text-[22px] font-bold leading-tight tabular-nums" style={{ color: tone }}>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          {/* ЧӨЛӨӨЛӨЛТ — төлөв бүрийн КАРТ + харьцааны ДОНАТ нэг хайрцагт. */}
          <Section
            title="Чөлөөлөлт төлөвөөр"
            right={
              <DonutCard
                rows={statusCards.map((row) => ({
                  name: row.name,
                  value: row.count,
                  color: ACQ_STATUS_COLORS[row.key] ?? COLORS.muted,
                }))}
                centerValue={(data?.total_acquisitions ?? 0).toLocaleString()}
                centerLabel="чөлөөлөлт"
                emptyText="Чөлөөлөлт алга"
              />
            }
          >
            <MiniCard
              label="Нийт чөлөөлөлт"
              value={(data?.total_acquisitions ?? 0).toLocaleString()}
              sub={billions(totalAmount)}
              color={COLORS.amount}
              title={money(totalAmount)}
            />
            {statusCards.map((row) => (
              <MiniCard
                key={row.key}
                label={row.name}
                value={row.count.toLocaleString()}
                sub={`${row.parcels.toLocaleString()} талбар · ${billions(row.amount)}`}
                color={ACQ_STATUS_COLORS[row.key] ?? COLORS.muted}
                title={money(row.amount)}
              />
            ))}
          </Section>

          {/* НЭГЖ ТАЛБАРЫН ГҮЙЦЭТГЭЛ — шат бүрийн карт + донат. */}
          <Section
            title="Нэгж талбарын гүйцэтгэл"
            right={
              <DonutCard
                rows={stageRows.map((row) => ({
                  name: row.name,
                  value: row.count,
                  color: row.color,
                }))}
                centerValue={stageTotal.toLocaleString()}
                centerLabel="нэгж талбар"
                emptyText="Нэгж талбар алга"
              />
            }
          >
            {stageRows.map((row) => (
              <MiniCard
                key={row.name}
                label={row.name}
                value={row.count.toLocaleString()}
                sub={`${stageTotal > 0 ? ((row.count / stageTotal) * 100).toFixed(1) : "0.0"}% · ${billions(row.amount)}`}
                color={row.color}
                title={money(row.amount)}
              />
            ))}
          </Section>

          {/* ЗАХИРАМЖИЙН ТӨСӨВ — карт + хэвтээ багана. */}
          {budgetCards.length > 0 && (
            <Section
              title="Захирамжийн төсвөөр"
              right={
                <div style={{ height: Math.max(180, budgetCards.length * 32 + 24) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={budgetCards.map((row) => ({ name: row.name, value: row.amount }))}
                      layout="vertical"
                      margin={{ left: 4, right: 72 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.08)" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => money(Number(value ?? 0))}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={14}>
                        {budgetCards.map((row, i) => (
                          <Cell key={row.key} fill={PALETTE[i % PALETTE.length]} />
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
              }
            >
              {budgetCards.map((row, i) => (
                <MiniCard
                  key={row.key}
                  label={row.name}
                  value={billions(row.amount)}
                  sub={`${row.count.toLocaleString()} чөлөөлөлт · олгосон ${billions(row.granted)}`}
                  color={PALETTE[i % PALETTE.length]}
                  title={money(row.amount)}
                />
              ))}
            </Section>
          )}

          {/* ҮНЭЛГЭЭНИЙ АНГИЛАЛ — карт + хэвтээ багана (нэг хайрцагт). */}
          <Section
            title="Үнэлгээний бүтэц"
            right={
              structureRows.length === 0 ? undefined : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={structureRows}
                      layout="vertical"
                      margin={{ top: 4, bottom: 4, left: 4, right: 72 }}
                      barCategoryGap="14%"
                    >
                      <XAxis type="number" hide domain={[0, "dataMax"]} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.08)" }}
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value) => money(Number(value ?? 0))}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={22}>
                        {structureRows.map((row) => (
                          <Cell key={row.name} fill={row.color} />
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
              )
            }
          >
            <MiniCard
              label="Газрын үнэлгээ"
              value={billions(data?.land_amount ?? 0)}
              sub={totalAmount > 0 ? `${Math.round(((data?.land_amount ?? 0) / totalAmount) * 100)}%` : undefined}
              color={COLORS.amount}
              title={money(data?.land_amount ?? 0)}
            />
            <MiniCard
              label="Үл хөдлөх хөрөнгө"
              value={billions(data?.real_state_amount ?? 0)}
              sub={totalAmount > 0 ? `${Math.round(((data?.real_state_amount ?? 0) / totalAmount) * 100)}%` : undefined}
              color={COLORS.parcels}
              title={money(data?.real_state_amount ?? 0)}
            />
            <MiniCard
              label="Эд хөрөнгө, зардал"
              value={billions(data?.property_amount ?? 0)}
              sub={totalAmount > 0 ? `${Math.round(((data?.property_amount ?? 0) / totalAmount) * 100)}%` : undefined}
              color={COLORS.property}
              title={money(data?.property_amount ?? 0)}
            />
          </Section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* САНХҮҮЖИЛТИЙН ТӨРЛӨӨР */}
            <div className="ap-card px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
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
                <div className="h-[180px]">
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
          <div className="ap-card px-5 py-4">
            <p className="mb-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
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
            <div className="ap-card px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
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
            <div className="ap-card px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
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
