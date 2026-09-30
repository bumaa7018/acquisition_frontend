"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fmt, legacyImportApi, type RollbackCount, type RollbackPreview } from "@/lib/legacy-import/api";
import { secondaryButton } from "./shared";

const LATER_LABEL: Record<string, string> = {
  compensations: "Олговор / үнэлгээ",
  decisionLinks: "Захирамжийн холбоос",
  documents: "Нэгж талбарын баримт",
};

function CountRow({ label, value }: { label: string; value: RollbackCount }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-50 py-1 dark:border-white/[0.04]">
      <span>{label}</span>
      <span className="tabular-nums">
        <b>{fmt(value.exists)}</b> устна
        {value.missing > 0 && <span className="text-slate-400"> · {fmt(value.missing)} аль хэдийн устсан (алгасна)</span>}
      </span>
    </div>
  );
}

/**
 * «Устгах» — оруулсан импортын бүртгэлийн мөр бүрийг дарааллаар нь устгана:
 * 1) үнэлгээ (захирамжаас салгаж), 2) нэгж талбар, 3) чөлөөлөлт.
 * Урьдчилсан харагдацыг харуулж, «ойлгосон» тэмдэглэсний дараа л идэвхжинэ.
 */
export function RollbackDialog({ sessionID, onClose, onDone }: {
  sessionID: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    legacyImportApi.rollbackPreview(sessionID).then(setPreview, (err: Error) => setError(err.message));
  }, [sessionID]);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await legacyImportApi.rollback(sessionID);
      const kept = result.kept?.length ? ` (үлдсэн чөлөөлөлт: ${result.kept.join(", ")})` : "";
      toast.success(`Импортын мэдээллийг устгалаа${kept}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа");
      legacyImportApi.rollbackPreview(sessionID).then(setPreview, () => undefined);
    } finally {
      setBusy(false);
    }
  };

  const later = Object.entries(preview?.addedLater ?? {}).filter(([, n]) => n > 0);
  const keeps = (preview?.acquisitions ?? []).filter((a) => a.keep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-white/[0.06] dark:bg-[#1e1f27]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <Trash2 className="h-5 w-5 text-[#f8285a]" />
          <p className="text-[15px] font-semibold text-slate-800 dark:text-white">Оруулсан мэдээллийг устгах</p>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4 text-[13px] text-slate-700 dark:text-slate-300">
          {error && <p className="text-[#f8285a]">{error}</p>}
          {!preview && !error && (
            <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Шалгаж байна…</p>
          )}
          {preview && (
            <>
              <div className="rounded-lg border border-[#f8285a]/30 bg-[#f8285a]/5 p-3">
                <p className="flex items-center gap-1.5 font-semibold text-[#f8285a]">
                  <AlertTriangle className="h-4 w-4" /> Анхааруулга
                </p>
                <p className="mt-1">
                  Энэ импортоор оруулсан мэдээллийг <b>импортын бүртгэлээр нэг бүрчлэн</b> өгөгдлийн сангаас бүрмөсөн
                  устгана. Сэргээх боломжгүй. Дараалал:
                </p>
                <ol className="mt-1 list-decimal pl-5">
                  <li>Үнэлгээ — нэгж талбарыг захирамжаас салгаж, олговор, хөрөнгө, үнэлгээг устгана</li>
                  <li>Нэгж талбар — нэгж талбар ба түүний бүх мэдээлэл (дараа нь нэмсэн, өөрчилсөн ч)</li>
                  <li>Чөлөөлөлт — импортоос өөр нэгж талбар орсон бол чөлөөлөлт ба тэр нэгж талбар үлдэнэ</li>
                </ol>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                  Өөр газраас аль хэдийн устсан мэдээллийг алгасаж логт бичнэ. Устгалын түүх энд үлдэнэ.
                </p>
              </div>

              <div>
                <p className="mb-1 font-medium text-slate-600 dark:text-slate-300">Устах мэдээлэл</p>
                <CountRow label="Үнэлгээ" value={preview.valuations} />
                <CountRow label="Нэгж талбар" value={preview.parcels} />
                <div className="flex justify-between gap-2 border-b border-slate-50 py-1 dark:border-white/[0.04]">
                  <span>Олговор</span>
                  <span className="tabular-nums"><b>{fmt(preview.compensations)}</b> · {fmt(preview.amount)}₮</span>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-50 py-1 dark:border-white/[0.04]">
                  <span>Захирамжаас салгах холбоос</span><b className="tabular-nums">{fmt(preview.decisionLinks)}</b>
                </div>
                {preview.acquisitions.map((a) => (
                  <div key={a.id} className="flex justify-between gap-2 border-b border-slate-50 py-1 dark:border-white/[0.04]">
                    <span>Чөлөөлөлт: {a.name || a.id}</span>
                    <b className={a.keep ? "text-amber-600" : !a.exists ? "text-slate-400" : "text-[#f8285a]"}>
                      {!a.exists ? "аль хэдийн устсан" : a.keep ? "ҮЛДЭНЭ" : "устна"}
                    </b>
                  </div>
                ))}
              </div>

              {keeps.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <p className="flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4" /> Үлдэх мэдээлэл</p>
                  {keeps.map((a) => (
                    <div key={a.id} className="mt-1">
                      <p><b>{a.name}</b>: {a.keepReason}</p>
                      {a.others.length > 0 && (
                        <p className="mt-0.5 break-words text-[12px]">Үлдэх нэгж талбар: {a.others.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {later.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-[#252630]">
                  <p className="font-semibold">Импортын нэгж талбарт дараа нь нэмсэн мэдээлэл (мөн устана)</p>
                  <ul className="mt-1 list-disc pl-5">
                    {later.map(([key, n]) => <li key={key}>{LATER_LABEL[key] ?? key}: <b>{fmt(n)}</b></li>)}
                  </ul>
                </div>
              )}

              {preview.blockers.length > 0 && (
                <div className="rounded-lg bg-[#f8285a]/10 p-3 text-[#f8285a]">
                  <p className="flex items-center gap-1.5 font-semibold"><XCircle className="h-4 w-4" /> Устгах боломжгүй</p>
                  <ul className="mt-1 list-disc pl-5">
                    {preview.blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              )}

              {preview.canRollback && (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/[0.08]">
                  <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>Энэ импортоор оруулсан мэдээлэл бүрмөсөн устана гэдгийг ойлгож, зөвшөөрч байна.</span>
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-[#37394d]">
          <button className={secondaryButton} onClick={onClose} disabled={busy}>Болих</button>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f8285a] px-4 text-[13px] font-semibold text-white hover:bg-[#e0204f] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!preview?.canRollback || !agreed || busy}
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Устгах
          </button>
        </div>
      </div>
    </div>
  );
}
