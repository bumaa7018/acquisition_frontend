"use client";
import { useState, useEffect } from "react";

export type PendingConfirm = {
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
} | null;

export function ConfirmDialog({
  open, title, description, confirmLabel = "Тийм", confirmColor = "#f1556c",
  onConfirm, onClose,
}: {
  open: boolean; title: string; description?: string;
  confirmLabel?: string; confirmColor?: string;
  onConfirm: () => void; onClose: () => void;
}) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!open) { setCountdown(10); return; }
    setCountdown(10);
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open && countdown === 0) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, open]);

  if (!open) return null;
  const circumference = 2 * Math.PI * 19;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
        <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <div className="relative mb-4">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2.5"
                className="text-slate-100 dark:text-[#2d2f3a]" />
              <circle cx="22" cy="22" r="19" fill="none" stroke={confirmColor} strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - countdown / 10)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[18px] font-bold tabular-nums text-slate-700 dark:text-white leading-none">
                {countdown}
              </span>
            </div>
          </div>
          <p className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">{title}</p>
          {description && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
          )}
          <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {countdown} секундын дараа автоматаар цуцлагдана
          </p>
        </div>
        <div className="h-px bg-slate-100 dark:bg-[#37394d]" />
        <div className="flex">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-r border-slate-100 dark:border-[#37394d]"
          >
            Болих
          </button>
          <button
            onClick={() => { onClose(); onConfirm(); }}
            className="flex-1 py-3.5 text-[13px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-[#252630]"
            style={{ color: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
