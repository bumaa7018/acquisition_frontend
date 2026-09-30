"use client";
import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, type RollbackLogEntry, type RollbackResult } from "@/lib/legacy-import/api";
import { Stat, td, th, theadClass } from "./shared";

const STEP_LABEL: Record<RollbackLogEntry["step"], string> = {
  valuation: "1. Үнэлгээ", parcel: "2. Нэгж талбар", acquisition: "3. Чөлөөлөлт", file: "Файл", rollback: "Устгал",
};
const KIND_LABEL: Record<string, string> = {
  valuation: "Үнэлгээ", decision_link: "Захирамжийн холбоос", funding_link: "Санхүүжилтийн холбоос",
  funding_source: "Санхүүжилтийн эх үүсвэр", decision_draft: "Захирамж", parcel: "Нэгж талбар",
  right_holder: "Эзэмшигч", document: "Баримт", land_acquisition: "Чөлөөлөлт", plan: "Төлөвлөгөө",
  file: "Файл", drone_layer: "Дроны давхарга", session: "Импорт",
};
const ACTION_LABEL: Record<RollbackLogEntry["action"], string> = {
  deleted: "Устгасан", detached: "Салгасан", skipped: "Алгассан", kept: "Үлдээсэн", failed: "Алдаа",
};
const ACTION_TONE: Record<RollbackLogEntry["action"], string> = {
  deleted: "text-[#f8285a]", detached: "text-slate-600 dark:text-slate-300", skipped: "text-slate-400",
  kept: "text-amber-600", failed: "text-[#f8285a] font-semibold",
};

type Filter = "all" | RollbackLogEntry["action"];

/** «Устгах»-ын түүх — хэн, хэзээ, алхам бүрт юу устгасан/алгассан/үлдээсэн. */
export function RollbackHistory({ log, result }: { log: RollbackLogEntry[]; result?: RollbackResult }) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => (filter === "all" ? log : log.filter((e) => e.action === filter)), [log, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of log) c[e.action] = (c[e.action] ?? 0) + 1;
    return c;
  }, [log]);
  const n = (key: string) => result?.counts?.[key] ?? 0;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-white/[0.08]">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-800 dark:text-white">
        <History className="h-4 w-4" /> Устгалын түүх
        {result && (
          <span className="text-[12px] font-normal text-slate-500">
            {result.by} · {new Date(result.at).toLocaleString("mn-MN")}
          </span>
        )}
      </p>
      {result && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Устгасан үнэлгээ" value={fmt(n("deleted:valuation"))} />
            <Stat label="Устгасан нэгж талбар" value={fmt(n("deleted:parcel"))} />
            <Stat label="Устгасан чөлөөлөлт" value={fmt(n("deleted:land_acquisition"))} />
            <Stat label="Аль хэдийн устсан (алгассан)" value={fmt(counts.skipped ?? 0)} tone={counts.skipped ? "warn" : "default"} />
          </div>
          {result.kept?.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Импортоос өөр мэдээлэлтэй тул үлдсэн чөлөөлөлт: <b>{result.kept.join(", ")}</b> — дэлгэрэнгүйг «Үлдээсэн» шүүлтүүрээс харна уу.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "deleted", "detached", "skipped", "kept", "failed"] as Filter[]).map((f) => {
          const total = f === "all" ? log.length : counts[f] ?? 0;
          if (f !== "all" && total === 0) return null;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("rounded-lg px-2.5 py-1 text-[12px] font-medium",
                filter === f ? "bg-[#02c0ce] text-white" : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300")}>
              {f === "all" ? "Бүгд" : ACTION_LABEL[f]} ({fmt(total)})
            </button>
          );
        })}
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className={theadClass}>
            <tr>
              <th className={th}>Алхам</th>
              <th className={th}>Төрөл</th>
              <th className={th}>Дугаар / нэр</th>
              <th className={th}>Үйлдэл</th>
              <th className={th}>Тайлбар</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i} className="border-b border-slate-50 align-top dark:border-white/[0.04]">
                <td className={cn(td, "whitespace-nowrap")}>{STEP_LABEL[e.step] ?? e.step}</td>
                <td className={cn(td, "whitespace-nowrap")}>{KIND_LABEL[e.kind] ?? e.kind}</td>
                <td className={cn(td, "break-all")}>{e.label || "—"}</td>
                <td className={cn(td, "whitespace-nowrap", ACTION_TONE[e.action])}>{ACTION_LABEL[e.action] ?? e.action}</td>
                <td className={td}>{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
