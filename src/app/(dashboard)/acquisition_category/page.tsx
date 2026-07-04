"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { acquisitionCategoryApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { ChevronDown, ChevronRight, FolderOpen, Plus, Pencil, Trash2, X, Check, Tag } from "lucide-react";
import { toast } from "sonner";
import type { AcquisitionCategory } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

type FormState = { name: string; sort_order: string };
const emptyForm: FormState = { name: "", sort_order: "0" };

function InlineForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm);
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        placeholder="Нэр *"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(form); if (e.key === "Escape") onCancel(); }}
        className={inputCls + " flex-1"}
      />
      <input
        type="number"
        placeholder="Эрэмбэ"
        value={form.sort_order}
        onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(form); if (e.key === "Escape") onCancel(); }}
        className={inputCls + " w-24"}
        min={0}
      />
      <button
        onClick={() => onSave(form)}
        disabled={isPending || !form.name.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce] text-white hover:bg-[#02a3af] disabled:opacity-50 transition-colors"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onCancel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SubCategorySection({ parent }: { parent: AcquisitionCategory }) {
  const queryClient = useQueryClient();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["acq-categories", parent.id],
    queryFn: () => acquisitionCategoryApi.list(parent.id),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      acquisitionCategoryApi.create({
        name: f.name.trim(),
        parent_id: parent.id,
        sort_order: f.sort_order ? parseInt(f.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Дэд ангилал нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", parent.id] });
      setAddingNew(false);
    },
    onError: (err) => toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      acquisitionCategoryApi.update(id, {
        name: f.name.trim(),
        sort_order: f.sort_order ? parseInt(f.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", parent.id] });
      setEditingId(null);
    },
    onError: (err) => toast.error(getApiError(err, "Засварлахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => acquisitionCategoryApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", parent.id] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  return (
    <>
    <div className="ml-8 mt-2 mb-3 border-l-2 border-slate-100 dark:border-[#37394d] pl-4 space-y-1.5">
      {isLoading && (
        <div className="space-y-1.5 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      )}

      {subs.map((sub) => (
        <div key={sub.id}>
          {editingId === sub.id ? (
            <InlineForm
              initial={{ name: sub.name, sort_order: String(sub.sort_order) }}
              onSave={(f) => updateMutation.mutate({ id: sub.id, f })}
              onCancel={() => setEditingId(null)}
              isPending={updateMutation.isPending}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-slate-50/50 dark:bg-[#1a1d20] hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors group">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-[13px] text-slate-700 dark:text-slate-200">{sub.name}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">#{sub.sort_order}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingId(sub.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setPendingConfirm({ title: `"${sub.name}" устгах уу?`, confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(sub.id) })}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {addingNew ? (
        <InlineForm
          onSave={(f) => createMutation.mutate(f)}
          onCancel={() => setAddingNew(false)}
          isPending={createMutation.isPending}
        />
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-slate-400 dark:text-slate-500 hover:text-[#02c0ce] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Дэд ангилал нэмэх
        </button>
      )}
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

export default function AcquisitionCategoryPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addingGeneral, setAddingGeneral] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: generals = [], isLoading } = useQuery({
    queryKey: ["acq-categories", null],
    queryFn: () => acquisitionCategoryApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      acquisitionCategoryApi.create({
        name: f.name.trim(),
        parent_id: null,
        sort_order: f.sort_order ? parseInt(f.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Ерөнхий ангилал нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", null] });
      setAddingGeneral(false);
    },
    onError: (err) => toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: number; f: FormState }) =>
      acquisitionCategoryApi.update(id, {
        name: f.name.trim(),
        sort_order: f.sort_order ? parseInt(f.sort_order) : 0,
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", null] });
      setEditingId(null);
    },
    onError: (err) => toast.error(getApiError(err, "Засварлахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => acquisitionCategoryApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["acq-categories", null] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Чөлөөлөлтийн ангилал
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Ерөнхий болон дэд ангилалуудын тохиргоо
          </p>
        </div>
        <button
          onClick={() => { setAddingGeneral(true); setEditingId(null); }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ерөнхий ангилал нэмэх
        </button>
      </div>

      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Ангилалуудын жагсаалт
          </p>
        </div>

        {/* Add general category form */}
        {addingGeneral && (
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#191b22]">
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-2">Шинэ ерөнхий ангилал</p>
            <InlineForm
              onSave={(f) => createMutation.mutate(f)}
              onCancel={() => setAddingGeneral(false)}
              isPending={createMutation.isPending}
            />
          </div>
        )}

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : generals.length === 0 && !addingGeneral ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">Ангилал олдсонгүй</p>
            <button
              onClick={() => setAddingGeneral(true)}
              className="mt-4 text-[13px] font-medium text-[#02c0ce] hover:underline"
            >
              Ерөнхий ангилал нэмэх
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
            {generals.map((cat) => (
              <div key={cat.id}>
                {/* General category row */}
                {editingId === cat.id ? (
                  <div className="px-5 py-3">
                    <InlineForm
                      initial={{ name: cat.name, sort_order: String(cat.sort_order) }}
                      onSave={(f) => updateMutation.mutate({ id: cat.id, f })}
                      onCancel={() => setEditingId(null)}
                      isPending={updateMutation.isPending}
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors group cursor-pointer"
                    onClick={() => toggle(cat.id)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                      <FolderOpen className="h-4 w-4 text-[#02c0ce]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white">{cat.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Эрэмбэ: {cat.sort_order}</p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(cat.id); setAddingGeneral(false); }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingConfirm({ title: `"${cat.name}" болон түүний дэд ангилалуудыг устгах уу?`, confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(cat.id) });
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="shrink-0 text-slate-400 ml-1">
                      {expanded.has(cat.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-categories */}
                {expanded.has(cat.id) && <SubCategorySection parent={cat} />}
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
