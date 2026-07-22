"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelApi, documentTypeApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { isProfessionalOrg } from "@/lib/role-utils";
import { formatDate, getApiError } from "@/lib/utils";
import { Upload, Trash2, Download, FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

function formatSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// "Хурлын тэмдэглэл" төрлийн хавсралт Гэрээтэй нэгтгэж хэвлэдэг тул
// цорын ганцаараа DOCX-ээр хавсаргах боломжтой байх ёстой (бусад бүх төрөл зөвхөн PDF).
function isDocxAllowed(docType?: { type: string }) {
  return docType?.type === "meeting_minutes";
}

function isDocxFile(file: File) {
  return file.type === DOCX_CONTENT_TYPE || file.name.toLowerCase().endsWith(".docx");
}

export function DocumentsTab({ parcelId, isLocked = false }: { parcelId: string; isLocked?: boolean }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const isProfOrg = isProfessionalOrg();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState<number | "">("");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => (isProfOrg ? profApi.profListParcelDocuments(parcelId) : parcelApi.listDocuments(parcelId)),
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
    staleTime: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, typeId, name }: { file: File; typeId: number; name: string }) =>
      isProfOrg
        ? profApi.profUploadParcelDocument(parcelId, file, typeId, name)
        : parcelApi.uploadDocument(parcelId, file, typeId, name),
    onSuccess: () => {
      toast.success("Баримт бичиг хавсаргагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
      closeModal();
    },
    onError: (err) => toast.error(getApiError(err, "Файл хавсаргахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      isProfOrg
        ? profApi.profDeleteParcelDocument(parcelId, docId)
        : parcelApi.deleteDocument(parcelId, docId).then(() => undefined),
    onSuccess: () => {
      toast.success("Баримт бичиг устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  function openModal() {
    setSelectedFile(null);
    setFileName("");
    setDocumentTypeId("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedFile(null);
    setFileName("");
    setDocumentTypeId("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const docType = docTypes.find(x => x.id === documentTypeId);
    const docxAllowed = isDocxAllowed(docType);
    const isPdf = f.type === "application/pdf";
    if (!isPdf && !(docxAllowed && isDocxFile(f))) {
      toast.error(docxAllowed ? "PDF эсвэл DOCX файл оруулна уу" : "PDF файл оруулна уу");
      e.target.value = "";
      return;
    }
    if (f.size > 50 * 1024 * 1024) { toast.error("50MB хэтэрлээ"); e.target.value = ""; return; }
    setSelectedFile(f);
    setFileName(docType ? docType.name : f.name.replace(/\.(pdf|docx)$/i, ""));
  }

  function handleSubmit() {
    if (!selectedFile) { toast.error("Файл сонгоно уу"); return; }
    if (!documentTypeId) { toast.error("Файлын төрөл сонгоно уу"); return; }
    if (!fileName.trim()) { toast.error("Файлын нэр оруулна уу"); return; }
    uploadMutation.mutate({ file: selectedFile, typeId: documentTypeId as number, name: fileName });
  }

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Баримт бичгүүд</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Зөвхөн PDF · Дээд хэмжээ 50MB</p>
          </div>
          {!isLocked && (
            <button
              onClick={openModal}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Нэмэх
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !docs.length ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
            <Paperclip className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-[13px]">Баримт бичиг байхгүй</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
            {docs.map((doc) => {
              const typeName = docTypes.find(t => t.id === doc.document_type_id)?.name;
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                    <FileText className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {typeName && <span className="text-[#02c0ce] mr-1.5">{typeName} ·</span>}
                      {formatSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {!isLocked && (
                      <button
                        onClick={() => setPendingConfirm({ title: "Баримт бичиг устгах уу?", confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(doc.id) })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Баримт бичиг нэмэх</p>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Document type */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Файлын төрөл</label>
                <select
                  value={documentTypeId}
                  onChange={e => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setDocumentTypeId(v);
                    // Файлын нэрийг хавсралтын төрлийн нэрээр санал болгоно
                    const t = docTypes.find(x => x.id === v);
                    if (t) setFileName(t.name);
                    // Шинэ төрөл DOCX зөвшөөрдөггүй бол өмнө сонгосон DOCX файлыг цэвэрлэнэ
                    if (selectedFile && isDocxFile(selectedFile) && !isDocxAllowed(t)) {
                      setSelectedFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }
                  }}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#252630] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-colors"
                >
                  <option value="">— Сонгох —</option>
                  {docTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* File picker */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Файл</label>
                <input
                  ref={inputRef}
                  type="file"
                  accept={isDocxAllowed(docTypes.find(x => x.id === documentTypeId)) ? ".pdf,application/pdf,.docx" : ".pdf,application/pdf"}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full h-9 rounded-lg border border-dashed border-slate-300 dark:border-white/[0.1] bg-slate-50 dark:bg-[#252630] px-3 text-[13px] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors text-left truncate"
                >
                  {selectedFile ? selectedFile.name : "Файл сонгох…"}
                </button>
              </div>

              {/* File name */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Файлын нэр</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  placeholder="Жишээ: Гэрээ №1"
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#252630] px-3 text-[13px] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-[#02c0ce] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-5">
              <button
                onClick={closeModal}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] transition-colors"
              >
                Цуцлах
              </button>
              <button
                onClick={handleSubmit}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {uploadMutation.isPending && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description}
        confirmLabel={pendingConfirm?.confirmLabel}
        confirmColor={pendingConfirm?.confirmColor}
        onConfirm={() => pendingConfirm?.onConfirm()}
        onClose={() => setPendingConfirm(null)}
      />
    </>
  );
}
