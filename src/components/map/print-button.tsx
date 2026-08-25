"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, RectangleHorizontal, RectangleVertical } from "lucide-react";
import type { PrintOrientation } from "./print-map";

interface Props {
  onPrint: (orientation: PrintOrientation) => void;
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

  const choose = (orientation: PrintOrientation) => {
    setOpen(false);
    onPrint(orientation);
  };

  return (
    <div ref={rootRef} className="absolute bottom-3 right-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Газрын зургийг PDF-ээр хэвлэх"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 dark:bg-[#252630]/90 text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-[#2d2f3d] transition-colors"
      >
        <Printer className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-11 right-0 w-48 overflow-hidden rounded-lg border border-slate-200 dark:border-[#37394d] bg-white/95 dark:bg-[#252630]/95 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => choose("landscape")}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2d2f3d] transition-colors"
          >
            <RectangleHorizontal className="h-4 w-4 shrink-0" />
            Хэвтээ (Landscape)
          </button>
          <button
            type="button"
            onClick={() => choose("portrait")}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2d2f3d] transition-colors border-t border-slate-100 dark:border-[#37394d]"
          >
            <RectangleVertical className="h-4 w-4 shrink-0" />
            Босоо (Portrait)
          </button>
        </div>
      )}
    </div>
  );
}
