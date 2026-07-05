"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ReceiptText } from "lucide-react";
import { landApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { isSeniorSpecialist } from "./shared";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

export function FinancingTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const isSenior = isSeniorSpecialist() && canEdit;

  const EMPTY_FORM = { organization_name: "", source_type: "", amount: "", currency: "MNT", note: "" };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  // Санхүүжилтийн эх үүсвэр чөлөөлөлтийн дэлгэрэнгүй API-тай хамт ирдэг —
  // тусдаа жагсаалтын API байхгүй. Энэ таб зөвхөн дотоод хэрэглэгчид харагдана.
  const { data: acq, isLoading } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
  });
  const sources = acq?.funding_sources ?? [];

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        organization_name: form.organization_name,
        source_type: form.source_type,
        amount: form.amount ? Number(form.amount) : undefined,
        currency: form.currency || undefined,
        note: form.note || undefined,
      };
      return editId
        ? landApi.updateFundingSource(id, editId, body)
        : landApi.createFundingSource(id, body);
    },
    onSuccess: () => {
      toast.success(editId ? "Мэдээлэл шинэчлэгдлээ" : "Санхүүжилтын эх үүсвэр нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["land", id] });
      closeForm();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (srcId: string) => landApi.deleteFundingSource(id, srcId),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["land", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const inp = "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  return (
    <>
    <div className="flex flex-col gap-5">
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Санхүүжилтын эх үүсвэрүүд
          </p>
          {isSenior && !showForm && (
            <button
              onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-3 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Нэмэх
            </button>
          )}
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-3">
              {editId ? "Засварлах" : "Шинэ санхүүжилтын эх үүсвэр"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилт хийх байгууллага *</p>
                <input
                  value={form.organization_name}
                  onChange={(e) => setForm((f) => ({ ...f, organization_name: e.target.value }))}
                  placeholder="Байгууллагын нэр..."
                  className={inp}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилтын эх үүсвэрийн төрөл *</p>
                <input
                  value={form.source_type}
                  onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
                  placeholder="Улсын төсөв / Гадаадын зээл / Орон нутгийн төсөв..."
                  className={inp}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Санхүүжилтын дүн</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className={inp}
                  />
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="h-9 w-24 shrink-0 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                  >
                    <option value="MNT">MNT</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="CNY">CNY</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Тайлбар</p>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Нэмэлт тайлбар..."
                  className={inp}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.organization_name.trim() || !form.source_type.trim()}
                className="h-9 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
              <button
                onClick={closeForm}
                className="h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] px-4 text-[13px] text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
              >
                Болих
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-5 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !sources.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <ReceiptText className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Санхүүжилтын эх үүсвэр бүртгэгдээгүй</p>
            {isSenior && <p className="text-[12px] mt-1 text-slate-400">&ldquo;Нэмэх&rdquo; товч дарж бүртгэнэ үү</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                  {["#", "Байгууллага", "Эх үүсвэрийн төрөл", "Дүн", "Тайлбар", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                {sources.map((src, i) => (
                  <tr key={src.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{src.organization_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{src.source_type || "—"}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {src.amount != null ? `${src.amount.toLocaleString()} ${src.currency ?? "MNT"}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{src.note || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {isSenior && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditId(src.id);
                              setForm({
                                organization_name: src.organization_name,
                                source_type: src.source_type,
                                amount: src.amount != null ? String(src.amount) : "",
                                currency: src.currency ?? "MNT",
                                note: src.note ?? "",
                              });
                              setShowForm(true);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 dark:border-white/[0.08] px-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Засах
                          </button>
                          <button
                            onClick={() => setPendingConfirm({ title: "Устгах уу?", confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(src.id) })}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {sources.some((s) => s.amount != null) && (
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                    <td colSpan={3} className="px-4 py-3 text-right text-[12px] font-semibold text-slate-500">Нийт дүн</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white tabular-nums">
                      {sources.reduce((s, src) => s + (src.amount ?? 0), 0).toLocaleString()} MNT
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
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
