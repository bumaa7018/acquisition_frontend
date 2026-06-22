"use client";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  STATS,
  STATUSES,
  REJECTED_PARCELS,
  TIMELINE,
} from "@/components/dashboard/mock-data";
import { Map, Layers, FileText, Banknote } from "lucide-react";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full animate-pulse bg-slate-100 dark:bg-[#252630]" />
  ),
});

/* ── Custom horizontal bar ─────────────────────────────── */
function HBar({
  label,
  value,
  maxVal,
  color,
  suffix = "",
}: {
  label: string;
  value: number;
  maxVal: number;
  color: string;
  suffix?: string;
}) {
  const pct = Math.max(3, (value / maxVal) * 100);
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 text-right leading-tight truncate"
        style={{ width: 86 }}
      >
        {label}
      </span>
      <div className="flex-1 h-[16px] rounded-sm overflow-hidden bg-slate-100 dark:bg-white/[0.05]">
        <div
          className="h-full rounded-sm transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0 text-right"
        style={{ width: 54 }}
      >
        {value.toLocaleString()}
        {suffix}
      </span>
    </div>
  );
}

/* ── 270° gauge ─────────────────────────────────────────── */
function Gauge({ value, isDark }: { value: number; isDark: boolean }) {
  const r = 52,
    cx = 70,
    cy = 72;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const filled = arcLen * (value / 100);
  return (
    <svg viewBox="0 0 140 118" className="w-full max-w-[160px] mx-auto">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0acf97" />
          <stop offset="100%" stopColor="#02c0ce" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={isDark ? "#37394d" : "#e5e7eb"}
        strokeWidth="12"
        strokeDasharray={`${arcLen} ${circ - arcLen}`}
        strokeLinecap="round"
        transform={`rotate(135, ${cx}, ${cy})`}
      />
      {/* Fill */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="url(#gaugeGrad)"
        strokeWidth="12"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(135, ${cx}, ${cy})`}
      />
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill={isDark ? "#fff" : "#1e293b"}
      >
        {value}%
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fontSize="10"
        fill={isDark ? "#8391a2" : "#94a3b8"}
      >
        ЯВЦ
      </text>
    </svg>
  );
}

/* ── Page ───────────────────────────────────────────────── */
export default function DashboardPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const tickColor = isDark ? "#8391a2" : "#94a3b8";
  const gridColor = isDark ? "#37394d" : "#eef2f7";
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 6,
    border: `1px solid ${isDark ? "#37394d" : "#e5e7eb"}`,
    background: isDark ? "#1e1f27" : "#fff",
    color: isDark ? "#aab8c5" : "#4c4c5c",
    boxShadow: "0 4px 20px rgba(0,0,0,.12)",
  };

  const maxCount = Math.max(...STATUSES.map((s) => s.count));
  const maxArea = Math.max(...STATUSES.map((s) => s.area));

  const MAIN_STATS = [
    {
      label: "ТӨЛӨВЛӨЛТИЙН ХИЛ",
      value: STATS.planArea,
      unit: "га",
      sub: "ТАЛБАЙ",
      icon: Map,
      color: "#02c0ce",
      bg: "#02c0ce18",
    },
    {
      label: "НЭГЖ ТАЛБАР",
      value: STATS.totalParcels,
      unit: "",
      sub: "НИЙТ",
      icon: Layers,
      color: "#777edd",
      bg: "#777edd18",
    },
    {
      label: "НИЙТ ЗАХИРАМЖ",
      value: STATS.totalOrders,
      unit: "",
      sub: "ЗАХИРАМЖ",
      icon: FileText,
      color: "#f9bc0b",
      bg: "#f9bc0b18",
    },
    {
      label: "НИЙТ НӨХӨХ ОЛГОВРЫН ДҮН",
      value: STATS.totalCompensation,
      unit: "тэрбум",
      sub: "НИЙТ ДҮН",
      icon: Banknote,
      color: "#0acf97",
      bg: "#0acf9718",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Title ─────────────────────────────────────── */}
      <div className="ap-card px-5 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-[3px] rounded-full shrink-0"
            style={{ background: "#02c0ce" }}
          />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-snug">
            СХД 5-Р ХОРОО &quot;ХЭСЭГЧИЛСЭН ЕРӨНХИЙ ТӨЛӨВЛӨГӨӨНИЙ ДАГУУ ГЭР
            ХОРООЛЛЫН ОРОН СУУЦЖУУЛАХ&quot; ДАХИН ТӨЛӨВЛӨЛТИЙН АЖИЛ
          </p>
        </div>
        <div className="shrink-0 text-right border-l border-slate-100 dark:border-[#37394d] pl-4">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#02c0ce" }}
          >
            ТӨЛБӨР ШҮҮХ
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Ангилал сонгоогүй
          </p>
        </div>
      </div>

      {/* ── 4 stat cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {MAIN_STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="ap-card relative overflow-hidden p-5">
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: s.color }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-tight">
                    {s.label}
                  </p>
                  <div className="flex items-end gap-1.5 mt-2">
                    <span className="text-[28px] font-black tabular-nums leading-none text-slate-800 dark:text-white">
                      {s.value}
                    </span>
                    {s.unit && (
                      <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">
                        {s.unit}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {s.sub}
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: s.bg }}
                >
                  <Icon className="h-5 w-5" style={{ color: s.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sub stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: "ЧӨЛӨӨЛСӨН НЭГЖ ТАЛБАР",
            sub: `${STATS.totalParcels} нэгж талбараас`,
            value: STATS.freedParcels,
            pct: Math.round((STATS.freedParcels / STATS.totalParcels) * 100),
            color: "#02c0ce",
          },
          {
            label: "ЧӨЛӨӨЛСӨН ТАЛБАЙ",
            sub: `${STATS.planArea} га нийт талбайгаас`,
            value: `${STATS.freedArea} га`,
            pct: Math.round(
              (parseFloat(STATS.freedArea) / parseFloat(STATS.planArea)) * 100,
            ),
            color: "#0acf97",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="ap-card px-5 py-3.5 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {s.label}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {s.sub}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span
                className="text-[32px] font-black tabular-nums leading-none"
                style={{ color: s.color }}
              >
                {s.value}
              </span>
              <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${s.pct}%`, background: s.color }}
                />
              </div>
              <p
                className="text-[10px] font-bold mt-0.5"
                style={{ color: s.color }}
              >
                {s.pct}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3-column main ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_252px] gap-4 items-start">
        {/* LEFT: bar charts */}
        <div className="flex flex-col gap-4">
          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3.5">
              НЭГЖ ТАЛБАРЫН МЭДЭЭЛЭЛ
            </p>
            <div className="space-y-2.5">
              {STATUSES.map((s) => (
                <HBar
                  key={s.key}
                  label={s.label}
                  value={s.count}
                  maxVal={maxCount}
                  color={s.color}
                />
              ))}
            </div>
          </div>

          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3.5">
              НЭГЖ ТАЛБАРЫН ТАЛБАЙ /М.КВ/
            </p>
            <div className="space-y-2.5">
              {STATUSES.map((s) => (
                <HBar
                  key={s.key}
                  label={s.label}
                  value={s.area}
                  maxVal={maxArea}
                  color={s.color}
                  suffix=" м²"
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              ТАЙЛБАР
            </p>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: s.color }}
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: map + timeline */}
        <div className="flex flex-col gap-4">
          <div className="ap-card overflow-hidden" style={{ height: 320 }}>
            <MapView />
          </div>

          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              НӨХӨХ ОЛГОВОРТОЙГООР ЧӨЛӨӨЛСӨН НЭГЖ ТАЛБАР
            </p>
            <ResponsiveContainer width="100%" height={168}>
              <AreaChart
                data={TIMELINE}
                margin={{ top: 10, bottom: 0, left: -10, right: 8 }}
              >
                <defs>
                  <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="#02c0ce"
                      stopOpacity={isDark ? 0.3 : 0.18}
                    />
                    <stop offset="95%" stopColor="#02c0ce" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{
                    stroke: "#02c0ce",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#02c0ce"
                  strokeWidth={2}
                  fill="url(#tlGrad)"
                  name="Нэгж талбар"
                  dot={{ fill: "#02c0ce", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#02c0ce", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT: gauge + rejected */}
        <div className="flex flex-col gap-4">
          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              ГАЗАР ЧӨЛӨӨЛТИЙН ЯВЦ
            </p>
            <Gauge value={STATS.progress} isDark={isDark} />
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 -mt-2">
              Шинэчлэгдсэн: 4 минутын өмнө
            </p>
          </div>

          <div className="ap-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                ТАТГАЛЗСАН НЭГЖ ТАЛБАРЫН МЭДЭЭЛЭЛ
              </p>
            </div>
            <div
              className="overflow-y-auto divide-y divide-slate-50 dark:divide-[#37394d]"
              style={{ maxHeight: 420 }}
            >
              {REJECTED_PARCELS.map((p, i) => (
                <div
                  key={p.id}
                  className="p-3.5 flex gap-2.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold mt-0.5"
                    style={{ background: "#f1556c" }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-white leading-tight">
                      {p.name}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 mt-1.5">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          ҮНЭЛГЭЭ
                        </p>
                        <p
                          className="text-[11px] font-bold mt-0.5"
                          style={{ color: "#02c0ce" }}
                        >
                          {p.valuation}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          ТАЛБАЙ
                        </p>
                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                          {p.area}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5 line-clamp-2">
                      {p.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
