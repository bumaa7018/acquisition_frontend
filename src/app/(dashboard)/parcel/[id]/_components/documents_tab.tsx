"use client";
import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Upload, Trash2, Download, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

function formatSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ parcelId }: { parcelId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => parcelApi.listDocuments(parcelId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => parcelApi.uploadDocument(parcelId, file),
    onSuccess: () => {
      toast.success("Баримт бичиг хавсаргагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
    },
    onError: () => toast.error("Файл хавсаргахад алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => parcelApi.deleteDocument(parcelId, docId),
    onSuccess: () => {
      toast.success("Баримт бичиг устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Баримт бичгүүд</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Дээд хэмжээ 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 10 * 1024 * 1024) { toast.error("10MB хэтэрлээ"); return; }
              uploadMutation.mutate(f);
              e.target.value = "";
            }
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
        >
          {uploadMutation.isPending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Нэмэх
        </button>
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
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => { if (confirm("Баримт бичиг устгах уу?")) deleteMutation.mutate(doc.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
