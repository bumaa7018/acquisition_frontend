"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { progressTypesApi } from "@/lib/api";
import { ClipboardList, Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ProgressType } from "@/types";

export default function ProgressTypesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<ProgressType | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["progress-types"],
    queryFn: () => progressTypesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => progressTypesApi.create({ name: form.name.trim(), description: form.description.trim() || undefined }),
    onSuccess: () => {
      toast.success("Явцын төрөл үүслээ");
      queryClient.invalidateQueries({ queryKey: ["progress-types"] });
      setShowCreate(false);
      setForm({ name: "", description: "" });
    },
    onError: () => toast.error("Үүсгэхэд алдаа гарлаа"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      progressTypesApi.update(editItem!.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["progress-types"] });
      setEditItem(null);
      setForm({ name: "", description: "" });
    },
    onError: () => toast.error("Засварлахад алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => progressTypesApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["progress-types"] });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  const openEdit = (item: ProgressType) => {
    setEditItem(item);
    setForm({ name: item.name, description: item.description ?? "" });
    setShowCreate(false);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: "", description: "" });
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditItem(null);
    setForm({ name: "", description: "" });
  };

  const submit = () => {
    if (!form.name.trim()) return;
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
            Явцын төрөл
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Газар олголтын явцын төрлүүдийн жагсаалт
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

      {/* Form */}
      {isFormOpen && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            {editItem ? "Засварлах" : "Шинэ явцын төрөл"}
          </p>
          <div className="flex flex-col gap-3 max-w-md">
            <input
              placeholder="Нэр *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <input
              placeholder="Тайлбар (заавал биш)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={isPending || !form.name.trim()}
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
            Явцын төрлүүд
          </p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">
              Явцын төрөл олдсонгүй
            </p>
            <button
              onClick={openCreate}
              className="mt-4 text-[13px] font-medium text-[#02c0ce] hover:underline"
            >
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
                    <ClipboardList className="h-4 w-4 text-[#02c0ce]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-[12px] text-slate-400 dark:text-slate-500">
                        {item.description}
                      </p>
                    )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
