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
 * Дэлгэрэнгүйг `acquisition_id`-аар API-аас татна.
 *
 * ГЭХДЭЭ API нь ХУВААРИЛАГДААГҮЙ чөлөөлөлт дээр 403 буцаадаг
 * (RequireAssignedOrSenior). "Үндсэн төлөвлөлтийн хил" давхарга нь тухайн
 * ТӨЛӨВЛӨГӨӨНИЙ БҮХ чөлөөлөлтийг ЗОРИУД харуулдаг тул хөршийн хил дээр дарах
 * нь бүрэн хэвийн үйлдэл — тэр үед цонх бүхэлдээ хоосорч, гарчигт нэрийн оронд
 * давхаргын нэр гарч, "үзэх эрх байхгүй байж болзошгүй" гэсэн эргэлзээтэй
 * мессеж үлддэг байв.
 *
 * Иймд GeoServer-ийн GetFeatureInfo-оос АЛЬ ХЭДИЙН ирсэн шинжүүдийг (`fallback`)
 * дамжуулж, дэлгэрэнгүй татагдаагүй ч НЭР, төлөвлөгөөний дугаар, төлөв, талбайг
 * харуулна. Мессеж нь эргэлзээгүй: хандах эрхгүй гэдгийг шууд хэлнэ.
 */

/** GeoServer-ийн хилийн давхаргаас ирдэг шинжүүд (view бүр өөр багцтай). */
export interface AcquisitionFeatureProps {
  acquisition_name?: string;
  plan_code?: string;
  status?: number;
  area_m2?: number;
  start_date?: string;
  end_date?: string;
}

/** GetFeatureInfo-ийн түүхий шинжийг цэгцэлнэ (утга нь текст ч, тоо ч байж болно). */
export function toAcquisitionFeatureProps(
  props: Record<string, unknown>,
): AcquisitionFeatureProps {
  const text = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
    return s ? s : undefined;
  };
  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    acquisition_name: text(props.acquisition_name),
    plan_code: text(props.plan_code),
    status: num(props.status),
    // v_acquisition_plan нь plan_area_m2, бусад нь area_m2 нэрээр буцаадаг.
    area_m2: num(props.area_m2) ?? num(props.plan_area_m2),
    start_date: text(props.start_date),
    end_date: text(props.end_date),
  };
}

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
  fallback,
  onClose,
}: {
  acquisitionId: string;
  /** Дарсан давхаргын нэр — гарчигт харагдана */
  layerLabel: string;
  /** Дарсан давхаргын өнгө — цонхыг ҮҮГЭЭР бүдэг будна */
  layerColor: string;
  /**
   * GeoServer-ийн GetFeatureInfo-оос ирсэн шинжүүд. Дэлгэрэнгүй татагдаагүй
   * (403 г.м.) үед НЭР болон үндсэн мөрүүд эндээс харагдана.
   */
  fallback?: AcquisitionFeatureProps;
  onClose: () => void;
}) {
  const { data: acq, isLoading, isError, error } = useQuery({
    queryKey: ["land", acquisitionId],
    // allow403 — хөрш чөлөөлөлт дээр дарах нь ХЭВИЙН тул глобал "Хандах эрхгүй"
    // анхааруулга гаргахгүй; цонх өөрөө доор тохирох мессежээ харуулна.
    queryFn: () => landApi.getById(acquisitionId, { allow403: true }),
    enabled: !!acquisitionId,
    retry: false,
    staleTime: 60_000,
  });

  const color = layerColor;
  // 403 = "энэ чөлөөлөлтөд хуваарилагдаагүй" — өгөгдөл байхгүй ГЭСЭН ҮГ БИШ.
  // Бусад алдаанаас (сүлжээ, 500) ялгаж, зөв шалтгааныг харуулна.
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const denied = isError && status === 403;
  // Дэлгэрэнгүй ирээгүй ч газрын зургаас ирсэн нэр байвал цонх хоосон биш.
  const name = acq?.acquisition_name || fallback?.acquisition_name;

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
                {name || layerLabel}
              </p>
              <p className="text-[11px] font-semibold" style={{ color }}>
                {layerLabel}
                {(() => {
                  const st = acq?.status ?? fallback?.status;
                  return st ? ` · ${STATUS_LABELS[st] ?? ""}` : "";
                })()}
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
            /*
             * Дэлгэрэнгүй ирээгүй — гэхдээ газрын зургаас ирсэн зүйлээ ХАРУУЛНА.
             * "Үндсэн төлөвлөлтийн хил" нь хөрш чөлөөлөлтүүдийг зориуд
             * харуулдаг тул энэ нь алдаа биш, ЭНГИЙН тохиолдол.
             */
            <>
              <div
                className="mb-3 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
                style={{ background: `${color}1a`, color: "inherit" }}
              >
                {denied
                  ? "Та энэ чөлөөлөлтөд хуваарилагдаагүй тул дэлгэрэнгүйг харах боломжгүй. Доор газрын зураг дээрх үндсэн мэдээлэл харагдаж байна."
                  : "Дэлгэрэнгүй мэдээлэл ачаалж чадсангүй. Доор газрын зураг дээрх үндсэн мэдээлэл харагдаж байна."}
              </div>
              <Row label="Чөлөөлөлтийн нэр" value={fallback?.acquisition_name} />
              <Row label="Төлөвлөгөөний дугаар" value={fallback?.plan_code} />
              <Row
                label="Төлөв"
                value={fallback?.status ? STATUS_LABELS[fallback.status] : undefined}
              />
              <Row
                label="Чөлөөлөх талбай"
                value={(fallback?.area_m2 ?? 0) > 0 ? formatArea(fallback?.area_m2) : undefined}
              />
              <Row
                label="Хугацаа"
                value={
                  fallback?.start_date || fallback?.end_date
                    ? `${fallback.start_date ? formatDate(fallback.start_date) : "—"} — ${fallback.end_date ? formatDate(fallback.end_date) : "—"}`
                    : undefined
                }
              />
            </>
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
