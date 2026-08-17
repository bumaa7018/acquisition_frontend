"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { isExternalSpecialRole, isProfessionalOrg } from "@/lib/role-utils";
import { formatDate, getApiError } from "@/lib/utils";
import { Banknote, Gavel, Landmark, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ParcelCourtDecision, ParcelInvoice, ParcelMortgage } from "@/types";

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
}: {
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/20 disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      Шинэчлэх
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
                    const isAllowedStatus = v.status_id === 20 || v.status_id === 30;
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
                            isAllowedStatus
                              ? "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                              : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
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
