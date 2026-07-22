"use client";

// React рендер хийх явцад баригдаагүй (uncaught) алдаа гарвал Next.js энэ
// компонентыг харуулна. Өмнө нь ийм алдаа хэзээ ч хаана ч логлогддоггүй
// байсан (error boundary огт байгаагүй) — одоо logger-оор дамжуулж backend/
// Grafana-с харагдах болгоно.

import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";
import { logger } from "@/lib/logger";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("uncaught render error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#14161c]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-white">Алдаа гарлаа</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          Хуудсыг ачаалахад гэнэтийн алдаа гарлаа. Дахин оролдоно уу.
          Асуудал үргэлжилбэл системийн админд хандана уу.
        </p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90"
          >
            <RefreshCw className="h-4 w-4" />
            Дахин оролдох
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
          >
            <Home className="h-4 w-4" />
            Нүүр хуудас
          </button>
        </div>
      </div>
    </div>
  );
}
