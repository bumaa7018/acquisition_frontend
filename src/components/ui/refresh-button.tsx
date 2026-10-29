"use client";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearGeoServerCache } from "@/lib/geoserver";
import { trackRefresh } from "@/lib/blocking-loader-state";

/**
 * "Хайх" товчны ард байрлах шинэчлэх товч — шүүлтийг өөрчлөхгүйгээр
 * хуудсан дээр идэвхтэй байгаа БҮХ query-г серверээс дахин татна.
 * Query бүрийг тусад нь холбох шаардлагагүй.
 *
 * Татаж дуустал контентын хэсэгт саарал давхарга + spinner гарна
 * (`ContentLoader`) — хуучин өгөгдөл доороо харагдсаар.
 */
export function RefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ type: "active" }) > 0;

  return (
    <button
      type="button"
      onClick={() => {
        clearGeoServerCache();
        void trackRefresh(queryClient.refetchQueries({ type: "active" }));
      }}
      disabled={fetching}
      title="Шинэчлэх"
      aria-label="Шинэчлэх"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#02c0ce] disabled:opacity-60 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
    </button>
  );
}
