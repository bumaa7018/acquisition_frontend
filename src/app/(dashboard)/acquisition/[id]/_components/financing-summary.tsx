"use client";

// Санхүүжилтийн табын БАРУУН багана — тоон үзүүлэлт, график.
//
// Яагаад тусдаа файл: зүүн тал нь бүртгэл (захирамжаас уншсан санхүүжилт,
// эх үүсвэрийн хүснэгт), баруун тал нь ДҮГНЭЛТ (нэгж талбарын гүйцэтгэл,
// мөнгөн дүнгүүд). Хоёулаа нэг файлд байвал 600+ мөр болж, аль хэсэг нь юу
// уншиж байгааг ялгахад хэцүү болно.

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Hourglass, Landmark, MapPinned } from "lucide-react";

const TOOLTIP_STYLE = {
  background: "#1e1f27",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e2e8f0",
} as const;

export const CHART_COLORS = {
  land: "#02c0ce",
  realState: "#6366f1",
  property: "#f59e0b",
  funding: "#10b981",
  pending: "#94a3b8",
} as const;

export function money(value: number): string {
  return `${Math.round(value).toLocaleString()}₮`;
}

/**
 * ТЭРБУМААР, аравтын НЭГ орноор: 1.3 ₮ тэрбум.
 * Бүх мөнгөн дүн НЭГ ижил нэгжтэй байж шууд харьцуулагдана; яг таг дүн нь
 * тухайн нүдний title (hover)-д үлдэнэ.
 */
export function billions(value: number): string {
  return `${(value / 1_000_000_000).toFixed(1)} ₮ тэрбум`;
}

export interface FinancingStats {
  /** Чөлөөлөлтийн нийт нэгж талбар. */
  parcelTotal: number;
  /** Нөхөх олговор ОЛГОГДСОН нэгж талбар. */
  parcelPaid: number;
  /** Үнэлгээ баталгаажсан (олговор зөвшөөрөгдсөн) нэгж талбар. */
  parcelApproved: number;
  /** Нийт үнэлгээний дүн — бүх олговрын мөрийн нийлбэр. */
  totalAmount: number;
  /**
   * Нэгж талбарын гүйцэтгэлийн ТАСАРХАЙ шатууд — тоо ба мөнгөн дүн.
   * Тооны нийлбэр нь `parcelTotal` (хувь нь 100% болно). Нэгж талбар бүр
   * хамгийн ахисан шатандаа л тоологдоно.
   */
  stages: {
    /** Олговор олгосон бичилттэй (дүн = ОЛГОСОН дүн). */
    granted: { count: number; amount: number };
    /** Үнэлгээ баталгаажсан (гэхдээ олговор олгоогүй). */
    approved: { count: number; amount: number };
    /** Санхүүд илгээсэн — хянагдаж буй. */
    submitted: { count: number; amount: number };
    /** Үнэлгээ хийгээгүй / илгээгээгүй. */
    pending: { count: number; amount: number };
  };
  /** Баталгаажсан олговрын дүн — газар / үл хөдлөх / эд хөрөнгө, зардал. */
  landAmount: number;
  realStateAmount: number;
  propertyAmount: number;
  /** Хүлээгдэж буй (баталгаажаагүй) үнэлгээний дүн. */
  pendingAmount: number;
  /** ОЛГОСОН дүн — compensation_grant бичилтүүдийн нийлбэр. */
  grantedAmount: number;
  /** Санхүүжилтийн төрлөөр (захирамжийн төсөв / эх үүсвэрийн төрөл). */
  fundingByType: { name: string; value: number }[];
}

/** Нэгж талбарын ТОО (том) + түүнд харгалзах МӨНГӨН дүн (доор). */
function StageTile({
  label,
  count,
  amount,
  share,
  tone,
}: {
  label: string;
  count: number;
  amount: number;
  /** Нийтэд эзлэх хувь — "Нийт" картад харуулахгүй. */
  share?: number;
  tone: string;
}) {
  return (
    <div className="ap-card flex items-start gap-3 px-4 py-3">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-bold tabular-nums text-slate-800 dark:text-white">
            {count.toLocaleString()}
          </span>
          {share != null && (
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: tone }}>
              {share.toFixed(1)}%
            </span>
          )}
        </p>
        <p className="truncate text-[11px] tabular-nums text-slate-500 dark:text-slate-400" title={money(amount)}>
          {billions(amount)}
        </p>
      </div>
    </div>
  );
}

export function FinancingSummary({ stats, loading }: { stats: FinancingStats; loading?: boolean }) {
  const approvedTotal = stats.landAmount + stats.realStateAmount + stats.propertyAmount;
  const stageRows = [
    {
      name: "Олгогдсон",
      value: stats.stages.granted.count,
      amount: stats.stages.granted.amount,
      color: CHART_COLORS.funding,
    },
    {
      name: "Баталгаажсан",
      value: stats.stages.approved.count,
      amount: stats.stages.approved.amount,
      color: CHART_COLORS.land,
    },
    {
      name: "Хүлээгдэж буй",
      value: stats.stages.submitted.count,
      amount: stats.stages.submitted.amount,
      color: CHART_COLORS.property,
    },
    {
      name: "Үнэлгээгүй",
      value: stats.stages.pending.count,
      amount: stats.stages.pending.amount,
      color: CHART_COLORS.pending,
    },
  ];
  const stageTotal = stageRows.reduce((sum, row) => sum + row.value, 0);
  const pct = (value: number) => (stageTotal > 0 ? (value / stageTotal) * 100 : 0);
  const parcelChart = stageRows.filter((x) => x.value > 0);

  const amountChart = [
    { name: "Газрын үнэлгээ", value: stats.landAmount, color: CHART_COLORS.land },
    { name: "Үл хөдлөх", value: stats.realStateAmount, color: CHART_COLORS.realState },
    { name: "Эд хөрөнгө, зардал", value: stats.propertyAmount, color: CHART_COLORS.property },
  ].filter((x) => x.value > 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ДЭЭД мөр — үнэлгээний гурван ангиллын дүн, ТЭРБУМААР нарийвчилсан.
          Доорх "Үнэлгээний бүтэц" чарттай ижил эх сурвалж, ижил өнгөтэй. */}
      <div className="ap-card grid grid-cols-1 divide-y divide-slate-100 overflow-hidden dark:divide-[#37394d] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { label: "Газрын үнэлгээ", value: stats.landAmount, color: CHART_COLORS.land },
          { label: "Үл хөдлөх хөрөнгө", value: stats.realStateAmount, color: CHART_COLORS.realState },
          { label: "Эд хөрөнгө, зардал", value: stats.propertyAmount, color: CHART_COLORS.property },
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
              {approvedTotal > 0 ? `${Math.round((row.value / approvedTotal) * 100)}%` : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* НЭГЖ ТАЛБАРЫН ТОО — нийт ба чарттай ИЖИЛ дөрвөн шат. Карт бүр дээр
          нэгж талбарын тоо, эзлэх хувь ба харгалзах мөнгөн дүн. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-5">
        <StageTile
          label="Нийт"
          count={stats.parcelTotal}
          amount={stats.totalAmount}
          tone={CHART_COLORS.realState}
        />
        {stageRows.map((row) => (
          <StageTile
            key={row.name}
            label={row.name}
            count={row.value}
            amount={row.amount}
            share={pct(row.value)}
            tone={row.color}
          />
        ))}
      </div>

      {/* Графикууд — өргөн дэлгэцэд хоёр багана. */}
      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
      {/* НЭГЖ ТАЛБАРЫН ГҮЙЦЭТГЭЛ — дөрвөн ТАСАРХАЙ шат, нийлбэр нь 100%. */}
      <div className="ap-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Нэгж талбарын гүйцэтгэл
          </p>
          <p className="text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
            {stageTotal.toLocaleString()} нэгж талбар
          </p>
        </div>
        {stageTotal === 0 ? (
          <p className="py-8 text-center text-[12px] text-slate-400">Нэгж талбар бүртгэгдээгүй</p>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={parcelChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {parcelChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="outside"
                      formatter={(value: unknown) => `${pct(Number(value ?? 0)).toFixed(1)}%`}
                      style={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) =>
                      `${Number(value ?? 0).toLocaleString()} (${pct(Number(value ?? 0)).toFixed(1)}%)`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Задаргаа — шат бүрийн тоо ба ХУВЬ (нийлбэр 100%). */}
            <div className="mt-1 divide-y divide-slate-100 dark:divide-[#37394d]">
              {stageRows.map((row) => (
                <div key={row.name} className="flex items-center gap-3 py-1.5">
                  <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-slate-500">
                    {row.value.toLocaleString()}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-800 dark:text-white">
                    {pct(row.value).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ҮНЭЛГЭЭНИЙ БҮТЭЦ — багана бүрийн ард ТООН дүн, доор нь задаргаа
          (дүн + эзлэх хувь) ба нийт мөр. Зөвхөн графикаар харуулбал хэдэн
          төгрөг болохыг таах шаардлагатай болдог. */}
      <div className="ap-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Үнэлгээний бүтэц
          </p>
          <p
            className="text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200"
            title={money(approvedTotal)}
          >
            {billions(approvedTotal)}
          </p>
        </div>
        {amountChart.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-slate-400">Баталгаажсан үнэлгээ алга</p>
        ) : (
          <>
            <div className="h-[132px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={amountChart}
                  layout="vertical"
                  margin={{ top: 4, bottom: 4, left: 4, right: 92 }}
                  barCategoryGap="14%"
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={116}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => money(Number(value ?? 0))}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                    {amountChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
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
            <div className="mt-1 divide-y divide-slate-100 dark:divide-[#37394d]">
              {amountChart.map((row) => (
                <div key={row.name} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="inline-flex min-w-0 items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span
                      className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-white"
                      title={money(row.value)}
                    >
                      {billions(row.value)}
                    </span>
                    <span className="w-10 text-right text-[11px] tabular-nums text-slate-400">
                      {approvedTotal > 0 ? `${Math.round((row.value / approvedTotal) * 100)}%` : "—"}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[12px] font-semibold text-slate-500">Нийт</span>
                <span
                  className="text-[13px] font-bold tabular-nums text-[#02c0ce]"
                  title={money(approvedTotal)}
                >
                  {billions(approvedTotal)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Санхүүжилтийн төрлөөр (захирамжийн төсөв). */}
      {stats.fundingByType.length > 0 && (
        <div className="ap-card px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Санхүүжилтийн төрлөөр
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.fundingByType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {stats.fundingByType.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]}
                    />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => money(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
