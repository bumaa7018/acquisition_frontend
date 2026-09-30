"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { fmt, legacyImportApi, type ImportState } from "@/lib/legacy-import/api";
import { JobProgress, Stat, primaryButton, td, th, theadClass } from "./shared";
import { RollbackDialog } from "./rollback-dialog";
import { RollbackHistory } from "./rollback-history";

/**
 * 4-Р АЛХАМ — НЭГТГЭЛ БА ОРУУЛАХ.
 *
 * Бүх файлаас юу орохыг нэг дор харуулна. «Оруулах» дарах хүртэл өгөгдөл
 * зөвхөн ТҮР хүснэгтэд байгаа — системийн хүснэгтэд нэг ч мөр бичигдээгүй.
 */
export function SummaryStep({ state, onCommitted }: { state: ImportState; onCommitted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { summary, result } = state;
  const committing = state.session.status === "committing" || (state.job?.kind === "commit" && state.job.state === "running");

  const commit = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      await legacyImportApi.commit(state.session.id);
      toast.success("Оруулж эхэллээ");
      onCommitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const rolledBack = state.session.status === "rolled_back";
  if ((state.session.status === "committed" || rolledBack) && result) {
    const rb = state.session.rollback;
    return (
      <div className="ap-card space-y-4 p-5">
        {rolledBack ? (
          <p className="flex items-center gap-2 text-[15px] font-semibold text-[#f8285a]">
            <XCircle className="h-5 w-5" /> Энэ импортоор оруулсан мэдээллийг устгасан
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#0acf97]">
              <CheckCircle2 className="h-5 w-5" /> Өгөгдлийн санд амжилттай орлоо
            </p>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#f8285a]/40 px-3 text-[13px] font-medium text-[#f8285a] hover:bg-[#f8285a]/5"
              onClick={() => setRemoving(true)}>
              <Trash2 className="h-4 w-4" /> Оруулсан мэдээллийг устгах
            </button>
          </div>
        )}
        {(state.rollbackLog?.length ?? 0) > 0 && <RollbackHistory log={state.rollbackLog!} result={rb} />}
        {removing && (
          <RollbackDialog sessionID={state.session.id} onClose={() => setRemoving(false)}
            onDone={() => { setRemoving(false); onCommitted(); }} />
        )}
        {rolledBack && <p className="text-[12px] text-slate-500 dark:text-slate-400">Доорх нь оруулах үеийн түүх.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Чөлөөлөлт (шинэ / шинэчилсэн)" value={`${result.acquisitions?.created ?? 0} / ${result.acquisitions?.updated ?? 0}`} />
          <Stat label="Нэгж талбар" value={fmt(result.parcels?.imported)} />
          <Stat label="Үнэлгээ" value={fmt(result.compensations?.applied ?? 0)} />
          <Stat label="Нийт дүн (₮)" value={fmt(result.compensations?.totalAmount ?? 0)} />
          <Stat label="Баталгаажсан чөлөөлөлт" value={fmt(result.acquisitionStatuses?.verified)} />
          <Stat label="Хээрийн судалгаа" value={fmt(result.acquisitionStatuses?.field)} />
          <Stat label="Алдаатай мөр" value={fmt(result.log?.failed)} tone={result.log?.failed ? "bad" : "good"} />
          <Stat label="Алгассан мөр" value={fmt(result.log?.skipped)} tone={result.log?.skipped ? "warn" : "default"} />
          <Stat label="Анхааруулга" value={fmt(result.log?.warnings)} tone={result.log?.warnings ? "warn" : "default"} />
        </div>
        <ul className="list-disc pl-5 text-[13px] text-slate-700 dark:text-slate-300">
          {(result.acquisitions?.names ?? []).map((name) => <li key={name}>{name}</li>)}
        </ul>
        {(result.log?.entries?.length ?? 0) > 0 && (
          <details className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] dark:bg-[#252630]">
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
              Алгассан / анхааруулгатай мөрүүд ({result.log!.entries!.length})
            </summary>
            <ul className="mt-2 max-h-[320px] space-y-0.5 overflow-auto">
              {result.log!.entries!.map((e, n) => (
                <li key={n} className={e.level === "failed" ? "text-[#f8285a]" : "text-amber-700 dark:text-amber-400"}>
                  <b>{e.key || "—"}</b>: {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="ap-card space-y-3 p-4">
        <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Оруулах чөлөөлөлтүүд</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className={theadClass}>
              <tr>
                <th className={th}>Чөлөөлөлтийн нэр</th>
                <th className={th}>Талбай (м²)</th>
                <th className={th}>Нэгж талбар</th>
                <th className={th}>Хилийн гадна</th>
                <th className={th}>Үнэлгээний мөр</th>
              </tr>
            </thead>
            <tbody>
              {summary.acquisitions.map((a) => (
                <tr key={a.idx} className="border-b border-slate-50 dark:border-white/[0.04]">
                  <td className={td}>
                    <b>{a.name || a.planParcelID}</b>
                    {a.existing && <span className="ml-1 text-[11px] text-sky-600">(шинэчлэгдэнэ)</span>}
                  </td>
                  <td className={td}>{fmt(a.areaM2)}</td>
                  <td className={td}>{fmt(a.parcels)}</td>
                  <td className={td}>{a.outside ? <span className="text-[#f8285a]">{a.outside}</span> : 0}</td>
                  <td className={td}>{fmt(a.reportRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ap-card space-y-3 p-4">
          <h3 className="text-[14px] font-semibold text-slate-800 dark:text-white">Нэгж талбар</h3>
          {summary.parcels ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Нийт" value={fmt(summary.parcels.total)} />
              <Stat label="Хилийн гадна" value={fmt(summary.parcels.outside)} tone={summary.parcels.outside ? "bad" : "good"} />
              <Stat label="Давхардсан" value={fmt(summary.parcels.duplicates)} tone={summary.parcels.duplicates ? "warn" : "default"} />
              <Stat label="ГУС-д олдоогүй" value={fmt(summary.parcels.gus.missing + summary.parcels.gus.failed)}
                tone={summary.parcels.gus.missing ? "warn" : "default"} />
              <Stat label="Зөвхөн data_ub" value={fmt(summary.parcels.gus.ub)} tone={summary.parcels.gus.ub ? "warn" : "default"} />
              <Stat label="Санд байгаа" value={fmt(summary.parcels.alreadyImported)} />
            </div>
          ) : <p className="text-[12px] text-slate-500">Оруулаагүй</p>}
        </div>
        <div className="ap-card space-y-3 p-4">
          <h3 className="text-[14px] font-semibold text-slate-800 dark:text-white">Үнэлгээ</h3>
          {summary.reports ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Мөр" value={fmt(summary.reports.rows)} />
              <Stat label="Нийт дүн (₮)" value={fmt(summary.reports.totalAmount)} />
              <Stat label="Олдоогүй нэгж талбар" value={fmt(summary.reports.missing)} tone={summary.reports.missing ? "bad" : "good"}
                hint={`${fmt(summary.reports.missingAmount)}₮`} />
              <Stat label="ГУС-аас шинээр" value={fmt(summary.reports.gus)} />
              <Stat label="Үнэлгээгүй нэгж талбар" value={fmt(summary.reports.withoutReport)} tone={summary.reports.withoutReport ? "warn" : "good"} />
              <Stat label="Талбайн зөрүү" value={fmt(summary.reports.areaDiffs)} tone={summary.reports.areaDiffs ? "warn" : "good"} />
            </div>
          ) : <p className="text-[12px] text-slate-500">Оруулаагүй — зөвхөн чөлөөлөлт, нэгж талбар орно</p>}
        </div>
      </div>

      <div className="ap-card space-y-3 p-4">
        {summary.blockers.length > 0 && (
          <div className="rounded-lg bg-[#f8285a]/10 px-3 py-2 text-[12px]">
            {summary.blockers.map((b) => (
              <p key={b} className="flex items-center gap-1.5 text-[#f8285a]"><XCircle className="h-4 w-4" /> {b}</p>
            ))}
          </div>
        )}
        {summary.cautions.length > 0 && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12px]">
            {summary.cautions.map((c) => (
              <p key={c} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /> {c}</p>
            ))}
          </div>
        )}
        {state.session.status === "failed" && state.result?.error && (
          <p className="text-[12px] text-[#f8285a]">Өмнөх оролдлого амжилтгүй (бүх өөрчлөлт буцаагдсан): {state.result.error}</p>
        )}
        {committing && <JobProgress label="Өгөгдлийн санд оруулж байна…" done={0} total={0} />}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-slate-500">
            «Оруулах» дарах хүртэл өгөгдөл түр хүснэгтэд л байна. Оруулахад бүх өөрчлөлт НЭГ гүйлгээнд хийгдэнэ.
          </p>
          <button className={primaryButton} disabled={!summary.canCommit || busy || committing} onClick={() => setConfirm(true)}>
            {(busy || committing) && <Loader2 className="h-4 w-4 animate-spin" />}
            Оруулах
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Өгөгдлийн санд оруулах уу?"
        description={`${summary.acquisitions.length} чөлөөлөлт, ${summary.parcels?.total ?? 0} нэгж талбар, ${summary.reports?.rows ?? 0} үнэлгээний мөрийг системд бүртгэнэ.`}
        confirmLabel="Оруулах"
        confirmColor="#02c0ce"
        onConfirm={commit}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
