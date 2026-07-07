"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { landApi, parcelStatusApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { formatArea, getApiError } from "@/lib/utils";
import { canAccessParcel, getCurrentUserId, isExternalSpecialRole, isFinanceSpecialist, isProfessionalOrg } from "@/lib/role-utils";
import { getParcelStatusStyle, VALUATION_STATUS_LABELS, VALUATION_TYPE_LABELS } from "@/types";
import type { ParcelStatus, ValuationStatus, ValuationType } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const RIGHT_TYPE_OPTIONS = [
  { value: 1, label: "Ашиглах" },
  { value: 2, label: "Эзэмших" },
  { value: 3, label: "Өмчлөх" },
];

type ParcelFilter = {
  parcel_id: string;
  au1_code: string;
  au2_code: string;
  au3_code: string;
  right_type: number;
  landuse: string;
  status_id: number;
};

const PAGE_SIZE = 20;

// Нөхөх олговрын үнэлгээний төлөвийн чипийн өнгө
const VAL_STATUS_CHIP: Record<ValuationStatus, string> = {
  draft: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  returned: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  rejected: "bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400",
};

const EMPTY_FILTER: ParcelFilter = {
  parcel_id: "",
  au1_code: "",
  au2_code: "",
  au3_code: "",
  right_type: 0,
  landuse: "",
  status_id: 0,
};

function parcelListParams(filter: ParcelFilter, page: number) {
  return {
    page,
    page_size: PAGE_SIZE,
    ...(filter.parcel_id.trim() ? { parcel_id: filter.parcel_id.trim() } : {}),
    ...(filter.au1_code.trim() ? { au1_code: filter.au1_code.trim() } : {}),
    ...(filter.au2_code.trim() ? { au2_code: filter.au2_code.trim() } : {}),
    ...(filter.au3_code.trim() ? { au3_code: filter.au3_code.trim() } : {}),
    ...(filter.right_type ? { right_type: filter.right_type } : {}),
    ...(filter.landuse.trim() ? { landuse: filter.landuse.trim() } : {}),
    ...(filter.status_id ? { status_id: filter.status_id } : {}),
  };
}

export function ParcelsTab({
  id,
  acquisitionProfOrgId,
  isAcqLocked = false,
}: {
  id: string;
  acquisitionProfOrgId?: string | null;
  isAcqLocked?: boolean;
}) {
  const queryClient = useQueryClient();
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();
  const isFinance = isFinanceSpecialist();
  const currentUserId = getCurrentUserId();
  const isMainProfOrg = isExternal && acquisitionProfOrgId === currentUserId;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [page, setPage] = useState(1);
  const [filterForm, setFilterForm] = useState<ParcelFilter>(EMPTY_FILTER);
  const [filter, setFilter] = useState<ParcelFilter>(EMPTY_FILTER);
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null);
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);

  const { data: parcelStatuses = [] } = useQuery<ParcelStatus[]>({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
  });

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ["land-parcels", id, filter, page],
    queryFn: () =>
      isProfOrg
        ? profApi.profListParcels(id, parcelListParams(filter, page))
        : landApi.getParcels(id, parcelListParams(filter, page)),
  });

  const syncMutation = useMutation({
    mutationFn: (parcelId: string) => landApi.syncParcel(id, parcelId),
    onSuccess: () => {
      toast.success("Синхрончлогдлоо");
      queryClient.invalidateQueries({ queryKey: ["land-parcels", id] });
      window.location.reload();
    },
    onError: (err) => toast.error(getApiError(err, "Синхрончлоход алдаа гарлаа")),
  });

  const compensationMutation = useMutation({
    mutationFn: ({ parcelId, paid }: { parcelId: string; paid: boolean }) =>
      landApi.setParcelCompensation(id, parcelId, paid),
    onSuccess: () => {
      toast.success("Нөхөн төлбөрийн төлөв шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["land-parcels", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Нөхөн төлбөр шинэчлэхэд алдаа гарлаа")),
  });

  const inp =
    "h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const hasFilter = !!(
    filter.parcel_id ||
    filter.au1_code ||
    filter.au2_code ||
    filter.au3_code ||
    filter.right_type !== 0 ||
    filter.landuse ||
    filter.status_id !== 0
  );
  const visibleParcels = (parcels?.data ?? []).filter((parcel) => {
    if (
      !canAccessParcel(
        parcel.status_name,
        acquisitionProfOrgId,
        parcel.independent_org_id,
      )
    )
      return false;
    // Санхүүгийн мэргэжилтэнд ЗӨВХӨН хянуулахаар илгээсэн (submitted) төлөвтэй
    // үнэлгээтэй нэгж талбар харагдана — баталгаажсан болон хүлээгдэж буй
    // (draft/returned) үнэлгээтэй талбарууд жагсаалтад орохгүй.
    if (isFinance) {
      return Object.values(parcel.valuation_statuses ?? {}).some(
        (status) => status === "submitted",
      );
    }
    return true;
  });

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                Нэгж талбарууд
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {parcels?.total ?? 0} нэгж талбар
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Дугаараар хайх"
                value={filterForm.parcel_id}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, parcel_id: e.target.value }))
                }
                className={`${inp} w-40`}
              />
              <input
                type="text"
                placeholder="Аймаг/Нийслэл"
                value={filterForm.au1_code}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, au1_code: e.target.value }))
                }
                className={`${inp} w-32`}
              />
              <input
                type="text"
                placeholder="Сум/Дүүрэг"
                value={filterForm.au2_code}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, au2_code: e.target.value }))
                }
                className={`${inp} w-32`}
              />
              <input
                type="text"
                placeholder="Баг/Хороо"
                value={filterForm.au3_code}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, au3_code: e.target.value }))
                }
                className={`${inp} w-32`}
              />
              <select
                value={filterForm.right_type}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    right_type: e.target.value ? Number(e.target.value) : 0,
                  }))
                }
                className={`${inp} w-36`}
              >
                <option value="">Эрхийн төрөл</option>
                {RIGHT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Газрын зориулалт"
                value={filterForm.landuse}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, landuse: e.target.value }))
                }
                className={`${inp} w-40`}
              />
              <select
                value={filterForm.status_id}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    status_id: e.target.value ? Number(e.target.value) : 0,
                  }))
                }
                className={`${inp} w-36`}
              >
                <option value="">Төлөв</option>
                {parcelStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setFilter({ ...filterForm });
                  setPage(1);
                }}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-[#02c0ce] hover:bg-[#02aebb] transition-colors"
              >
                Хайх
              </button>
              {hasFilter && (
                <button
                  onClick={() => {
                    setFilterForm(EMPTY_FILTER);
                    setFilter(EMPTY_FILTER);
                    setPage(1);
                  }}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] border border-slate-200 dark:border-white/[0.08] transition-colors"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>
        </div>

        {parcelsLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {[
                    "",
                    "Дугаар",
                    "Баг",
                    "Эрхийн төрөл",
                    "Газрын зориулалт",
                    "Талбай",
                    "Давхцал",
                    "Нөхөн төлбөр",
                    "Төлөв",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleParcels.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-12 text-center text-[13px] text-slate-400 dark:text-slate-500"
                    >
                      Нэгж талбар олдсонгүй
                    </td>
                  </tr>
                ) : visibleParcels.map((p) => {
                  const isOpen = expandedParcel === p.id;
                  const cashAmt = Number(p.cash_amount) || 0;
                  const landGrantAmt = Number(p.land_grant_amount) || 0;
                  const landGrantCount = Number(p.land_grant_count) || 0;

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-[#37394d] transition-colors ${isOpen ? "bg-slate-50/80 dark:bg-[#1a1d20]" : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"}`}
                      >
                        <td className="pl-3 pr-1 py-2.5 w-8" />
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                          {p.parcel_id}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {p.au3_code}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {RIGHT_TYPE_OPTIONS.find(
                            (o) => o.value === p.right_type,
                          )?.label || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {p.landuse || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatArea(p.area_m2)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatArea(p.acquisition_area_m2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1">
                            {cashAmt > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400 tabular-nums w-fit">
                                Мөнгөн&nbsp;{cashAmt.toLocaleString()}₮
                              </span>
                            )}
                            {landGrantCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400 w-fit">
                                Газраар{landGrantAmt > 0 ? <>&nbsp;{landGrantAmt.toLocaleString()}₮</> : <>&nbsp;{landGrantCount}</>}
                              </span>
                            )}
                            {cashAmt === 0 && landGrantCount === 0 && (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {p.status_name ? (
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                              style={getParcelStatusStyle(p.status, p.status_name)}
                            >
                              {p.status_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                          {/* Мэрг. байгууллагад нөхөх олговрын үнэлгээний төлөвийг урсгал бүрээр харуулна */}
                          {isProfOrg && p.valuation_statuses && Object.keys(p.valuation_statuses).length > 0 && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {(Object.entries(p.valuation_statuses) as [ValuationType, ValuationStatus][]).map(([vt, vs]) => (
                                <span
                                  key={vt}
                                  className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${VAL_STATUS_CHIP[vs] ?? "bg-slate-100 text-slate-500"}`}
                                >
                                  {VALUATION_TYPE_LABELS[vt] ?? vt}: {VALUATION_STATUS_LABELS[vs] ?? vs}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isMainProfOrg && isAcqLocked ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 px-2.5 py-1 text-[11px] font-medium cursor-not-allowed select-none">
                                🔒 Хаалттай
                              </span>
                            ) : (
                              <Link
                                href={`/parcel/${p.id}?acq=${id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors"
                              >
                                <Info className="h-3 w-3" /> Дэлгэрэнгүй
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {parcels && parcels.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-[#37394d]">
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              {(parcels.page - 1) * parcels.page_size + 1}–
              {Math.min(parcels.page * parcels.page_size, parcels.total)} / {parcels.total}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
              >
                Өмнөх
              </button>
              <span className="text-[12px] text-slate-500 px-2">
                {parcels.page} / {parcels.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(parcels.total_pages, p + 1))}
                disabled={page >= parcels.total_pages}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
              >
                Дараах
              </button>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description}
        confirmLabel={pendingConfirm?.confirmLabel}
        confirmColor={pendingConfirm?.confirmColor}
        onConfirm={() => pendingConfirm?.onConfirm()}
        onClose={() => setPendingConfirm(null)}
      />
    </>
  );
}
