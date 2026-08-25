"use client";
import { Download, Loader2, X } from "lucide-react";
import type { PrintOrientation } from "./print-map";

interface Props {
  orientation: PrintOrientation;
  dataUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
}

export default function PrintPreviewModal({ orientation, dataUrl, onClose, onDownload }: Props) {
  // Хэвтээ (landscape) үед модал өргөн, босоо (portrait) үед нарийн — хуудасны
  // харьцаатай ойролцоо харагдахын тулд өргөнийг чиглэлээр нь өөрчилнө.
  const widthClass = orientation === "landscape" ? "max-w-3xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full ${widthClass} flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl transition-[max-width] duration-200 dark:border-white/[0.06] dark:bg-[#1e1f27]`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-[#37394d]">
          <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Хэвлэх урьдчилан харах</p>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-[#15161c]">
          {dataUrl ? (
            <img src={dataUrl} alt="Хэвлэх урьдчилан харах" className="h-auto w-full rounded shadow" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-[12px]">Бэлтгэж байна...</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5 dark:border-[#37394d]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-4 text-[12.5px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#252630]"
          >
            Хаах
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={!dataUrl}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#02aab6] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Татах
          </button>
        </div>
      </div>
    </div>
  );
}
