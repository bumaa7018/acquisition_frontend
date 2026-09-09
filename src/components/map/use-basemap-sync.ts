"use client";

// Сервер дээрх суурь зургийн тохиргоог НЭГ УДАА уншиж модул дахь санд тавина.
//
// Апп ачаалахад (providers) дуудагдана: газрын зургууд тохиргоог модулаас
// синхроноор авдаг тул хүсэлт ирэхээс өмнө үндсэн зурагтай нээгдээд, хариу
// ирэхэд суурь давхарга нь чимээгүй солигдоно.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { setBasemapSetting } from "./basemap-config";

/** Тохиргооны query-ийн түлхүүр — тохиргоо солиход invalidate хийнэ. */
export const BASEMAP_QUERY_KEY = ["settings", "basemap"] as const;

export function useBasemapSync() {
  const { data } = useQuery({
    queryKey: BASEMAP_QUERY_KEY,
    queryFn: () => settingsApi.getBasemap(),
    // Тохиргоо ховор солигддог; хуудас хооронд дахин дуудахгүй.
    staleTime: 5 * 60_000,
    // Нэвтрээгүй үед 401 гарахгүйн тул токен байхад л уншина.
    enabled: typeof window !== "undefined",
  });

  useEffect(() => {
    // data===undefined (уншиж байна) үед сан хөндөгдөхгүй — үндсэн зураг хэвээр.
    if (data !== undefined) setBasemapSetting(data);
  }, [data]);
}
