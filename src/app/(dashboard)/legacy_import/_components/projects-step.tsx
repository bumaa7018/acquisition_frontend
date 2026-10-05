"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fmt, legacyImportApi, type AcquisitionInfo, type ImportState, type ProjectSettings, type ValuationProject,
} from "@/lib/legacy-import/api";
import { FileDrop, IssueList, ReadOnlyNotice, inputClass, primaryButton, secondaryButton } from "./shared";
import { ProjectCategoryPicker } from "./project-category-picker";

const GeometryPreviewMap = dynamic(() => import("@/components/map/geometry-preview-map"), { ssr: false });

const EMPTY_INFO: AcquisitionInfo = {
  implementingOrg: "", responsibleOrg: "", reason: "", startDate: "", endDate: "", nithDecreeNumber: "", groupListNumber: "",
};

const INFO_FIELDS: { key: keyof AcquisitionInfo; label: string; type?: "date"; placeholder?: string; hint?: string }[] = [
  { key: "implementingOrg", label: "Хэрэгжүүлэгч байгууллага", placeholder: "Байгууллагын нэр" },
  { key: "responsibleOrg", label: "Хариуцах байгууллага", placeholder: "Байгууллагын нэр" },
  { key: "reason", label: "Чөлөөлөх шалтгаан", placeholder: "Ж: Гэр хорооллын дахин төлөвлөлт" },
  { key: "startDate", label: "Эхлэх огноо", type: "date" },
  { key: "endDate", label: "Дуусах огноо", type: "date" },
  { key: "nithDecreeNumber", label: "НИТХ тогтоолын дугаар", placeholder: "Ж: 15/12", hint: "хоосон бол эксэлээс" },
  { key: "groupListNumber", label: "Бүлэг жагсаалтын дугаар", placeholder: "Ж: 3", hint: "хоосон бол эксэлээс" },
];

/**
 * «ЗӨВХӨН ҮНЭЛГЭЭ» — 2-Р АЛХАМ (ЗААВАЛ БИШ, АЛГАСАЖ БОЛНО).
 *
 * Эксэлээс үүсэх чөлөөлөлт бүрд ангилал, «Төслийн мэдээлэл» (байгууллага,
 * огноо, НИТХ тогтоол) ба хилийн shapefile. Оруулаагүй бол чөлөөлөлт хилгүй,
 * мэдээлэлгүй үүснэ — дараа нь чөлөөлөлтийн дэлгэцээс засаж болно.
 */
export function ProjectsStep({
  state,
  onUpdated,
  locked,
}: {
  state: ImportState;
  onUpdated: (next: ImportState) => void;
  locked: boolean;
}) {
  const projects = state.reports?.projects ?? [];
  const [open, setOpen] = useState<string | null>(projects.length === 1 ? projects[0].name : null);

  return (
    <div className="space-y-4">
      {locked ? (
        <ReadOnlyNotice title="Чөлөөлөлтийн мэдээлэл ба хил" />
      ) : (
        <div className="ap-card p-4">
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Чөлөөлөлтийн мэдээлэл ба хил (заавал биш)</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Төсөл бүрд чөлөөлөлтийн мэдээлэл болон хилийн shapefile (<b>.shp, .dbf, .shx, .prj</b>) оруулж болно. Алгасвал
            чөлөөлөлт хилгүй, мэдээлэлгүй үүснэ — дараа нь чөлөөлөлтийн дэлгэцээс засаж болно. Хил нь НЭГ полигон байна
            (олон полигон бол нэгтгэгдэнэ, тусдаа хэсгүүдтэй бол хүлээж авахгүй).
          </p>
        </div>
      )}
      {projects.length === 0 && <p className="text-[12px] text-slate-500">Эхлээд үнэлгээний эксэлээ оруулна уу.</p>}
      {projects.map((p) => (
        <ProjectCard key={p.name} state={state} project={p} settings={state.projectSettings?.[p.name]}
          open={open === p.name} onToggle={() => setOpen(open === p.name ? null : p.name)}
          onUpdated={onUpdated} locked={locked} />
      ))}
    </div>
  );
}

function ProjectCard({
  state,
  project,
  settings,
  open,
  onToggle,
  onUpdated,
  locked,
}: {
  state: ImportState;
  project: ValuationProject;
  settings: ProjectSettings | undefined;
  open: boolean;
  onToggle: () => void;
  onUpdated: (next: ImportState) => void;
  locked: boolean;
}) {
  const saved = settings?.info ?? EMPTY_INFO;
  const [info, setInfo] = useState<AcquisitionInfo>(saved);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"info" | "boundary" | "remove" | null>(null);
  const dirty = INFO_FIELDS.some((f) => info[f.key] !== saved[f.key]);
  const boundary = settings?.boundary;
  const sessionID = state.session.id;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<ImportState>, success: string) => {
    setBusy(kind);
    try {
      const next = await action();
      onUpdated(next);
      if (kind === "info") setInfo(next.projectSettings?.[project.name]?.info ?? EMPTY_INFO);
      if (kind === "boundary") setFiles([]);
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа", { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const saveInfo = () => run("info", () => legacyImportApi.updateProject(sessionID, { name: project.name, info }), "Мэдээлэл хадгалагдлаа");
  const uploadBoundary = () => {
    if (!files.some((f) => f.name.toLowerCase().endsWith(".shp"))) { toast.error(".shp файл сонгоно уу"); return; }
    run("boundary", () => legacyImportApi.projectBoundary(sessionID, project.name, files), "Хил шалгалт давлаа");
  };
  const removeBoundary = () =>
    run("remove", () => legacyImportApi.removeProjectBoundary(sessionID, project.name), "Хилийг хаслаа");

  return (
    <div className="ap-card overflow-hidden">
      <button type="button" onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">{project.name}</p>
          <p className="text-[12px] text-slate-500">
            {fmt(project.parcels)} нэгж талбар · {fmt(project.amount)}₮ ·{" "}
            {project.category.general}{project.category.sub ? ` / ${project.category.sub}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge ok={Boolean(boundary)}>{boundary ? `Хил: ${fmt(boundary.areaM2)} м²` : "Хилгүй"}</Badge>
            <Badge ok={project.hasInfo}>{project.hasInfo ? "Мэдээлэлтэй" : "Мэдээлэлгүй"}</Badge>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-100 p-4 dark:border-white/[0.06]">
          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Ангилал</h3>
            <div className="max-w-xl">
              <ProjectCategoryPicker sessionID={sessionID} project={project} chosen={settings?.category}
                onUpdated={onUpdated} disabled={locked} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Чөлөөлөлтийн мэдээлэл</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INFO_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-[12px] text-slate-600 dark:text-slate-300">
                  <span>{f.label}{f.hint && <span className="ml-1 text-slate-400">({f.hint})</span>}</span>
                  <input className={inputClass} type={f.type ?? "text"} value={info[f.key]} placeholder={f.placeholder}
                    disabled={locked || busy !== null} maxLength={f.key === "nithDecreeNumber" || f.key === "groupListNumber" ? 100 : undefined}
                    onChange={(e) => setInfo((cur) => ({ ...cur, [f.key]: e.target.value }))} />
                </label>
              ))}
            </div>
            {!locked && (
              <div className="flex justify-end gap-2">
                {dirty && (
                  <button className={secondaryButton} onClick={() => setInfo(saved)} disabled={busy !== null}>Буцаах</button>
                )}
                <button className={primaryButton} onClick={saveInfo} disabled={!dirty || busy !== null}>
                  {busy === "info" && <Loader2 className="h-4 w-4 animate-spin" />} Хадгалах
                </button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Чөлөөлөлтийн хил</h3>
            {boundary ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                  <span><b>{boundary.file}</b> · {fmt(boundary.areaM2)} м²</span>
                  {!locked && (
                    <button className={cn(secondaryButton, "h-8 px-3 text-[12px]")} onClick={removeBoundary} disabled={busy !== null}>
                      {busy === "remove" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Хасах
                    </button>
                  )}
                </div>
                {boundary.issues.length > 0 && <IssueList issues={boundary.issues} />}
                <GeometryPreviewMap geometries={[{ wkt: boundary.wkt, color: "#02c0ce", filled: true }]} height={280} />
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Хил оруулаагүй — чөлөөлөлт хилгүй үүснэ.</p>
            )}
            {!locked && (
              <div className="space-y-2">
                <FileDrop accept=".shp,.dbf,.shx,.prj,.cpg" hint=".shp, .dbf, .shx, .prj, .cpg" files={files}
                  onChange={setFiles} disabled={busy !== null} />
                <div className="flex justify-end">
                  <button className={primaryButton} onClick={uploadBoundary} disabled={busy !== null || files.length === 0}>
                    {busy === "boundary" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {boundary ? "Хил солих" : "Хил оруулах"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
      ok ? "bg-[#02c0ce]/10 text-[#02c0ce]" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400")}>
      {children}
    </span>
  );
}
