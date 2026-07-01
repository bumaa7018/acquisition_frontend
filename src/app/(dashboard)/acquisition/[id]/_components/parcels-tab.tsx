"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { landApi, parcelStatusApi } from "@/lib/api";
import { formatArea, getApiError } from "@/lib/utils";
import { canAccessParcel, getCurrentUserId, isExternalSpecialRole } from "@/lib/role-utils";
import { getParcelStatusStyle } from "@/types";
import type { Compensation, ParcelStatus } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "./confirm-dialog";

const RIGHT_TYPE_OPTIONS = [
  { value: 1, label: "Ашиглах" },
  { value: 2, label: "Эзэмших" },
  { value: 3, label: "Өмчлөх" },
];

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
  const currentUserId = getCurrentUserId();
  const isMainProfOrg = isExternal && acquisitionProfOrgId === currentUserId;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [filterForm, setFilterForm] = useState({
    parcel_id: "",
    right_type: 0,
    landuse: "",
    status_id: 0,
  });
  const [filter, setFilter] = useState({
    parcel_id: "",
    right_type: 0,
    landuse: "",
    status_id: 0,
  });
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null);
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);

  const { data: parcelStatuses = [] } = useQuery<ParcelStatus[]>({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
  });

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ["land-parcels", id, filter],
    queryFn: () =>
      landApi.getParcels(id, { page: 1, page_size: 100, ...filter }),
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", id],
    queryFn: () => landApi.listCompensations(id),
    enabled: !!id,
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

  const compsByParcel = allComps.reduce<Record<string, Compensation[]>>(
    (acc, c) => {
      (acc[c.parcel_id || ""] ??= []).push(c);
      return acc;
    },
    {},
  );

  const inp =
    "h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const visibleParcels = (parcels?.data ?? []).filter((parcel) =>
    canAccessParcel(
      parcel.status_name,
      acquisitionProfOrgId,
      parcel.independent_org_id,
    ),
  );

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
                {isExternal ? visibleParcels.length : (parcels?.total ?? 0)} нэгж талбар
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
                onClick={() => setFilter({ ...filterForm })}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-[#02c0ce] hover:bg-[#02aebb] transition-colors"
              >
                Хайх
              </button>
              {(filter.parcel_id ||
                filter.right_type !== 0 ||
                filter.landuse ||
                filter.status_id !== 0) && (
                <button
                  onClick={() => {
                    const empty = { parcel_id: "", right_type: 0, landuse: "", status_id: 0 };
                    setFilterForm(empty);
                    setFilter(empty);
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
                {visibleParcels.map((p) => {
                  const comps = compsByParcel[p.parcel_id] ?? [];
                  const isOpen = expandedParcel === p.id;
                  const cashAmt = comps
                    .filter((c) => c.compensation_type === "cash")
                    .reduce((s, c) => s + c.amount, 0);
                  const landGrantAmt = comps
                    .filter((c) => c.compensation_type === "land_grant")
                    .reduce((s, c) => s + c.amount, 0);
                  const landGrantCount = comps.filter((c) => c.compensation_type === "land_grant").length;

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
                            {comps.length === 0 && (
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
