"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { monthRange } from "@/lib/chronos";

/**
 * «Он цагийн зураг»-ийн өгөгдөл — газрын зураг, цагийн гол, сараар шинэчлэгдэх дашбоард
 * НЭГ query-г хуваалцана (React Query-ийн ижил түлхүүр).
 * acquisitionIds: undefined = бүх чөлөөлөлт, [] = өгөгдөлгүй.
 */
export function useChronosData(acquisitionIds: string[] | undefined, enabled: boolean) {
  const none = acquisitionIds !== undefined && acquisitionIds.length === 0;
  const q = useQuery({
    queryKey: ["chronos", acquisitionIds ?? "all"],
    queryFn: () => dashboardApi.chronos(acquisitionIds),
    enabled: enabled && !none,
    staleTime: 60_000,
  });
  const months = useMemo(() => monthRange(q.data?.months ?? []), [q.data?.months]);
  const counts = useMemo(() => new Map((q.data?.months ?? []).map((m) => [m.month, m.count])), [q.data?.months]);
  return { data: q.data, isLoading: enabled && !none && q.isLoading, error: q.error, months, counts, none };
}
