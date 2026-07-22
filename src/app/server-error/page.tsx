"use client";

// Backend-руу хандахад алдаа гарсан эсвэл timeout болсон үед энд шилжинэ.
// Энэ хуудас ямар ч API дуудахгүй — зөвхөн дахин оролдох/нүүр хуудас руу буцах сонголт өгнө.

import { ServerCrash, RefreshCw, Home } from "lucide-react";

function goBackAndRetry() {
  // Алдаа гарсан хуудас руу буцаж дахин ачаална (?from=... query-гээс).
  let target = "/";
  if (typeof window !== "undefined") {
    const from = new URLSearchParams(window.location.search).get("from");
    if (from && from.startsWith("/") && !from.startsWith("/server-error")) target = from;
  }
  window.location.href = target;
}

export default function ServerErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#14161c]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <ServerCrash className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-white">Серверт холбогдоход алдаа гарлаа</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          Сервер түр хариу өгөхгүй байна эсвэл хүсэлт хугацаа хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.
          Асуудал үргэлжилбэл системийн админд хандана уу.
        </p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            onClick={goBackAndRetry}
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
