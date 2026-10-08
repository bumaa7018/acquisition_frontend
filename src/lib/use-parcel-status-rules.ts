"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parcelStatusApi } from "@/lib/api";
import type { ParcelStatusRules } from "@/types";

const NONE: ParcelStatusRules = {
  is_final: false,
  locks_progress: false,
  is_valuation_stage: false,
  is_released: false,
  requires_reason: false,
};

/**
 * Бүртгэл ачаалагдаагүй (эсвэл төлөв олдоогүй) үеийн өгөгдмөл — өмнө кодонд
 * хатуу бичигдсэн дүрэм (seed 000049-тэй ИЖИЛ). Ингэснээр ачаалж байх агшинд
 * түгжээ «нээгдэхгүй».
 */
export const DEFAULT_PARCEL_STATUS_RULES: Record<number, ParcelStatusRules> = {
  2: { ...NONE, is_valuation_stage: true },
  3: { ...NONE, is_final: true, locks_progress: true, requires_reason: true },
  4: { ...NONE, is_final: true, requires_reason: true },
  5: { ...NONE, is_final: true, locks_progress: true, is_released: true },
};

/**
 * Нэгж талбарын төлөвийн ДҮРЭМ — «Нэгж талбарын төлөв» тохиргооноос (parcel_status).
 * Өмнө төлөвийн НЭР/дугаараар хатуу шалгадаг байсныг орлоно:
 *
 *     const statusRules = useParcelStatusRules();
 *     if (statusRules(parcel.status_id).is_final) …
 *
 * `["parcel-statuses"]` түлхүүр нь useParcelStatusStyle-тэй ИЖИЛ тул нэг л хүсэлт явна.
 */
export function useParcelStatusRules() {
  const { data } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
    // Дүрэм нь түгжээ — тохиргоог өөр цонхонд сольсон бол хуудас руу буцахад
    // (focus/mount) ШУУД шинэчлэгдэнэ (6 мөр тул хямд).
    staleTime: 0,
  });
  return useMemo(() => {
    const byId = new Map<number, ParcelStatusRules>();
    for (const s of data ?? []) {
      byId.set(s.id, {
        is_final: !!s.is_final,
        locks_progress: !!s.locks_progress,
        is_valuation_stage: !!s.is_valuation_stage,
        is_released: !!s.is_released,
        requires_reason: !!s.requires_reason,
      });
    }
    const loaded = !!data;
    return (statusId?: number | null): ParcelStatusRules => {
      if (statusId == null) return NONE;
      const fromRegistry = byId.get(statusId);
      if (fromRegistry) return fromRegistry;
      // Бүртгэл ачаалагдаагүй үед л өмнөх дүрмийг; ачаалагдсан бол бүртгэлд
      // байхгүй төлөвт дүрэмгүй.
      return loaded ? NONE : DEFAULT_PARCEL_STATUS_RULES[statusId] ?? NONE;
    };
  }, [data]);
}

/**
 * Тухайн дүрэм асаалттай төлөвүүдийн НЭР — тайлбар текстэд («Зөвхөн
 * "Чөлөөлсөн" төлөвтэй…»). Бүртгэл ачаалагдаагүй бол `fallback`.
 */
export function useParcelStatusNamesWithRule(rule: keyof ParcelStatusRules, fallback: string[]) {
  const { data } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
    staleTime: 5 * 60_000,
  });
  return useMemo(
    () => (data ? data.filter((s) => s[rule]).map((s) => s.name) : fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, rule],
  );
}
