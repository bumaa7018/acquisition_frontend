/**
 * «Он цагийн зураг» — газрын зургийн бүтэн дэлгэцийн хураангуйтай (AcquisitionOverviewPanel)
 * ИЖИЛ статистикийг СОНГОСОН САРЫН байдлаар угсарна. Хугацаанаас хамаарах
 * хэсгийг (явц, гүйцэтгэл, олговор, захирамж, сарын график, үнэлгээний бүтэц)
 * Он цагийн зурагын өгөгдлөөс, бусдыг (ангилал, байршил, хариуцагч…) дашбоардын
 * хариунаас (base) авна. Цэвэр функц — Node тестээр шалгагдана.
 */
import type { DashboardData } from "@/lib/api";
import type { FinanceDashboardData, LandAcquisition, ParcelStatus } from "@/types";
import { CHRONOS_NOT_STARTED, monthKey, statsAt, statusAt, type ChronosData } from "@/lib/chronos";

const upTo = (date: string | null | undefined, key: string) => !!date && monthKey(date) <= key;

/** Түүх нь эхлээгүй нэгж талбарын псевдо төлөв (явцын жагсаалт, өнгө). */
export const NOT_STARTED_STATUS_ID = -1;

export function overviewAt(
  base: DashboardData | undefined,
  baseFinance: FinanceDashboardData | null | undefined,
  chronos: ChronosData,
  key: string,
): { data: DashboardData; finance: FinanceDashboardData } {
  const statuses = chronos.statuses ?? [];
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const stats = statsAt(chronos.parcels, statuses, key);

  // Чөлөөлөлт бүрийн гүйцэтгэл — тухайн сарын байдлаар эцсийн төлөвт байгаа нэгж талбар.
  const perAcq = new Map<string, { name: string; total: number; final: number }>();
  const timeline: { date: string; count: number }[] = [];
  let land = 0, realState = 0, property = 0;
  for (const p of chronos.parcels) {
    const row = perAcq.get(p.acquisition_id) ?? { name: p.acquisition_name, total: 0, final: 0 };
    row.total++;
    const st = byId.get(statusAt(p.events, key) ?? NaN);
    if (st?.is_final) row.final++;
    perAcq.set(p.acquisition_id, row);
    // Сарын график — тухайн сар хүртэл АНХ чөлөөлсөн огноо.
    const rel = p.events.find((e) => byId.get(e.status_id)?.is_released);
    if (rel && upTo(rel.date, key)) timeline.push({ date: rel.date.slice(0, 10).replaceAll("-", "."), count: 1 });
    if (upTo(p.comp_at, key)) {
      land += p.comp_land || 0;
      realState += p.comp_real_state || 0;
      property += p.comp_property || 0;
    }
  }
  const acqProgress = (id: string, fallbackCount: number) => {
    const r = perAcq.get(id);
    const total = r?.total ?? fallbackCount;
    const final = r?.final ?? 0;
    return { parcel_count: total, final_parcel_count: final, progress_percent: total ? Math.round((final * 100) / total) : 0 };
  };
  const acquisitions: LandAcquisition[] = base?.acquisitions?.length
    ? base.acquisitions.map((a) => ({ ...a, ...acqProgress(a.id, a.parcel_count) }))
    : Array.from(perAcq.entries()).map(([id, r]) => ({ id, acquisition_name: r.name, ...acqProgress(id, r.total) }) as LandAcquisition);

  // Захирамжийн төсөл — тухайн сарын байдлаарх явц (дашбоардтай ижил ангилал).
  const decisions = { total: 0, confirmed: 0, confirming: 0, reviewing: 0, draft: 0 };
  for (const d of chronos.decisions ?? []) {
    if (!upTo(d.created_at, key)) continue;
    decisions.total++;
    if (upTo(d.confirmed_at, key)) {
      decisions.confirmed++;
      continue;
    }
    const last = [...d.events].reverse().find((e) => upTo(e.date, key));
    if (last?.type === "confirming") decisions.confirming++;
    else if (last?.type === "reviewing") decisions.reviewing++;
    else decisions.draft++;
  }

  const parcelStatuses: ParcelStatus[] = [
    ...(base?.parcel_statuses?.length
      ? base.parcel_statuses
      : statuses.map((s) => ({ id: s.id, code: s.code ?? "", name: s.name, color: s.color, sort_order: s.sort_order }) as ParcelStatus)),
    { id: NOT_STARTED_STATUS_ID, code: "not_started", name: "Чөлөөлөгдөөгүй (түүх эхлээгүй)", color: CHRONOS_NOT_STARTED, sort_order: -1 } as ParcelStatus,
  ];
  const statusBreakdown = [
    ...(stats.unknown
      ? [{ status_id: NOT_STARTED_STATUS_ID, name: "Чөлөөлөгдөөгүй (түүх эхлээгүй)", count: stats.unknown, area_m2: 0 }]
      : []),
    ...stats.byStatus.map((r) => ({ status_id: r.status.id, name: r.status.name, count: r.count, area_m2: r.areaM2 })),
  ];

  const data: DashboardData = {
    ...(base ?? ({} as DashboardData)),
    acquisitions,
    parcel_statuses: parcelStatuses,
    total_parcels: stats.total,
    freed_parcels: stats.released,
    freed_area_m2: stats.releasedAreaM2,
    plan_area_m2: base?.plan_area_m2 ?? 0,
    total_orders: decisions.confirmed,
    total_compensation: stats.compTotal,
    decisions,
    compensation: {
      total: stats.compTotal,
      issued: stats.compIssued,
      approved: stats.compApproved,
      unapproved: stats.compUnapproved,
    },
    status_breakdown: statusBreakdown,
    timeline,
    filtered_parcel_ids: base?.filtered_parcel_ids ?? [],
    filtered_au1_codes: base?.filtered_au1_codes ?? [],
    filtered_au2_codes: base?.filtered_au2_codes ?? [],
    filtered_au3_codes: base?.filtered_au3_codes ?? [],
  };
  const finance = {
    ...(baseFinance ?? ({} as FinanceDashboardData)),
    land_amount: land,
    real_state_amount: realState,
    property_amount: property,
    funding_by_type: baseFinance?.funding_by_type ?? [],
  } as FinanceDashboardData;
  return { data, finance };
}
