"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { isExternalSpecialRole, isProfessionalOrg } from "@/lib/role-utils";
import { formatArea, formatDate, getApiError } from "@/lib/utils";
import { Banknote, Calculator, Gavel, Landmark, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ParcelBasePriceFactor, ParcelCourtDecision, ParcelFeeItem, ParcelInvoice, ParcelMortgage } from "@/types";

/**
 * "Барьцаа, төлбөр" таб — "Мэдээлэл татах"-аар ГУС-аас татагдаж хадгалагдсан
 * санхүү, эрх зүйн бүртгэлүүд.
 *
 * Гурвуулаа `parcel-full` хариултаас ирдэг тул нэмэлт хүсэлт хэрэггүй.
 */

const num = (v: number) => (v || 0).toLocaleString();

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">{text}</p>
  );
}

/** Хүснэгтгүй "нэр — утга" мөр (суурь үнийн карт). */
function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`tabular-nums ${strong ? "text-[13px] font-bold text-[#02c0ce]" : "text-slate-700 dark:text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  title, icon, count, action, children,
}: {
  title: string; icon: React.ReactNode; count?: number; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="ap-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[#02c0ce]">{icon}</span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </p>
        {!!count && (
          <span className="rounded-full bg-[#02c0ce]/10 px-2 py-0.5 text-[11px] font-semibold text-[#02c0ce]">
            {count}
          </span>
        )}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function RefreshButton({
  pending,
  onClick,
  label = "Шинэчлэх",
}: {
  pending: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/20 disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

/** Нэг барьцааны мөр. Давхар барьцаа нь эцгийнхээ дор доголтой харагдана. */
function MortgageRow({ item, nested }: { item: ParcelMortgage; nested?: boolean }) {
  const period = item.start_mortgage_period || item.end_mortgage_period
    ? `${item.start_mortgage_period ? formatDate(item.start_mortgage_period) : "—"} — ${item.end_mortgage_period ? formatDate(item.end_mortgage_period) : "—"}`
    : "";
  const isActiveStatus = String(item.status_id).trim() === "20";
  return (
    <div
      className={`rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#191b22] px-4 py-3 ${
        nested ? "ml-6 border-l-2 border-l-[#02c0ce]/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {nested && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-400">
            Давхар барьцаа
          </span>
        )}
        <span className="text-[13px] font-semibold text-slate-800 dark:text-white">
          {item.mortgage_contract_no || item.loan_contract_no || "—"}
        </span>
        {item.mortgage_type && (
          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {item.mortgage_type}
          </span>
        )}
        {item.status_name && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isActiveStatus
              ? "bg-[#02c0ce]/10 text-[#02c0ce]"
              : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
          }`}>
            {item.status_name}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
        {item.loan_contract_amount > 0 && (
          <span className="tabular-nums">
            Зээлийн дүн: {num(item.loan_contract_amount)} {item.unit_type}
          </span>
        )}
        {item.monetary_unit_value > 0 && (
          <span className="tabular-nums">Ханш: {num(item.monetary_unit_value)}</span>
        )}
        {period && <span>{period}</span>}
        {item.loan_contract_no && item.mortgage_contract_no && (
          <span>Зээлийн гэрээ: {item.loan_contract_no}</span>
        )}
      </div>
    </div>
  );
}

export function FinanceTab({ acqId, parcelId, isLocked = false }: { acqId: string; parcelId: string; isLocked?: boolean }) {
  const queryClient = useQueryClient();
  const isProfOrg = isProfessionalOrg();
  const isExternal = isExternalSpecialRole();
  const { data, isLoading } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => (isProfOrg ? profApi.profGetParcel(acqId, parcelId) : landApi.getParcel(acqId, parcelId)),
    enabled: !!acqId,
  });

  const invalidateParcel = () => {
    queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
  };
  const parcelCode = data?.parcel_id ?? "";
  const canSync = !isExternal && !isProfOrg && !isLocked && !!parcelCode;

  const invoiceSyncMutation = useMutation({
    mutationFn: () => landApi.syncParcelInvoices(acqId, parcelCode),
    onSuccess: () => {
      toast.success("Газрын төлбөрийн нэхэмжлэл шинэчлэгдлээ");
      invalidateParcel();
    },
    onError: (err) => toast.error(getApiError(err, "Газрын төлбөрийн нэхэмжлэл шинэчлэхэд алдаа гарлаа")),
  });
  const mortgageSyncMutation = useMutation({
    mutationFn: () => landApi.syncParcelMortgages(acqId, parcelCode),
    onSuccess: () => {
      toast.success("Барьцааны мэдээлэл шинэчлэгдлээ");
      invalidateParcel();
    },
    onError: (err) => toast.error(getApiError(err, "Барьцааны мэдээлэл шинэчлэхэд алдаа гарлаа")),
  });
  const courtSyncMutation = useMutation({
    mutationFn: () => landApi.syncParcelCourtDecisions(acqId, parcelCode),
    onSuccess: () => {
      toast.success("Шүүхийн шийдвэрийн мэдээлэл шинэчлэгдлээ");
      invalidateParcel();
    },
    onError: (err) => toast.error(getApiError(err, "Шүүхийн шийдвэрийн мэдээлэл шинэчлэхэд алдаа гарлаа")),
  });
  const feeSyncMutation = useMutation({
    mutationFn: () => landApi.syncParcelFee(acqId, parcelCode),
    onSuccess: (res) => {
      // status=false нь алдаа БИШ — ГУС төлбөрийг бодож чадаагүй шалтгаан.
      if (res && res.status === false) {
        toast.warning(res.msg || "Газрын төлбөр бодогдсонгүй");
      } else {
        toast.success("Газрын төлбөрийн бодолт шинэчлэгдлээ");
      }
      invalidateParcel();
    },
    onError: (err) => toast.error(getApiError(err, "Газрын төлбөр бодоход алдаа гарлаа")),
  });
  const basePriceSyncMutation = useMutation({
    mutationFn: () => landApi.syncParcelBasePrice(acqId, parcelCode),
    onSuccess: () => {
      toast.success("Газрын суурь үнэ шинэчлэгдлээ");
      invalidateParcel();
    },
    onError: (err) => toast.error(getApiError(err, "Газрын суурь үнэ шинэчлэхэд алдаа гарлаа")),
  });

  if (isLoading)
    return (
      <div className="ap-card p-5 animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
      </div>
    );
  if (!data)
    return <div className="ap-card p-10 text-center text-[13px] text-slate-400">Мэдээлэл олдсонгүй</div>;

  const invoices: ParcelInvoice[] = data.invoices ?? [];
  const mortgages: ParcelMortgage[] = data.mortgages ?? [];
  const courtDecisions: ParcelCourtDecision[] = data.court_decisions ?? [];
  const fees: ParcelFeeItem[] = data.fees ?? [];
  const factors: ParcelBasePriceFactor[] = data.base_price_factors ?? [];
  const basePricePerHa = data.detail?.base_price_per_ha;
  const hasBasePrice = basePricePerHa != null && basePricePerHa > 0;
  // Нийт төлбөр нь бүсүүдийн payment-ийн НИЙЛБЭР (ГУС-ийн total_payment-ыг
  // хадгалдаггүй — нэг л эх сурвалжтай байлгах нь зөрүү гарахаас сэргийлнэ).
  const feeTotal = fees.reduce((sum, v) => sum + (v.payment || 0), 0);
  // Өмчлөлийн газарт төлбөр БАЙДАГГҮЙ тул төлбөрийн картыг харуулахгүй
  // (тайлбар бичиг ч харуулахгүй) — суурь үнэ бүтэн өргөнөөр гарна.
  const isOwnership = data.detail?.right_type === 3;
  const landusePurpose = data.landuse_name
    ? `${data.landuse_name}${data.landuse ? ` (${data.landuse})` : ""}`
    : data.landuse || "—";

  // Эцэг барьцаа эхэлж, давхар барьцаа нь эцгийнхээ ард. Эцэг нь ирээгүй
  // "өнчин" давхар барьцааг ч алдалгүй үндсэн түвшинд харуулна.
  const parents = mortgages.filter((m) => !m.source_parent_id);
  const parentIds = new Set(parents.map((m) => m.source_id));
  const orphans = mortgages.filter((m) => m.source_parent_id && !parentIds.has(m.source_parent_id));
  const childrenOf = (id: string) => mortgages.filter((m) => m.source_parent_id === id);

  const totalAmount = invoices.reduce((sum, v) => sum + (v.amount || 0), 0);
  const totalPaid = invoices.reduce((sum, v) => sum + (v.paid_amount || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Зүүн: суурь үнэ (хүснэгтгүй) | Баруун: төлбөрийн бодолт.
          Өмчлөлийн газарт төлбөр байдаггүй тул суурь үнэ БҮТЭН өргөнөө эзэлнэ. */}
      <div className={`grid gap-5 ${isOwnership ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        <SectionCard
          title="Газрын суурь үнэ"
          icon={<Calculator className="h-4 w-4" />}
          action={
            // Суурь үнэ хадгалагдсан бол товч харуулахгүй — татах нь зөвхөн
            // мэдээлэл байхгүй үед л утгатай.
            canSync && !hasBasePrice ? (
              <RefreshButton
                pending={basePriceSyncMutation.isPending}
                onClick={() => basePriceSyncMutation.mutate()}
                label="Суурь үнэ татах"
              />
            ) : undefined
          }
        >
          <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
            <InfoRow
              label="Суурь үнэ /1га/"
              value={hasBasePrice ? `${num(basePricePerHa)}₮` : "—"}
              strong
            />
            <InfoRow label="Газрын зориулалт" value={landusePurpose} />
            <InfoRow label="Нийт талбай" value={formatArea(data.area_m2)} />
            {data.detail?.valuation_zone ? (
              <InfoRow label="Үнэлгээний бүс" value={data.detail.valuation_zone} />
            ) : null}
          </div>

          {/* Үнэлгээний хүчин зүйл — нэр дотроо хэмжих нэгжээ агуулдаг тул
              (ж: "Гадаргын налуу/гр/") утгыг зөвхөн тоогоор харуулна. */}
          {factors.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-[#37394d]">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Үнэлгээний хүчин зүйл
                <span className="ml-1 font-normal normal-case tracking-normal">({factors.length})</span>
              </p>
              <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                {factors.map((f) => (
                  <div
                    key={f.factor_id}
                    className={`flex items-baseline justify-between gap-2 border-b border-slate-50 py-0.5 text-[11.5px] last:border-0 dark:border-[#2a2c38] ${
                      f.in_active === false ? "opacity-50" : ""
                    }`}
                    title={f.factor_code}
                  >
                    <span className="truncate text-slate-500 dark:text-slate-400">{f.factor_name}</span>
                    <span className="shrink-0 tabular-nums font-medium text-slate-700 dark:text-slate-200">
                      {f.factor_value != null ? f.factor_value.toLocaleString() : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {!isOwnership && (
          <SectionCard
            title="Газрын төлбөрийн бодолт"
            icon={<Banknote className="h-4 w-4" />}
            count={fees.length}
            action={
              canSync ? (
                <RefreshButton
                  pending={feeSyncMutation.isPending}
                  onClick={() => feeSyncMutation.mutate()}
                  label="Төлбөр татах"
                />
              ) : undefined
            }
          >
            {fees.length === 0 ? (
              <EmptyRow text="Байхгүй" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#37394d]">
                      {["Бүсийн төрөл", "Ашиглаж буй талбай (м²)", "Бүсийн талбай (м²)", "1м² төлбөр (₮)", "Төлбөр (₮)"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((v, i) => (
                      <tr key={`${v.zone_id}-${i}`} className="border-b border-slate-50 dark:border-[#37394d] last:border-0">
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          {v.zone_type || "—"}
                          {v.zone_name && (
                            <span className="ml-1.5 text-[11px] text-slate-400 dark:text-slate-500">{v.zone_name}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{num(v.landuse_area)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{num(v.zone_area)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{num(v.base_fee_per_m2)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-800 dark:text-white">{num(v.payment)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-[#37394d]">
                      <td className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Нийт
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                        {num(fees.reduce((s, v) => s + (v.landuse_area || 0), 0))}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                        {num(fees.reduce((s, v) => s + (v.zone_area || 0), 0))}
                      </td>
                      <td />
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[#02c0ce]">{num(feeTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* Газрын төлбөр */}
      <SectionCard
        title="Газрын төлбөрийн нэхэмжлэл"
        icon={<Banknote className="h-4 w-4" />}
        count={invoices.length}
        action={canSync ? <RefreshButton pending={invoiceSyncMutation.isPending} onClick={() => invoiceSyncMutation.mutate()} /> : undefined}
      >
        {invoices.length === 0 ? (
          <EmptyRow text="Байхгүй" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#37394d]">
                    {["Нэхэмжлэл", "Утга", "Дүн", "Төлсөн", "Үлдэгдэл", "Төлөв"].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((v) => {
                    const rest = (v.amount || 0) - (v.paid_amount || 0);
                    // Зөвхөн 2, 3 төлөвтэй нэхэмжлэлийг анхаарал татахаар улаанаар
                    // тэмдэглэнэ — бусад бүх төлөв хэвийн (сааралдуу) харагдана.
                    const isAlertStatus = v.status_id === 2 || v.status_id === 3;
                    return (
                      <tr key={v.invoice_no} className="border-b border-slate-50 dark:border-[#37394d] last:border-0">
                        <td className="px-2 py-2.5 font-mono text-[12px] text-slate-700 dark:text-slate-200">{v.invoice_no}</td>
                        <td className="px-2 py-2.5 text-slate-600 dark:text-slate-300">{v.description || "—"}</td>
                        <td className="px-2 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{num(v.amount)}</td>
                        <td className="px-2 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{num(v.paid_amount)}</td>
                        <td className={`px-2 py-2.5 tabular-nums font-semibold ${rest > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {num(rest)}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isAlertStatus
                              ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
                              : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                          }`}>
                            {v.status_name || v.status_id}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-[12px] dark:border-[#37394d]">
              <span className="text-slate-500 dark:text-slate-400">Нийт дүн: <b className="tabular-nums text-slate-700 dark:text-slate-200">{num(totalAmount)}₮</b></span>
              <span className="text-slate-500 dark:text-slate-400">Төлсөн: <b className="tabular-nums text-emerald-600 dark:text-emerald-400">{num(totalPaid)}₮</b></span>
              <span className="text-slate-500 dark:text-slate-400">Үлдэгдэл: <b className="tabular-nums text-rose-600 dark:text-rose-400">{num(totalAmount - totalPaid)}₮</b></span>
            </div>
          </>
        )}
      </SectionCard>

      {/* Барьцаа */}
      <SectionCard
        title="Барьцааны мэдээлэл"
        icon={<Landmark className="h-4 w-4" />}
        count={mortgages.length}
        action={canSync ? <RefreshButton pending={mortgageSyncMutation.isPending} onClick={() => mortgageSyncMutation.mutate()} /> : undefined}
      >
        {mortgages.length === 0 ? (
          <EmptyRow text="Байхгүй" />
        ) : (
          <div className="space-y-2">
            {parents.map((parent) => (
              <div key={parent.id} className="space-y-2">
                <MortgageRow item={parent} />
                {childrenOf(parent.source_id).map((child) => (
                  <MortgageRow key={child.id} item={child} nested />
                ))}
              </div>
            ))}
            {orphans.map((item) => (
              <MortgageRow key={item.id} item={item} nested />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Шүүхийн шийдвэр */}
      <SectionCard
        title="Шүүхийн шийдвэрийн мэдээлэл"
        icon={<Gavel className="h-4 w-4" />}
        count={courtDecisions.length}
        action={canSync ? <RefreshButton pending={courtSyncMutation.isPending} onClick={() => courtSyncMutation.mutate()} /> : undefined}
      >
        {courtDecisions.length === 0 ? (
          <EmptyRow text="Байхгүй" />
        ) : (
          <div className="space-y-2">
            {courtDecisions.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#191b22] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-white">
                    {d.court_decision_no || "—"}
                  </span>
                  {d.status_name && (
                    <span className="ml-auto rounded-full bg-[#02c0ce]/10 px-2 py-0.5 text-[11px] font-semibold text-[#02c0ce]">
                      {d.status_name}
                    </span>
                  )}
                </div>
                {(d.start_period || d.end_period) && (
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    {d.start_period ? formatDate(d.start_period) : "—"} — {d.end_period ? formatDate(d.end_period) : "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
