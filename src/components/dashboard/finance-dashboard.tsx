"use client";

// САНХҮҮГИЙН мэргэжилтний хяналтын самбар.
//
// Зарчим: газрын зураг/байршил ХАРУУЛАХГҮЙ — зөвхөн мөнгөн дүн ба тоон
// үзүүлэлт. Бүх өгөгдөл НЭГ хөнгөн endpoint-оос (`/dashboard/finance`) ирнэ:
// backend талд нэг асуулгаар нэгтгэгддэг тул жагсаалт татаж client дээр
// нэгтгэх шаардлагагүй (том өгөгдөлд ачаалал өгөхгүй).
//
// Байршил (хоосон зайгүй):
//   1. 4 гол үзүүлэлт
//   2. 3 донат нэг мөрөнд — чөлөөлөлт төлөвөөр · нэгж талбарын гүйцэтгэл ·
//      санхүүжилтийн төрөл (дүн нь тайлбар мөрөнд — давхардсан карт байхгүй)
//   3. Оноор (шугаман, 2/3) · Үнэлгээний бүтэц + захирамжийн төсөв (1/3)
//   4. Дүүрэг/сумаар (дарж шүүнэ) · Явж буй чөлөөлөлтүүд

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
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
import { AbbrevAmount } from "@/components/ui/amount-hint";

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

// Батлагдсан / Олгосон / Хүлээгдэж буй — самбар даяар ИЖИЛ өнгө (өнгө нь
// утгыг дагана). Олгосон нь #16a34a: өмнөх #10b981 нь цэнхэр-ногоон (#02c0ce)-той
// хэвийн хараатай хүнд ч ялгагдахгүй байсан (ΔE 10.8 < 15) — validate_palette.
const COLORS = {
  amount: "#02c0ce",
  granted: "#16a34a",
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

/** Гарчигтай карт — бүх хэсгийн нэг загвар. */
function Card({
  title,
  right,
  className = "",
  align = "center",
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  /** Жагсаалт дээд талаасаа эхэлнэ (start); чарт/донат дундаа (center). */
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  // Мөрний өндрөөр сунах үед агуулга нь ДУНДАА байрлана — хөрш картууд ижил
  // өндөртэй, доор нь хоосон зурвас үлдэхгүй.
  return (
    <div className={`ap-card flex flex-col px-4 py-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {right}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${align === "start" ? "justify-start" : "justify-center"}`}>{children}</div>
    </div>
  );
}

/**
 * Дугуй (donut) чарт + баруун талдаа задаргаа.
 *
 * Тайлбарын мөр бүр: нэр, тоо, доор нь жижгээр дүн/хувь — тусдаа карт
 * давхардуулахгүйгээр нэг зурагт бүх тоо багтана.
 */
function DonutCard({
  rows,
  centerValue,
  centerLabel,
  emptyText,
}: {
  rows: { name: string; value: number; color: string; hint?: React.ReactNode; title?: string; display?: string; inlineHint?: string }[];
  centerValue: string;
  centerLabel: string;
  emptyText: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const shown = rows.filter((row) => row.value > 0);
  if (total === 0) {
    return <p className="py-10 text-center text-[12px] text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[136px] w-[136px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="none">
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
          <span className="text-[16px] font-bold tabular-nums text-slate-800 dark:text-white">{centerValue}</span>
          <span className="text-[10px] text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row) => (
          <div key={row.name} className="min-w-0" title={row.title}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-600 dark:text-slate-300">{row.name}</span>
              {row.inlineHint && (
                <span className="shrink-0 text-[10.5px] tabular-nums text-slate-400">{row.inlineHint}</span>
              )}
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-slate-800 dark:text-white">
                {row.display ?? row.value.toLocaleString()}
              </span>
            </div>
            {row.hint && (
              <p className="pl-[18px] text-[10.5px] tabular-nums text-slate-400">{row.hint}</p>
            )}
          </div>
        ))}
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
  value: React.ReactNode;
  hint?: React.ReactNode;
  Icon: typeof Banknote;
  tone: string;
}) {
  return (
    <div className="ap-card flex items-center gap-3 border-l-4 px-4 py-3" style={{ borderLeftColor: tone }}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${tone}1a`, color: tone }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="whitespace-normal break-words text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="break-words text-[21px] font-bold leading-tight tabular-nums text-slate-800 dark:text-white">
          {value}
        </p>
        {hint && <p className="whitespace-normal break-words text-[11px] tabular-nums text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Дүн + тоог нэг мөрөнд харуулах задаргааны жагсаалт. Мөр бүрийн доор нийтэд
 * эзлэх хувийн нимгэн зурвас — тусдаа баганан чарт давхардуулахгүй.
 */
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
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
      {rows.map((row) => {
        const share = total > 0 ? (row.amount / total) * 100 : 0;
        const active = activeKey === row.key;
        return (
          <div
            key={row.key}
            role={onPick ? "button" : undefined}
            tabIndex={onPick ? 0 : undefined}
            onClick={onPick ? () => onPick(active ? "" : row.key) : undefined}
            onKeyDown={
              onPick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(active ? "" : row.key);
                    }
                  }
                : undefined
            }
            className={`flex w-full items-center gap-3 px-1 py-1.5 text-left transition-colors ${
              onPick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#252630]" : "cursor-default"
            } ${active ? "bg-[#02c0ce]/8" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-slate-600 dark:text-slate-300">{row.name}</span>
              <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${(row.amount / max) * 100}%`, background: COLORS.amount }}
                />
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
              {row.parcels.toLocaleString()} т.
            </span>
            <span
              className="w-24 shrink-0 whitespace-nowrap text-right text-[12px] font-bold tabular-nums text-slate-800 dark:text-white"
              title={money(row.amount)}
            >
              <AbbrevAmount value={row.amount}>{billions(row.amount)}</AbbrevAmount>
            </span>
            <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{share.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Оноор: шугаман график ───────────────────────────────────────────────────

/**
 * Он дараалсан байх ёстой: тэнхлэг ангиллын (category) тул дутуу он (жишээ
 * нь 2023) алгасагдвал 2022→2024 нэг жилийн алхам мэт харагдаж өсөлт/бууралтыг
 * гуйвуулна. Хамгийн бага-их оны хооронд дутуу оныг 0-ээр нөхнө.
 */
function fillYears(rows: FinanceBucket[]): { year: string; amount: number; granted: number; pending: number }[] {
  if (rows.length === 0) return [];
  const byYear = new Map(rows.map((row) => [Number(row.name), row]));
  const years = Array.from(byYear.keys());
  const out = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    const row = byYear.get(y);
    out.push({ year: String(y), amount: row?.amount ?? 0, granted: row?.granted ?? 0, pending: row?.pending ?? 0 });
  }
  return out;
}

type SeriesKey = "amount" | "granted" | "pending";
type MarkerShape = "circle" | "square" | "diamond";

// Өнгө ганцаараа ялгах хэрэгсэл биш: Олгосон↔Хүлээгдэж буй хос нь
// протанопид ΔE 6–7 (validate_palette WARN) тул ХЭЛБЭР (дугуй/дөрвөлжин/
// ромб) ба Хүлээгдэж буйн тасархай шугам хоёрдогч кодчлол болно.
const SERIES: { key: SeriesKey; label: string; shape: MarkerShape; dash?: string }[] = [
  { key: "amount", label: "Батлагдсан", shape: "circle" },
  { key: "granted", label: "Олгосон", shape: "square" },
  { key: "pending", label: "Хүлээгдэж буй", shape: "diamond", dash: "6 4" },
];

// Харанхуй горимын алхмууд нь ижил өнгөний бараан хувилбар (OKLCH L 0.48–0.67),
// харанхуй гадаргуу дээр validate_palette --mode dark-аар шалгагдсан.
const SERIES_COLORS: Record<"light" | "dark", Record<SeriesKey, string>> = {
  light: { amount: COLORS.amount, granted: COLORS.granted, pending: COLORS.pending },
  dark: { amount: "#0891b2", granted: "#16a34a", pending: "#d97706" },
};

type YearRow = { year: string } & Record<SeriesKey, number>;

/** Цэгийн тэмдэг — 2px гадаргуун хүрээтэй (шугам дээр давхцахад ялгарна). */
function Marker({
  cx,
  cy,
  shape,
  color,
  surface,
  r = 4,
}: {
  cx?: number;
  cy?: number;
  shape: MarkerShape;
  color: string;
  surface: string;
  r?: number;
}) {
  if (cx == null || cy == null) return null;
  const common = { fill: color, stroke: surface, strokeWidth: 2 };
  if (shape === "square") {
    return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1} {...common} />;
  }
  if (shape === "diamond") {
    const d = r + 1;
    return <path d={`M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`} {...common} />;
  }
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

/** Тайлбарын тэмдэг — шугамын хэв (тасархай эсэх) + цэгийн хэлбэр. */
function SeriesSwatch({ color, shape, dash, surface }: { color: string; shape: MarkerShape; dash?: string; surface: string }) {
  return (
    <svg width="26" height="12" aria-hidden className="shrink-0">
      <line x1="1" y1="6" x2="25" y2="6" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      <Marker cx={13} cy={6} shape={shape} color={color} surface={surface} r={3.5} />
    </svg>
  );
}

/** Өмнөх онтой харьцуулсан өөрчлөлт: ▲/▼ хувь (текстийн өнгөөр — цуврал өнгөөр биш). */
function Change({ current, previous }: { current: number; previous?: number }) {
  if (previous == null) return null;
  if (previous === 0) {
    return current > 0 ? <span className="text-slate-500 dark:text-slate-400">▲ шинэ</span> : null;
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-slate-400">— 0%</span>;
  return (
    <span className="text-slate-500 dark:text-slate-400">
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function YearTrendChart({ rows, undated }: { rows: YearRow[]; undated?: FinanceBucket }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const colors = SERIES_COLORS[dark ? "dark" : "light"];
  const surface = dark ? "#1e1f27" : "#ffffff";
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  return (
    <Card
      title="Оноор"
      className="xl:col-span-2"
      right={
        undated && undated.amount > 0 ? (
          <span className="text-[11px] text-slate-400" title={money(undated.amount)}>
            Огноогүй: {billions(undated.amount)}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-[12px] text-slate-400">Өгөгдөл алга</p>
      ) : (
        <>
          {/* Тайлбар: хэлбэр + тасархай хэв + СҮҮЛИЙН оны дүн ба өмнөх онтой харьцуулсан өөрчлөлт. */}
          <div className="mb-1 flex flex-wrap gap-x-5 gap-y-1.5">
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-[11.5px]">
                <SeriesSwatch color={colors[s.key]} shape={s.shape} dash={s.dash} surface={surface} />
                <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
                {last && (
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-white" title={money(last[s.key])}>
                    {billions(last[s.key])}
                  </span>
                )}
                {last && <span className="text-[10.5px] tabular-nums"><Change current={last[s.key]} previous={prev?.[s.key]} /></span>}
              </div>
            ))}
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 16, right: 16 }}
                />
                <YAxis
                  tickFormatter={(v) => `${(Number(v) / 1_000_000_000).toFixed(0)}`}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  label={{ value: "тэрбум₮", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip
                  cursor={{ stroke: dark ? "#4a4d63" : "#cbd5e1", strokeWidth: 1 }}
                  content={({ active, label }) => {
                    if (!active || label == null) return null;
                    const i = rows.findIndex((r) => r.year === String(label));
                    if (i < 0) return null;
                    return (
                      <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-lg">
                        <p className="mb-1 font-semibold">{label} он</p>
                        {SERIES.map((s) => (
                          <div key={s.key} className="flex items-center gap-2 py-0.5">
                            <SeriesSwatch color={colors[s.key]} shape={s.shape} dash={s.dash} surface="#1e1f27" />
                            <span className="min-w-[96px]">{s.label}</span>
                            <span className="font-semibold tabular-nums">{money(rows[i][s.key])}</span>
                            <span className="text-[10.5px] tabular-nums">
                              <Change current={rows[i][s.key]} previous={rows[i - 1]?.[s.key]} />
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={colors[s.key]}
                    strokeWidth={2}
                    strokeDasharray={s.dash}
                    isAnimationActive={false}
                    dot={(p: { cx?: number; cy?: number; index?: number }) => (
                      <Marker key={`${s.key}-${p.index}`} cx={p.cx} cy={p.cy} shape={s.shape} color={colors[s.key]} surface={surface} />
                    )}
                    activeDot={(p: { cx?: number; cy?: number; index?: number }) => (
                      <Marker key={`${s.key}-a-${p.index}`} cx={p.cx} cy={p.cy} shape={s.shape} color={colors[s.key]} surface={surface} r={5.5} />
                    )}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}

/** Хэвтээ баганан задаргаа (үнэлгээний бүтэц, захирамжийн төсөв). */
function HBarList({
  rows,
  colorOf,
  tooltip,
}: {
  rows: { key: string; name: string; value: number }[];
  colorOf: (index: number, key: string) => string;
  tooltip?: (key: string) => string;
}) {
  return (
    <div style={{ height: Math.max(40, rows.length * 30 + 8) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, bottom: 0, left: 0, right: 88 }} barCategoryGap="22%">
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            width={124}
            axisLine={false}
            tickLine={false}
            // Нэг мөрөнд (recharts-ийн автомат таслалт нэрийг хоёр мөр болгодог байв).
            tick={({ x, y, payload }) => {
              const v = String(payload?.value ?? "");
              return (
                <text x={Number(x) - 6} y={Number(y)} dy={4} textAnchor="end" fontSize={10.5} fill="#94a3b8">
                  {v.length > 20 ? `${v.slice(0, 19)}…` : v}
                </text>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const key = (item?.payload as { key?: string } | undefined)?.key ?? "";
              const extra = tooltip?.(key);
              return [extra ? `${money(Number(value ?? 0))} · ${extra}` : money(Number(value ?? 0)), "Дүн"];
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
            {rows.map((row, i) => (
              <Cell key={row.key} fill={colorOf(i, row.key)} />
            ))}
            <LabelList
              dataKey="value"
              content={({ x, y, width, height, value }) => (
                <text
                  x={Number(x ?? 0) + Number(width ?? 0) + 6}
                  y={Number(y ?? 0) + Number(height ?? 0) / 2}
                  dy={3.5}
                  fontSize={10}
                  fontWeight={600}
                  fill="#64748b"
                >
                  {billions(Number(value ?? 0))}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
  });

  const byDistrict = data?.by_district ?? [];
  const topAcquisitions = data?.top_acquisitions ?? [];
  const statusCards = data?.acquisition_status ?? [];
  const budgetCards = data?.acquisition_budgets ?? [];
  // ЯВЖ БУЙ (баталгаажаагүй) чөлөөлөлтүүд — үнэлгээний дүнгээр буурахаар,
  // хажууд нь олгосон дүн. Нэр урт байдаг тул тэнхлэгт богиносгоно.
  const acquisitionChart = topAcquisitions.map((row) => ({
    name: row.name.length > 30 ? `${row.name.slice(0, 29)}…` : row.name,
    "Үнэлгээний дүн": row.amount,
    Олгосон: row.granted,
  }));
  const totalAmount = data?.total_amount ?? 0;
  const pct = (part: number) => (totalAmount > 0 ? `${((part / totalAmount) * 100).toFixed(1)}%` : "0%");

  // Чөлөөлөлтийн "Санхүүжилт" табтай ИЖИЛ задаргаа.
  const stageRows = [
    { name: "Олгогдсон", count: data?.stage_granted.count ?? 0, amount: data?.stage_granted.amount ?? 0, color: COLORS.granted },
    { name: "Үнэлгээ баталгаажсан", count: data?.stage_approved.count ?? 0, amount: data?.stage_approved.amount ?? 0, color: COLORS.amount },
    { name: "Үнэлгээ хүлээгдэж буй", count: data?.stage_submitted.count ?? 0, amount: data?.stage_submitted.amount ?? 0, color: COLORS.property },
    { name: "Үнэлгээ хийгээгүй", count: data?.stage_pending.count ?? 0, amount: data?.stage_pending.amount ?? 0, color: COLORS.muted },
  ];
  const stageTotal = stageRows.reduce((sum, row) => sum + row.count, 0);
  const structureRows = [
    { key: "land", name: "Газрын үнэлгээ", value: data?.land_amount ?? 0, color: COLORS.amount },
    { key: "real_state", name: "Үл хөдлөх хөрөнгө", value: data?.real_state_amount ?? 0, color: COLORS.parcels },
    { key: "property", name: "Эд хөрөнгө, зардал", value: data?.property_amount ?? 0, color: COLORS.property },
  ].filter((row) => row.value > 0);
  // Санхүүжилтийн төрөл — дүнгээр эхний 4 + «Бусад» (олон жижиг зүсэм
  // донатыг уншигдахгүй болгож, картыг хэт өндөр болгодог байв).
  const fundingTypes = useMemo(() => {
    const rows = [...(data?.funding_by_type ?? [])]
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    if (rows.length <= 5) return rows.map((row) => ({ key: row.key, name: row.name, amount: row.amount }));
    const rest = rows.slice(4).reduce((sum, row) => sum + row.amount, 0);
    return [
      ...rows.slice(0, 4).map((row) => ({ key: row.key, name: row.name, amount: row.amount })),
      { key: "__other", name: `Бусад (${rows.length - 4})`, amount: rest },
    ];
  }, [data]);
  const fundingTotal = fundingTypes.reduce((sum, row) => sum + row.amount, 0);

  // Оноор — өсөх дарааллаар; огноогүй мөрийг шугамд оруулахгүй (тусад нь харуулна).
  const { yearRows, undated } = useMemo(() => {
    const all = data?.by_year ?? [];
    return {
      yearRows: fillYears(all.filter((row) => /^\d{4}$/.test(row.name.trim()))),
      undated: all.find((row) => row.name.trim() === ""),
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-slate-800 dark:text-white">Санхүүгийн хяналтын самбар</h1>
          <p className="text-[12px] text-slate-400">Нөхөх олговрын дүн, олголтын явц — он, дүүрэг, хороогоор</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearMultiSelect value={years} onChange={setYears} className="w-36" />
          {/* ДҮҮРЭГ — бүрэн жагсаалт (шүүлтээс хамаарахгүй). */}
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className={SELECT_CLS}>
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
          {/* 1. Гол үзүүлэлт */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              label="Нийт үнэлгээний дүн"
              value={<AbbrevAmount value={totalAmount}>{billions(totalAmount)}</AbbrevAmount>}
              hint={money(totalAmount)}
              Icon={Landmark}
              tone={COLORS.amount}
            />
            <Tile
              label="Олгосон дүн"
              value={<AbbrevAmount value={data?.granted_amount ?? 0}>{billions(data?.granted_amount ?? 0)}</AbbrevAmount>}
              hint={totalAmount > 0 ? `${pct(data?.granted_amount ?? 0)} гүйцэтгэл` : undefined}
              Icon={Banknote}
              tone={COLORS.granted}
            />
            <Tile
              label="Хүлээгдэж буй дүн"
              value={<AbbrevAmount value={data?.pending_amount ?? 0}>{billions(data?.pending_amount ?? 0)}</AbbrevAmount>}
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

          {/* 2. Гурван донат нэг мөрөнд */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card
              title="Чөлөөлөлт төлөвөөр"
              right={
                <span className="text-[11px] font-semibold tabular-nums text-slate-500" title={money(totalAmount)}>
                  {billions(totalAmount)}
                </span>
              }
            >
              <DonutCard
                rows={statusCards.map((row) => ({
                  name: row.name,
                  value: row.count,
                  color: ACQ_STATUS_COLORS[row.key] ?? COLORS.muted,
                  hint: `${row.parcels.toLocaleString()} талбар · ${billions(row.amount)}`,
                  title: money(row.amount),
                }))}
                centerValue={(data?.total_acquisitions ?? 0).toLocaleString()}
                centerLabel="чөлөөлөлт"
                emptyText="Чөлөөлөлт алга"
              />
            </Card>
            <Card title="Нэгж талбарын гүйцэтгэл">
              <DonutCard
                rows={stageRows.map((row) => ({
                  name: row.name,
                  value: row.count,
                  color: row.color,
                  hint: `${stageTotal > 0 ? ((row.count / stageTotal) * 100).toFixed(1) : "0.0"}% · ${billions(row.amount)}`,
                  title: money(row.amount),
                }))}
                centerValue={stageTotal.toLocaleString()}
                centerLabel="нэгж талбар"
                emptyText="Нэгж талбар алга"
              />
            </Card>
            <Card
              title="Санхүүжилтийн төрлөөр"
              className="lg:col-span-2 xl:col-span-1"
              right={
                <span className="text-[11px] font-semibold tabular-nums text-slate-500" title={money(data?.funding_total ?? 0)}>
                  {billions(data?.funding_total ?? 0)}
                </span>
              }
            >
              {fundingTypes.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-400">Санхүүжилтийн эх үүсвэр бүртгэгдээгүй</p>
              ) : (
                <DonutCard
                  rows={fundingTypes.map((row, i) => ({
                    name: row.name,
                    value: row.amount,
                    color: row.key === "__other" ? COLORS.muted : PALETTE[i % PALETTE.length],
                    display: billions(row.amount),
                    hint: `${fundingTotal > 0 ? ((row.amount / fundingTotal) * 100).toFixed(1) : "0.0"}%`,
                    title: `${row.name} · ${money(row.amount)}`,
                  }))}
                  centerValue={(fundingTotal / 1_000_000_000).toFixed(1)}
                  centerLabel="тэрбум₮"
                  emptyText="Санхүүжилтийн эх үүсвэр бүртгэгдээгүй"
                />
              )}
            </Card>
          </div>

          {/* 3. Оноор (шугаман) · бүтэц + төсөв */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <YearTrendChart rows={yearRows} undated={undated} />
            <div className="flex flex-col gap-4">
              <Card title="Үнэлгээний бүтэц" className="flex-1">
                {structureRows.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-slate-400">Өгөгдөл алга</p>
                ) : (
                  <HBarList
                    rows={structureRows}
                    colorOf={(i) => structureRows[i].color}
                    tooltip={(key) => pct(structureRows.find((row) => row.key === key)?.value ?? 0)}
                  />
                )}
              </Card>
              {budgetCards.length > 0 && (
                <Card title="Захирамжийн төсвөөр" className="flex-1">
                  <HBarList
                    rows={budgetCards.map((row) => ({ key: row.key, name: row.name, value: row.amount }))}
                    colorOf={(i) => PALETTE[i % PALETTE.length]}
                    tooltip={(key) => {
                      const row = budgetCards.find((b) => b.key === key);
                      return row ? `${row.count.toLocaleString()} чөлөөлөлт · олгосон ${billions(row.granted)}` : "";
                    }}
                  />
                </Card>
              )}
            </div>
          </div>

          {/* 4. Дүүрэг/сумаар (дарж шүүнэ) · явж буй чөлөөлөлтүүд */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card
              title="Дүүрэг / сумаар"
              align="start"
              right={<span className="text-[11px] text-slate-400">{byDistrict.length} нэгж · дарж шүүнэ</span>}
            >
              <div className="max-h-[360px] overflow-y-auto">
                <BucketList
                  rows={byDistrict}
                  total={totalAmount}
                  emptyText="Дүүргийн мэдээлэл алга"
                  onPick={(key) => setDistrict(key)}
                  activeKey={district}
                />
              </div>
            </Card>

            <Card
              title="Явж буй чөлөөлөлтүүд"
              align="start"
              right={
                <span className="text-[11px] text-slate-400">
                  Нийт {(data?.total_acquisitions ?? 0).toLocaleString()} чөлөөлөлт
                </span>
              }
            >
              {topAcquisitions.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-slate-400">Өгөгдөл алга</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  <div style={{ height: Math.max(160, topAcquisitions.length * 30 + 32) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={acquisitionChart} layout="vertical" margin={{ left: 0, right: 76 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={205}
                          axisLine={false}
                          tickLine={false}
                          tick={({ x, y, payload }) => (
                            <text x={Number(x) - 6} y={Number(y)} dy={4} textAnchor="end" fontSize={10.5} fill="#94a3b8">
                              {String(payload?.value ?? "")}
                            </text>
                          )}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(148,163,184,0.08)" }}
                          contentStyle={TOOLTIP_STYLE}
                          formatter={(value) => money(Number(value ?? 0))}
                        />
                        <Legend verticalAlign="top" align="right" height={22} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Үнэлгээний дүн" radius={[0, 4, 4, 0]} barSize={10} fill={COLORS.amount} isAnimationActive={false}>
                          <LabelList
                            dataKey="Үнэлгээний дүн"
                            position="right"
                            formatter={(value: unknown) => billions(Number(value ?? 0))}
                            style={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                          />
                        </Bar>
                        <Bar dataKey="Олгосон" radius={[0, 4, 4, 0]} barSize={10} fill={COLORS.granted} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
