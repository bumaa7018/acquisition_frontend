"use client";

// Захирамж ба санхүүжилтийн карт — хяналтын самбар ба чөлөөлөлтийн
// «Санхүүжилт» табд ИЖИЛ харагдана.
//
//   НЭГ карт, хоёр хуваагдана:
//   ЗҮҮН  — «Төлөвлөсөн санхүүжилтийн нийт дүн», доор нь тэр санхүүжилтээс
//           олгосон дүн.
//   БАРУУН — «Захирамж гарсан» дүн, доор нь Олгогдсон | Хүлээгдэж байгаа,
//           түүний доор «Захирамжийн төсөлд» (холбогдсон нэгж талбарын дүн).
//
// Бүх дүн нь САНХҮҮЖИЛТИЙН ОНООР (backend: /dashboard/decision-funding):
// нэгж талбар захирамжид холбогдсон санхүүжилтийн холбоосынхоо онд хамаарна.

import type { ReactNode } from "react";
import type { DecisionFundingSummary } from "@/lib/api";
import { AbbrevAmount } from "@/components/ui/amount-hint";

export const DECISION_FUNDING_COLORS = {
  issued: "#0acf97",
  granted: "#16a34a",
  pending: "#f59e0b",
  draft: "#777edd",
  planned: "#02c0ce",
} as const;

function billions(value: number): string {
  return `${(value / 1_000_000_000).toFixed(2)} тэр`;
}

function Amount({ value }: { value: number }) {
  return <AbbrevAmount value={value}>{billions(value)}</AbbrevAmount>;
}

/**
 * Эзлэх хувь — яг 100% (эсвэл 0%) бол бүхэл, бусад үед аравны нэг орноор
 * (99.8%). Тоймлолт 100.0% / 0.0% болж төөрөгдүүлэхээс сэргийлнэ:
 * 99.96 → 99.9%, 0.02 → <0.1%.
 */
export function share(part: number, total: number): string {
  if (total <= 0) return "—";
  const pct = (part / total) * 100;
  if (pct >= 100) return `${Math.round(pct)}%`;
  if (pct <= 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  return `${Math.min(99.9, Math.round(pct * 10) / 10).toFixed(1)}%`;
}

/** Сонгосон онуудын шошго: [] → «Бүх он», [2025] → «2025 он». */
export function fundingYearsLabel(years: number[]): string {
  if (years.length === 0) return "Бүх он";
  return `${[...years].sort((a, b) => a - b).join(", ")} он`;
}

function Skel({ w = "w-20" }: { w?: string }) {
  return <span className={`inline-block h-6 ${w} animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]`} />;
}

function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-widest text-slate-400 dark:text-slate-500">
        {children}
      </p>
      {right && (
        <span className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500">{right}</span>
      )}
    </div>
  );
}

/** Нэг мөрт задаргаа: ● шошго … дүн (хувь). */
function Row({
  label,
  value,
  color,
  note,
  strong,
}: {
  label: string;
  value?: number;
  color: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] leading-5">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className={`truncate ${strong ? "font-semibold text-slate-600 dark:text-slate-300" : ""}`}>{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {value === undefined ? <Skel w="w-10" /> : <Amount value={value} />}
        </span>
        {note && <span className="tabular-nums text-slate-400">{note}</span>}
      </span>
    </div>
  );
}

/**
 * Захирамж ба санхүүжилтийн карт:
 *   ЗҮҮН  — «Төсөв» (төлөвлөсөн санхүүжилтийн нийт дүн).
 *   БАРУУН — «Захирамж гарсан» дүн (үндсэн), доор нь Олгогдсон / Хүлээгдэж
 *            байгаа мөр мөрөөр.
 *   ДООД  — «Захирамжийн төсөлд».
 */
export function DecisionFundingCard({
  data,
  loading,
  yearLabel,
  className,
}: {
  data?: DecisionFundingSummary | null;
  loading?: boolean;
  yearLabel: string;
  className?: string;
}) {
  const ready = !loading && !!data;
  const issued = data?.issued;
  const draft = data?.draft;
  const big = "mt-1.5 text-[22px] font-black leading-none tabular-nums text-slate-800 dark:text-white";
  return (
    <div className={`ap-card relative overflow-hidden px-4 py-4 ${className ?? ""}`}>
      <div className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: DECISION_FUNDING_COLORS.issued }} />
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ЗҮҮН — төсөв (төлөвлөсөн санхүүжилтийн нийт дүн). */}
        <div className="min-w-0">
          <Label>Төсөв</Label>
          <div className={big}>{ready ? <Amount value={data?.planned ?? 0} /> : <Skel />}</div>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{yearLabel}</p>
        </div>
        {/* БАРУУН — захирамж гарсан (үндсэн), доор нь олгогдсон / хүлээгдэж байгаа. */}
        <div className="min-w-0 sm:border-l sm:border-slate-100 sm:pl-4 sm:dark:border-white/[0.06]">
          <Label right={issued ? `${issued.parcels.toLocaleString()} н.т` : undefined}>Захирамж гарсан</Label>
          <div className={big}>{ready && issued ? <Amount value={issued.amount} /> : <Skel />}</div>
          <div className="mt-1.5">
            <Row
              label="Олгогдсон"
              value={ready ? issued?.granted ?? 0 : undefined}
              color={DECISION_FUNDING_COLORS.granted}
              note={issued ? share(issued.granted, issued.amount) : undefined}
            />
            <Row
              label="Хүлээгдэж байгаа"
              value={ready ? issued?.pending ?? 0 : undefined}
              color={DECISION_FUNDING_COLORS.pending}
              note={issued ? share(issued.pending, issued.amount) : undefined}
            />
          </div>
        </div>
      </div>
      {/* ДООД — захирамжийн төсөлд холбогдсон нэгж талбарын дүн. */}
      <div className="mt-1.5 border-t border-slate-100 pt-1 dark:border-white/[0.06]">
        <Row
          label="Захирамжийн төсөлд"
          value={ready ? draft?.amount ?? 0 : undefined}
          color={DECISION_FUNDING_COLORS.draft}
          note={draft ? `${draft.parcels.toLocaleString()} н.т` : undefined}
          strong
        />
      </div>
    </div>
  );
}
