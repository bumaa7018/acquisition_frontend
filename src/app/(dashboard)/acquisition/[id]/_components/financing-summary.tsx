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
import { AmountHint } from "@/components/ui/amount-hint";

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
  /** Захирамж гарсан нэгж талбар. */
  parcelPaid: number;
  /** Үнэлгээ баталгаажсан (олговор зөвшөөрөгдсөн) нэгж талбар. */
  parcelApproved: number;
  /** Нийт үнэлгээний дүн — бүх олговрын мөрийн нийлбэр. */
  totalAmount: number;
  /**
   * Нэгж талбарын гүйцэтгэлийн ТАСАРХАЙ шатууд — тоо ба мөнгөн дүн. Нэгж
   * талбар бүр нэг л шатанд тоологдоно.
   */
  stages: {
    /**
     * Захирамж гарсан — хяналтын самбартай ИЖИЛ (санхүүжилтийн оноор).
     * granted — олгогдсон, pending — хүлээгдэж буй хэсэг.
     */
    issued: { count: number; amount: number; granted: number; pending: number };
    /** Захирамжийн төсөлд холбогдсон (санхүүжилтийн оноор). */
    draft: { count: number; amount: number };
    /** Санхүү шалгаж буй — үнэлгээ баталгаажсан, захирамжид холбогдоогүй. */
    approved: { count: number; amount: number };
    /** Санхүү шалгаж буй — санхүүд илгээсэн, шалгагдаж буй. */
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
  rows,
  className,
  inline,
}: {
  label: string;
  className?: string;
  /** Дүнг тооны ард НЭГ мөрөнд харуулна (зай хэмнэнэ). */
  inline?: boolean;
  count: number;
  amount: number;
  /** Нийтэд эзлэх хувь — "Нийт" картад харуулахгүй. */
  share?: number;
  tone: string;
  /** Дотоод задаргаа (ж: Олгогдсон / Хүлээгдэж буй). */
  rows?: { label: string; amount: number; count?: number; color: string }[];
}) {
  return (
    <div className={`ap-card flex items-start gap-3 px-4 py-3 ${className ?? ""}`}>
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone }} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
          {inline && (
            <span className="ml-1 text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400" title={money(amount)}>
              · {billions(amount)}
              <AmountHint value={amount} className="ml-1" />
            </span>
          )}
        </p>
        {!inline && (
          <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400" title={money(amount)}>
            {billions(amount)}
            <AmountHint value={amount} className="ml-1" />
          </p>
        )}
        {rows && rows.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5 dark:border-white/[0.06]">
            {rows.map((r) => (
              <li key={r.label} className="text-[11px] leading-4">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span>
                    {r.label}
                    {r.count != null && <span className="tabular-nums text-slate-400"> · {r.count.toLocaleString()}</span>}
                  </span>
                </span>
                <span className="block pl-3 font-semibold tabular-nums text-slate-700 dark:text-slate-200" title={money(r.amount)}>
                  {billions(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Хоёр хуваагдсан шатны карт — ЗҮҮН: үндсэн мэдээлэл (нэгж талбарын тоо,
 * хувь, дүн), БАРУУН: дэд мэдээлэл (мөр мөрөөр).
 */
function SplitStageTile({
  label,
  count,
  amount,
  share,
  tone,
  rows,
  note,
}: {
  label: string;
  count: number;
  amount: number;
  share: number;
  tone: string;
  rows: { label: string; amount: number; count?: number; color: string }[];
  note?: string;
}) {
  return (
    <div className="ap-card grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
      {/* ЗҮҮН — үндсэн мэдээлэл */}
      <div className="flex min-w-0 items-start gap-2.5 px-3 py-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone }} />
        <div className="min-w-0 flex-1">
          <p className="flex items-start justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="min-w-0 break-words">{label}</span>
            {note && <span className="shrink-0 normal-case tracking-normal">{note}</span>}
          </p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-bold tabular-nums text-slate-800 dark:text-white">
              {count.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: tone }}>
              {share.toFixed(1)}%
            </span>
          </p>
          <p className="text-[12px] font-semibold tabular-nums text-slate-600 dark:text-slate-300" title={money(amount)}>
            {billions(amount)}
            <AmountHint value={amount} className="ml-1" />
          </p>
        </div>
      </div>
      {/* БАРУУН — дэд мэдээлэл */}
      <ul className="flex min-w-0 flex-col justify-center gap-2 border-l border-slate-100 bg-slate-50/70 px-3 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {rows.map((r) => (
          <li key={r.label} className="min-w-0 text-[11px] leading-4">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="min-w-0">
                {r.label}
                {r.count != null && <span className="tabular-nums text-slate-400"> · {r.count.toLocaleString()}</span>}
              </span>
            </span>
            <span
              className="mt-0.5 block pl-3.5 text-[13px] font-bold tabular-nums text-slate-700 dark:text-slate-200"
              title={money(r.amount)}
            >
              {billions(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FinancingSummary({
  stats,
  loading,
  fundingYear = 0,
}: {
  stats: FinancingStats;
  loading?: boolean;
  /** Табын дээд талд сонгосон санхүүжилтийн он (0 = бүх он) — шошгонд. */
  fundingYear?: number;
}) {
  const approvedTotal = stats.landAmount + stats.realStateAmount + stats.propertyAmount;
  const st = stats.stages;
  const stageRows = [
    {
      name: "Захирамж гарсан",
      value: st.issued.count,
      amount: st.issued.amount,
      color: CHART_COLORS.funding,
      rows: [
        { label: "Олгогдсон", amount: st.issued.granted, color: "#16a34a" },
        { label: "Хүлээгдэж буй", amount: st.issued.pending, color: CHART_COLORS.property },
      ],
    },
    {
      name: "Захирамжийн төсөлд",
      value: st.draft.count,
      amount: st.draft.amount,
      color: CHART_COLORS.realState,
    },
    {
      name: "Санхүү шалгаж буй",
      value: st.approved.count + st.submitted.count,
      amount: st.approved.amount + st.submitted.amount,
      color: CHART_COLORS.land,
      rows: [
        { label: "Үнэлгээ баталгаажсан", count: st.approved.count, amount: st.approved.amount, color: CHART_COLORS.land },
        { label: "Шалгагдаж буй", count: st.submitted.count, amount: st.submitted.amount, color: CHART_COLORS.property },
      ],
    },
    {
      name: "Үнэлгээгүй",
      value: st.pending.count,
      amount: st.pending.amount,
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
            <p className="mb-1 flex items-start gap-1.5 break-words text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="min-w-0">{row.label}</span>
            </p>
            <p
              className="text-[15px] font-bold tabular-nums text-slate-800 dark:text-white"
              title={money(row.value)}
            >
              {billions(row.value)}
              <AmountHint value={row.value} className="ml-1" />
            </p>
            <p className="text-[11px] tabular-nums text-slate-400">
              {approvedTotal > 0 ? `${Math.round((row.value / approvedTotal) * 100)}%` : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* НЭГЖ ТАЛБАРЫН ТОО — нийт ба чарттай ИЖИЛ шатууд. Карт бүр дээр
          нэгж талбарын тоо, эзлэх хувь ба харгалзах мөнгөн дүн.
          «Захирамж гарсан», «Захирамжийн төсөлд» нь санхүүжилтийн оноор
          (хяналтын самбартай ижил). */}
      {/* Нийт (зүүн, хоёр мөр) · дээд мөр: Захирамж гарсан, Санхүү шалгаж буй
          (үндсэн мэдээлэл зүүн, дэд баруун) · доод мөр: Захирамжийн төсөлд,
          Үнэлгээгүй (дүн нь тооны ард). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_minmax(0,2fr)]">
        <StageTile
          label="Нийт"
          count={stats.parcelTotal}
          amount={stats.totalAmount}
          tone={CHART_COLORS.realState}
          className="sm:col-span-2 lg:col-span-1 lg:row-span-2"
        />
        {[stageRows[0], stageRows[2]].map((row) => (
          <SplitStageTile
            key={row.name}
            label={row.name}
            count={row.value}
            amount={row.amount}
            share={pct(row.value)}
            tone={row.color}
            rows={row.rows ?? []}
          />
        ))}
        {[stageRows[1], stageRows[3]].map((row) => (
          <StageTile
            key={row.name}
            label={row.name}
            count={row.value}
            amount={row.amount}
            share={pct(row.value)}
            tone={row.color}
            inline
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
                {/* key — он солигдож шатны тоо өөрчлөгдөхөд дахин зурна
                    (өгөгдлийн мөр солигдоход Pie хоосон үлддэг байсан). */}
                <PieChart key={parcelChart.map((x) => `${x.name}:${x.value}`).join("|")}>
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
                  <span className="inline-flex min-w-0 flex-1 items-start gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="min-w-0 break-words">{row.name}</span>
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
            <AmountHint value={approvedTotal} className="ml-1" />
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
                  <span className="inline-flex min-w-0 items-start gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="min-w-0 break-words">{row.name}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span
                      className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-white"
                      title={money(row.value)}
                    >
                      {billions(row.value)}
                      <AmountHint value={row.value} className="ml-1" />
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
                  <AmountHint value={approvedTotal} className="ml-1" />
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
