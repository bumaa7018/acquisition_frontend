"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt, legacyImportApi, type ImportState, type ParcelRow } from "@/lib/legacy-import/api";
import {
  FileDrop, FileResults, IssueCell, Stat, StepStatus, firstError, primaryButton, td, th, theadClass, worst,
  ReadOnlyNotice,
} from "./shared";

const GeometryPreviewMap = dynamic(() => import("@/components/map/geometry-preview-map"), { ssr: false });

type Filter = "issues" | "status" | "outside" | "gus" | "all";

const GUS_LABEL: Record<ParcelRow["gus"], string> = {
  info: "ГУС", ub: "data_ub", missing: "олдоогүй", failed: "алдаа", skip: "—", pending: "шалгаж байна",
};

/**
 * 2-Р АЛХАМ — НЭГЖ ТАЛБАР.
 *
 * Дугааргүй / давхардсан / геометргүй мөр, СИСТЕМД БАЙХГҮЙ төлөвийн код (эхний
 * төлөвт орно — тусад нь ялгаж харуулна), санд
 * аль хэдийн байгаа нэгж талбар, ЧӨЛӨӨЛӨЛТИЙН ХИЛИЙН ГАДНАХ нэгж талбар болон
 * ГУС-аас татагдах эсэхийг харуулна. ГУС-ын шалгалт арын ажлаар явна.
 */
export function ParcelStep({
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
  const [filter, setFilter] = useState<Filter>("issues");
  const view = state.parcels;
  const running = state.job?.kind === "parcels" && state.job.state === "running";

  const submit = async () => {
    if (!files.some((f) => f.name.toLowerCase().endsWith(".shp"))) { toast.error(".shp файл сонгоно уу"); return; }
    setBusy(true);
    try {
      const next = await legacyImportApi.parcels(state.session.id, files);
      onUpdated(next);
      if (next.parcels?.canProceed) toast.success("Нэгж талбарын файл уншигдлаа — ГУС-аас шалгаж байна");
      else toast.error(firstError(next.parcels) ?? "Шалгалт давсангүй — доорх жагсаалтыг үзнэ үү", { duration: 10000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    const list = view?.rows ?? [];
    if (filter === "outside") return list.filter((r) => r.outside);
    if (filter === "status") return list.filter((r) => r.statusUnmatched);
    if (filter === "gus") return list.filter((r) => r.gus === "missing" || r.gus === "ub" || r.gus === "failed");
    if (filter === "issues") return list.filter((r) => worst(r.issues) === "error" || worst(r.issues) === "warning");
    return list;
  }, [view, filter]);

  const geometries = [
    ...(state.boundary?.map ?? []).map((m) => ({ wkt: m.boundary, color: "#02c0ce" })),
    ...(view?.map ?? []).filter((m) => !m.outside).map((m) => ({ wkt: m.wkt, color: "#64748b" })),
    ...(view?.map ?? []).filter((m) => m.outside).map((m) => ({ wkt: m.wkt, color: "#f8285a", filled: true })),
  ];

  return (
    <div className="space-y-4">
      {locked ? (
        <ReadOnlyNotice title="Нэгж талбарын файл" />
      ) : (
      <div className="ap-card space-y-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Нэгж талбарын файл</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Нөлөөлөлд өртсөн нэгж талбаруудын shapefile. Атрибутад <code>parcel_id</code> заавал, төлөвийн код
            (<code>code</code>) байвал зохино. Үндсэн хил, эрхийн мэдээллийг ГУС-аас татна.
          </p>
        </div>
        <FileDrop accept=".shp,.dbf,.shx,.prj,.cpg" hint=".shp, .dbf, .shx, .prj, .cpg" files={files}
          onChange={setFiles} disabled={locked || busy || running} />
        <div className="flex items-center justify-between gap-3">
          {view ? <StepStatus ok={view.canProceed} errors={view.errors} warnings={view.warnings} /> : <span />}
          <button className={primaryButton} onClick={submit} disabled={locked || busy || running || files.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Уншиж байна…" : view ? "Дахин шалгах" : "Оруулж шалгах"}
          </button>
        </div>
      </div>
      )}

      {view && (
        <div className="ap-card space-y-4 p-4">
          <FileResults files={view.files} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Нийт мөр" value={fmt(view.stats.total)} />
            <Stat label="Хилийн гадна" value={fmt(view.stats.outside)} tone={view.stats.outside ? "bad" : "good"} />
            <Stat label="ГУС-аас олдсон" value={fmt(view.stats.gus.info)} tone="good" />
            <Stat label="Зөвхөн data_ub" value={fmt(view.stats.gus.ub)} tone={view.stats.gus.ub ? "warn" : "default"} />
            <Stat label="ГУС-д олдоогүй" value={fmt(view.stats.gus.missing + view.stats.gus.failed)}
              tone={view.stats.gus.missing + view.stats.gus.failed ? "warn" : "default"} />
            <Stat label="Санд байгаа" value={fmt(view.stats.alreadyImported)} hint="Аль хэдийн бүртгэгдсэн — алгасна" />
            <Stat label="Давхардсан" value={fmt(view.stats.duplicates)} tone={view.stats.duplicates ? "warn" : "default"} />
            <Stat label="Дугааргүй (ERR)" value={fmt(view.stats.synthetic)} tone={view.stats.synthetic ? "warn" : "default"} />
            <Stat label="Төлөв таараагүй" value={fmt(view.stats.statusUnmatched ?? 0)}
              tone={view.stats.statusUnmatched ? "warn" : "good"}
              hint="SHP-ийн төлөвийн код системийн төлөвтэй таараагүй — эхний төлөвт орно" />
          </div>
          {Object.keys(view.stats.unmappedCodes).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="font-semibold">Системд байхгүй төлөвийн код:</span>
              {Object.entries(view.stats.unmappedCodes).map(([c, n]) => (
                <span key={c} className="rounded-md bg-amber-200/70 px-1.5 py-0.5 font-mono font-semibold dark:bg-amber-500/25">
                  {c} × {fmt(n)}
                </span>
              ))}
              <span>
                — эдгээр нэгж талбар эхний төлөв <b>«{view.stats.initialStatusName}»</b>-д хадгалагдана.
              </span>
              <button type="button" onClick={() => setFilter("status")} className="ml-auto font-semibold underline-offset-2 hover:underline">
                Жагсаалтаар харах
              </button>
            </div>
          )}

          {geometries.length > 0 && (
            <div>
              <p className="mb-1 text-[12px] text-slate-500">
                <span className="font-semibold text-[#02c0ce]">□</span> Чөлөөлөлтийн хил &nbsp;
                <span className="font-semibold text-slate-500">□</span> Нэгж талбар &nbsp;
                <span className="font-semibold text-[#f8285a]">■</span> Хилийн гадна
              </p>
              <GeometryPreviewMap geometries={geometries} height={380} />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {([
              ["issues", `Анхаарах (${view.rows.filter((r) => ["error", "warning"].includes(worst(r.issues) ?? "")).length})`],
              ...(view.stats.statusUnmatched
                ? ([["status", `Төлөв таараагүй (${view.stats.statusUnmatched})`]] as [Filter, string][])
                : []),
              ["outside", `Хилийн гадна (${view.stats.outside})`],
              ["gus", `ГУС-аас татагдаагүй (${view.stats.gus.missing + view.stats.gus.ub + view.stats.gus.failed})`],
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
            <table className="w-full min-w-[900px] text-left">
              <thead className={cn(theadClass, "sticky top-0")}>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Нэгж талбар</th>
                  <th className={th}>Төлөв</th>
                  <th className={th}>Талбай (м²)</th>
                  <th className={th}>Хилд</th>
                  <th className={th}>ГУС</th>
                  <th className={th}>Шалгалт</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className={td} colSpan={7}>Энэ ангилалд мөр алга.</td></tr>
                )}
                {rows.slice(0, 1000).map((row) => (
                  <tr key={row.idx} className={cn("border-b border-slate-50 dark:border-white/[0.04]",
                    row.statusUnmatched && "bg-amber-50/70 dark:bg-amber-500/[0.07]")}>
                    <td className={td}>{row.idx}</td>
                    <td className={td}>
                      <b>{row.parcelID || "—"}</b>
                      {row.oldParcelID && <div className="text-[11px] text-slate-400">{row.oldParcelID}</div>}
                    </td>
                    <td className={td}>
                      {row.statusName || row.status}
                      {row.statusUnmatched ? (
                        <div className="mt-0.5 inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                          код {row.sourceCode} системд байхгүй → эхний төлөв
                        </div>
                      ) : row.sourceCode !== null ? (
                        <span className="text-[11px] text-slate-400"> (код {row.sourceCode})</span>
                      ) : (
                        <span className="text-[11px] text-slate-400"> (кодгүй)</span>
                      )}
                    </td>
                    <td className={td}>{fmt(row.areaM2)}</td>
                    <td className={td}>
                      {row.outside
                        ? <span className="text-[#f8285a]">гадна ({fmt(row.nearestDistanceM)} м)</span>
                        : row.insidePct === null ? "—" : `${row.insidePct}%`}
                    </td>
                    <td className={td}>{GUS_LABEL[row.gus]}</td>
                    <td className={td}><IssueCell issues={row.issues} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 1000 && <p className="p-2 text-[12px] text-slate-500">Эхний 1000 мөрийг харуулав.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
