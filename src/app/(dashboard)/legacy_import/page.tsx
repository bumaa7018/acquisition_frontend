"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { canImportLegacyData } from "@/lib/role-utils";
import { legacyImportApi, type ImportMode, type ImportState } from "@/lib/legacy-import/api";
import { BoundaryStep } from "./_components/boundary-step";
import { ParcelStep } from "./_components/parcel-step";
import { ReportStep } from "./_components/report-step";
import { SummaryStep } from "./_components/summary-step";
import { ValuationStep } from "./_components/valuation-step";
import { ProjectsStep } from "./_components/projects-step";
import { RollbackDialog } from "./_components/rollback-dialog";
import { GusJobBanner, primaryButton, secondaryButton, td, th, theadClass } from "./_components/shared";

type StepKey = "boundary" | "parcels" | "reports" | "projects" | "summary";

/** Горим бүрийн алхам: бүтэн — хил → нэгж талбар → үнэлгээ; зөвхөн үнэлгээ — эксэл (+ заавал биш мэдээлэл, хил). */
const STEPS: Record<ImportMode, { key: StepKey; label: string }[]> = {
  full: [
    { key: "boundary", label: "Чөлөөлөлтийн хил" },
    { key: "parcels", label: "Нэгж талбар" },
    { key: "reports", label: "Үнэлгээ" },
    { key: "summary", label: "Нэгтгэл ба оруулах" },
  ],
  valuation: [
    { key: "reports", label: "Үнэлгээний эксэл" },
    { key: "projects", label: "Чөлөөлөлтийн мэдээлэл ба хил" },
    { key: "summary", label: "Нэгтгэл ба оруулах" },
  ],
};

const MODE_LABEL: Record<ImportMode, string> = { full: "Бүтэн", valuation: "Зөвхөн үнэлгээ" };

const modeOf = (state: ImportState | undefined): ImportMode => state?.session.mode ?? "full";

const STATUS_LABEL: Record<ImportState["session"]["status"], string> = {
  draft: "Ноорог", committing: "Оруулж байна", committed: "Оруулсан", failed: "Амжилтгүй", rolled_back: "Устгасан",
};

/**
 * ГУС-ын шалгалт (нэгж талбар / үнэлгээ) явж байгаа эсвэл тасарсан. Тасарсан
 * ажил нь харгалзах шалгалт ДУУСААГҮЙ үед л — файлыг дахин оруулсны дараа
 * санах ойд үлдсэн хуучин алдаа алхмыг хаах ёсгүй.
 */
const gusJob = (state: ImportState | undefined) => {
  const job = state?.job;
  if (!state || !job || job.kind === "commit" || job.state === "done") return null;
  if (job.state === "failed") {
    const view = job.kind === "parcels" ? state.parcels : state.reports;
    if (!view || view.gusDone) return null;
  }
  return job;
};

/** Үнэлгээний ГУС-ын шалгалт дуусаагүй (оруулаагүй бол саад биш). */
const reportsPending = (state: ImportState) => Boolean(state.reports && !state.reports.gusDone);

/**
 * Алхам бүр өмнөх алхам нь алдаагүй, ГУС-ын шалгалт нь ДУУССАН бол нээгдэнэ —
 * дуусаагүй байхад цааш явбал нэгтгэл, тохиргоо дутуу мэдээлэл дээр хийгдэнэ.
 */
function reachable(state: ImportState | undefined, step: StepKey): boolean {
  if (!state) return step === "boundary";
  if (state.session.status === "committed" || state.session.status === "rolled_back") return true;
  if (modeOf(state) === "valuation") {
    if (step === "reports") return true;
    return Boolean(state.reports?.canProceed) && !reportsPending(state) && !gusJob(state);
  }
  if (step === "boundary") return true;
  if (!state.boundary?.canProceed) return false;
  if (step === "parcels") return true;
  if (!state.parcels?.canProceed || !state.parcels.gusDone) return false;
  if (step === "reports") return true;
  return !reportsPending(state) && !gusJob(state);
}

function LegacyImportPage() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const sessionID = params.get("session");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [step, setStep] = useState<StepKey>("boundary");
  const [creating, setCreating] = useState(false);
  const [rollbackID, setRollbackID] = useState<string | null>(null);

  useEffect(() => setAllowed(canImportLegacyData()), []);

  const sessions = useQuery({
    queryKey: ["legacy-import", "sessions"],
    queryFn: legacyImportApi.sessions,
    enabled: allowed === true && !sessionID,
  });
  const stateKey = ["legacy-import", "session", sessionID];
  const stateQuery = useQuery({
    queryKey: stateKey,
    // Анх нээхэд loader харуулна; дараагийн шинэчлэлт чимээгүй.
    queryFn: () => legacyImportApi.get(sessionID!, queryClient.getQueryData(stateKey) !== undefined),
    enabled: allowed === true && Boolean(sessionID),
  });
  const state = stateQuery.data;

  // ГУС-ын шалгалт / оруулалт явж байхад ЗӨВХӨН явцыг (хөнгөн, loader-гүй)
  // шалгана; дуусмагц бүтэн төлөвийг нэг удаа татна.
  const busy = state?.job?.state === "running" || state?.session.status === "committing";
  const progress = useQuery({
    queryKey: ["legacy-import", "progress", sessionID],
    queryFn: () => legacyImportApi.progress(sessionID!),
    enabled: allowed === true && Boolean(sessionID) && busy,
    refetchInterval: 1000,
    // Хариу бүр шинэ объект — ижил «дууссан» хариу давтагдсан ч effect ажиллана.
    structuralSharing: false,
  });
  useEffect(() => {
    const p = progress.data;
    if (!p || !state || !busy) return;
    if (p.job?.state === "running" || p.status === "committing") {
      queryClient.setQueryData<ImportState>(stateKey, { ...state, job: p.job, session: { ...state.session, status: p.status } });
    } else {
      if (p.job?.state === "done" && p.job.kind !== "commit" && state.job?.state === "running") {
        toast.success("ГУС-аас татаж дууслаа — дараагийн алхам руу шилжиж болно");
      }
      queryClient.invalidateQueries({ queryKey: stateKey });
    }
  }, [progress.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сэргээсэн импорт — хамгийн сүүлд хүрсэн алхам руу.
  useEffect(() => {
    if (!state) return;
    setStep((current) => {
      if (current !== "boundary") return current;
      if (state.session.status === "committed" || state.session.status === "rolled_back") return "summary";
      if (state.reports) return reachable(state, "summary") ? "summary" : "reports";
      if (modeOf(state) === "valuation") return "reports";
      if (state.parcels) return "reports";
      if (state.boundary?.canProceed) return "parcels";
      return "boundary";
    });
  }, [state?.session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setState = (next: ImportState) => queryClient.setQueryData(["legacy-import", "session", sessionID], next);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["legacy-import", "session", sessionID] });

  const start = async (mode: ImportMode) => {
    setCreating(true);
    try {
      const { id } = await legacyImportApi.create(mode);
      setStep("boundary");
      router.push(`/legacy_import?session=${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await legacyImportApi.remove(id);
      queryClient.invalidateQueries({ queryKey: ["legacy-import", "sessions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  if (allowed === null) return null;
  if (!allowed) {
    return <div className="ap-card p-8 text-center text-[13px] text-slate-500">Энэ хуудсыг харах эрх байхгүй байна.</div>;
  }

  const locked = state?.session.status === "committed" || state?.session.status === "committing" || state?.session.status === "rolled_back";
  const steps = STEPS[modeOf(state)];
  const nextStep = steps[steps.findIndex((s) => s.key === step) + 1];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Хуучин мэдээлэл оруулах</h1>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            Чөлөөлөлтийн хил, нэгж талбар, үнэлгээний файлыг шалгаж түр хадгална. «Оруулах» дарсны дараа л системд бүртгэгдэнэ.
          </p>
        </div>
        {sessionID && (
          <button className={secondaryButton} onClick={() => router.push("/legacy_import")}>Бүх импорт</button>
        )}
      </div>

      {!sessionID && (
        <div className="ap-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Импортууд</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button className={secondaryButton} onClick={() => start("valuation")} disabled={creating}
                title="Зөвхөн үнэлгээний эксэл — хил, нэгж талбарын файлгүй (архивын адил)">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Зөвхөн үнэлгээ
              </button>
              <button className={primaryButton} onClick={() => start("full")} disabled={creating}
                title="Чөлөөлөлтийн хил + нэгж талбар + үнэлгээ">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Шинэ импорт
              </button>
            </div>
          </div>
          {sessions.isLoading && <p className="text-[12px] text-slate-500">Уншиж байна…</p>}
          {sessions.error && <p className="text-[12px] text-[#f8285a]">{(sessions.error as Error).message}</p>}
          {sessions.data && sessions.data.length === 0 && <p className="text-[12px] text-slate-500">Одоогоор импорт алга.</p>}
          {sessions.data && sessions.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className={theadClass}>
                  <tr>
                    <th className={th}>Огноо</th>
                    <th className={th}>Хэрэглэгч</th>
                    <th className={th}>Горим</th>
                    <th className={th}>Төлөв</th>
                    <th className={th}>Чөлөөлөлт</th>
                    <th className={th}>Нэгж талбар</th>
                    <th className={th}>Үнэлгээ</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-white/[0.04]">
                      <td className={td}>{new Date(s.updatedAt).toLocaleString("mn-MN")}</td>
                      <td className={td}>{s.createdBy}</td>
                      <td className={td}>{MODE_LABEL[s.mode ?? "full"]}</td>
                      <td className={td}>
                        {STATUS_LABEL[s.status]}
                        {s.rollback && (
                          <span className="block text-[11px] text-slate-400">
                            {s.rollback.by}, {new Date(s.rollback.at).toLocaleString("mn-MN")}
                          </span>
                        )}
                      </td>
                      <td className={td}>{s.acquisitions}</td>
                      <td className={td}>{s.mode === "valuation" ? "—" : s.parcels}</td>
                      <td className={td}>{s.reportRows}</td>
                      <td className={td}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                            onClick={() => router.push(`/legacy_import?session=${s.id}`)}>
                            <Eye className="h-3.5 w-3.5" /> Дэлгэрэнгүй
                          </button>
                          {s.status === "committed" && (
                            <button
                              disabled={!s.deletable}
                              title={s.deletable ? "Энэ импортоор оруулсан мэдээллийг санаас устгана"
                                : "Импортын бүртгэл (устгах жагсаалт) байхгүй — өмнөх хувилбараар оруулсан импорт"}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#f8285a]/40 px-3 text-[12px] font-medium text-[#f8285a] hover:bg-[#f8285a]/5 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => setRollbackID(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" /> Устгах
                            </button>
                          )}
                          {(s.status === "draft" || s.status === "failed") && (
                            <button title="Устгах" className="text-slate-400 hover:text-[#f8285a]" onClick={() => remove(s.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {rollbackID && (
        <RollbackDialog
          sessionID={rollbackID}
          onClose={() => setRollbackID(null)}
          onDone={() => {
            setRollbackID(null);
            queryClient.invalidateQueries({ queryKey: ["legacy-import"] });
          }}
        />
      )}

      {sessionID && stateQuery.error && (
        <div className="ap-card p-4 text-[13px] text-[#f8285a]">{(stateQuery.error as Error).message}</div>
      )}

      {sessionID && state && (
        <>
          <ol className="ap-card flex flex-wrap gap-2 p-3">
            {modeOf(state) === "valuation" && (
              <li className="flex items-center px-2 text-[12px] font-semibold text-[#02c0ce]">Зөвхөн үнэлгээ:</li>
            )}
            {steps.map((s, index) => {
              const open = reachable(state, s.key);
              const done =
                (s.key === "boundary" && state.boundary?.canProceed) ||
                (s.key === "parcels" && state.parcels?.canProceed && state.parcels.gusDone) ||
                (s.key === "reports" && state.reports?.canProceed && state.reports.gusDone) ||
                (s.key === "projects" && (state.reports?.projects ?? []).some((p) => p.hasInfo || p.areaM2 !== null)) ||
                (s.key === "summary" && state.session.status === "committed");
              return (
                <li key={s.key}>
                  <button
                    disabled={!open}
                    onClick={() => setStep(s.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      step === s.key ? "bg-[#02c0ce] text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#252630]",
                      !open && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      step === s.key ? "bg-white/25" : done ? "bg-[#0acf97] text-white" : "bg-slate-200 dark:bg-white/[0.1]",
                    )}>
                      {done ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>

          {gusJob(state) && <GusJobBanner job={gusJob(state)!} />}

          {step === "boundary" && <BoundaryStep state={state} onUpdated={setState} locked={locked} />}
          {step === "parcels" && <ParcelStep state={state} onUpdated={setState} locked={locked} />}
          {step === "reports" && (modeOf(state) === "valuation"
            ? <ValuationStep state={state} onUpdated={setState} locked={locked} />
            : <ReportStep state={state} onUpdated={setState} locked={locked} />)}
          {step === "projects" && <ProjectsStep state={state} onUpdated={setState} locked={locked} />}
          {step === "summary" && <SummaryStep state={state} onCommitted={refresh} />}

          {nextStep && (
            <div className="flex items-center justify-end gap-3">
              {!reachable(state, nextStep.key) && state.job?.state === "running" && state.job.kind !== "commit" && (
                <span className="text-[12px] text-slate-500">ГУС-аас татаж дуусахыг хүлээнэ үү</span>
              )}
              {!reachable(state, nextStep.key) && !gusJob(state) && reportsPending(state) && (
                <span className="text-[12px] text-[#f8285a]">ГУС-ын шалгалт дуусаагүй — үнэлгээний файлаа «Дахин шалгах»-аар дахин оруулна уу</span>
              )}
              <button
                className={primaryButton}
                disabled={!reachable(state, nextStep.key)}
                onClick={() => setStep(nextStep.key)}
              >
                {step === "projects" && !(state.reports?.projects ?? []).some((p) => p.hasInfo || p.areaM2 !== null)
                  ? "Алгасах →"
                  : "Дараагийн алхам →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LegacyImportPage />
    </Suspense>
  );
}
