"use client";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt, legacyImportApi, type ImportState, type ReportRow } from "@/lib/legacy-import/api";
import {
  FileDrop, FileResults, IssueCell, IssueList, Stat, StepStatus, firstError, primaryButton, td, th, theadClass,
  ReadOnlyNotice,
} from "./shared";
import { ProjectCategoryPicker } from "./project-category-picker";

type Filter = "attention" | "skipped" | "all";

const MATCH_LABEL: Partial<Record<ReportRow["match"], string>> = {
  gus: "ГУС",
  excel: "эксэл (ГУС-д алга)",
  failed: "эксэл (ГУС алдаа)",
  synthetic: "дугааргүй",
  db: "санд бүртгэлтэй — орохгүй",
  no_project: "төсөлгүй — орохгүй",
  pending: "шалгаж байна",
};

const skipped = (r: ReportRow) => r.match === "db" || r.match === "no_project";

/**
 * «ЗӨВХӨН ҮНЭЛГЭЭ» — 1-Р АЛХАМ.
 *
 * Хил, нэгж талбарын SHP-гүй: архивын импортын адил чөлөөлөлтийг
 * «Бүтээн байгуулалтын ажлын нэр»-ээр бүлэглэж үүсгэнэ, ангиллыг
 * «Бүтээн байгуулалтын төрөл»-өөс (эсвэл гараар сонгоно), нэгж талбарыг ГУС-аас
 * татна. Эксэлийн толгой нь бүтэн импортын үнэлгээний файлтай ИЖИЛ.
 */
export function ValuationStep({
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
  const [filter, setFilter] = useState<Filter>("attention");
  const view = state.reports;
  const running = state.job?.kind === "reports" && state.job.state === "running";

  const submit = async () => {
    setBusy(true);
    try {
      const next = await legacyImportApi.reports(state.session.id, files);
      onUpdated(next);
      if (next.reports?.canProceed) toast.success("Үнэлгээний файл уншигдлаа — нэгж талбарыг ГУС-аас шалгаж байна");
      else toast.error(firstError(next.reports) ?? "Шалгалт давсангүй — доорх жагсаалтыг үзнэ үү", { duration: 10000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    const list = view?.rows ?? [];
    if (filter === "skipped") return list.filter(skipped);
    if (filter === "attention") return list.filter((r) => r.issues.some((i) => i.level !== "info"));
    return list;
  }, [view, filter]);
  const projectIssues = (view?.projects ?? []).flatMap((p) => p.issues);
  const stats = view?.stats;

  return (
    <div className="space-y-4">
      {locked ? (
        <ReadOnlyNotice title="Үнэлгээний файл" />
      ) : (
        <div className="ap-card space-y-4 p-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Үнэлгээний файл (зөвхөн үнэлгээ)</h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Нөхөх олговрын тайлан (.xlsx) — толгой нь бүтэн импортын үнэлгээний файлтай ижил. Хил, нэгж талбарын файл
              шаардахгүй: чөлөөлөлтийг «Бүтээн байгуулалтын ажлын нэр»-ээр бүлэглэж хилгүй үүсгэнэ, ангиллыг
              «Бүтээн байгуулалтын төрөл»-өөс, нэгж талбарыг ГУС-аас татна. Оноор нэрлэсэн sheet («2015») нь тухайн оны
              бүртгэл болно.
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
        </div>
      )}

      {view && stats && (
        <div className="ap-card space-y-4 p-4">
          <FileResults files={view.files} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Үнэлгээний мөр" value={fmt(stats.rows)} />
            <Stat label="Нийт дүн (₮)" value={fmt(stats.totalAmount)} />
            <Stat label="Чөлөөлөлт (төсөл)" value={fmt(stats.projects ?? 0)} />
            <Stat label="ГУС-аас" value={fmt(stats.gus)} tone="good" hint={stats.gusFromUb ? `data_ub ${fmt(stats.gusFromUb)}` : undefined} />
            <Stat label="ГУС-д олдоогүй" value={fmt(stats.excel ?? 0)} tone={stats.excel ? "warn" : "good"} hint="эксэлийн мэдээллээр" />
            <Stat label="Дугааргүй (ERR…)" value={fmt(stats.synthetic ?? 0)} tone={stats.synthetic ? "warn" : "default"} />
            <Stat label="Давхардсан (D2…)" value={fmt(stats.duplicates)} tone={stats.duplicates ? "warn" : "default"} />
            <Stat label="Орохгүй" value={fmt(stats.db + stats.missing)} tone={stats.db + stats.missing ? "bad" : "good"}
              hint={`${fmt(stats.missingAmount)}₮`} />
          </div>

          {(view.projects ?? []).length > 0 && (
            <div className="space-y-2">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-800 dark:text-white">Үүсэх чөлөөлөлт</h3>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Ангиллыг «Бүтээн байгуулалтын төрөл»-өөс автоматаар тогтооно — өөрчлөх бол сонгоно уу. Хил, бусад мэдээллийг
                  дараагийн алхамд оруулж болно (заавал биш).
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead className={theadClass}>
                    <tr>
                      <th className={th}>Төслийн нэр</th>
                      <th className={th}>Ангилал</th>
                      <th className={th}>Нэгж талбар</th>
                      <th className={th}>Мөр</th>
                      <th className={th}>Дүн (₮)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.projects!.map((p) => (
                      <tr key={p.name} className="border-b border-slate-50 align-top dark:border-white/[0.04]">
                        <td className={td}>
                          <b>{p.name}</b>
                          {p.variants.length > 1 && (
                            <span className="block text-[11px] text-slate-400" title={p.variants.join("\n")}>
                              {p.variants.length} бичиглэл нэгтгэсэн
                            </span>
                          )}
                          {p.existing && <span className="block text-[11px] text-[#f8285a]">өмнө импортоор орсон</span>}
                        </td>
                        <td className={td}>
                          <ProjectCategoryPicker sessionID={state.session.id} project={p}
                            chosen={state.projectSettings?.[p.name]?.category} onUpdated={onUpdated} disabled={locked} />
                        </td>
                        <td className={td}>{fmt(p.parcels)}</td>
                        <td className={td}>{fmt(p.rows)}</td>
                        <td className={td}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {projectIssues.length > 0 && <IssueList issues={projectIssues} />}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {([
              ["attention", `Анхаарах (${view.rows.filter((r) => r.issues.some((i) => i.level !== "info")).length})`],
              ["skipped", `Орохгүй (${view.rows.filter(skipped).length})`],
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
                  <th className={th}>Бүртгэх дугаар</th>
                  <th className={th}>Төсөл</th>
                  <th className={th}>Дүн (₮)</th>
                  <th className={th}>Тааралт</th>
                  <th className={th}>Шалгалт</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.idx} className="border-b border-slate-50 align-top dark:border-white/[0.04]">
                    <td className={cn(td, "whitespace-nowrap text-slate-500")}>{r.sheet} · {r.excelRow}</td>
                    <td className={td}>{r.parcelID || r.oldParcelID || "—"}</td>
                    <td className={cn(td, r.idKind && r.idKind !== "real" ? "font-semibold text-amber-600" : "")}>
                      {r.assignedID || "—"}
                    </td>
                    <td className={cn(td, "max-w-[220px] truncate")} title={r.project}>{r.project || "—"}</td>
                    <td className={td}>{fmt(r.totalAmount)}</td>
                    <td className={cn(td, "whitespace-nowrap", skipped(r) ? "text-[#f8285a]" : "")}>
                      {r.match === "gus" && r.gusOrigin === "ub" ? "data_ub" : MATCH_LABEL[r.match] ?? r.match}
                    </td>
                    <td className={td}><IssueCell issues={r.issues} /></td>
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
