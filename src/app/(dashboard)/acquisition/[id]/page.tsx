"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, usersApi, parcelStatusApi } from "@/lib/api";
import { ConfirmDialog, type PendingConfirm } from "./_components/confirm-dialog";
import { STATUS_CFG, hasPermission, isSeniorSpecialist } from "./_components/shared";
import { GeneralTab } from "./_components/general-tab";
import { AttachmentsTab } from "./_components/attachments-tab";
import { STATUS_LABELS, ACQ_STATUS } from "@/types";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import {
  canAccessAcquisition,
  canAccessParcel,
  getCurrentUserId,
  isExternalSpecialRole,
  isProfessionalOrg,
} from "@/lib/role-utils";
import {
  ArrowLeft,
  MapPin,
  Info,
  RefreshCw,
  Trash2,
  ChevronRight,
  Clock,
  Pencil,
  X,
  LayoutList,
  Paperclip,
  Activity,
  Map,
  ReceiptText,
  Plus,
  FileDown,
  Calculator,
  Users,
  UserPlus,
  UserMinus,
} from "lucide-react";

import type { Compensation, AcquisitionAssignee, ParcelStatus } from "@/types";
import { getParcelStatusStyle } from "@/types";
import { toast } from "sonner";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const AcquisitionMap = dynamic(
  () => import("@/components/map/acquisition-map").then((m) => m.AcquisitionMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

type Tab =
  | "general"
  | "attachments"
  | "progress"
  | "parcels"
  | "assignees"
  | "map"
  | "financing";

// ─── Advance status modal ─────────────────────────────────────────────────────
function AdvanceModal({
  id,
  availableStatuses,
  onClose,
}: {
  id: string;
  availableStatuses: { id: number; label: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<number | "">(
    availableStatuses[0]?.id ?? "",
  );
  const [decreeNumber, setDecreeNumber] = useState("");
  const [decreeDate, setDecreeDate] = useState("");
  const sel =
    "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const inp =
    "w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const advanceMutation = useMutation({
    mutationFn: () =>
      landApi.advanceStatus(
        id,
        selectedStatus as number,
        note,
        decreeNumber,
        decreeDate || undefined,
      ),
    onSuccess: () => {
      toast.success("Явц шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["land", id] });
      queryClient.invalidateQueries({ queryKey: ["progress", id] });
      queryClient.invalidateQueries({ queryKey: ["available-statuses", id] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Явц шинэчлэхэд алдаа гарлаа")),
  });

  const needsDecree = selectedStatus === ACQ_STATUS.CONFIRMED;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[15px] font-bold text-slate-800 dark:text-white">
            Явц солих
          </p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Шилжүүлэх төлөв
            </p>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(Number(e.target.value))}
              className={sel}
            >
              {availableStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {needsDecree && (
            <>
              <div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
                  НЗД-ын захирамжийн дугаар{" "}
                  <span className="text-red-400">*</span>
                </p>
                <input
                  type="text"
                  value={decreeNumber}
                  onChange={(e) => setDecreeNumber(e.target.value)}
                  placeholder="А/ХХХ-2024"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
                  НЗД-ын захирамжийн огноо{" "}
                  <span className="text-red-400">*</span>
                </p>
                <input
                  type="date"
                  value={decreeDate}
                  onChange={(e) => setDecreeDate(e.target.value)}
                  className={inp}
                />
              </div>
            </>
          )}
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">
              Тайлбар{" "}
              <span className="text-slate-300 dark:text-slate-600">
                (заавал биш)
              </span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Шилжүүлэх шалтгаан..."
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
            >
              Болих
            </button>
            <button
              onClick={() => advanceMutation.mutate()}
              disabled={
                !selectedStatus ||
                (needsDecree && (!decreeNumber || !decreeDate)) ||
                advanceMutation.isPending
              }
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
            >
              {advanceMutation.isPending ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Шилжүүлэх
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress tab ─────────────────────────────────────────────────────────────
function ProgressTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [showModal, setShowModal] = useState(false);

  const { data: acq } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
  });
  const { data: progress = [], isLoading } = useQuery({
    queryKey: ["progress", id],
    queryFn: () => landApi.getProgress(id),
  });
  const { data: availableStatuses = [] } = useQuery({
    queryKey: ["available-statuses", id],
    queryFn: () => landApi.getAvailableStatuses(id),
    enabled: canEdit,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Status card */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">
              Одоогийн төлөв
            </p>
            {acq && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  color: STATUS_CFG[acq.status]?.color,
                  background: STATUS_CFG[acq.status]?.bg,
                }}
              >
                {STATUS_LABELS[acq.status]}
              </span>
            )}
          </div>
          {canEdit && availableStatuses.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
            >
              <ChevronRight className="h-4 w-4" /> Явц солих
            </button>
          )}
          {canEdit && availableStatuses.length === 0 && acq && (
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              Эцсийн шатанд хүрсэн
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <AdvanceModal
          id={id}
          availableStatuses={availableStatuses}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Progress table */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Явцын түүх
          </p>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : !progress.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Clock className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Явцын бичлэг байхгүй</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {[
                    "#",
                    "Өмнөх төлөв",
                    "Шинэ төлөв",
                    "Тайлбар",
                    "Хэрэглэгч",
                    "Огноо",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {progress.map((p, i) => {
                  const from = STATUS_CFG[p.from_status] ?? STATUS_CFG[1];
                  const to = STATUS_CFG[p.to_status] ?? STATUS_CFG[1];
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                    >
                      <td className="px-4 py-3 text-[12px] font-mono text-slate-400 dark:text-slate-500">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: from.color, background: from.bg }}
                        >
                          {STATUS_LABELS[p.from_status] ?? p.from_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: to.color, background: to.bg }}
                        >
                          {STATUS_LABELS[p.to_status] ?? p.to_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                        {p.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {p.changed_by}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(p.changed_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assignees tab ────────────────────────────────────────────────────────────
type UserOption = { id: string; first_name: string; last_name: string; email: string; position?: string };

function AssigneesTab({ id, canEdit }: { id: string; canEdit: boolean }) {
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

const RIGHT_TYPE_OPTIONS = [
  { value: 1, label: "Ашиглах" },
  { value: 2, label: "Эзэмших" },
  { value: 3, label: "Өмчлөх" },
];

// ─── Parcels tab ──────────────────────────────────────────────────────────────
function ParcelsTab({
  id,
  acquisitionProfOrgId,
  isAcqLocked = false,
}: {
  id: string;
  acquisitionProfOrgId?: string | null;
  isAcqLocked?: boolean;
}) {
  const queryClient = useQueryClient();
  const isExternal = isExternalSpecialRole();
  const currentUserId = getCurrentUserId();
  const isMainProfOrg = isExternal && acquisitionProfOrgId === currentUserId;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [filterForm, setFilterForm] = useState({
    parcel_id: "",
    right_type: 0,
    landuse: "",
    status_id: 0,
  });
  const [filter, setFilter] = useState({
    parcel_id: "",
    right_type: 0,
    landuse: "",
    status_id: 0,
  });
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null);
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);

  const { data: parcelStatuses = [] } = useQuery<ParcelStatus[]>({
    queryKey: ["parcel-statuses"],
    queryFn: () => parcelStatusApi.list(),
  });

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ["land-parcels", id, filter],
    queryFn: () =>
      landApi.getParcels(id, { page: 1, page_size: 100, ...filter }),
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", id],
    queryFn: () => landApi.listCompensations(id),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: (parcelId: string) => landApi.syncParcel(id, parcelId),
    onSuccess: () => {
      toast.success("Синхрончлогдлоо");
      queryClient.invalidateQueries({ queryKey: ["land-parcels", id] });
      window.location.reload();
    },
    onError: (err) => toast.error(getApiError(err, "Синхрончлоход алдаа гарлаа")),
  });

  const compensationMutation = useMutation({
    mutationFn: ({ parcelId, paid }: { parcelId: string; paid: boolean }) =>
      landApi.setParcelCompensation(id, parcelId, paid),
    onSuccess: () => {
      toast.success("Нөхөн төлбөрийн төлөв шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["land-parcels", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Нөхөн төлбөр шинэчлэхэд алдаа гарлаа")),
  });

  const compsByParcel = allComps.reduce<Record<string, Compensation[]>>(
    (acc, c) => {
      (acc[c.parcel_id || ""] ??= []).push(c);
      return acc;
    },
    {},
  );

  const inp =
    "h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const visibleParcels = (parcels?.data ?? []).filter((parcel) =>
    canAccessParcel(
      parcel.status_name,
      acquisitionProfOrgId,
      parcel.independent_org_id,
    ),
  );

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                Нэгж талбарууд
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {isExternal ? visibleParcels.length : (parcels?.total ?? 0)} нэгж талбар
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Дугаараар хайх"
                value={filterForm.parcel_id}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, parcel_id: e.target.value }))
                }
                className={`${inp} w-40`}
              />
              <select
                value={filterForm.right_type}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    right_type: e.target.value ? Number(e.target.value) : 0,
                  }))
                }
                className={`${inp} w-36`}
              >
                <option value="">Эрхийн төрөл</option>
                {RIGHT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Газрын зориулалт"
                value={filterForm.landuse}
                onChange={(e) =>
                  setFilterForm((f) => ({ ...f, landuse: e.target.value }))
                }
                className={`${inp} w-40`}
              />
              <select
                value={filterForm.status_id}
                onChange={(e) =>
                  setFilterForm((f) => ({
                    ...f,
                    status_id: e.target.value ? Number(e.target.value) : 0,
                  }))
                }
                className={`${inp} w-36`}
              >
                <option value="">Төлөв</option>
                {parcelStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setFilter({ ...filterForm })}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-[#02c0ce] hover:bg-[#02aebb] transition-colors"
              >
                Хайх
              </button>
              {(filter.parcel_id ||
                filter.right_type !== 0 ||
                filter.landuse ||
                filter.status_id !== 0) && (
                <button
                  onClick={() => {
                    const empty = { parcel_id: "", right_type: 0, landuse: "", status_id: 0 };
                    setFilterForm(empty);
                    setFilter(empty);
                  }}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] border border-slate-200 dark:border-white/[0.08] transition-colors"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>
        </div>

        {parcelsLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {[
                    "",
                    "Дугаар",
                    "Баг",
                    "Эрхийн төрөл",
                    "Газрын зориулалт",
                    "Талбай",
                    "Давхцал",
                    "Нөхөн төлбөр",
                    "Төлөв",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleParcels.map((p) => {
                  const comps = compsByParcel[p.parcel_id] ?? [];
                  const isOpen = expandedParcel === p.id;
                  const cashAmt = comps
                    .filter((c) => c.compensation_type === "cash")
                    .reduce((s, c) => s + c.amount, 0);
                  const landGrantAmt = comps
                    .filter((c) => c.compensation_type === "land_grant")
                    .reduce((s, c) => s + c.amount, 0);
                  const landGrantCount = comps.filter((c) => c.compensation_type === "land_grant").length;

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-[#37394d] transition-colors ${isOpen ? "bg-slate-50/80 dark:bg-[#1a1d20]" : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"}`}
                      >
                        <td className="pl-3 pr-1 py-2.5 w-8" />
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                          {p.parcel_id}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {p.au3_code}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {RIGHT_TYPE_OPTIONS.find(
                            (o) => o.value === p.right_type,
                          )?.label || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {p.landuse || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatArea(p.area_m2)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatArea(p.acquisition_area_m2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-1">
                            {cashAmt > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400 tabular-nums w-fit">
                                Мөнгөн&nbsp;{cashAmt.toLocaleString()}₮
                              </span>
                            )}
                            {landGrantCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400 w-fit">
                                Газраар{landGrantAmt > 0 ? <>&nbsp;{landGrantAmt.toLocaleString()}₮</> : <>&nbsp;{landGrantCount}</>}
                              </span>
                            )}
                            {comps.length === 0 && (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {p.status_name ? (
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                              style={getParcelStatusStyle(p.status, p.status_name)}
                            >
                              {p.status_name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isMainProfOrg && isAcqLocked ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 px-2.5 py-1 text-[11px] font-medium cursor-not-allowed select-none">
                                🔒 Хаалттай
                              </span>
                            ) : (
                              <Link
                                href={`/parcel/${p.id}?acq=${id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors"
                              >
                                <Info className="h-3 w-3" /> Дэлгэрэнгүй
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
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

// ─── Financing tab ────────────────────────────────────────────────────────────
function FinancingTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const isSenior = isSeniorSpecialist() && canEdit;

  const EMPTY_FORM = { organization_name: "", source_type: "", amount: "", currency: "MNT", note: "" };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["funding-sources", id],
    queryFn: () => landApi.listFundingSources(id),
  });

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
      queryClient.invalidateQueries({ queryKey: ["funding-sources", id] });
      closeForm();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (srcId: string) => landApi.deleteFundingSource(id, srcId),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["funding-sources", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const inp = "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  return (
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
                            onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(src.id); }}
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
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
async function generateReport(acqId: string) {
  const { authStorage } = await import("@/lib/auth");
  const token = authStorage.getAccessToken();

  const res = await fetch(`/api/report/acquisition/${acqId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Report generation failed");

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, ""))
    : "2010_тайлан.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam as Tab) ?? "general";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tabKey, setTabKey] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();

  function handleTabClick(key: Tab) {
    setTab(key);
    setTabKey((k) => k + 1);
  }
  const canEditBase = hasPermission("acquisition.create");

  const { data: acq, isLoading, error } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
    retry: (failCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return failCount < 2;
    },
  });

  const { data: accessParcels, isLoading: accessParcelsLoading } = useQuery({
    queryKey: ["land-parcels-access", id],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 1000 }),
    enabled: isExternal && isProfOrg && !!acq,
  });

  if (isLoading || accessParcelsLoading)
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
        <div className="h-12 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
        <div className="h-64 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
      </div>
    );

  const errStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  if (errStatus === 403)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтэд ажиллах эрх танд олгогдоогүй байна.
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
            Ахлах мэргэжилтэнтэй холбогдоно уу.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  if (!acq)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
        Олдсонгүй
      </div>
    );

  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1];
  const canAccessCurrentAcquisition = canAccessAcquisition(
    acq.professional_org_id,
    accessParcels?.data,
  );

  if (!canAccessCurrentAcquisition)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтөд таны байгууллага холбогдоогүй байна.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const isAcqLocked = acq?.status === ACQ_STATUS.CONFIRMED;

  // Баталгаажсан чөлөөлөлтийн дэлгэрэнгүйд гадаад байгуулгуудын хандалтыг хаана
  if (isExternal && isAcqLocked)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Дэлгэрэнгүй мэдээлэл хаалттай
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Энэ чөлөөлөлт <strong className="text-slate-600 dark:text-slate-300">Баталгаажсан</strong> төлөвтэй тул зөвхөн систем администратор харах боломжтой.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const canEdit = canEditBase && !isAcqLocked;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general",
      label: "Ерөнхий мэдээлэл",
      icon: <LayoutList className="h-4 w-4" />,
    },
    {
      key: "attachments",
      label: "Хавсралт",
      icon: <Paperclip className="h-4 w-4" />,
    },
    {
      key: "parcels",
      label: "Нэгж талбарууд",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: "financing",
      label: "Санхүүжилт",
      icon: <Calculator className="h-4 w-4" />,
    },
    { key: "progress", label: "Явц", icon: <Activity className="h-4 w-4" /> },
    {
      key: "assignees",
      label: "Ажилтнууд",
      icon: <Users className="h-4 w-4" />,
    },
    { key: "map", label: "Байршил", icon: <Map className="h-4 w-4" /> },
  ];
  const visibleTabs = isExternal
    ? TABS.filter((item) => item.key === "general" || item.key === "parcels")
    : TABS;
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : "general";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/acquisition"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {acq.acquisition_name || acq.plan_code}
            </h1>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: sc.color, background: sc.bg }}
            >
              {STATUS_LABELS[acq.status] ?? "Тодорхойгүй"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {acq.plan_code}
            {acq.plan_name ? ` · ${acq.plan_name}` : ""}
          </p>
        </div>
        {!isExternal && (
          <button
            disabled={reportLoading}
            onClick={async () => {
              setReportLoading(true);
              try {
                await generateReport(id);
              } catch {
                toast.error("Тайлан үүсгэхэд алдаа гарлаа");
              } finally {
                setReportLoading(false);
              }
            }}
            className="flex shrink-0 items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-50 transition-colors"
          >
            {reportLoading ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Тайлан татах
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[100px] whitespace-nowrap transition-all select-none
                ${
                  active
                    ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"
                }`}
            >
              {/* active indicator — top border */}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span
                className={`transition-colors ${active ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}`}
              >
                {t.icon}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-wide transition-colors ${active ? "text-[#02c0ce]" : ""}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content — key changes on every click (incl. re-click) → remount → fresh fetch */}
      {isAcqLocked && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3">
          <span className="text-amber-500 shrink-0">🔒</span>
          <p className="text-[13px] text-amber-700 dark:text-amber-400 font-medium">
            Энэ чөлөөлөлт <strong>Баталгаажсан</strong> төлөвтэй байгаа тул ямар нэгэн засвар хийх боломжгүй.
          </p>
        </div>
      )}
      {activeTab === "general" && <GeneralTab key={tabKey} id={id} canEdit={canEdit && !isExternal} />}
      {activeTab === "attachments" && <AttachmentsTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "progress" && <ProgressTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "parcels" && (
        <ParcelsTab
          key={tabKey}
          id={id}
          acquisitionProfOrgId={acq.professional_org_id}
          isAcqLocked={isAcqLocked}
        />
      )}
      {activeTab === "assignees" && <AssigneesTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "financing" && <FinancingTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "map" && (
        <div key={tabKey} className="ap-card p-5">
          <AcquisitionMap acquisitionId={id} aus={acq.aus} />
        </div>
      )}
    </div>
  );
}
