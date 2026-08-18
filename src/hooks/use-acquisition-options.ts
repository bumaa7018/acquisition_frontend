"use client";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import type { LandAcquisitionOption } from "@/types";

// Шүүлтүүрийн dropdown-уудын НЭГ дундын өгөгдлийн эх.
//
// Өмнө нь 4 компонент (тайлан + нэгж талбарын хуудасны Төлөвлөгөө/Газар
// чөлөөлөлт сонголтууд) тус тусдаа `landApi.list({ page: 1, page_size: 200 })`
// дуудаж, ҮНДСЭН жагсаалтын хүнд endpoint-ыг ашигладаг байв. Одоо тусдаа
// хөнгөн /land-acquisitions/filter-options-ыг дуудна (landApi.filterOptions
// тайлбарыг уншина уу).
//
// staleTime 10 минут: dropdown-ы агуулга бараг өөрчлөгддөггүй бөгөөд 60
// секундын өмнөх утга нь хуудас хооронд эргэлдэх тутам хүсэлт дахин
// илгээгдэх шалтгаан болж байв.
export const ACQ_OPTIONS_KEY = ["acq-filter-options"] as const;

export function useAcquisitionOptions() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ACQ_OPTIONS_KEY,
    queryFn: () => landApi.filterOptions(),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  const acquisitions: LandAcquisitionOption[] = data ?? [];
  return { acquisitions, isLoading, isError };
}

// Төлөвлөгөөний сонголт — чөлөөлөлтүүдээс plan_code-оор давхардлыг хасна.
// Тусдаа plan API байхгүй тул ижил өгөгдлөөс гаргана (нэмэлт хүсэлтгүй).
export function useAcquisitionPlanOptions() {
  const { acquisitions, isLoading, isError } = useAcquisitionOptions();
  const plans = Array.from(
    new Map(
      acquisitions
        .filter((a) => a.plan_code)
        .map((a) => [a.plan_code, { plan_code: a.plan_code, name: a.plan_name ?? "" }]),
    ).values(),
  );
  return { plans, isLoading, isError };
}
