"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parcelStatusApi } from "@/lib/api";
import { getParcelStatusStyle } from "@/types";
import type { ParcelStatus } from "@/types";

/** Тогтвортой хоосон утга — `?? []` нь рендер бүрд шинэ массив үүсгэхээс сэргийлнэ. */
const EMPTY: ParcelStatus[] = [];

/**
 * Нэгж талбарын төлөвийн ӨНГИЙГ БҮРТГЭЛЭЭС авах.
 *
 * ЯАГААД: `getParcelStatusStyle` нь код дотор хатуу бичсэн хүснэгттэй бөгөөд
 * тэр хүснэгтэд ЗӨВХӨН анхны 6 төлөв (0-5) байдаг. Бүртгэлд шинэ төлөв
 * нэмэхэд (эсвэл байгаа төлөвийн өнгийг солиход) жагсаалт, дэлгэрэнгүй
 * хуудсууд хуучин/саарал өнгөөр харагддаг байв.
 *
 * Энэ hook нь бүртгэлийн өнгийг холбож өгсөн ИЖИЛ функцийг буцаана —
 * дуудагч зөвхөн `getStyle(id, name)` гэж дуудна:
 *
 *     const statusStyle = useParcelStatusStyle();
 *     const s = statusStyle(p.status_id, p.status_name);
 *
 * Хүсэлт: `["parcel-statuses"]` түлхүүр нь газрын зургийн давхаргууд,
 * бүртгэлийн хуудастай ИЖИЛ тул React Query давхардлыг нэгтгэнэ —
 * хуудсанд хэдэн ч компонент дуудсан нэг л хүсэлт явна (~700 байт).
 */
export function useParcelStatusStyle() {
  const { data } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const byId = new Map<number, string>();
    for (const s of data ?? EMPTY) if (s.color) byId.set(s.id, s.color);
    return (statusId?: number, statusName?: string) =>
      getParcelStatusStyle(
        statusId,
        statusName ?? "",
        statusId != null ? byId.get(statusId) : undefined,
      );
  }, [data]);
}

/** Төлөвийн id → өнгө. Зөвхөн өнгө хэрэгтэй дуудагчид (газрын зургийн давхарга г.м.). */
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
