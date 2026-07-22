"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assetCalcTypeApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { Calculator, Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AssetCalcType } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

export default function AssetCalcTypePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<AssetCalcType | null>(null);
  const [form, setForm] = useState({ code: "", name: "", default_unit: "", sort_order: "" });
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["asset-calc-types"],
    queryFn: () => assetCalcTypeApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      assetCalcTypeApi.create({
        code: form.code.trim(),
        name: form.name.trim(),
        default_unit: form.default_unit.trim(),
        sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Байгааламжийн тооцооллын мэдээллийн төрөл үүслээ");
      queryClient.invalidateQueries({ queryKey: ["asset-calc-types"] });
      setShowCreate(false);
      setForm({ code: "", name: "", default_unit: "", sort_order: "" });
    },
    onError: (err) => toast.error(getApiError(err, "Үүсгэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      assetCalcTypeApi.update(editItem!.id, {
        code: form.code.trim(),
        name: form.name.trim(),
        default_unit: form.default_unit.trim(),
        sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["asset-calc-types"] });
      setEditItem(null);
      setForm({ code: "", name: "", default_unit: "", sort_order: "" });
    },
    onError: (err) => toast.error(getApiError(err, "Засварлахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assetCalcTypeApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["asset-calc-types"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const openEdit = (item: AssetCalcType) => {
    setEditItem(item);
    setForm({ code: item.code, name: item.name, default_unit: item.default_unit, sort_order: String(item.sort_order) });
    setShowCreate(false);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: "", name: "", default_unit: "", sort_order: "" });
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditItem(null);
    setForm({ code: "", name: "", default_unit: "", sort_order: "" });
  };

  const submit = () => {
    if (!form.name.trim() || !form.code.trim()) return;
    if (editItem) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = showCreate || editItem !== null;

  return (
    <>
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Байгааламжийн тооцооллын мэдээллийн төрлүүд
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Өртгийн хандлагаарх тооцооллын ангилалуудыг тохируулна
          </p>
        </div>
        <button
          onClick={isFormOpen ? closeForm : openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isFormOpen ? "Болих" : "Нэмэх"}
        </button>
      </div>

      {isFormOpen && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            {editItem ? "Засварлах" : "Шинэ төрөл"}
          </p>
          <div className="flex flex-col gap-3 max-w-md">
            <input
              placeholder="Код * (жишээ: unit_cost)"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <input
              placeholder="Нэр *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <input
              placeholder="Үндсэн хэмжих нэгж (жишээ: төгрөг/м²)"
              value={form.default_unit}
              onChange={(e) => setForm((f) => ({ ...f, default_unit: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <input
              type="number"
              placeholder="Эрэмбэ"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={isPending || !form.name.trim() || !form.code.trim()}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                {editItem ? "Хадгалах" : "Үүсгэх"}
              </button>
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Тооцооллын мэдээллийн төрлүүд
          </p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calculator className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">Төрөл олдсонгүй</p>
            <button onClick={openCreate} className="mt-4 text-[13px] font-medium text-[#02c0ce] hover:underline">
              Шинэ төрөл нэмэх
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                    <Calculator className="h-4 w-4 text-[#02c0ce]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#02c0ce] bg-[#02c0ce]/10">
                        {item.code}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500">
                      Үндсэн нэгж: {item.default_unit || "—"} · Эрэмбэ: {item.sort_order}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-[#252630] text-slate-500 dark:text-slate-400 hover:bg-[#02c0ce]/10 hover:text-[#02c0ce] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPendingConfirm({ title: `"${item.name}" устгах уу?`, confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(item.id) })}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
