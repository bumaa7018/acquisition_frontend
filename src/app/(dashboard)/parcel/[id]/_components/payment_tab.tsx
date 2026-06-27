"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi } from "@/lib/api";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import { X, Plus, Wallet, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { TARGET_TYPE_LABELS, COMP_TYPE_LABELS, INP } from "./constants";

export function PaymentTab({
  parcelId,
  acqId,
  parcelCode,
}: {
  parcelId: string;
  acqId: string;
  parcelCode: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "MNT", paid_at: "", note: "" });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["parcel-payments", parcelId],
    queryFn: () => parcelApi.listPayments(parcelId),
  });

  const { data: parcelData } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const effectiveCode = parcelData?.parcel_id ?? parcelCode;

  const { data: compensations = [] } = useQuery({
    queryKey: ["compensations", acqId, effectiveCode],
    queryFn: () => landApi.listCompensations(acqId, effectiveCode),
    enabled: !!acqId && !!effectiveCode,
  });

  const cashTotal = compensations.filter((c) => c.compensation_type === "cash").reduce((s, c) => s + c.amount, 0);
  const landGrantTotal = compensations.filter((c) => c.compensation_type === "land_grant").reduce((s, c) => s + c.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const addMutation = useMutation({
    mutationFn: () =>
      parcelApi.addPayment(parcelId, {
        amount: Number(form.amount),
        currency: form.currency,
        paid_at: form.paid_at || undefined,
        note: form.note,
      }),
    onSuccess: () => {
      toast.success("Төлбөр бүртгэгдлээ");
      setForm({ amount: "", currency: "MNT", paid_at: "", note: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["parcel-payments", parcelId] });
    },
    onError: (err) => toast.error(getApiError(err, "Бүртгэхэд алдаа гарлаа")),
  });

  const detail = parcelData?.detail;
  const hasValuation = !!(detail?.valuation_zone || detail?.base_price_per_ha || detail?.auction_price);
  const [editValuation, setEditValuation] = useState(false);
  const [vForm, setVForm] = useState({ zone: "", base_price: "", coeff: "", auction_price: "" });

  const valuationMutation = useMutation({
    mutationFn: () =>
      landApi.updateParcelValuation(acqId, parcelId, {
        valuation_zone: vForm.zone,
        base_price_per_ha: vForm.base_price ? Number(vForm.base_price) : null,
        auction_coeff: vForm.coeff ? Number(vForm.coeff) : null,
        auction_price: vForm.auction_price ? Number(vForm.auction_price) : null,
      }),
    onSuccess: () => {
      toast.success("Үнэлгээ хадгалагдлаа");
      setEditValuation(false);
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Land valuation */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Газрын үнэлгээ</p>
          {!editValuation && (
            <button
              onClick={() => {
                setVForm({
                  zone: detail?.valuation_zone ?? "",
                  base_price: detail?.base_price_per_ha?.toString() ?? "",
                  coeff: detail?.auction_coeff?.toString() ?? "",
                  auction_price: detail?.auction_price?.toString() ?? "",
                });
                setEditValuation(true);
              }}
              className="text-[12px] font-medium text-[#02c0ce] hover:underline"
            >
              {hasValuation ? "Засах" : "Мэдээлэл оруулах"}
            </button>
          )}
        </div>

        {editValuation ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ["zone", "Газрын суурь үнэлгээний зэрэглэл / Бүс", "text", "Жишээ: А бүс, 1-р зэрэглэл"],
                ["base_price", "Газрын суурь үнэ /1га/", "number", "0"],
                ["coeff", "Дуудлага худалдааны анхны үнийн итгэлцүүр", "number", "1.0"],
                ["auction_price", "Дуудлага худалдааны анхны үнэ", "number", "0"],
              ] as [keyof typeof vForm, string, string, string][]).map(([field, label, type, placeholder]) => (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</label>
                  <input
                    value={vForm[field]}
                    onChange={(e) => setVForm((f) => ({ ...f, [field]: e.target.value }))}
                    className={INP} type={type} placeholder={placeholder}
                    step={field === "coeff" ? "0.0001" : undefined}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => valuationMutation.mutate()}
                disabled={valuationMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                {valuationMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
              <button
                onClick={() => setEditValuation(false)}
                className="rounded-lg border border-slate-200 dark:border-white/[0.08] px-4 py-2 text-[13px] text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
              >
                Цуцлах
              </button>
            </div>
          </div>
        ) : hasValuation ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                  {["#", "Газрын суурь үнэлгээний зэрэглэл / Бүс", "Газрын суурь үнэ /1га/", "Дуудлага худалдааны анхны үнийн итгэлцүүр", "Дуудлага худалдааны анхны үнэ", "Нийт"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">1</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{detail?.valuation_zone || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.base_price_per_ha != null ? detail.base_price_per_ha.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.auction_coeff != null ? detail.auction_coeff : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.auction_price != null ? detail.auction_price.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-white">
                    {detail?.auction_price != null ? `${detail.auction_price.toLocaleString()}₮` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
            Газрын үнэлгээний мэдээлэл бүртгэгдээгүй
          </div>
        )}
      </div>

      {/* Compensation breakdown */}
      {compensations.length > 0 && (
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Үнэлгээний мэдээлэл</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#37394d] px-5">
            {compensations.map((comp) => (
              <div key={comp.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-400/15">
                    {comp.target_type === "parcel" ? (
                      <MapPin className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                  </span>
                  <div>
                    <span className="text-[13px] text-slate-600 dark:text-slate-300">
                      {TARGET_TYPE_LABELS[comp.target_type] ?? comp.target_type}
                    </span>
                    <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}>
                      {COMP_TYPE_LABELS[comp.compensation_type]}
                    </span>
                    {comp.coverage_percent > 0 && (
                      <span className="ml-2 text-[12px] text-slate-400">{comp.coverage_percent}%</span>
                    )}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {comp.amount.toLocaleString()}₮
                </span>
              </div>
            ))}
            <div className="flex items-start justify-between py-3.5">
              <span className="text-[13px] font-bold text-slate-800 dark:text-white">Нийт мөнгөн дүн</span>
              <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{cashTotal.toLocaleString()}₮</span>
            </div>
            {landGrantTotal > 0 && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[13px] text-slate-500 dark:text-slate-400">Газрын нөхөн олговор</span>
                <span className="text-[13px] font-semibold text-sky-600 dark:text-sky-400 tabular-nums">{landGrantTotal.toLocaleString()}₮</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary + add form */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">Нийт төлсөн</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {totalPaid.toLocaleString()} <span className="text-[14px] font-medium text-slate-400">₮</span>
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Болих" : "Төлбөр нэмэх"}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#37394d] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Дүн</p>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" className={INP} />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Валют</p>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={INP}>
                <option value="MNT">MNT</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Огноо</p>
              <input type="date" value={form.paid_at} onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))} className={INP} />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
              <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Тайлбар..." className={INP} />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.amount || addMutation.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Plus className="h-4 w-4" />}
                Хадгалах
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Төлбөрийн түүх</p>
        </div>
        {isLoading ? (
          <div className="p-5 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !payments.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Wallet className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Төлбөрийн бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["#", "Дүн", "Огноо", "Тайлбар", "Бүртгэсэн"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {payments.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{p.amount.toLocaleString()} {p.currency}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{p.note || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
