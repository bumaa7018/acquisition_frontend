"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { acquisitionCategoryApi, departmentApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { ChevronRight, FolderOpen, Plus, Pencil, Trash2, X, Check, Tag } from "lucide-react";
import { toast } from "sonner";
import type { AcquisitionCategory, Department } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

type FormState = { name: string; sort_order: string; department_id: string };
const emptyForm: FormState = { name: "", sort_order: "0", department_id: "" };

function InlineForm({
  initial,
  onSave,
  onCancel,
  isPending,
  departments,
}: {
  initial?: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
  /** Өгвөл "Хариуцсан алба" сонгогч гарна (зөвхөн ЕРӨНХИЙ ангилалд). */
  departments?: Department[];
}) {
  const [form, setForm] = useState<FormState>(initial ?? emptyForm);
  // Талбар бүрийг ЖИЖИГ САВАНД оруулж, өргөнийг САВАНД нь өгнө.
  //
  // ЯАГААД: inputCls дотор `w-full` байдаг тул input дээр шууд `flex-1` нэмэхэд
  // хоёр өргөний дүрэм зөрчилдөж, хажууд нь өөр талбар нэмэгдэхэд нэрийн
  // талбар 0 өргөнтэй болж ХАРАГДАХГҮЙ болдог байв. Одоо сав нь flex-1 +
  // min-w, input нь w-full — зөрчилгүй. Нарийн дэлгэц дээр доошоо эгнэнэ.
  const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-[200px] flex-1">
        <label className={fieldLabel}>Нэр *</label>
        <input
          autoFocus
          placeholder="Ангилалын нэр"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(form); if (e.key === "Escape") onCancel(); }}
          className={inputCls}
        />
      </div>

      {departments && (
        <div className="w-full shrink-0 sm:w-56">
          <label className={fieldLabel}>Хариуцсан алба</label>
          <select
            value={form.department_id}
            onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            className={inputCls}
          >
            <option value="">— Сонгоогүй —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="w-full shrink-0 sm:w-24">
        <label className={fieldLabel}>Эрэмбэ</label>
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(form); if (e.key === "Escape") onCancel(); }}
          className={inputCls}
          min={0}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.name.trim()}
          title="Хадгалах"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce] text-white hover:bg-[#02a3af] disabled:opacity-50 transition-colors"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={onCancel}
          title="Болих"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Устгах баталгаажуулалт — ХОЛБОГДСОН чөлөөлөлтийг харгалзана.
 *
 * ЯАГААД: өмнө нь шууд "устгах уу?" гэж асуугаад устгадаг байсан ба ангилалд
 * чөлөөлөлт холбогдсон бол backend дээр FK зөрчигдөж "Дотоод алдаа гарлаа"
 * (500) гэсэн ойлгомжгүй мессеж буцдаг байв. Одоо тоог нь урьдчилж харуулж,
 * боломжгүй шалтгааныг нь тодорхой хэлнэ.
 */
function requestDelete(
  cat: AcquisitionCategory,
  onConfirm: () => void,
): PendingConfirm {
  const used = cat.acquisition_count ?? 0;
  if (used > 0) {
    // БОЛОМЖГҮЙ тохиолдол — баталгаажуулах цонх НЭЭХГҮЙ. ConfirmDialog нь
    // устгахыг батлах зориулалттай (10 секундын тоолуур, "Болих/Устгах")
    // тул "чадахгүй" мэдэгдэлд тохирохгүй. Мэдээллийг toast-оор өгнө.
    toast.error(
      `"${cat.name}"-д ${used} чөлөөлөлт холбогдсон тул устгах боломжгүй. ` +
      `Эхлээд тэдгээр чөлөөлөлтийн ангилалыг өөрчилнө үү.`,
    );
    return null;
  }
  const subs = cat.sub_count ?? 0;
  return {
    title: `"${cat.name}" устгах уу?`,
    description: subs > 0 ? `Түүний ${subs} дэд ангилал хамт устана.` : undefined,
    confirmLabel: "Устгах",
    confirmColor: "#f1556c",
    onConfirm,
  };
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
    // Дэд ангилалд хариуцсан алба байхгүй — талбарыг илгээхгүй (backend
    // null болгож бичих тул хоосон нь зөв утга).
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
    <div className="space-y-1.5">
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
              initial={{ name: sub.name, sort_order: String(sub.sort_order), department_id: "" }}
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
                {(sub.acquisition_count ?? 0) > 0 && (
                  <span
                    title="Энэ ангилалд холбогдсон чөлөөлөлт — устгах боломжгүй"
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                  >
                    {sub.acquisition_count} чөлөөлөлт
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  title="Нэр, эрэмбийг засах"
                  onClick={() => setEditingId(sub.id)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setPendingConfirm(requestDelete(sub, () => deleteMutation.mutate(sub.id)))}
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingGeneral, setAddingGeneral] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: generals = [], isLoading } = useQuery({
    queryKey: ["acq-categories", null],
    queryFn: () => acquisitionCategoryApi.list(),
  });

  // Хариуцсан алба — ГУС-ийн хэлтсийн жагсаалт. Ангилал нь зөвхөн дугаарыг
  // хадгалдаг тул нэрийг эндээс тааруулна.
  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "options"],
    queryFn: () => departmentApi.list({ page_size: 200 }).then((r) => r.data ?? []),
    staleTime: 5 * 60_000,
  });
  const deptName = (id?: number | null) =>
    id == null ? "" : departments.find((d) => String(d.id) === String(id))?.name ?? `#${id}`;

  const createMutation = useMutation({
    mutationFn: (f: FormState) =>
      acquisitionCategoryApi.create({
        name: f.name.trim(),
        parent_id: null,
        sort_order: f.sort_order ? parseInt(f.sort_order) : 0,
        department_id: f.department_id ? Number(f.department_id) : null,
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
        department_id: f.department_id ? Number(f.department_id) : null,
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
      setSelectedId(null); // устгасан мөр дээр зогссон самбарыг сэргээнэ
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  // Сонгосон ерөнхий ангилал. Жагсаалт ачаалагдмагц ЭХНИЙХИЙГ нь өөрөө
  // сонгоно — баруун талын самбар хоосон зогсохгүй.
  const selected = generals.find((c) => c.id === selectedId) ?? generals[0] ?? null;
  useEffect(() => {
    if (selectedId != null && generals.some((c) => c.id === selectedId)) return;
    setSelectedId(generals[0]?.id ?? null);
  }, [generals, selectedId]);

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

      {/*
        ЕРӨНХИЙ ангилал ЗҮҮН талд жагсаалт, сонгосон нэгнийх нь ДЭД ангилал
        БАРУУН талын дэлгэрэнгүй самбарт.

        ЯАГААД: өмнө нь дэд ангилалууд мөр дотор нээгддэг (accordion) байсан
        тул хэд хэдэн ангилалыг зэрэг нээхэд хаана байгаагаа алдаж, "юуны дэд
        ангилал бэ" нь ойлгомжгүй болдог байв. Одоо нэг үед ЗӨВХӨН нэг
        ангилалын агуулга харагдаж, гарчиг нь дээрээ бичигдэнэ.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <div className="ap-card overflow-hidden self-start">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Ерөнхий ангилал
          </p>
        </div>

        {/* Add general category form */}
        {addingGeneral && (
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#191b22]">
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-2">Шинэ ерөнхий ангилал</p>
            <InlineForm
              departments={departments}
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
                      // key — ангилал солиход маягт ЗААВАЛ шинээр монтлогдож,
                      // өмнөх мөрийн утга үлдэхээс сэргийлнэ.
                      key={`edit-${cat.id}`}
                      initial={{
                        name: cat.name,
                        sort_order: String(cat.sort_order),
                        department_id: cat.department_id != null ? String(cat.department_id) : "",
                      }}
                      departments={departments}
                      onSave={(f) => updateMutation.mutate({ id: cat.id, f })}
                      onCancel={() => setEditingId(null)}
                      isPending={updateMutation.isPending}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedId(cat.id)}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                      selected?.id === cat.id
                        ? "bg-[#02c0ce]/[0.08] dark:bg-[#02c0ce]/[0.12]"
                        : "hover:bg-slate-50 dark:hover:bg-[#252630]"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                      <FolderOpen className="h-4 w-4 text-[#02c0ce]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white">{cat.name}</p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {cat.sub_count ?? 0} дэд ангилал
                        {(cat.acquisition_count ?? 0) > 0 && ` · ${cat.acquisition_count} чөлөөлөлт`}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        selected?.id === cat.id ? "text-[#02c0ce]" : "text-slate-300 dark:text-slate-600"
                      }`}
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ДЭЛГЭРЭНГҮЙ: сонгосон ерөнхий ангилал + дэд ангилалууд ────── */}
      <div className="ap-card overflow-hidden self-start">
        {!selected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Tag className="mb-3 h-10 w-10 text-slate-300 dark:text-[#37394d]" />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">
              Зүүн талаас ерөнхий ангилал сонгоно уу
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Ерөнхий ангилал
                </p>
                <p className="mt-0.5 truncate text-[15px] font-bold text-slate-800 dark:text-white">
                  {selected.name}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Эрэмбэ: {selected.sort_order}
                  {selected.department_id != null && (
                    <>
                      {" · "}
                      <span className="font-medium text-[#02c0ce]">{deptName(selected.department_id)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  title="Нэр, хариуцсан алба, эрэмбийг засах"
                  onClick={() => { setEditingId(selected.id); setAddingGeneral(false); }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#02c0ce]/10 px-2.5 text-[12px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/20"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Засах
                </button>
                <button
                  title="Ерөнхий ангилалыг устгах"
                  onClick={() =>
                    setPendingConfirm(requestDelete(selected, () => deleteMutation.mutate(selected.id)))
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Холбогдсон чөлөөлөлт — устгах боломжгүйг УРЬДЧИЛЖ мэдэгдэнэ */}
            {(selected.acquisition_count ?? 0) > 0 && (
              <div className="border-b border-amber-100 bg-amber-50/70 px-5 py-2.5 text-[12px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                Энэ ангилалд <b>{selected.acquisition_count}</b> чөлөөлөлт холбогдсон тул устгах боломжгүй.
              </div>
            )}

            <div className="px-5 py-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Дэд ангилал
              </p>
              <SubCategorySection key={selected.id} parent={selected} />
            </div>
          </>
        )}
      </div>
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
