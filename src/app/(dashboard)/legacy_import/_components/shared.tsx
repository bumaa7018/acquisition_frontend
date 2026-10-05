"use client";
import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, Info, Loader2, UploadCloud, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileInfo, Issue } from "@/lib/legacy-import/api";

export const inputClass =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200";

export const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#02c0ce] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#02a3af] disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-300";

/**
 * Оруулсан (эсвэл оруулж буй) импорт — ЗӨВХӨН ХАРАХ. Файл оруулах, дахин
 * шалгах товч харагдахгүй; backend ч өөрчлөлтийг хүлээж авахгүй (409).
 */
export function ReadOnlyNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="ap-card flex items-start gap-3 p-4">
      <Eye className="mt-0.5 h-5 w-5 shrink-0 text-[#02c0ce]" />
      <div>
        <p className="text-[14px] font-semibold text-slate-800 dark:text-white">{title}</p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {detail ?? "Системд оруулсан импорт — зөвхөн харах боломжтой. Файл дахин оруулах, шалгах, өөрчлөх боломжгүй."}
        </p>
      </div>
    </div>
  );
}

/** Олон файл сонгох / чирж оруулах талбар. */
export function FileDrop({
  accept,
  hint,
  files,
  onChange,
  disabled,
}: {
  accept: string;
  hint: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const allowed = accept.split(",").map((ext) => ext.trim().toLowerCase());
  const pick = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => allowed.some((ext) => f.name.toLowerCase().endsWith(ext)));
    onChange(picked);
  };
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) pick(e.dataTransfer.files); }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-[#02c0ce] bg-[#02c0ce]/5" : "border-slate-200 hover:border-[#02c0ce]/60 dark:border-white/[0.1]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <UploadCloud className="h-8 w-8 text-[#02c0ce]" />
        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Файлаа чирж оруулах эсвэл дарж сонгоно уу</p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f) => (
            <li key={f.name} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-[#252630] dark:text-slate-300">
              {f.name} <span className="text-slate-400">({Math.ceil(f.size / 1024)} KB)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<Issue["level"], { icon: typeof XCircle; text: string; bg: string; label: string }> = {
  error: { icon: XCircle, text: "text-[#f8285a]", bg: "bg-[#f8285a]/10", label: "Алдаа" },
  warning: { icon: AlertTriangle, text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: "Анхааруулга" },
  info: { icon: Info, text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", label: "Мэдээлэл" },
};

/** Асуудлуудыг түвшнээр нь бүлэглэж харуулна; олон бол эвхэгдэнэ. */
export function IssueList({ issues, limit = 8 }: { issues: Issue[]; limit?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      {(["error", "warning", "info"] as const).map((level) => {
        const list = issues.filter((i) => i.level === level);
        if (list.length === 0) return null;
        const style = LEVEL_STYLE[level];
        const Icon = style.icon;
        const shown = open[level] ? list : list.slice(0, limit);
        return (
          <div key={level} className={cn("rounded-lg px-3 py-2", style.bg)}>
            <p className={cn("mb-1 flex items-center gap-1.5 text-[12px] font-semibold", style.text)}>
              <Icon className="h-4 w-4" /> {style.label} ({list.length})
            </p>
            <ul className="space-y-0.5 text-[12px] text-slate-700 dark:text-slate-300">
              {shown.map((i, n) => <li key={`${i.code}-${n}`}>• {i.message}</li>)}
            </ul>
            {list.length > limit && (
              <button
                onClick={() => setOpen((o) => ({ ...o, [level]: !o[level] }))}
                className={cn("mt-1 inline-flex items-center gap-1 text-[12px] font-medium", style.text)}
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", open[level] && "rotate-180")} />
                {open[level] ? "Хураах" : `Бүгдийг харах (+${list.length - limit})`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FileResults({ files }: { files: FileInfo[] }) {
  const issues = files.flatMap((f) => f.issues);
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {files.filter((f) => f.name).map((f) => (
          <li key={f.name} className="rounded-md bg-slate-100 px-2.5 py-1 text-[12px] text-slate-700 dark:bg-[#252630] dark:text-slate-300">
            {f.name} — <b>{f.features}</b> мөр
          </li>
        ))}
      </ul>
      <IssueList issues={issues} />
    </div>
  );
}

export function Stat({ label, value, tone = "default", hint }: {
  label: string;
  value: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 dark:border-white/[0.06] dark:bg-[#1e1f27]" title={hint}>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn(
        "break-all text-base font-bold leading-snug",
        tone === "good" && "text-[#0acf97]",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "bad" && "text-[#f8285a]",
        tone === "default" && "text-slate-800 dark:text-white",
      )}>{value}</p>
    </div>
  );
}

export function StepStatus({ ok, errors, warnings }: { ok: boolean; errors: number; warnings: number }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#0acf97]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#0acf97]">
      <CheckCircle2 className="h-3.5 w-3.5" /> Шалгалт давсан{warnings > 0 ? ` · ${warnings} анхааруулга` : ""}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f8285a]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#f8285a]">
      <XCircle className="h-3.5 w-3.5" /> {errors} алдаа — засаж дахин оруулна уу
    </span>
  );
}

/** ГУС-ын шалгалтын явц. */
export function JobProgress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done * 100) / total) : 0;
  return (
    <div className="rounded-lg bg-[#02c0ce]/5 px-3 py-2">
      <div className="mb-1 flex justify-between text-[12px] text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span>{total > 0 ? `${done} / ${total}` : "эхэлж байна…"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
        <div className="h-full bg-[#02c0ce] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * ГУС-ын шалгалт явж байна / тасарсан — алхмын жагсаалтын доор ТОД харуулна.
 * Дуусах хүртэл дараагийн алхам нээгдэхгүй.
 */
export function GusJobBanner({ job }: { job: { kind: string; state: string; done: number; total: number; error?: string } }) {
  const what = job.kind === "parcels" ? "Нэгж талбарыг" : "Үнэлгээний нэгж талбарыг";
  if (job.state === "failed") {
    return (
      <div className="ap-card flex items-start gap-3 border-l-4 border-[#f8285a] p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#f8285a]" />
        <div className="text-[13px]">
          <p className="font-semibold text-slate-800 dark:text-white">{what} ГУС-аас шалгах ажил тасарлаа</p>
          <p className="text-slate-500 dark:text-slate-400">
            {job.error ? `${job.error}. ` : ""}Файлаа «Дахин шалгах»-аар дахин оруулна уу — дуусах хүртэл дараагийн алхам нээгдэхгүй.
          </p>
        </div>
      </div>
    );
  }
  const pct = job.total > 0 ? Math.round((job.done * 100) / job.total) : 0;
  return (
    <div className="ap-card space-y-2 border-l-4 border-[#02c0ce] p-4" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#02c0ce]" />
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">{what} ГУС-аас татаж байна…</p>
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-[#02c0ce]">
          {job.total > 0 ? `${job.done} / ${job.total} · ${pct}%` : "эхэлж байна…"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
        <div className="h-full bg-[#02c0ce] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Дуусахыг хүлээнэ үү — дараагийн алхам дуусмагц нээгдэнэ. Хуудсаа хаасан ч ажил сервер дээр үргэлжилнэ.
      </p>
    </div>
  );
}

export const th = "px-3 py-2 font-semibold";
export const td = "px-3 py-2 align-top text-[12px] text-slate-700 dark:text-slate-300";
export const theadClass =
  "border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06] dark:bg-[#252630]/60 dark:text-slate-500";

/**
 * Toast-д харуулах ЭХНИЙ алдаа — «файлд алдаа байна» гэсэн ерөнхий мессежийн
 * оронд жинхэнэ шалтгааныг (ж нь ГУС-ын тохиргоо дутуу) шууд хэлнэ.
 */
export function firstError(view: { files: FileInfo[]; rows: { issues: Issue[] }[] } | null | undefined): string | null {
  if (!view) return null;
  const all = [...view.files.flatMap((f) => f.issues), ...view.rows.flatMap((r) => r.issues)];
  return all.find((i) => i.level === "error")?.message ?? null;
}

/** Мөрийн хамгийн ноцтой асуудлын түвшин (хүснэгтийн тэмдэглэгээнд). */
export function worst(issues: Issue[]): Issue["level"] | null {
  if (issues.some((i) => i.level === "error")) return "error";
  if (issues.some((i) => i.level === "warning")) return "warning";
  if (issues.some((i) => i.level === "info")) return "info";
  return null;
}

export function IssueCell({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return <span className="text-[#0acf97]">✓</span>;
  return (
    <ul className="space-y-0.5">
      {issues.map((i, n) => (
        <li key={n} className={LEVEL_STYLE[i.level].text}>{i.message}</li>
      ))}
    </ul>
  );
}
