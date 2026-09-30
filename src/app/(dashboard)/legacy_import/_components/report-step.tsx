"use client";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt, legacyImportApi, type ImportState, type ReportRow } from "@/lib/legacy-import/api";
import {
  FileDrop, FileResults, IssueCell, JobProgress, Stat, StepStatus, firstError, primaryButton, td, th, theadClass,
  ReadOnlyNotice,
} from "./shared";

type Filter = "diff" | "missing" | "area" | "all";

const MATCH_LABEL: Record<ReportRow["match"], string> = {
  staged: "нэгж талбарын файлд",
  db: "санд бүртгэлтэй",
  gus: "ГУС-аас шинээр",
  missing: "олдоогүй",
  pending: "шалгаж байна",
};

/**
 * 3-Р АЛХАМ — ҮНЭЛГЭЭНИЙ ФАЙЛ.
 *
 * Нэгж талбарын ЗӨРҮҮ: эксэлд байгаа ч нэгж талбарын файлд байхгүй мөр (санд
 * эсвэл ГУС-аас олдсон, эсвэл огт олдоогүй), эсрэгээр нэгж талбарын файлд
 * байгаа ч үнэлгээний мөргүй нэгж талбар. ГУС-аас татагдаагүй мэдээлэл ба
 * талбайн зөрүүг анхааруулна.
 */
export function ReportStep({
  state,
  onUpdated,
  locked,
}: {
  state: ImportState;
  onUpdated: (next: ImportState) => void;
  locked: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("diff");
  const view = state.reports;
  const running = state.job?.kind === "reports" && state.job.state === "running";

  const submit = async () => {
    setBusy(true);
    try {
      const next = await legacyImportApi.reports(state.session.id, files);
      onUpdated(next);
      if (next.reports?.canProceed) toast.success("Үнэлгээний файл уншигдлаа");
      else toast.error(firstError(next.reports) ?? "Шалгалт давсангүй — доорх жагсаалтыг үзнэ үү", { duration: 10000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    const list = view?.rows ?? [];
    if (filter === "diff") return list.filter((r) => r.match !== "staged");
    if (filter === "missing") return list.filter((r) => r.match === "missing" || r.gusOrigin === "ub");
    if (filter === "area") return list.filter((r) => r.issues.some((i) => i.code === "area_diff"));
    return list;
  }, [view, filter]);

  return (
    <div className="space-y-4">
      {locked ? (
        <ReadOnlyNotice title="Үнэлгээний файл" />
      ) : (
      <div className="ap-card space-y-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Үнэлгээний файл</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Нөхөх олговрын тайлан (.xlsx). Загвар таарсан бүх sheet уншигдана. Олон файл сонгож болно.
          </p>
        </div>
        <FileDrop accept=".xlsx" hint=".xlsx" files={files} onChange={setFiles} disabled={locked || busy || running} />
        <div className="flex items-center justify-between gap-3">
          {view ? <StepStatus ok={view.canProceed} errors={view.errors} warnings={view.warnings} /> : <span />}
          <button className={primaryButton} onClick={submit} disabled={locked || busy || running || files.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Уншиж байна…" : view ? "Дахин шалгах" : "Оруулж шалгах"}
          </button>
        </div>
        {running && <JobProgress label="Нэгж талбарын файлд байхгүй мөрүүдийг ГУС-аас шалгаж байна" done={state.job!.done} total={state.job!.total} />}
      </div>
      )}

      {view && (
        <div className="ap-card space-y-4 p-4">
          <FileResults files={view.files} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Үнэлгээний мөр" value={fmt(view.stats.rows)} />
            <Stat label="Нийт дүн (₮)" value={fmt(view.stats.totalAmount)} />
            <Stat label="Файлд таарсан" value={fmt(view.stats.staged)} tone="good" />
            <Stat label="Санд бүртгэлтэй" value={fmt(view.stats.db)} />
            <Stat label="ГУС-аас шинээр" value={fmt(view.stats.gus)} tone={view.stats.gus ? "warn" : "default"} />
            <Stat label="Олдоогүй" value={fmt(view.stats.missing)} tone={view.stats.missing ? "bad" : "good"}
              hint={`${fmt(view.stats.missingAmount)}₮`} />
            <Stat label="Үнэлгээгүй нэгж талбар" value={fmt(view.stats.withoutReport)} tone={view.stats.withoutReport ? "warn" : "good"} />
            <Stat label="Талбайн зөрүү" value={fmt(view.stats.areaDiffs)} tone={view.stats.areaDiffs ? "warn" : "good"} />
          </div>

          {view.parcelsWithoutReport.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300">
              <p className="mb-1 font-semibold text-amber-600">
                Нэгж талбарын файлд байгаа ч үнэлгээний мөргүй ({view.parcelsWithoutReport.length}) — үнэлгээ, олговор орохгүй
              </p>
              <p className="break-words">{view.parcelsWithoutReport.map((p) => p.parcelID).join(", ")}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {([
              ["diff", `Нэгж талбарын зөрүү (${view.rows.filter((r) => r.match !== "staged").length})`],
              ["missing", `ГУС-аас татагдаагүй (${view.stats.missing + view.stats.gusFromUb})`],
              ["area", `Талбайн зөрүү (${view.stats.areaDiffs})`],
              ["all", `Бүгд (${view.rows.length})`],
            ] as [Filter, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={cn("rounded-full px-3 py-1 text-[12px] font-medium",
                  filter === key ? "bg-[#02c0ce] text-white" : "bg-slate-100 text-slate-600 dark:bg-[#252630] dark:text-slate-300")}>
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className={cn(theadClass, "sticky top-0")}>
                <tr>
                  <th className={th}>Эх сурвалж</th>
                  <th className={th}>Нэгж талбар</th>
                  <th className={th}>Өмчлөгч</th>
                  <th className={th}>Дүн (₮)</th>
                  <th className={th}>Талбай эксэл / SHP</th>
                  <th className={th}>Тааралт</th>
                  <th className={th}>Шалгалт</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td className={td} colSpan={7}>Зөрүү алга.</td></tr>}
                {rows.slice(0, 1000).map((row) => (
                  <tr key={row.idx} className="border-b border-slate-50 dark:border-white/[0.04]">
                    <td className={td}>
                      {row.sheet} <span className="text-slate-400">мөр {row.excelRow}</span>
                      <div className="text-[11px] text-slate-400">{row.file}</div>
                    </td>
                    <td className={td}>
                      <b>{row.parcelID || "—"}</b>
                      {row.oldParcelID && <div className="text-[11px] text-slate-400">{row.oldParcelID}</div>}
                    </td>
                    <td className={td}>{row.holderName || "—"}</td>
                    <td className={td}>{fmt(row.totalAmount)}</td>
                    <td className={td}>{fmt(row.affectedAreaM2, 2)} / {fmt(row.shpAreaM2)}</td>
                    <td className={td}>
                      {MATCH_LABEL[row.match]}{row.gusOrigin === "ub" ? " (data_ub)" : ""}
                    </td>
                    <td className={td}><IssueCell issues={row.issues} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
