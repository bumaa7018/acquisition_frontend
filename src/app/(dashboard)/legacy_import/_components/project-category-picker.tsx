"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { legacyImportApi, type CategoryChoice, type ImportState, type ValuationProject } from "@/lib/legacy-import/api";
import { inputClass } from "./shared";

const selectClass = cn(inputClass, "h-8 w-full min-w-[180px] px-2 text-[12px]");

/**
 * «Зөвхөн үнэлгээ» — төслийн (чөлөөлөлтийн) ангилал. Анхны утга нь
 * «Бүтээн байгуулалтын төрөл»-өөс автоматаар тогтсон ангилал; сонгосон даруй
 * хадгална. «Автомат» нь гараар сонгосныг буцаана.
 */
export function ProjectCategoryPicker({
  sessionID,
  project,
  chosen,
  onUpdated,
  disabled,
}: {
  sessionID: string;
  project: ValuationProject;
  chosen: CategoryChoice | undefined;
  onUpdated: (next: ImportState) => void;
  disabled: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const categories = useQuery({ queryKey: ["legacy-import", "categories"], queryFn: legacyImportApi.categories });
  // Төлөвийн projectSettings нь ГУС-ын шалгалт явж байхад ч шинэ — view-ээс түрүүлнэ.
  const value = chosen ?? project.categoryIds ?? { general: "", sub: "" };
  const generals = useMemo(() => (categories.data ?? []).filter((c) => c.parentId === null), [categories.data]);
  const subs = useMemo(
    () => (categories.data ?? []).filter((c) => value.general && c.parentId === Number(value.general)),
    [categories.data, value.general],
  );

  const save = async (category: CategoryChoice) => {
    setSaving(true);
    try {
      onUpdated(await legacyImportApi.updateProject(sessionID, { name: project.name, category }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ангилал хадгалахад алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  const off = disabled || saving || categories.isLoading;
  const isChosen = Boolean(chosen);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <select className={selectClass} value={value.general} disabled={off} aria-label="Ерөнхий ангилал"
          onChange={(e) => e.target.value && save({ general: e.target.value, sub: "" })}>
          {!value.general && <option value="">— сонгох —</option>}
          {generals.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={selectClass} value={value.sub} disabled={off || subs.length === 0} aria-label="Дэд ангилал"
          onChange={(e) => save({ general: value.general, sub: e.target.value })}>
          <option value="">— дэд ангилалгүй —</option>
          {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        {isChosen ? (
          <>
            <span className="font-medium text-[#02c0ce]">гараар сонгосон</span>
            <button type="button" disabled={off} onClick={() => save({ general: "", sub: "" })}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:hover:text-slate-300"
              title={`«${project.constructionType || "—"}» төрлөөс автоматаар тогтооно`}>
              <RotateCcw className="h-3 w-3" /> автомат
            </button>
          </>
        ) : (
          <span className={project.categoryMatched ? "text-slate-400" : "text-amber-600"}>
            {project.categoryMatched ? "төрлөөс" : "төрөл таарсангүй"}: {project.constructionType || "—"}
          </span>
        )}
      </div>
    </div>
  );
}
