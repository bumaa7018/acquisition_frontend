"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parcelStatusApi } from "@/lib/api";
import { getParcelStatusStyle } from "@/types";
import type { ParcelStatus } from "@/types";

/** Тогтвортой хоосон утга — `?? []` нь рендер бүрд шинэ массив үүсгэхээс сэргийлнэ. */
const EMPTY: ParcelStatus[] = [];

/**
 * Нэгж талбарын төлөвийн ӨНГИЙГ БҮРТГЭЛЭЭС авах — өнгөний цорын ганц эх
 * сурвалж нь backend-ийн `parcel_status.color`. Кодонд төлөвийн id/нэрээр
 * хатуу өнгө байхгүй: админ шинэ төлөв нэмэх, өнгө солиход бүх хуудас дагана.
 *
 *     const statusStyle = useParcelStatusStyle();
 *     const s = statusStyle(p.status_id);   // { color, bg }
 *
 * Бүртгэл ачаалагдаж байх үед / өнгөгүй төлөв — саарал (PARCEL_STATUS_FALLBACK_COLOR).
 *
 * Хүсэлт: `["parcel-statuses"]` түлхүүр нь газрын зургийн давхаргууд,
 * бүртгэлийн хуудастай ИЖИЛ тул React Query давхардлыг нэгтгэнэ —
 * хуудсанд хэдэн ч компонент дуудсан нэг л хүсэлт явна (~700 байт).
 */
export function useParcelStatusStyle() {
  const byId = useParcelStatusColors();
  return useMemo(
    () => (statusId?: number | null) => getParcelStatusStyle(statusId != null ? byId.get(statusId) : undefined),
    [byId],
  );
}

/** Төлөвийн id → өнгө. Зөвхөн өнгө хэрэгтэй дуудагчид (график, газрын зургийн давхарга г.м.). */
export function useParcelStatusColors() {
  const { data } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const byId = new Map<number, string>();
    for (const s of data ?? EMPTY) if (s.color) byId.set(s.id, s.color);
    return byId;
  }, [data]);
}
