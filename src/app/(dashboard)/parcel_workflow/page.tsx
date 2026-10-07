"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parcelWorkflowApi, parcelStatusApi, documentTypeApi } from "@/lib/api";
import { sortDocumentTypes } from "@/lib/document-types";
import { getApiError } from "@/lib/utils";
import { ArrowRight, GitBranch, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ParcelWorkflow } from "@/types";
import { getParcelStatusStyle } from "@/types";
import { DocumentTypeChecklist } from "./_components/document-type-checklist";

const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
const labelCls =
  "block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider";

function StatusBadge({ name, id }: { name: string; id: number | null }) {
  if (!name && id === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
        Эхний статус (байхгүй)
      </span>
    );
  }
  const style = getParcelStatusStyle(id ?? undefined, name);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold"
      style={{ color: style.color, background: style.bg }}
    >
      {name || `Статус ${id}`}
    </span>
  );
}

export default function ParcelWorkflowPage() {
  const queryClient = useQueryClient();

  const [fromStatusId, setFromStatusId] = useState<string>("");
  const [toStatusId, setToStatusId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("0");
  // Шилжилтэд ЗААВАЛ байх хавсралт — нэмэх маягт ба засаж буй шилжилт.
  const [newDocs, setNewDocs] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDocs, setEditDocs] = useState<number[]>([]);

  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
    staleTime: 60_000,
  });
  const sortedDocTypes = useMemo(() => sortDocumentTypes(docTypes), [docTypes]);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["parcel-workflow"],
    queryFn: () => parcelWorkflowApi.list(),
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      parcelWorkflowApi.create({
        from_status_id: fromStatusId ? Number(fromStatusId) : null,
        to_status_id: Number(toStatusId),
        sort_order: sortOrder ? Number(sortOrder) : 0,
        document_type_ids: newDocs,
      }),
    onSuccess: () => {
      toast.success("Шилжилт нэмэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["parcel-workflow"] });
      setFromStatusId("");
      setToStatusId("");
      setSortOrder("0");
      setNewDocs([]);
    },
    onError: (err) => toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => parcelWorkflowApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-workflow"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const saveDocsMutation = useMutation({
    mutationFn: ({ id, ids }: { id: number; ids: number[] }) => parcelWorkflowApi.setRequiredDocuments(id, ids),
    onSuccess: () => {
      toast.success("Заавал хавсралт хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-workflow"] });
      setEditingId(null);
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const startEdit = (w: ParcelWorkflow) => {
    setEditDocs((w.required_documents ?? []).map((d) => d.document_type_id));
    setEditingId(w.id);
  };

  const handleCreate = () => {
    if (!toStatusId) {
      toast.error("Очих статус сонгоно уу");
      return;
    }
    createMutation.mutate();
  };

  // Group by from_status for visual clarity
  const grouped = workflows.reduce<Record<string, ParcelWorkflow[]>>((acc, w) => {
    const key = w.from_status_id === null ? "null" : String(w.from_status_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(w);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">
          Нэгж талбарын ажлын урсгал
        </h1>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
          Нэгж талбарын статус хоорондын шилжилтийн дарааллыг тохируулна
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Add transition form */}
        <div className="ap-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#02c0ce]/10">
              <Plus className="h-4 w-4 text-[#02c0ce]" />
            </div>
            <h2 className="text-[14px] font-semibold text-slate-800 dark:text-white">
              Шилжилт нэмэх
            </h2>
          </div>

          <div>
            <label className={labelCls}>Эхлэх статус</label>
            <select
              value={fromStatusId}
              onChange={(e) => setFromStatusId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Эхний статус (байхгүй) —</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Хоосон үлдээвэл анх удаа сонгох боломжтой статус болно
            </p>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-slate-300 dark:text-slate-600" />
          </div>

          <div>
            <label className={labelCls}>Очих статус *</label>
            <select
              value={toStatusId}
              onChange={(e) => setToStatusId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Сонгоно уу —</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Заавал хавсралт</label>
            <DocumentTypeChecklist types={sortedDocTypes} value={newDocs} onChange={setNewDocs}
              disabled={createMutation.isPending} />
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Энэ шилжилтийг хийхийн өмнө нэгж талбарт орсон байх ёстой хавсралт (заавал биш)
            </p>
          </div>

          <div>
            <label className={labelCls}>Эрэмбэ</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputCls}
              min={0}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={createMutation.isPending || !toStatusId}
            className="h-9 w-full rounded-lg bg-[#02c0ce] text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? "Нэмж байна..." : "Шилжилт нэмэх"}
          </button>
        </div>

        {/* Workflow visualization */}
        <div className="xl:col-span-2 ap-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#02c0ce]" />
              <h2 className="text-[14px] font-semibold text-slate-800 dark:text-white">
                Тохиргоосон шилжилтүүд
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630] animate-pulse" />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-10 text-center">
              <GitBranch className="mx-auto mb-3 h-8 w-8 text-slate-200 dark:text-slate-700" />
              <p className="text-[13px] text-slate-400 dark:text-slate-500">
                Шилжилт тохируулаагүй байна
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {Object.entries(grouped).map(([key, items]) => {
                const first = items[0];
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge
                        name={first.from_status_name}
                        id={first.from_status_id}
                      />
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        шилжих боломжтой:
                      </span>
                    </div>
                    <div className="ml-4 space-y-1.5">
                      {items.map((w) => {
                        const docs = sortDocumentTypes(
                          (w.required_documents ?? []).map((d) => ({ ...d, type: d.document_type_code, name: d.document_type_name })),
                        );
                        const isEditing = editingId === w.id;
                        return (
                          <div
                            key={w.id}
                            className="rounded-lg border border-slate-100 dark:border-[#37394d] px-3 py-2 bg-slate-50/50 dark:bg-[#1a1d20]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <StatusBadge name={w.to_status_name} id={w.to_status_id} />
                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  #{w.sort_order}
                                </span>
                                <button
                                  onClick={() => startEdit(w)}
                                  disabled={editingId !== null}
                                  title="Заавал хавсралт засах"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-[#02c0ce] hover:bg-[#02c0ce]/10 disabled:opacity-40 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteMutation.mutate(w.id)}
                                  disabled={deleteMutation.isPending}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Энэ шилжилтэд ЗААВАЛ байх хавсралт */}
                            {!isEditing && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                                {docs.length === 0 ? (
                                  <span className="text-[11.5px] text-slate-400 dark:text-slate-500">Заавал хавсралтгүй</span>
                                ) : (
                                  docs.map((d) => (
                                    <span
                                      key={d.document_type_id}
                                      className="rounded-md bg-[#02c0ce]/10 px-2 py-0.5 text-[11.5px] font-medium text-[#02a3af] dark:text-[#3fd4df]"
                                    >
                                      {d.document_type_name}
                                    </span>
                                  ))
                                )}
                              </div>
                            )}
                            {isEditing && (
                              <div className="mt-2 space-y-2">
                                <DocumentTypeChecklist types={sortedDocTypes} value={editDocs} onChange={setEditDocs}
                                  disabled={saveDocsMutation.isPending} />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingId(null)}
                                    disabled={saveDocsMutation.isPending}
                                    className="h-8 rounded-lg border border-slate-200 px-3 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-[#37394d] dark:text-slate-300 dark:hover:bg-[#252630]"
                                  >
                                    Болих
                                  </button>
                                  <button
                                    onClick={() => saveDocsMutation.mutate({ id: w.id, ids: editDocs })}
                                    disabled={saveDocsMutation.isPending}
                                    className="h-8 rounded-lg bg-[#02c0ce] px-3 text-[12.5px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                                  >
                                    {saveDocsMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
