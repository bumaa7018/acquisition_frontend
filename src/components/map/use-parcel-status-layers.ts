"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parcelStatusApi } from "@/lib/api";
import {
  parcelStatusLayerDefs,
  PARCEL_STATUS_GROUP_ID,
  type MapLayerDef,
  type ParcelStatusLike,
} from "./layer-config";

/**
 * Нэгж талбарын ТӨЛӨВИЙН давхаргууд — бүртгэлээс.
 *
 * ЯАГААД hook: эдгээр давхаргууд одоо СЕРВЕР талын өгөгдлөөс (parcel_status
 * хүснэгт) хамаарна. Өмнө нь код дотор хатуу бичигдсэн 6 мөр байсан тул
 * "Нэгж талбарын статус" цэсээр шинэ төлөв нэмэхэд газрын зураг дээр тэр
 * ОГТ гарч ирдэггүй байв. Хамаарлыг модулийн далд кэшэнд нуухаас илүү
 * ил гаргаж, ачаалалтын төлөвийг дуудагч нь харах боломжтой болгов.
 *
 * Кэш: төлөвийн бүртгэл маш ховор өөрчлөгддөг тул удаан хугацаанд шинэлэг
 * гэж үзнэ — газрын зураг нээх болгонд дахин татахгүй.
 */
/** Тогтвортой хоосон утга — `data = []` гэсэн өгөгдмөл нь рендер бүрд ШИНЭ
 *  массив үүсгэж, доорх мемог утгагүй болгоно. */
const EMPTY: ParcelStatusLike[] = [];

export function useParcelStatusLayers() {
  const { data, isLoading } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
    staleTime: 5 * 60_000,
  });

  // ЗААВАЛ мемолно: шинэ массив бүр өөр IDENTITY-тэй тул дуудагчийн
  // `useEffect([defs])` нь РЕНДЕР БҮРД дахин ажиллаж, давхаргын шүүлтийг
  // дахин тавьдаг байв (`status=N` нь дарагдаж, бүх төлөв бүх талбарыг
  // зурдаг болно).
  const defs = useMemo(() => parcelStatusLayerDefs(data ?? EMPTY) as MapLayerDef[], [data]);

  return {
    /** Давхаргын тодорхойлолтууд — `sort_order`-ийн дарааллаар. */
    defs,
    /** Бүртгэл татагдаж дуустал `true`. */
    isLoading,
  };
}

/** Давхаргын самбар дахь төлөвийн бүлгийн тодорхойлолт. */
export const PARCEL_STATUS_GROUP = {
  id: PARCEL_STATUS_GROUP_ID,
  label: "Нэгж талбарын хил",
  color: "#22c55e",
};


// Төлөвийн өнгөний hook нь `@/lib/use-parcel-status-style`-д — газрын зургаас
// гадна (жагсаалт, дэлгэрэнгүй хуудас) ч хэрэглэгддэг тул тэнд төвлөрүүлэв.
export { useParcelStatusColors } from "@/lib/use-parcel-status-style";
