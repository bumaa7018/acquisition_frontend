"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, RectangleHorizontal, RectangleVertical } from "lucide-react";
import type { PrintOrientation, PrintPaperSize } from "./print-map";

interface Props {
  onPrint: (orientation: PrintOrientation, paper: PrintPaperSize) => void;
}

export default function PrintButton({ onPrint }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const choose = (orientation: PrintOrientation, paper: PrintPaperSize) => {
    setOpen(false);
    onPrint(orientation, paper);
  };

  return (
    <div ref={rootRef} className="absolute bottom-3 right-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Ажлын зургийг PDF-ээр бэлдэх"
        className="flex h-9 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:bg-[#252630]/90 dark:text-slate-200 dark:hover:bg-[#2d2f3d]"
      >
        <Printer className="h-4 w-4 shrink-0" />
        Ажлын зураг
      </button>
      {open && (
        <div className="absolute bottom-11 right-0 w-52 overflow-hidden rounded-lg border border-slate-200 dark:border-[#37394d] bg-white/95 dark:bg-[#252630]/95 shadow-lg backdrop-blur">
          {/* Цаасны хэмжээ бүрд хэвтээ/босоо — нийт 4 сонголт */}
          {(["A4", "A3"] as PrintPaperSize[]).map((paper, pi) => (
            <div key={paper} className={pi > 0 ? "border-t border-slate-200 dark:border-[#37394d]" : ""}>
              <p className="bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:bg-[#2d2f3d] dark:text-slate-500">
                {paper}
              </p>
              <button
                type="button"
                onClick={() => choose("landscape", paper)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2d2f3d] transition-colors"
              >
                <RectangleHorizontal className="h-4 w-4 shrink-0" />
                Хэвтээ (Landscape)
              </button>
              <button
                type="button"
                onClick={() => choose("portrait", paper)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#37394d] dark:text-slate-200 dark:hover:bg-[#2d2f3d]"
              >
                <RectangleVertical className="h-4 w-4 shrink-0" />
                Босоо (Portrait)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
