"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelStatusApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { Grid2x2, Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ParcelStatus } from "@/types";
import { getParcelStatusStyle } from "@/types";

export default function ParcelStatusPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<ParcelStatus | null>(null);
  const [form, setForm] = useState({ code: "", name: "", sort_order: "" });
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      parcelStatusApi.create({
        code: form.code.trim(),
        name: form.name.trim(),
        sort_order: form.sort_order ? parseInt(form.sort_order) : undefined,
      }),
    onSuccess: () => {
      toast.success("Нэгж талбарын статус үүслээ");
      queryClient.invalidateQueries({ queryKey: ["parcel-statuses"] });
      setShowCreate(false);
      setForm({ code: "", name: "", sort_order: "" });
    },
    onError: (err) => toast.error(getApiError(err, "Үүсгэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      parcelStatusApi.update(editItem!.id, {
        code: form.code.trim() || undefined,
        name: form.name.trim() || undefined,
        sort_order: form.sort_order ? parseInt(form.sort_order) : undefined,
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-statuses"] });
      setEditItem(null);
      setForm({ code: "", name: "", sort_order: "" });
    },
    onError: (err) => toast.error(getApiError(err, "Засварлахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => parcelStatusApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-statuses"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const openEdit = (item: ParcelStatus) => {
    setEditItem(item);
    setForm({
      code: item.code,
      name: item.name,
      sort_order: String(item.sort_order),
    });
    setShowCreate(false);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: "", name: "", sort_order: "" });
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditItem(null);
    setForm({ code: "", name: "", sort_order: "" });
  };

  const submit = () => {
    if (!form.name.trim() || !form.code.trim()) return;
    if (editItem) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = showCreate || editItem !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Нэгж талбарын статус
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Нэгж талбарын статусуудын жагсаалт
          </p>
        </div>
        <button
          onClick={isFormOpen ? closeForm : openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          {isFormOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isFormOpen ? "Болих" : "Нэмэх"}
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            {editItem ? "Засварлах" : "Шинэ статус"}
          </p>
          <div className="flex flex-col gap-3 max-w-md">
            <input
              placeholder="Код * (жишээ: negotiating)"
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
              type="number"
              placeholder="Эрэмбэ"
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: e.target.value }))
              }
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

      {/* List */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Нэгж талбарын статусууд
          </p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Grid2x2 className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">
              Статус олдсонгүй
            </p>
            <button
              onClick={openCreate}
              className="mt-4 text-[13px] font-medium text-[#02c0ce] hover:underline"
            >
              Шинэ статус нэмэх
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
            {data.map((item) => {
              const style = getParcelStatusStyle(item.id, item.name);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: style.bg }}
                    >
                      <Grid2x2
                        className="h-4 w-4"
                        style={{ color: style.color }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          {item.name}
                        </p>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold"
                          style={{
                            color: style.color,
                            backgroundColor: style.bg,
                          }}
                        >
                          {item.code}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-400 dark:text-slate-500">
                        Эрэмбэ: {item.sort_order}
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
                      onClick={() => {
                        if (confirm(`"${item.name}" устгах уу?`))
                          deleteMutation.mutate(item.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
