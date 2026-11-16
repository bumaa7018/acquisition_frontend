"use client";
import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Тохиргоо, удирдлагын цэсүүдийн НЭМЭХ / ЗАСАХ / НУУЦ ҮГ СОЛИХ хэлбэрийн
 * нийтлэг попап. Жагсаалтын дээр гарч ирдэг (хуудсыг түлхэхгүй) ба
 * агуулгаараа өндөр бол попап дотроо гүйлгэгдэнэ.
 *
 * Арын бүдэг хэсэг дээр дарахад ХААГДАХГҮЙ — санамсаргүй дарж бөглөсөн
 * мэдээллээ алдахаас сэргийлнэ. Esc товч ба загалмайгаар хаана (busy үед
 * хаахгүй).
 */
const WIDTHS = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export function FormDialog({
  open,
  title,
  subtitle,
  onClose,
  busy = false,
  size = "md",
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** Хадгалж байх үед Esc ба загалмай ажиллахгүй. */
  busy?: boolean;
  size?: keyof typeof WIDTHS;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "my-6 flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-white/[0.06] dark:bg-[#1e1f27]",
          WIDTHS[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold text-slate-800 dark:text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Хаах"
            title="Хаах"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
