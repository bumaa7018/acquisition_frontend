"use client";

// Нийгэм, эдийн засгийн судалгаа — "Төслийн мэдээлэл"-ийн доод хэсэгт
// харагдах бүртгэл (төлөвлөгөөний 2.4.2.1 ажил).
//
// Чөлөөлөлтөд НЭГ бүртгэл: "Мэдээлэл оруулах"-аар зөвшөөрсөн/татгалзсан тоо,
// тайлбар, судалгааны файлыг бөглөнө. Дахин оруулахад бүртгэл ОРЛОГДОНО.
//
// Файл нь ЗААВАЛ бөгөөд ЗӨВХӨН PDF. Хэрэглэгч олон PDF сонговол ЭНД (browser
// дээр) нэг файл болж нэгтгэгдэнэ — серверт үргэлж нэг PDF хадгалагдана.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, FilePlus2, FileText, Loader2, X } from "lucide-react";
import { landApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";

/** Файл PDF эсэх — MIME хоосон ирэх тохиолдол байдаг тул өргөтгөлөөр ч шалгана. */
function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Олон PDF-ийг НЭГ файл болгож нэгтгэнэ (pdf-lib, dynamic import).
 *
 * Нэг файл сонгосон үед нэгтгэхгүй — эх файлыг хэвээр илгээнэ (хуудсын
 * метадата, гарын үсэг зэрэг хөндөгдөхгүй).
 */
async function mergePdfFiles(files: File[]): Promise<File> {
  if (files.length === 1) return files[0];
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // ignoreEncryption: нэвтрэх кодгүй, зөвхөн хэвлэх хамгаалалттай PDF-ийг
    // (сканнераас гардаг) уншиж чадахгүй байхаас сэргийлнэ.
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const out = await merged.save();
  // BlobPart-д ArrayBuffer хэлбэрээр өгнө (Uint8Array-ийн буфер хуваалцахгүй).
  return new File([out.slice().buffer as ArrayBuffer], "niigem-ediin-zasag-sudalgaa.pdf", {
    type: "application/pdf",
  });
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const EMPTY_FORM = { agreed: "", rejected: "", note: "" };

export function SocioSurveySection({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data: survey, isLoading } = useQuery({
    queryKey: ["acq-socio-survey", id],
    queryFn: () => landApi.getSocioSurvey(id),
    enabled: !!id,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ agreed?: boolean; rejected?: boolean; file?: boolean }>({});
  const [merging, setMerging] = useState(false);

  const openModal = () => {
    // Бүртгэл байвал өмнөх утгуудаас үргэлжлүүлж засна.
    setForm({
      agreed: survey ? String(survey.agreed_count) : "",
      rejected: survey ? String(survey.rejected_count) : "",
      note: survey?.note ?? "",
    });
    setFiles([]);
    setErrors({});
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Олон файлыг нэг PDF болгоно; файл сонгоогүй үед (зөвхөн тоо засах)
      // хадгалагдсан файл хэвээр үлдэнэ.
      let file: File | null = null;
      if (files.length > 0) {
        setMerging(files.length > 1);
        try {
          file = await mergePdfFiles(files);
        } finally {
          setMerging(false);
        }
      }
      return landApi.saveSocioSurvey(id, {
        agreed_count: Number(form.agreed),
        rejected_count: Number(form.rejected),
        note: form.note,
        file,
      });
    },
    onSuccess: () => {
      toast.success("Судалгааны мэдээлэл хадгалагдлаа");
      setOpen(false);
      setFiles([]);
      void queryClient.invalidateQueries({ queryKey: ["acq-socio-survey", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const handleFiles = (picked: File[]) => {
    const pdfs = picked.filter(isPdfFile);
    if (pdfs.length !== picked.length) {
      toast.error("Зөвхөн PDF файл хавсаргана");
    }
    if (pdfs.length > 0) setErrors((e) => ({ ...e, file: false }));
    setFiles(pdfs);
  };

  const handleSubmit = () => {
    const agreedNum = Number(form.agreed);
    const rejectedNum = Number(form.rejected);
    const next = {
      agreed: form.agreed.trim() === "" || !Number.isFinite(agreedNum) || agreedNum < 0,
      rejected: form.rejected.trim() === "" || !Number.isFinite(rejectedNum) || rejectedNum < 0,
      // Файл нь ЗААВАЛ: шинэ бүртгэлд шинэ файл, хадгалагдсан бүртгэлд
      // өмнөх файл нь хүчинтэй тул дахин шаардахгүй.
      file: files.length === 0 && !survey?.file_url,
    };
    setErrors(next);
    if (next.agreed || next.rejected || next.file) {
      if (next.file) toast.error("Судалгааны файлыг (PDF) хавсаргана уу");
      return;
    }
    saveMutation.mutate();
  };

  const busy = saveMutation.isPending || merging;
  const total = (survey?.agreed_count ?? 0) + (survey?.rejected_count ?? 0);

  const row = (label: string, value: React.ReactNode) => (
    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0">
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">{label}</span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 min-w-0 flex-1">{value || "—"}</span>
    </div>
  );

  return (
    <div className="mt-5">
      <div className="h-px w-full bg-[#e2e8f0] dark:bg-[#37394d]" />
      <div className="flex items-center gap-2 pt-4 pb-1">
        <ClipboardList className="h-3.5 w-3.5 text-[#02c0ce]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Нийгэм эдийн засгийн судалгаа
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={openModal}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#02c0ce]/10 px-2.5 text-[12px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/20"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Мэдээлэл оруулах
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 rounded bg-slate-100 dark:bg-[#252630] animate-pulse" />
          ))}
        </div>
      ) : !survey ? (
        <div className="my-2 rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-[13px] text-slate-400 dark:border-[#37394d] dark:text-slate-500">
          Судалгааны мэдээлэл ороогүй байна.
        </div>
      ) : (
        <>
          {row(
            "Зөвшөөрсөн",
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                {survey.agreed_count.toLocaleString()}
              </span>
              {total > 0 && (
                <span className="text-[11px] text-slate-400">
                  {Math.round((survey.agreed_count / total) * 100)}%
                </span>
              )}
            </span>,
          )}
          {row(
            "Татгалзсан",
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300">
                {survey.rejected_count.toLocaleString()}
              </span>
              {total > 0 && (
                <span className="text-[11px] text-slate-400">
                  {Math.round((survey.rejected_count / total) * 100)}%
                </span>
              )}
            </span>,
          )}
          {row("Нийт хамрагдсан", total > 0 ? total.toLocaleString() : undefined)}
          {row("Тайлбар", survey.note)}
          {row(
            "Судалгааны файл",
            survey.file_url ? (
              <a
                href={survey.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#02c0ce] hover:underline"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{survey.file_name || "Судалгаа.pdf"}</span>
                {survey.size_bytes > 0 && (
                  <span className="shrink-0 text-[11px] text-slate-400">({formatSize(survey.size_bytes)})</span>
                )}
              </a>
            ) : undefined,
          )}
          {row("Шинэчилсэн", survey.updated_at ? formatDate(survey.updated_at) : undefined)}
        </>
      )}

      {/* Мэдээлэл оруулах цонх */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-white/[0.06] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#02c0ce]/10">
                  <ClipboardList className="h-4 w-4 text-[#02c0ce]" />
                </div>
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Нийгэм эдийн засгийн судалгаа
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Зөвшөөрсөн /тоогоор/ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.agreed}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, agreed: e.target.value }));
                      setErrors((er) => ({ ...er, agreed: false }));
                    }}
                    placeholder="0"
                    className={`h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${
                      errors.agreed
                        ? "border-red-400 bg-red-50/30 focus:ring-red-400/20"
                        : "border-slate-200 bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08]"
                    }`}
                  />
                  {errors.agreed && <p className="mt-0.5 text-[11px] text-red-400">Тоо оруулна уу</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Татгалзсан /тоогоор/ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.rejected}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, rejected: e.target.value }));
                      setErrors((er) => ({ ...er, rejected: false }));
                    }}
                    placeholder="0"
                    className={`h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${
                      errors.rejected
                        ? "border-red-400 bg-red-50/30 focus:ring-red-400/20"
                        : "border-slate-200 bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08]"
                    }`}
                  />
                  {errors.rejected && <p className="mt-0.5 text-[11px] text-red-400">Тоо оруулна уу</p>}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Тайлбар
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={3}
                  placeholder="Судалгааны дүнгийн тайлбар..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition-all focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Судалгааны файл (PDF) <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                  className={`block w-full rounded-lg text-[12px] text-slate-500 file:mr-3 file:h-8 file:rounded-lg file:border-0 file:bg-[#02c0ce]/10 file:px-3 file:text-[12px] file:font-semibold file:text-[#02c0ce] hover:file:bg-[#02c0ce]/20 dark:text-slate-400 ${
                    errors.file ? "ring-1 ring-red-400" : ""
                  }`}
                />
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Олон файл сонговол НЭГ PDF болж нэгтгэгдэн хадгалагдана.
                </p>
                {files.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {files.map((f) => (
                      <li key={f.name + f.size} className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        • {f.name} <span className="text-slate-400">({formatSize(f.size)})</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Хадгалагдсан файл байгаа үед шинээр сонгоогүй бол хэвээр үлдэнэ */}
                {files.length === 0 && survey?.file_name && (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Одоогийн файл: {survey.file_name} — шинээр сонгоогүй бол хэвээр үлдэнэ.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-9 rounded-xl px-4 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#02c0ce] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {merging ? "Файл нэгтгэж байна..." : saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
