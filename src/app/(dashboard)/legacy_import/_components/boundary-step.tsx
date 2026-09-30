"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmt, legacyImportApi, type ImportState } from "@/lib/legacy-import/api";
import {
  FileDrop, FileResults, IssueCell, StepStatus, firstError, inputClass, primaryButton, td, th, theadClass,
  ReadOnlyNotice,
} from "./shared";

const GeometryPreviewMap = dynamic(() => import("@/components/map/geometry-preview-map"), { ssr: false });

/**
 * 1-Р АЛХАМ — ЧӨЛӨӨЛӨЛТИЙН ХИЛ.
 *
 * Үйлчилгээ нь: shapefile-ийн бүх хэсэг (.shp/.dbf/.shx, .prj) ирсэн эсэх,
 * төлөвлөгөөний дугаар атрибут байгаа эсэх, геометр полигон/зөв эсэх,
 * ГУС-аас төлөвлөгөө олдсон эсэх, хил нь төлөвлөгөөний хилтэй таарч буйг
 * шалгана. Алдаа байвал дараагийн алхам руу шилжихгүй.
 */
export function BoundaryStep({
  state,
  onUpdated,
  locked,
}: {
  state: ImportState;
  onUpdated: (next: ImportState) => void;
  locked: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [general, setGeneral] = useState(state.session.category?.general ?? "");
  const [sub, setSub] = useState(state.session.category?.sub ?? "");
  const [busy, setBusy] = useState(false);
  const categories = useQuery({ queryKey: ["legacy-import", "categories"], queryFn: legacyImportApi.categories });

  const generals = useMemo(() => (categories.data ?? []).filter((c) => c.parentId === null), [categories.data]);
  const subs = useMemo(
    () => (categories.data ?? []).filter((c) => general && c.parentId === Number(general)),
    [categories.data, general],
  );
  useEffect(() => { if (sub && !subs.some((s) => String(s.id) === sub)) setSub(""); }, [subs, sub]);

  const view = state.boundary;
  const submit = async () => {
    if (!general) { toast.error("Ерөнхий ангиллыг сонгоно уу"); return; }
    if (!files.some((f) => f.name.toLowerCase().endsWith(".shp"))) { toast.error(".shp файл сонгоно уу"); return; }
    setBusy(true);
    try {
      const next = await legacyImportApi.boundary(state.session.id, files, general, sub);
      onUpdated(next);
      if (next.boundary?.canProceed) toast.success("Чөлөөлөлтийн хил шалгалт давлаа");
      else toast.error(firstError(next.boundary) ?? "Шалгалт давсангүй — доорх жагсаалтыг үзнэ үү", { duration: 10000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const geometries = (view?.map ?? []).flatMap((m) => [
    ...(m.plan ? [{ wkt: m.plan, color: "#94a3b8", dashed: true }] : []),
    { wkt: m.boundary, color: "#02c0ce", filled: true },
  ]);

  return (
    <div className="space-y-4">
      {locked ? (
        <ReadOnlyNotice title="Чөлөөлөлтийн хилийн файл" detail={`${view?.categories ? `Ангилал: ${view.categories.general.name}${view.categories.sub ? " / " + view.categories.sub.name : ""}. ` : ""}Системд оруулсан импорт — зөвхөн харах боломжтой. Файл дахин оруулах, шалгах, өөрчлөх боломжгүй.`} />
      ) : (
      <div className="ap-card space-y-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Чөлөөлөлтийн хилийн файл</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Shapefile-ийн <b>.shp, .dbf, .shx, .prj</b> (байвал .cpg) файлуудыг хамт сонгоно. Атрибутад төлөвлөгөөний
            нэгж талбарын дугаар (<code>parcel_id</code>) заавал байна.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] text-slate-600 dark:text-slate-300">
            Ерөнхий ангилал *
            <select className={inputClass} value={general} disabled={locked || busy}
              onChange={(e) => setGeneral(e.target.value)}>
              <option value="">— сонгох —</option>
              {generals.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-slate-600 dark:text-slate-300">
            Дэд ангилал
            <select className={inputClass} value={sub} disabled={locked || busy || subs.length === 0}
              onChange={(e) => setSub(e.target.value)}>
              <option value="">— байхгүй —</option>
              {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <FileDrop accept=".shp,.dbf,.shx,.prj,.cpg" hint=".shp, .dbf, .shx, .prj, .cpg" files={files}
          onChange={setFiles} disabled={locked || busy} />
        <div className="flex items-center justify-between gap-3">
          {view ? <StepStatus ok={view.canProceed} errors={view.errors} warnings={view.warnings} /> : <span />}
          <button className={primaryButton} onClick={submit} disabled={locked || busy || files.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Шалгаж байна…" : view ? "Дахин шалгах" : "Оруулж шалгах"}
          </button>
        </div>
        {view && view.rows.length > 0 && !view.canProceed && (
          <p className="text-[12px] text-slate-500">Хилийг солих бол нэгж талбар, үнэлгээний шалгалт дахин хийгдэнэ.</p>
        )}
      </div>
      )}

      {view && (
        <div className="ap-card space-y-4 p-4">
          <FileResults files={view.files} />
          {view.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className={theadClass}>
                  <tr>
                    <th className={th}>Төлөвлөгөөний дугаар</th>
                    <th className={th}>Чөлөөлөлтийн нэр</th>
                    <th className={th}>Талбай (м²)</th>
                    <th className={th}>Төлөвлөгөөтэй давхцал</th>
                    <th className={th}>Шалгалт</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.idx} className="border-b border-slate-50 dark:border-white/[0.04]">
                      <td className={td}>
                        <b>{row.planParcelID || "—"}</b>
                        {row.planCode && <div className="text-[11px] text-slate-400">{row.planCode}</div>}
                      </td>
                      <td className={td}>
                        {row.name || <span className="text-slate-400">—</span>}
                        {row.existing && <div className="text-[11px] text-sky-600">өмнө оруулсан — шинэчлэгдэнэ</div>}
                      </td>
                      <td className={td}>{fmt(row.areaM2)}</td>
                      <td className={td}>{row.insidePlanPct === null ? "—" : `${row.insidePlanPct}%`}</td>
                      <td className={td}><IssueCell issues={row.issues} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {geometries.length > 0 && (
            <div>
              <p className="mb-1 text-[12px] text-slate-500">
                <span className="font-semibold text-[#02c0ce]">■</span> Чөлөөлөлтийн хил &nbsp;
                <span className="font-semibold text-slate-400">┅</span> ГУС-ийн төлөвлөгөөний хил
              </p>
              <GeometryPreviewMap geometries={geometries} height={320} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
