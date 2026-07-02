"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { formatDate, getApiError } from "@/lib/utils";
import { UserCheck, UserPlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { isExternalSpecialRole, isProfessionalOrg } from "@/lib/role-utils";
import type { AuthorizedRepresentative } from "@/types";

function row(label: string, value?: React.ReactNode) {
  return (
    <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0">
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">{label}</span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{value || "—"}</span>
    </div>
  );
}

export function HolderTab({ acqId, parcelId, isLocked = false }: { acqId: string; parcelId: string; isLocked?: boolean }) {
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();
  const svc = isProfOrg
    ? {
        getParcel: (a: string, p: string) => profApi.profGetParcel(a, p),
        listRepresentatives: (a: string, p: string) => profApi.profListRepresentatives(a, p),
        createRepresentative: (a: string, p: string, body: Omit<AuthorizedRepresentative, "id" | "acquisition_id" | "parcel_id" | "created_at" | "created_by">) =>
          profApi.profCreateRepresentative(a, p, body),
        deleteRepresentative: (a: string, p: string, id: string) => profApi.profDeleteRepresentative(a, p, id),
      }
    : {
        getParcel: (a: string, p: string) => landApi.getParcel(a, p),
        listRepresentatives: (a: string, p: string) => landApi.listRepresentatives(a, p),
        createRepresentative: (a: string, p: string, body: Omit<AuthorizedRepresentative, "id" | "acquisition_id" | "parcel_id" | "created_at" | "created_by">) =>
          landApi.createRepresentative(a, p, body),
        deleteRepresentative: (a: string, p: string, id: string) =>
          landApi.deleteRepresentative(a, p, id).then(() => undefined),
      };

  const { data, isLoading } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => svc.getParcel(acqId, parcelId),
    enabled: !!acqId,
  });

  const [repModalOpen, setRepModalOpen] = useState(false);
  const [repForm, setRepForm] = useState({ last_name: "", first_name: "", register_no: "", phone: "", email: "", address: "", note: "" });
  const [repFormErrors, setRepFormErrors] = useState<{ last_name?: boolean; first_name?: boolean }>({});
  const [repDeleteConfirm, setRepDeleteConfirm] = useState<string | null>(null);

  const { data: representatives = [], refetch: refetchReps } = useQuery<AuthorizedRepresentative[]>({
    queryKey: ["representatives", acqId, parcelId],
    queryFn: () => svc.listRepresentatives(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const createRepMutation = useMutation({
    mutationFn: () => svc.createRepresentative(acqId, parcelId, repForm),
    onSuccess: () => {
      toast.success("Итгэмжлэгдсэн төлөөлөгч бүртгэгдлээ");
      setRepModalOpen(false);
      setRepForm({ last_name: "", first_name: "", register_no: "", phone: "", email: "", address: "", note: "" });
      setRepFormErrors({});
      void refetchReps();
    },
    onError: (err) => toast.error(getApiError(err, "Бүртгэхэд алдаа гарлаа")),
  });

  const deleteRepMutation = useMutation({
    mutationFn: (repId: string) => svc.deleteRepresentative(acqId, parcelId, repId),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      setRepDeleteConfirm(null);
      void refetchReps();
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const handleRepSubmit = () => {
    const errors = { last_name: !repForm.last_name.trim(), first_name: !repForm.first_name.trim() };
    setRepFormErrors(errors);
    if (errors.last_name || errors.first_name) return;
    createRepMutation.mutate();
  };

  if (isLoading)
    return (
      <div className="ap-card p-5 animate-pulse space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-100 dark:bg-[#252630]" />)}
      </div>
    );
  if (!data)
    return <div className="ap-card p-10 text-center text-[13px] text-slate-400">Мэдээлэл олдсонгүй</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid md:grid-cols-2 gap-5">
        {/* Эзэмшигч — зүүн */}
        <div className="ap-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Эзэмшигч</p>
          {data.detail ? (
            <>
              {row("Овог нэр", `${data.detail.holder_last_name ?? ""} ${data.detail.holder_name ?? ""}`.trim())}
              {row("Регистрийн дугаар", data.detail.holder_register_no)}
              {row("Иргэний үнэмлэх", data.detail.holder_civil_id)}
              {row("Утас", data.detail.holder_phone)}
              {row("И-мэйл", data.detail.holder_email)}
              {row("Эзэмшигчийн төрөл", data.detail.holder_type)}
            </>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-8">Эзэмшигчийн мэдээлэл байхгүй</p>
          )}
        </div>

        {/* Өргөдөл & үнэлгээ — баруун */}
        <div className="ap-card p-5">
          {data.detail ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Өргөдлийн мэдээлэл</p>
              {row("Өргөдлийн дугаар", data.detail.app_no)}
              {row("Шийдвэрийн дугаар", data.detail.decision_no)}
              {row("Шийдвэрийн огноо", data.detail.decision_date ? formatDate(data.detail.decision_date) : undefined)}
              {row("Гэрээний дугаар", data.detail.contract_no)}
              {row("Гэрчилгээний дугаар", data.detail.certificate_no)}
              {(data.detail.valuation_zone || data.detail.base_price_per_ha != null || data.detail.auction_price != null) && (
                <>
                  <div className="mt-5">
                    <div className="h-px w-full bg-[#e2e8f0] dark:bg-[#37394d]" />
                    <p className="pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Газрын үнэлгээ</p>
                  </div>
                  {row("Үнэлгээний бүс / зэрэглэл", data.detail.valuation_zone)}
                  {row("Газрын суурь үнэ /1га/", data.detail.base_price_per_ha != null ? data.detail.base_price_per_ha.toLocaleString() : undefined)}
                  {row("Дуудлагын анхны үнийн итгэлцүүр", data.detail.auction_coeff != null ? String(data.detail.auction_coeff) : undefined)}
                  {row("Дуудлагын анхны үнэ", data.detail.auction_price != null ? `${data.detail.auction_price.toLocaleString()} ₮` : undefined)}
                </>
              )}
            </>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-8">Мэдээлэл байхгүй</p>
          )}
        </div>
      </div>

      {/* Итгэмжлэгдсэн төлөөлөгч */}
      <div className="ap-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#02c0ce]" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Итгэмжлэгдсэн төлөөлөгч
            </p>
          </div>
          {!isExternal && !isLocked && (
            <button
              onClick={() => { setRepModalOpen(true); setRepFormErrors({}); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Бүртгэх
            </button>
          )}
        </div>

        {representatives.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
            Итгэмжлэгдсэн төлөөлөгч бүртгэгдээгүй байна
          </p>
        ) : (
          <div className="space-y-2">
            {representatives.map((rep) => (
              <div key={rep.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#191b22] px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-white">
                      {rep.last_name} {rep.first_name}
                    </span>
                    {rep.register_no && (
                      <span className="rounded-md bg-slate-200/70 dark:bg-white/[0.06] px-2 py-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {rep.register_no}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {rep.phone && <span>📞 {rep.phone}</span>}
                    {rep.email && <span>✉ {rep.email}</span>}
                    {rep.address && <span>📍 {rep.address}</span>}
                  </div>
                  {rep.note && (
                    <p className="text-[11px] italic text-slate-400 dark:text-slate-500">{rep.note}</p>
                  )}
                </div>
                {!isExternal && !isLocked && (
                  repDeleteConfirm === rep.id ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Устгах уу?</span>
                      <button
                        onClick={() => deleteRepMutation.mutate(rep.id)}
                        disabled={deleteRepMutation.isPending}
                        className="h-7 px-2.5 rounded-lg bg-red-500 text-[12px] font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >Тийм</button>
                      <button
                        onClick={() => setRepDeleteConfirm(null)}
                        className="h-7 px-2.5 rounded-lg text-[12px] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
                      >Үгүй</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRepDeleteConfirm(rep.id)}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Төлөөлөгч бүртгэх modal */}
      {repModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#02c0ce]/10">
                  <UserPlus className="h-4 w-4 text-[#02c0ce]" />
                </div>
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Итгэмжлэгдсэн төлөөлөгч бүртгэх</p>
              </div>
              <button onClick={() => setRepModalOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Овог <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={repForm.last_name}
                    onChange={(e) => { setRepForm(f => ({ ...f, last_name: e.target.value })); setRepFormErrors(e2 => ({ ...e2, last_name: false })); }}
                    placeholder="Овог"
                    className={`h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${repFormErrors.last_name ? "border-red-400 bg-red-50/30 focus:ring-red-400/20" : "border-slate-200 dark:border-white/[0.08] bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15"}`}
                  />
                  {repFormErrors.last_name && <p className="mt-0.5 text-[11px] text-red-400">Заавал бөглөнө</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Нэр <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={repForm.first_name}
                    onChange={(e) => { setRepForm(f => ({ ...f, first_name: e.target.value })); setRepFormErrors(e2 => ({ ...e2, first_name: false })); }}
                    placeholder="Нэр"
                    className={`h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${repFormErrors.first_name ? "border-red-400 bg-red-50/30 focus:ring-red-400/20" : "border-slate-200 dark:border-white/[0.08] bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15"}`}
                  />
                  {repFormErrors.first_name && <p className="mt-0.5 text-[11px] text-red-400">Заавал бөглөнө</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Регистрийн дугаар</label>
                  <input type="text" value={repForm.register_no} onChange={(e) => setRepForm(f => ({ ...f, register_no: e.target.value }))} placeholder="АА99999999" className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Утас</label>
                  <input type="text" value={repForm.phone} onChange={(e) => setRepForm(f => ({ ...f, phone: e.target.value }))} placeholder="9999 9999" className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">И-мэйл</label>
                <input type="email" value={repForm.email} onChange={(e) => setRepForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.mn" className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Хаяг</label>
                <input type="text" value={repForm.address} onChange={(e) => setRepForm(f => ({ ...f, address: e.target.value }))} placeholder="Хаяг оруулах..." className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={repForm.note}
                  onChange={(e) => setRepForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  placeholder="Нэмэлт тэмдэглэл..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-[#37394d]">
              <button onClick={() => setRepModalOpen(false)} className="h-9 px-4 rounded-xl text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors">
                Болих
              </button>
              <button
                onClick={handleRepSubmit}
                disabled={createRepMutation.isPending}
                className="h-9 px-5 rounded-xl bg-[#02c0ce] text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {createRepMutation.isPending ? "Хадгалж байна..." : "Бүртгэх"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
