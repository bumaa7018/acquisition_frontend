"use client";
import { useQuery } from "@tanstack/react-query";
import { X, MapPin, Users, Banknote, FileText } from "lucide-react";
import { landApi, parcelApi } from "@/lib/api";
import { formatArea, formatDate } from "@/lib/utils";
import { getParcelStatusStyle } from "@/types";
import type { Compensation, ParcelHolder } from "@/types";

/**
 * Газрын зураг дээр НЭГЖ ТАЛБАР дарахад гарах дэлгэрэнгүй цонх.
 *
 * Өгөгдлийг ОДОО БАЙГАА endpoint-уудаас цуглуулна (шинэ API нэмээгүй):
 *   - getParcel      → дугаар, талбай, чөлөөлөх талбай, төлөв, эзэмшигчид
 *   - getById (acq)  → захирамжийн дугаар/огноо
 *   - listCompensations → газрын ба хөрөнгийн үнэлгээний дүн
 *   - listStatusHistory → төлөв солих ШАЛТГААН
 *
 * Дуудлагууд нь цонх нээгдэхэд л явна (enabled), тиймээс зураг дээр дарахгүй
 * бол ямар ч нэмэлт ачаалал үүсэхгүй.
 *
 * ЭРХ: parcel маршрутууд "хуваарилагдсан эсвэл ахлах" шалгалттай. Эрхгүй
 * хэрэглэгчид 403 ирнэ — тэр үед цонх алдааны мессеж харуулна (зураг дээрх
 * бүх талбарыг дарж үзэх боломж нээгдэхгүй).
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

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 px-5 py-3 dark:border-[#37394d]">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      {children}
    </div>
  );
}

function money(n: number) {
  return `${Math.round(n).toLocaleString()} ₮`;
}

export default function ParcelInfoModal({
  acquisitionId,
  parcelUuid,
  onClose,
}: {
  acquisitionId: string;
  /** parcel.id (UUID) — GeoServer-ийн feature-ийн `id` талбар */
  parcelUuid: string;
  onClose: () => void;
}) {
  const enabled = !!acquisitionId && !!parcelUuid;

  const { data: parcel, isLoading, isError } = useQuery({
    queryKey: ["parcel-full", acquisitionId, parcelUuid],
    queryFn: () => landApi.getParcel(acquisitionId, parcelUuid),
    enabled,
    retry: false,
  });

  const { data: acq } = useQuery({
    queryKey: ["land", acquisitionId],
    queryFn: () => landApi.getById(acquisitionId),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  // Нөхөх олговор — тухайн нэгж талбарынх. parcel_id нь КОД (UUID биш).
  const { data: comps = [] } = useQuery({
    queryKey: ["compensations", acquisitionId, parcel?.parcel_id],
    queryFn: () => landApi.listCompensations(acquisitionId, parcel!.parcel_id),
    enabled: enabled && !!parcel?.parcel_id,
    retry: false,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["parcel-status-history", acquisitionId, parcelUuid],
    queryFn: () => parcelApi.listStatusHistory(acquisitionId, parcelUuid),
    enabled,
    retry: false,
  });

  const style = getParcelStatusStyle(parcel?.status_id, parcel?.status_name ?? "");

  // Газрын үнэлгээ = нэгж талбарт (target_type "parcel"), хөрөнгийн үнэлгээ =
  // хөрөнгө бүрд (target_type "asset"). Зөвхөн ҮНДСЭН урсгалыг тооцно —
  // сонгоогүй бол бүх урсгалын нийлбэр төөрөгдүүлэх тул сонгосон нь давуу.
  const primary = parcel?.selected_valuation_type;
  const scoped = (c: Compensation) => !primary || !c.valuation_type || c.valuation_type === primary;
  const sum = (t: "parcel" | "asset") =>
    comps.filter((c) => c.target_type === t && scoped(c)).reduce((a, c) => a + (c.amount || 0), 0);
  const landTotal = sum("parcel");
  const assetTotal = sum("asset");

  // Үндсэн эзэмшигчид — итгэмжлэгдсэн төлөөлөгчийг оруулахгүй.
  const mainHolders: ParcelHolder[] = (parcel?.holders ?? []).filter(
    (h) => h.main_applicant && h.holder_role !== "representative",
  );

  // ОДООГИЙН төлөвт шилжихэд бичсэн шалтгаан. history нь status_date DESC
  // тул тухайн төлвийн ХАМГИЙН СҮҮЛИЙН мөр эхэлж таарна. Голдуу
  // "Нөлөөлөгдсөн гарсан"/"Татгалзсан" үед бөглөгддөг; бусад төлөвт хоосон.
  const currentReason =
    history.find((h) => h.status_id === parcel?.status_id && h.reason?.trim())?.reason ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Цонхны дэвсгэрийг ЯВЦЫН өнгөөр бүдэг будна (status.bg = өнгө + 1f alpha) */}
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: style.bg, borderColor: `${style.color}55` }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${style.color}33` }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${style.color}22` }}>
              <MapPin className="h-4 w-4" style={{ color: style.color }} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[14px] font-bold text-slate-800 dark:text-white">
                {parcel?.parcel_id || "Нэгж талбар"}
              </p>
              {parcel?.status_name && (
                <p className="text-[11px] font-semibold" style={{ color: style.color }}>
                  {parcel.status_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white/70 dark:bg-[#1e1f27]/80">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-slate-200/60 dark:bg-white/10" />
              ))}
            </div>
          ) : isError || !parcel ? (
            <p className="px-5 py-10 text-center text-[13px] text-slate-500">
              Мэдээлэл ачаалж чадсангүй — энэ нэгж талбарыг үзэх эрх байхгүй байж болзошгүй.
            </p>
          ) : (
            <>
              <div className="px-5 py-3">
                <Row label="Нэгж талбарын дугаар" value={<span className="font-mono">{parcel.parcel_id}</span>} />
                <Row label="Талбай" value={formatArea(parcel.area_m2)} />
                <Row label="Нөлөөлөлтөд өртсөн талбай" value={formatArea(parcel.acquisition_area_m2)} />
                <Row label="Явцын нэр" value={<span style={{ color: style.color }}>{parcel.status_name || "—"}</span>} />
                {/* Шалтгаан — байхгүй бол "—" харагдана (мөр нь үргэлж байна) */}
                <Row label="Шалтгаан" value={currentReason} />
              </div>

              <Section icon={FileText} title="Захирамж">
                <Row label="Захирамжийн дугаар" value={acq?.decree_number} />
                <Row label="Захирамжийн огноо" value={acq?.decree_date ? formatDate(acq.decree_date) : undefined} />
              </Section>

              <Section icon={Users} title="Үндсэн эзэмшигчид">
                {mainHolders.length === 0 ? (
                  <p className="py-1 text-[12.5px] text-slate-400">Бүртгэгдээгүй</p>
                ) : (
                  <div className="space-y-1.5">
                    {mainHolders.map((h) => (
                      <div key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                          {[h.last_name, h.name].filter(Boolean).join(" ").trim() || "—"}
                        </span>
                        {h.register_no && (
                          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-500 dark:bg-white/10 dark:text-slate-400">
                            {h.register_no}
                          </span>
                        )}
                        {h.phone && <span className="text-[11px] text-slate-400">📞 {h.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={Banknote} title="Нөхөх олговор">
                <Row label="Газрын үнэлгээ" value={landTotal > 0 ? money(landTotal) : undefined} />
                <Row label="Хөрөнгийн үнэлгээ" value={assetTotal > 0 ? money(assetTotal) : undefined} />
                <Row
                  label="Нийт"
                  value={
                    landTotal + assetTotal > 0 ? (
                      <span className="font-bold text-[#0acf97]">{money(landTotal + assetTotal)}</span>
                    ) : undefined
                  }
                />
              </Section>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
