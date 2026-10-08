"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react";
import { dashboardApi, type DashboardData } from "@/lib/api";
import { getParcelStatusStyle, type FinanceDashboardData } from "@/types";
import { monthlyTimeline } from "@/lib/timeline-months";
import { cn, formatBillion } from "@/lib/utils";
import { AbbrevAmount } from "@/components/ui/amount-hint";

const ACQ_STATUS_LABEL: Record<number, string> = {
  1: "Шинэ",
  2: "Хээрийн судалгаа",
  3: "Баталгаажсан",
  4: "Цуцлагдсан",
};

const VALUATION_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Ноорог", color: "#64748b" },
  submitted: { label: "Илгээсэн", color: "#f59e0b" },
  approved: { label: "Баталгаажсан", color: "#0acf97" },
  returned: { label: "Буцаагдсан", color: "#f1556c" },
  rejected: { label: "Татгалзсан", color: "#94a3b8" },
};

const VALUATION_TYPE_LABEL: Record<string, string> = {
  asset: "Хөрөнгийн үнэлгээ",
  independent: "Хөндлөнгийн үнэлгээ",
  mika: "МИКА үнэлгээ",
};

/**
 * Самбар нээлттэй үед газрын зургийн зүүн булангийн товчнуудыг (2D/3D,
 * бүтэн дэлгэц) самбарын баруун тал руу шилжүүлэх зай: left-3 + 440px + 12px.
 */
export const OVERVIEW_PANEL_SHIFT = "left-[464px]";

const fmtDate = (d?: string) => (d ? d.slice(0, 10) : "");

const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 100) / total) : 0);
const ha = (m2: number) => (m2 / 10_000).toLocaleString("mn-MN", { maximumFractionDigits: 2 });

/**
 * Газрын зургийг БҮТЭН ДЭЛГЭЦЭЭР харах үед зүүн талд гарах хураангуй —
 * ерөнхий мэдээлэл, нэгж талбарын явц, нөхөх олговор (олголтын шат, бүтэц,
 * эх үүсвэр), үнэлгээ, захирамж, сараар чөлөөлсөн байдал.
 * Өгөгдөл нь дашбоардын API-аас (дашбоард дээр бэлэн, чөлөөлөлтийн хуудсанд
 * `useAcquisitionOverview`-ээр).
 */
export function AcquisitionOverviewPanel({
  data,
  finance,
  loading,
  title,
  subtitle,
  years = [],
  showYears = false,
}: {
  data?: DashboardData;
  /** Санхүүжилт — нэг чөлөөлөлт сонгосон үед (эрхгүй бол null). */
  finance?: FinanceDashboardData | null;
  loading?: boolean;
  title: string;
  subtitle?: string;
  /** Сарын графикийн хүрээ (сонгосон он); хоосон бол өгөгдлийн хүрээ. */
  years?: number[];
  /** Сонгосон оныг толгойд ТОД тэмдгээр харуулах (дашбоардын шүүлт). */
  showYears?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const statuses = useMemo(() => {
    const colors = new Map((data?.parcel_statuses ?? []).map((s) => [s.id, s.color]));
    return (data?.status_breakdown ?? [])
      .filter((s) => s.count > 0)
      .map((s) => ({
        id: s.status_id,
        name: s.name,
        count: s.count,
        area: s.area_m2,
        color: colors.get(s.status_id) || getParcelStatusStyle(s.status_id, s.name).color,
      }));
  }, [data?.parcel_statuses, data?.status_breakdown]);

  const months = useMemo(() => monthlyTimeline(data?.timeline ?? [], years), [data?.timeline, years]);
  const monthTotal = months.reduce((s, m) => s + m.count, 0);

  const acqs = useMemo(() => data?.acquisitions ?? [], [data?.acquisitions]);
  const single = acqs.length === 1 ? acqs[0] : null;
  const total = data?.total_parcels ?? 0;
  const finalCount = acqs.reduce((s, a) => s + (a.final_parcel_count ?? 0), 0);
  const parcelCountAll = acqs.reduce((s, a) => s + (a.parcel_count ?? 0), 0);
  const progress = pct(finalCount, parcelCountAll);
  const freed = data?.freed_parcels ?? 0;
  const comp = data?.compensation;
  const compTotal = comp?.total ?? data?.total_compensation ?? 0;
  const dec = data?.decisions;
  const valStatuses = (data?.valuation_statuses ?? []).filter((v) => v.count > 0);
  const valTypes = (data?.valuation_types ?? []).filter((v) => v.count > 0 || v.amount > 0);
  // Олон чөлөөлөлт шүүсэн үед — гүйцэтгэлээр эрэмбэлсэн жагсаалт.
  const acqProgress = useMemo(
    () =>
      acqs.length > 1
        ? [...acqs]
            .map((a) => ({ id: a.id, name: a.acquisition_name || a.plan_code, parcels: a.parcel_count ?? 0, pct: a.parcel_count ? (a.progress_percent ?? 0) : 0 }))
            .sort((a, b) => b.pct - a.pct || b.parcels - a.parcels)
        : [],
    [acqs],
  );
  const acqBuckets = acqProgress.reduce(
    (c, a) => (a.pct >= 100 ? { ...c, full: c.full + 1 } : a.pct > 0 ? { ...c, partial: c.partial + 1 } : { ...c, fresh: c.fresh + 1 }),
    { full: 0, partial: 0, fresh: 0 },
  );
  const structure = finance
    ? [
        { label: "Газар", color: "#0acf97", value: finance.land_amount },
        { label: "Үл хөдлөх хөрөнгө", color: "#0f9ed5", value: finance.real_state_amount },
        { label: "Эд хөрөнгө", color: "#f9bc0b", value: finance.property_amount },
      ].filter((x) => x.value > 0)
    : [];
  const structureTotal = structure.reduce((s, x) => s + x.value, 0);
  const funding = (finance?.funding_by_type ?? []).filter((f) => f.amount > 0);
  const locations = (data?.locations ?? []).filter((l) => l.district);

  return (
    <div
      className={cn("absolute bottom-3 left-3 top-3 z-20 flex w-[440px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur dark:border-[#37394d] dark:bg-[#1e1f27]/95", collapsed && "bottom-auto")}
      // Самбар дээрх товшилт/гүйлгэлт газрын зургийг хөдөлгөхгүй.
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#37394d]">
        <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-[#02c0ce]" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-bold leading-snug text-slate-800 dark:text-white">{title}</p>
          {showYears && (
            <span className="mt-1.5 inline-flex items-center rounded-md bg-[#02c0ce] px-2 py-0.5 text-[13px] font-bold tabular-nums text-white shadow-sm">
              {years.length > 0 ? `${[...years].sort((a, b) => a - b).join(", ")} он` : "Бүх он"}
            </span>
          )}
          {(subtitle || single) && (
            <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-slate-400">
              {[subtitle, single ? ACQ_STATUS_LABEL[single.status] : ""].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Дэлгэх" : "Хураах"}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#252630]"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading && !data ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
              ))}
            </div>
          ) : !data ? (
            <p className="text-[12px] text-slate-500">Мэдээлэл алга</p>
          ) : (
            <>
              {/* Гол үзүүлэлтүүд */}
              <div className="grid grid-cols-4 gap-1.5">
                <Kpi label="Нийт нэгж талбар" value={total.toLocaleString()} />
                <Kpi label="Чөлөөлсөн" value={`${freed.toLocaleString()}`} hint={`${pct(freed, total)}%`} tone="good" />
                <Kpi
                  label="Чөлөөлсөн талбай"
                  value={`${ha(data.freed_area_m2 ?? 0)} га`}
                  hint={data.plan_area_m2 ? `/ ${ha(data.plan_area_m2)} га` : undefined}
                />
                <Kpi label="Захирамж" value={`${(dec?.confirmed ?? 0).toLocaleString()}`} hint={dec ? `/ ${dec.total} төсөл` : undefined} />
              </div>

              {/* Ерөнхий мэдээлэл */}
              {(single || locations.length > 0) && (
                <Section title="Ерөнхий">
                  <dl className="space-y-1 text-[12px]">
                    {single?.general_category_name && (
                      <InfoRow label="Ангилал" value={[single.general_category_name, single.sub_category_name].filter(Boolean).join(" › ")} />
                    )}
                    {(single?.start_date || single?.end_date) && (
                      <InfoRow label="Хугацаа" value={`${fmtDate(single?.start_date) || "—"} – ${fmtDate(single?.end_date) || "—"}`} />
                    )}
                    {locations.length > 0 && (
                      <div className="flex items-start gap-2">
                        <dt className="w-[110px] shrink-0 text-slate-400">Байршил</dt>
                        <dd className="min-w-0 flex-1 space-y-0.5 font-medium text-slate-700 dark:text-slate-200">
                          {locations.map((l) => (
                            <p key={l.district} className="break-words">
                              {l.district}
                              {l.khoroos.length > 0 && <span className="font-normal text-slate-500 dark:text-slate-400">, {l.khoroos.join(", ")}</span>}
                            </p>
                          ))}
                        </dd>
                      </div>
                    )}
                    {single && acqs.length === 1 && single.area_m2 > 0 && <InfoRow label="Талбай" value={`${ha(single.area_m2)} га`} />}
                    {!!single?.assigned_users?.length && (
                      <InfoRow label="Хариуцагч" value={single.assigned_users.map((u) => u.user_name).filter(Boolean).join(", ")} />
                    )}
                    {single?.professional_org_name && <InfoRow label="Мэргэжлийн байгууллага" value={single.professional_org_name} />}
                    {single?.implementing_org && <InfoRow label="Хэрэгжүүлэгч" value={single.implementing_org} />}
                    {single?.decree_number && (
                      <InfoRow label="Шийдвэр" value={[single.decree_number, fmtDate(single.decree_date)].filter(Boolean).join(" · ")} />
                    )}
                  </dl>
                  {(single?.overlapping_parcel_count ?? 0) > 0 && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                      Байршлаар давхцсан {single?.overlapping_parcel_count} нэгж талбар байна
                    </p>
                  )}
                </Section>
              )}

              {/* Олон чөлөөлөлт — гүйцэтгэлээр */}
              {acqProgress.length > 0 && (
                <Section title="Чөлөөлөлтүүд" right={`${acqProgress.length}`}>
                  <div className="mb-2 grid grid-cols-3 gap-1.5 text-center">
                    <DecisionChip label="Бүрэн чөлөөлсөн" value={acqBuckets.full} color="#0acf97" />
                    <DecisionChip label="Хэрэгжиж буй" value={acqBuckets.partial} color="#f9bc0b" />
                    <DecisionChip label="Эхлээгүй" value={acqBuckets.fresh} color="#98a6ad" />
                  </div>
                  <ul className="space-y-1.5">
                    {acqProgress.slice(0, 10).map((a) => (
                      <li key={a.id} className="text-[12px]">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">{a.name}</span>
                          <span className="shrink-0 tabular-nums font-semibold text-slate-800 dark:text-white">{a.pct}%</span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                          <div className="h-full bg-[#02c0ce]" style={{ width: `${Math.min(100, a.pct)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {acqProgress.length > 10 && <p className="mt-1 text-[11px] text-slate-400">… бусад {acqProgress.length - 10}</p>}
                </Section>
              )}

              {/* Нэгж талбар — явцаар */}
              <Section title="Нэгж талбар явцаар" right={parcelCountAll > 0 ? `Гүйцэтгэл ${progress}%` : undefined}>
                {statuses.length === 0 ? (
                  <p className="text-[12px] text-slate-500">Нэгж талбар алга</p>
                ) : (
                  <>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                      {statuses.map((s) => (
                        <div key={s.id} style={{ width: `${pct(s.count, total)}%`, background: s.color }} title={`${s.name}: ${s.count}`} />
                      ))}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {statuses.map((s) => (
                        <li key={s.id} className="flex items-start gap-2 text-[12px]">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                          <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">{s.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-white">{s.count.toLocaleString()}</span>
                          <span className="w-9 shrink-0 text-right tabular-nums text-slate-400">{pct(s.count, total)}%</span>
                          <span className="w-16 shrink-0 text-right tabular-nums text-slate-400">{ha(s.area)} га</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>

              {/* Нөхөх олговор */}
              <Section title="Нөхөх олговор">
                <p className="text-[18px] font-bold tabular-nums text-slate-800 dark:text-white">
                  <AbbrevAmount value={compTotal}>{formatBillion(compTotal)}</AbbrevAmount>
                </p>
                {comp && (
                  <ul className="mt-1.5 space-y-1 text-[12px]">
                    <MoneyRow color="#0acf97" label="Захирамж гарсан" value={comp.issued} />
                    <MoneyRow color="#0f9ed5" label="Төсөлд байгаа · үнэлгээ баталгаажсан" value={comp.approved} />
                    <MoneyRow color="#f9bc0b" label="Үнэлгээ баталгаажаагүй" value={comp.unapproved} />
                  </ul>
                )}
              </Section>

              {/* Үнэлгээний бүтэц */}
              {structureTotal > 0 && (
                <Section title="Үнэлгээний бүтэц">
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                    {structure.map((x) => (
                      <div key={x.label} style={{ width: `${pct(x.value, structureTotal)}%`, background: x.color }} />
                    ))}
                  </div>
                  <ul className="mt-2 space-y-1 text-[12px]">
                    {structure.map((x) => (
                      <MoneyRow key={x.label} color={x.color} label={`${x.label} · ${pct(x.value, structureTotal)}%`} value={x.value} />
                    ))}
                  </ul>
                </Section>
              )}

              {/* Санхүүжилтийн эх үүсвэр */}
              {funding.length > 0 && (
                <Section title="Санхүүжилтийн эх үүсвэр">
                  <ul className="space-y-1 text-[12px]">
                    {funding.map((f, i) => (
                      <MoneyRow key={f.key || f.name} color={["#02c0ce", "#777edd", "#f9bc0b", "#0acf97", "#f1556c"][i % 5]} label={f.name || "—"} value={f.amount} />
                    ))}
                  </ul>
                </Section>
              )}

              {/* Үнэлгээ */}
              {(valStatuses.length > 0 || valTypes.length > 0) && (
                <Section title="Үнэлгээ">
                  {valStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {valStatuses.map((v) => {
                        const meta = VALUATION_STATUS[v.status] ?? { label: v.status, color: "#64748b" };
                        return (
                          <span key={v.status} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${meta.color}1f`, color: meta.color }}>
                            {meta.label} <b className="tabular-nums">{v.count}</b>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {valTypes.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[12px]">
                      {valTypes.map((v) => (
                        <li key={v.valuation_type} className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">
                            {VALUATION_TYPE_LABEL[v.valuation_type] ?? v.valuation_type}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-500">{v.count}</span>
                          <span className="w-[92px] shrink-0 text-right font-semibold tabular-nums text-slate-800 dark:text-white">
                            <AbbrevAmount value={v.amount}>{formatBillion(v.amount)}</AbbrevAmount>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {/* Захирамжийн төсөл — явцаар */}
              {dec && dec.total > 0 && (
                <Section title="Захирамжийн төсөл" right={`${dec.total}`}>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <DecisionChip label="Төсөл" value={dec.draft} color="#98a6ad" />
                    <DecisionChip label="Хянагдаж буй" value={dec.reviewing} color="#777edd" />
                    <DecisionChip label="Батлах" value={dec.confirming} color="#f9bc0b" />
                    <DecisionChip label="Батлагдсан" value={dec.confirmed} color="#0acf97" />
                  </div>
                </Section>
              )}

              {/* Сараар чөлөөлсөн */}
              <Section title="Сараар чөлөөлсөн нэгж талбар" right={monthTotal > 0 ? `${monthTotal}` : undefined}>
                {monthTotal === 0 ? (
                  <p className="text-[12px] text-slate-500">Чөлөөлсөн нэгж талбар алга</p>
                ) : (
                  <div className="h-[130px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip
                          cursor={{ fill: "rgba(2,192,206,0.08)" }}
                          formatter={(v: unknown) => [`${v} нэгж талбар`, "Чөлөөлсөн"]}
                          contentStyle={{ fontSize: 12, borderRadius: 6 }}
                        />
                        <Bar dataKey="count" fill="#0acf97" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</h3>
        {right && <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-[110px] shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.03]">
      <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-[16px] font-bold leading-tight tabular-nums text-slate-800 dark:text-white", tone === "good" && "text-[#0acf97] dark:text-[#0acf97]")}>
        {value}
        {hint && <span className="ml-1 text-[11px] font-medium text-slate-400">{hint}</span>}
      </p>
    </div>
  );
}

function MoneyRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-white">
        <AbbrevAmount value={value}>{formatBillion(value)}</AbbrevAmount>
      </span>
    </li>
  );
}

function DecisionChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-1.5 dark:bg-white/[0.03]">
      <p className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

/**
 * Нэг чөлөөлөлтийн хураангуй (чөлөөлөлтийн хуудасны газрын зураг) — газрын
 * зураг бүтэн дэлгэцэд орох үед л татна. Санхүүгийн хэсэг эрхгүй бол (403) нуугдана.
 */
export function useAcquisitionOverview(acquisitionId: string, enabled: boolean) {
  const dash = useQuery({
    queryKey: ["map-overview", "dashboard", acquisitionId],
    queryFn: () => dashboardApi.get({ acquisition_id: acquisitionId }, { silent: true }),
    enabled: enabled && !!acquisitionId,
    staleTime: 60_000,
  });
  const finance = useQuery({
    queryKey: ["map-overview", "finance", acquisitionId],
    queryFn: () => dashboardApi.finance({ acquisition_id: acquisitionId }, { silent: true }),
    enabled: enabled && !!acquisitionId,
    staleTime: 60_000,
    retry: false,
  });
  return { data: dash.data, finance: finance.data ?? null, loading: dash.isLoading };
}
