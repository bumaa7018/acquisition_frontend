"use client";
import { Maximize, Minimize } from "lucide-react";

interface Props {
  isFullscreen: boolean;
  onClick: () => void;
  className?: string;
}

export default function FullscreenButton({ isFullscreen, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isFullscreen ? "Дэлгэцээс гарах" : "Дэлгэц дүүргэж харах"}
      className={
        className ??
        // LayerPanel (top-3 right-3, бүлгүүд анхнаасаа дэлгэрсэн) болон 2D/3D товч (top-3 left-3)-той
        // мөргөлдөхгүй цорын ганц буланд байрлуулав — газрын зургийн хайрцаг намхан үед ч давхцахгүй
        "absolute bottom-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 dark:bg-[#252630]/90 text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-[#2d2f3d] transition-colors"
      }
    >
      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </button>
  );
}
