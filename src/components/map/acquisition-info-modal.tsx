"use client";
import { useQuery } from "@tanstack/react-query";
import { X, Layers, Map } from "lucide-react";
import { landApi } from "@/lib/api";
import { formatArea, formatDate } from "@/lib/utils";
import { STATUS_LABELS } from "@/types";
import { ProgressBadge } from "@/components/ui/progress-badge";

/**
 * ХИЛИЙН давхаргууд дээр дарахад гарах цонх.
 *
 * Газрын зураг дээрх "бусад" давхаргууд нь бүгд чөлөөлөлтийн/төлөвлөгөөний
 * ХИЛ (v_acquisition_plan, v_plan_acquisition, v_acquisition_boundary).
 * GeoServer тэдгээрээс зөвхөн plan_code/status/талбай буцаадаг тул
 * чөлөөлөлтийн бодит мэдээллийг `acquisition_id`-аар API-аас татаж харуулна.
 */

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-40 shrink-0 text-[11.5px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );
}

export default function AcquisitionInfoModal({
  acquisitionId,
  layerLabel,
  layerColor,
  onClose,
}: {
  acquisitionId: string;
  /** Дарсан давхаргын нэр — гарчигт харагдана */
  layerLabel: string;
  /** Дарсан давхаргын өнгө — цонхыг ҮҮГЭЭР бүдэг будна */
  layerColor: string;
  onClose: () => void;
}) {
  const { data: acq, isLoading, isError } = useQuery({
    queryKey: ["land", acquisitionId],
    queryFn: () => landApi.getById(acquisitionId),
    enabled: !!acquisitionId,
    retry: false,
    staleTime: 60_000,
  });

  const color = layerColor;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: `${color}14`, borderColor: `${color}55` }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${color}33` }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22` }}>
              <Layers className="h-4 w-4" style={{ color }} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-slate-800 dark:text-white">
                {acq?.acquisition_name || layerLabel}
              </p>
              <p className="text-[11px] font-semibold" style={{ color }}>
                {layerLabel}
                {acq?.status ? ` · ${STATUS_LABELS[acq.status] ?? ""}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white/70 px-5 py-3 dark:bg-[#1e1f27]/80">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-slate-200/60 dark:bg-white/10" />
              ))}
            </div>
          ) : isError || !acq ? (
            <p className="py-8 text-center text-[13px] text-slate-500">
              Мэдээлэл ачаалж чадсангүй — үзэх эрх байхгүй байж болзошгүй.
            </p>
          ) : (
            <>
              <Row label="Чөлөөлөлтийн нэр" value={acq.acquisition_name} />
              <Row
                label="Явц"
                value={
                  <span className="inline-flex items-center gap-2">
                    <ProgressBadge
                      percent={acq.progress_percent}
                      parcelCount={acq.parcel_count}
                      finalCount={acq.final_parcel_count}
                    />
                    <span className="text-[12px] text-slate-500">
                      {acq.parcel_count ?? 0} нэгж талбар
                    </span>
                  </span>
                }
              />
              <Row label="Ерөнхий ангилал" value={acq.general_category_name} />
              <Row label="Дэд ангилал" value={acq.sub_category_name} />
              <Row label="Хэрэгжүүлэгч байгууллага" value={acq.implementing_org} />
              <Row label="Чөлөөлөх талбай" value={formatArea(acq.area_m2)} />
              <Row
                label="Хугацаа"
                value={
                  acq.start_date || acq.end_date
                    ? `${acq.start_date ? formatDate(acq.start_date) : "—"} — ${acq.end_date ? formatDate(acq.end_date) : "—"}`
                    : undefined
                }
              />

              <div className="mt-2 border-t border-slate-100 pt-2 dark:border-[#37394d]">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  <Map className="h-3 w-3" /> Төлөвлөгөө
                </p>
                <Row
                  label="Нэгж талбарын дугаар"
                  value={acq.plan_parcel_id ? <span className="font-mono">{acq.plan_parcel_id}</span> : undefined}
                />
                <Row label="Төлөвлөгөөний дугаар" value={acq.plan_code} />
                <Row label="Төлөвлөгөөний нэр" value={acq.plan_name} />
                <Row label="Төлөвлөгөөний төрөл" value={acq.plan_type_name} />
                <Row label="Бүтээн байгуулалт" value={acq.plan_gazner} />
                <Row
                  label="Төлөвлөгөөний талбай"
                  value={(acq.plan_area_m2 ?? 0) > 0 ? formatArea(acq.plan_area_m2) : undefined}
                />
                <Row label="Батлагдсан" value={acq.plan_approved_date ? formatDate(acq.plan_approved_date) : undefined} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
