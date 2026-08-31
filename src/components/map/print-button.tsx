"use client";
import { Printer } from "lucide-react";

interface Props {
  onClick: () => void;
}

/**
 * "Ажлын зураг" товч — газрын зургийн баруун доод буланд.
 *
 * ЯАГААД ЦЭСГҮЙ: цаас (A4/A3) болон чиглэлийг ХЭВЛЭХИЙН ЦОНХ дотор
 * сонгодог болсон. Энд ч бас сонгуулбал хэрэглэгч нэг зүйлийг ХОЁР УДАА
 * сонгох болно — товч зөвхөн цонхыг нээнэ.
 */
export default function PrintButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ажлын зургийг PDF-ээр бэлдэх"
      className="absolute bottom-3 right-3 z-10 flex h-9 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:bg-[#252630]/90 dark:text-slate-200 dark:hover:bg-[#2d2f3d]"
    >
      <Printer className="h-4 w-4 shrink-0" />
      Ажлын зураг
    </button>
  );
}
