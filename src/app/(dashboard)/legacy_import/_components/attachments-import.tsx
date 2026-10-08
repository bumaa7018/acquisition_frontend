"use client";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FolderOpen, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn, getApiError } from "@/lib/utils";
import { documentTypeApi, type DocumentPaymentInput } from "@/lib/api";
import { legacyImportApi, type AttachmentParcel } from "@/lib/legacy-import/api";
import { COMPENSATION_RECEIPT_TYPE, PAYMENT_STAGE_OPTIONS, todayISO } from "@/lib/payment-stage";
import { inputClass, JobProgress, primaryButton, secondaryButton, Stat, td, th, theadClass } from "./shared";

/** Нэг дор илгээх хүсэлтийн тоо — серверийг дарахгүй, хурдан. */
const CONCURRENCY = 3;

type RowStatus = "found" | "missing" | "hasReceipt" | "duplicate";
type UploadState = { state: "pending" | "uploading" | "done" | "failed"; error?: string };

interface Row {
  key: string;
  file: File;
  /** Файлын нэр өргөтгөлгүй = нэгж талбарын дугаар. */
  number: string;
  parcel: AttachmentParcel | null;
  status: RowStatus;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  found: "Олдсон",
  missing: "Нэгж талбар олдсонгүй",
  hasReceipt: "Өмнө баримттай",
  duplicate: "Хавтсанд давхар нэр",
};

const isPdf = (f: File) => /\.pdf$/i.test(f.name);
const stem = (name: string) => name.replace(/\.pdf$/i, "").trim();
const relPath = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

/**
 * Хуучин хавсралт оруулах — хавтас сонгоход доторх БҮХ PDF-ийг уншиж, нэрийг
 * нь (өргөтгөлгүй) нэгж талбарын дугаартай ЯГ тулгана. «Оруулах» дарахад
 * олдсон нэгж талбар бүрт «Нөхөх олговор олгосон баримт» төрлөөр хуулна.
 */
export function AttachmentsImport({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [matching, setMatching] = useState(false);
  const [stage, setStage] = useState<DocumentPaymentInput["stage"]>("full");
  const [date, setDate] = useState(todayISO());
  const [includeWithReceipt, setIncludeWithReceipt] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [running, setRunning] = useState(false);

  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
  });
  const receiptType = docTypes.find((t) => t.type === COMPENSATION_RECEIPT_TYPE);

  const pick = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    const pdfs = files.filter(isPdf).sort((a, b) => relPath(a).localeCompare(relPath(b)));
    setSkipped(files.length - pdfs.length);
    setUploads({});
    if (pdfs.length === 0) {
      setRows([]);
      toast.error("Сонгосон хавтсанд PDF файл алга");
      return;
    }
    setMatching(true);
    try {
      const matches = await legacyImportApi.matchAttachments(pdfs.map((f) => stem(f.name)));
      const byNumber = new Map(matches.map((m) => [m.parcelNumber, m.parcel]));
      const seen = new Set<string>();
      setRows(
        pdfs.map((file) => {
          const number = stem(file.name);
          const parcel = byNumber.get(number) ?? null;
          let status: RowStatus = !parcel ? "missing" : parcel.receipts > 0 ? "hasReceipt" : "found";
          // Дэд хавтсанд ижил нэртэй файл — эхнийх нь л орно.
          if (parcel && seen.has(number)) status = "duplicate";
          seen.add(number);
          return { key: relPath(file), file, number, parcel, status };
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Тулгахад алдаа гарлаа");
      setRows(null);
    } finally {
      setMatching(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { found: 0, missing: 0, hasReceipt: 0, duplicate: 0 };
    rows?.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const toUpload = (rows ?? []).filter(
    (r) => r.status === "found" || (r.status === "hasReceipt" && includeWithReceipt),
  );
  const finished = Object.values(uploads).filter((u) => u.state === "done" || u.state === "failed").length;
  const failed = Object.values(uploads).filter((u) => u.state === "failed").length;
  const anyUploaded = Object.keys(uploads).length > 0;

  const run = async () => {
    if (!receiptType) {
      toast.error("«Нөхөх олговор олгосон баримт» хавсралтын төрөл олдсонгүй");
      return;
    }
    const queue = [...toUpload];
    setRunning(true);
    setUploads(Object.fromEntries(queue.map((r) => [r.key, { state: "pending" } as UploadState])));
    const set = (key: string, u: UploadState) => setUploads((prev) => ({ ...prev, [key]: u }));
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        set(r.key, { state: "uploading" });
        try {
          await legacyImportApi.uploadAttachment(r.parcel!.id, r.file, receiptType.id, { stage, date });
          set(r.key, { state: "done" });
        } catch (err) {
          set(r.key, { state: "failed", error: err instanceof Error ? err.message : getApiError(err, "Оруулахад алдаа гарлаа") });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    toast.success("Хавсралт оруулж дууслаа");
  };

  return (
    <div className="ap-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">Хавсралт оруулах</h2>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            Хавтас сонгоход доторх бүх PDF-ийг уншина. Файлын нэр нь нэгж талбарын дугаартай яг ижил байх ёстой
            (жишээ: <span className="font-mono">1461502863.pdf</span>). Олдсон нэгж талбарт «Нөхөх олговор олгосон баримт»
            төрлөөр хавсаргана.
          </p>
        </div>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={onClose} title="Хаах" disabled={running}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          // Хөтөч хавтсыг бүхэлд нь (дэд хавтастай) сонгуулна.
          {...{ webkitdirectory: "", directory: "" }}
          onChange={(e) => pick(e.target.files)}
        />
        <button className={secondaryButton} onClick={() => inputRef.current?.click()} disabled={matching || running}>
          {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} Хавтас сонгох
        </button>
        <label className="text-[12px] text-slate-500 dark:text-slate-400">
          Олголтын шат
          <select className={cn(inputClass, "mt-1 block w-40")} value={stage} disabled={running}
            onChange={(e) => setStage(e.target.value as DocumentPaymentInput["stage"])}>
            {PAYMENT_STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-slate-500 dark:text-slate-400">
          Олгосон огноо
          <input type="date" className={cn(inputClass, "mt-1 block w-40")} value={date} max={todayISO()} disabled={running}
            onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {rows && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="PDF файл" value={rows.length} hint={skipped > 0 ? `PDF биш ${skipped} файлыг алгассан` : undefined} />
            <Stat label="Олдсон" value={counts.found} tone="good" />
            <Stat label="Олдоогүй" value={counts.missing} tone={counts.missing > 0 ? "bad" : "default"} />
            <Stat label="Өмнө баримттай" value={counts.hasReceipt} tone={counts.hasReceipt > 0 ? "warn" : "default"} />
            <Stat label="Давхар нэр" value={counts.duplicate} tone={counts.duplicate > 0 ? "warn" : "default"} />
          </div>
          {skipped > 0 && (
            <p className="text-[12px] text-slate-500">PDF биш {skipped} файлыг алгаслаа.</p>
          )}
          {counts.hasReceipt > 0 && (
            <label className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeWithReceipt} disabled={running}
                onChange={(e) => setIncludeWithReceipt(e.target.checked)} />
              Өмнө баримттай {counts.hasReceipt} нэгж талбарт ч оруулах (давхар баримт үүснэ)
            </label>
          )}

          {(running || anyUploaded) && (
            <JobProgress label={running ? "Хавсралт хуулж байна" : `Дууссан${failed > 0 ? ` · ${failed} алдаатай` : ""}`}
              done={finished} total={Object.keys(uploads).length} />
          )}

          <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-100 dark:border-white/[0.06]">
            <table className="w-full min-w-[720px] text-left">
              <thead className={theadClass}>
                <tr>
                  <th className={th}>Файл</th>
                  <th className={th}>Нэгж талбар</th>
                  <th className={th}>Чөлөөлөлт</th>
                  <th className={th}>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = uploads[r.key];
                  return (
                    <tr key={r.key} className="border-b border-slate-50 dark:border-white/[0.04]">
                      <td className={cn(td, "break-all")}>{r.key}</td>
                      <td className={cn(td, "font-mono")}>{r.number}</td>
                      <td className={cn(td, "break-words")}>
                        {r.parcel ? (
                          <>
                            {r.parcel.acquisitionName || "—"}
                            {r.parcel.planCode && <span className="block text-[11px] text-slate-400">{r.parcel.planCode}</span>}
                          </>
                        ) : "—"}
                      </td>
                      <td className={td}>
                        {u ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            u.state === "done" && "text-[#0acf97]",
                            u.state === "failed" && "text-[#f8285a]",
                            (u.state === "pending" || u.state === "uploading") && "text-slate-500",
                          )}>
                            {u.state === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {u.state === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {u.state === "pending" ? "Хүлээгдэж байна" : u.state === "uploading" ? "Хуулж байна"
                              : u.state === "done" ? "Орсон" : u.error}
                          </span>
                        ) : (
                          <span className={cn(
                            "font-medium",
                            r.status === "found" && "text-[#0acf97]",
                            r.status === "missing" && "text-[#f8285a]",
                            (r.status === "hasReceipt" || r.status === "duplicate") && "text-amber-600 dark:text-amber-400",
                          )}>
                            {STATUS_LABEL[r.status]}
                            {r.status === "hasReceipt" && ` (${r.parcel?.receipts})`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3">
            <span className="text-[12px] text-slate-500">{toUpload.length} файл оруулна</span>
            <button className={primaryButton} onClick={run} disabled={running || anyUploaded || toUpload.length === 0 || !receiptType || !date}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Оруулах
            </button>
          </div>
        </>
      )}
    </div>
  );
}
