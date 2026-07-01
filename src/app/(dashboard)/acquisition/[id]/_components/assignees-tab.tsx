"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Users, UserPlus, UserMinus } from "lucide-react";
import { landApi, usersApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/role-utils";
import type { AcquisitionAssignee } from "@/types";
import { ConfirmDialog, type PendingConfirm } from "./confirm-dialog";
import { isSeniorSpecialist } from "./shared";

type UserOption = { id: string; first_name: string; last_name: string; email: string; position?: string };

export function AssigneesTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const canManage = isSeniorSpecialist() && canEdit;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserOption[]>([]);

  const { data: assignees = [], isLoading } = useQuery<AcquisitionAssignee[]>({
    queryKey: ["assignees", id],
    queryFn: () => landApi.getAssignees(id),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => usersApi.list({ page: 1, page_size: 200 }),
    enabled: modalOpen,
  });

  const allUsers = usersData?.data ?? [];
  const assignedIds = new Set(assignees.map((a) => a.user_id));
  const selectedIds = new Set(selected.map((u) => u.id));
  const currentUserId = getCurrentUserId();

  const filteredUsers = allUsers.filter((u) => {
    if (u.id === currentUserId) return false;
    if (assignedIds.has(u.id)) return false;
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    const position = (u.position ?? "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || position.includes(q) || u.email.toLowerCase().includes(q);
  });

  const setMutation = useMutation({
    mutationFn: (users: { user_id: string; user_name: string; user_position?: string }[]) =>
      landApi.setAssignees(id, users),
    onSuccess: () => {
      toast.success("Ажилтны жагсаалт шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["assignees", id] });
      closeModal();
    },
    onError: (err) => toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  function openModal() {
    setSearch("");
    setSelected([]);
    setStep("select");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelected([]);
    setSearch("");
    setStep("select");
  }

  function toggleUser(u: UserOption) {
    setSelected((prev) =>
      selectedIds.has(u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  }

  function removeAssignee(userId: string) {
    const updated = assignees
      .filter((a) => a.user_id !== userId)
      .map((a) => ({ user_id: a.user_id, user_name: a.user_name ?? "", user_position: a.user_position ?? "" }));
    setMutation.mutate(updated);
  }

  function confirmAdd() {
    const updated = [
      ...assignees.map((a) => ({ user_id: a.user_id, user_name: a.user_name ?? "", user_position: a.user_position ?? "" })),
      ...selected.map((u) => ({
        user_id: u.id,
        user_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.id,
        user_position: u.position ?? "",
      })),
    ];
    setMutation.mutate(updated);
  }

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Ажиллах ажилтнууд</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Энэ чөлөөлөлтэд ажиллах эрх бүхий ажилтнууд
            </p>
          </div>
          {canManage && (
            <button
              onClick={openModal}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" /> Ажилтан нэмэх
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : !assignees.length ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
            <Users className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-[13px]">
              {canManage ? "Ажилтан бүртгэгдээгүй байна. Нэмэх товч дарна уу." : "Ажиллах ажилтан бүртгэгдээгүй байна"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
            {assignees.map((a) => (
              <div key={a.user_id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#02c0ce]/10 text-[#02c0ce] text-[13px] font-bold select-none">
                  {(a.user_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{a.user_name}</p>
                  {a.user_position && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{a.user_position}</p>
                  )}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {a.assigned_by_name ? `${a.assigned_by_name} оноосон` : ""}
                    {a.assigned_at ? ` · ${new Date(a.assigned_at).toLocaleDateString("mn-MN")}` : ""}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => setPendingConfirm({ title: `"${a.user_name}" ажилтныг хасах уу?`, confirmLabel: "Тийм, хасах", onConfirm: () => removeAssignee(a.user_id) })}
                    disabled={setMutation.isPending}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d] shrink-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  {step === "select" ? "Ажилтан сонгох" : "Баталгаажуулах"}
                </p>
                {step === "select" && selected.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-[#02c0ce] text-white text-[11px] font-bold px-1.5">
                    {selected.length}
                  </span>
                )}
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1 — Select */}
            {step === "select" && (
              <>
                <div className="px-6 pt-4 pb-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Нэр, албан тушаалаар хайх..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#252630] px-3 text-[13px] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-[#02c0ce] transition-colors"
                  />
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
                  {!usersData ? (
                    <div className="space-y-2 p-4 animate-pulse">
                      {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]" />)}
                    </div>
                  ) : !filteredUsers.length ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 text-[13px]">
                      {search ? "Хайлтад тохирох ажилтан олдсонгүй" : "Нэмэх боломжтой ажилтан байхгүй"}
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isChecked = selectedIds.has(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleUser(u)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-left ${
                            isChecked
                              ? "bg-[#02c0ce]/8 dark:bg-[#02c0ce]/12"
                              : "hover:bg-slate-50 dark:hover:bg-[#252630]"
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                            isChecked ? "bg-[#02c0ce] border-[#02c0ce]" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {isChecked && (
                              <svg viewBox="0 0 10 8" className="h-3 w-3 text-white fill-current">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            )}
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#02c0ce]/10 text-[#02c0ce] text-[12px] font-bold select-none">
                            {(u.first_name || u.last_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                              {u.first_name} {u.last_name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {u.position || u.email}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2 px-6 py-3 border-t border-slate-100 dark:border-[#37394d] shrink-0">
                  <button
                    onClick={closeModal}
                    className="flex-1 h-9 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] transition-colors"
                  >
                    Цуцлах
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    disabled={selected.length === 0}
                    className="flex-1 h-9 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-40 transition-colors"
                  >
                    Үргэлжлэх ({selected.length})
                  </button>
                </div>
              </>
            )}

            {/* Step 2 — Confirm */}
            {step === "confirm" && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-3">
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Дараах {selected.length} ажилтныг нэмэх үү?
                  </p>
                  <div className="rounded-xl border border-slate-100 dark:border-[#37394d] overflow-hidden divide-y divide-slate-100 dark:divide-[#37394d]">
                    {selected.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#02c0ce]/10 text-[#02c0ce] text-[12px] font-bold select-none">
                          {(u.first_name || u.last_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {u.position || u.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 px-6 py-3 border-t border-slate-100 dark:border-[#37394d] shrink-0">
                  <button
                    onClick={() => setStep("select")}
                    disabled={setMutation.isPending}
                    className="flex-1 h-9 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#252630] hover:bg-slate-200 dark:hover:bg-[#2e2f3e] disabled:opacity-50 transition-colors"
                  >
                    Буцах
                  </button>
                  <button
                    onClick={confirmAdd}
                    disabled={setMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 h-9 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
                  >
                    {setMutation.isPending && (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    Баталгаажуулах
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
