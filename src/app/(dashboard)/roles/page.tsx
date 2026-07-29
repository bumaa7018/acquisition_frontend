"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi, permissionsApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import {
  canEditRolePermissions,
  canGrantPermission,
  canListPermissions,
  canViewRoles,
} from "@/lib/role-utils";
import { Shield, ShieldCheck, Lock, Save, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

// Backend seed-ийн `resource` нэрсийн монгол тайлбар. Байхгүй бол түүхий
// нэрийг харуулна (шинэ resource нэмэгдэхэд ч UI эвдрэхгүй).
const RESOURCE_LABELS: Record<string, string> = {
  users: "Хэрэглэгч",
  roles: "Роль",
  permissions: "Эрх",
  admin: "Системийн тохиргоо",
  audit: "Үйлдлийн лог",
  land: "Газар чөлөөлөлт",
  compensation: "Нөхөх олговор / үнэлгээ",
  бусад: "Бусад",
};

const ACTION_LABELS: Record<string, string> = {
  read: "Харах",
  create: "Нэмэх",
  update: "Засах",
  delete: "Устгах",
};

function splitPermission(name: string): { resource: string; action: string } {
  const sep = name.includes(":") ? ":" : name.includes(".") ? "." : null;
  if (!sep) return { resource: "бусад", action: name };
  const [resource, ...rest] = name.split(sep);
  return { resource, action: rest.join(sep) };
}

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  // Эрхийн сонголтыг дарангуут хадгалахгүй — локал төлөвт хуримтлуулж,
  // "Хадгалах" дарахад л сервэрт нэг мөр илгээнэ.
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Эрх нь token-оос уншигддаг тул mount-ийн дараа тодорхой болно.
  const [ready, setReady] = useState(false);
  const [perms, setPerms] = useState({
    view: false,
    managePerms: false,
    listPerms: false,
  });

  useEffect(() => {
    setPerms({
      view: canViewRoles(),
      managePerms: canEditRolePermissions(),
      listPerms: canListPermissions(),
    });
    setReady(true);
  }, []);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
    enabled: ready && perms.view,
  });
  const { data: permsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionsApi.list(),
    // permissions:read эрхгүй бол 403 болох тул дуудахгүй.
    enabled: ready && perms.view && perms.listPerms,
  });
  const { data: roleDetail, isLoading: roleLoading } = useQuery({
    queryKey: ["role", selectedRole],
    queryFn: () => rolesApi.getById(selectedRole!),
    enabled: !!selectedRole && ready && perms.view,
  });

  const invalidateRoles = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] });
    queryClient.invalidateQueries({ queryKey: ["role"] });
    // Хэрэглэгчийн жагсаалтын роль badge-ууд ч хамаарна.
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  // Зөвхөн ЗӨРҮҮГ (нэмэгдсэн/хасагдсаныг) илгээнэ.
  const savePermsMutation = useMutation({
    mutationFn: async ({
      roleId,
      added,
      removed,
    }: {
      roleId: string;
      added: string[];
      removed: string[];
    }) => {
      for (const permId of added) {
        await rolesApi.assignPermission(roleId, permId);
      }
      for (const permId of removed) {
        await rolesApi.removePermission(roleId, permId);
      }
    },
    onSuccess: () => {
      toast.success("Эрхийн тохиргоо хадгалагдлаа");
      invalidateRoles();
    },
    onError: (err) => {
      toast.error(getApiError(err, "Эрх хадгалахад алдаа гарлаа"));
      // Хэсэгчлэн биелсэн байж мэдэх тул сервэрийн бодит төлөвийг татна.
      invalidateRoles();
    },
  });

  const assignedIds = useMemo(
    () => (roleDetail?.permissions ?? []).map((p) => p.id),
    [roleDetail],
  );

  // Роль сонгогдох / сервэрийн төлөв шинэчлэгдэхэд драфтыг тэгшитгэнэ.
  useEffect(() => {
    setDraftPerms(assignedIds);
  }, [assignedIds, selectedRole]);

  const permsAdded = draftPerms.filter((id) => !assignedIds.includes(id));
  const permsRemoved = assignedIds.filter((id) => !draftPerms.includes(id));
  const permsDirty = permsAdded.length > 0 || permsRemoved.length > 0;

  function togglePerm(permId: string) {
    setDraftPerms((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId],
    );
  }

  /** Роль солих — хадгалаагүй өөрчлөлт байвал асууна. */
  function selectRole(roleId: string) {
    const next = roleId === selectedRole ? null : roleId;
    if (permsDirty) {
      setPendingConfirm({
        title: "Хадгалаагүй өөрчлөлт байна",
        description:
          "Өөр рольд шилжвэл хадгалаагүй эрхийн өөрчлөлт хаягдана. Үргэлжлүүлэх үү?",
        confirmLabel: "Үргэлжлүүлэх",
        confirmColor: "#f59e0b",
        onConfirm: () => {
          setDraftPerms(assignedIds);
          setSelectedRole(next);
        },
      });
      return;
    }
    setSelectedRole(next);
  }

  /** Хадгалах — бусад хэсэгтэй ижил ConfirmDialog-оор батлуулна. */
  function confirmSavePerms() {
    if (!selectedRole || !permsDirty) return;
    const permNameById = new Map(
      (permsData?.data ?? []).map((p) => [p.id, p.name]),
    );
    const list = (ids: string[]) =>
      ids.map((id) => permNameById.get(id) ?? id).join(", ");
    const parts: string[] = [];
    if (permsAdded.length)
      parts.push(`Нэмэх (${permsAdded.length}): ${list(permsAdded)}`);
    if (permsRemoved.length)
      parts.push(`Хасах (${permsRemoved.length}): ${list(permsRemoved)}`);

    setPendingConfirm({
      title: `"${roleDetail?.name ?? ""}" ролийн эрхийг хадгалах уу?`,
      description: parts.join(" · "),
      confirmLabel: "Хадгалах",
      confirmColor: "#02c0ce",
      onConfirm: () =>
        savePermsMutation.mutate({
          roleId: selectedRole,
          added: permsAdded,
          removed: permsRemoved,
        }),
    });
  }

  const groupedPerms = useMemo(
    () =>
      Object.entries(
        (permsData?.data ?? []).reduce<
          Record<string, NonNullable<typeof permsData>["data"]>
        >((acc, perm) => {
          const { resource } = splitPermission(perm.name);
          if (!acc[resource]) acc[resource] = [];
          acc[resource]!.push(perm);
          return acc;
        }, {}),
      ),
    [permsData],
  );

  if (!ready) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
      </div>
    );
  }

  if (!perms.view) {
    return (
      <div className="ap-card p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-[#37394d]" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Энэ хуудсыг харах эрх байхгүй байна.
        </p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          Ролийн тохиргоо харахад <code>roles:read</code> эрх шаардлагатай.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Эрх &amp; Роль
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              Системд бүртгэлтэй ролиудын хандах эрхийн тохиргоо
            </p>
          </div>
          <div className="text-[13px] text-slate-400 dark:text-slate-500">
            Нийт:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {rolesData?.data?.length ?? 0}
            </span>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Roles list */}
          <div className="ap-card p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ролиуд
            </p>
            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]"
                  />
                ))}
              </div>
            ) : !rolesData?.data?.length ? (
              <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
                Роль олдсонгүй
              </p>
            ) : (
              <div className="space-y-1.5">
                {rolesData.data.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRole(r.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-all ${
                      r.id === selectedRole
                        ? "border-[#02c0ce]/30 bg-[#02c0ce]/10"
                        : "border-transparent bg-slate-50 hover:border-slate-200 dark:bg-[#252630] dark:hover:border-[#37394d]"
                    }`}
                  >
                    <Shield
                      className={`h-4 w-4 shrink-0 ${
                        r.id === selectedRole
                          ? "text-[#02c0ce]"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`truncate text-[13px] font-medium ${
                          r.id === selectedRole
                            ? "text-[#02c0ce]"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {r.name}
                      </p>
                      {r.description && (
                        <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {r.description}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {r.permissions?.length ?? 0} эрх
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Permissions panel */}
          <div className="lg:col-span-2">
            {!perms.listPerms ? (
              <div className="ap-card flex h-64 items-center justify-center p-6">
                <div className="text-center">
                  <Lock className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-[#37394d]" />
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    Эрхийн жагсаалт харах эрх байхгүй байна.
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">
                    <code>permissions:read</code> эрх шаардлагатай.
                  </p>
                </div>
              </div>
            ) : !selectedRole ? (
              <div className="ap-card flex h-64 items-center justify-center">
                <div className="text-center">
                  <Shield className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-[#37394d]" />
                  <p className="text-[13px] text-slate-400 dark:text-slate-500">
                    Роль сонгоно уу
                  </p>
                </div>
              </div>
            ) : (
              <div className="ap-card overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                    {roleDetail?.name}
                    {roleDetail?.description ? ` — ${roleDetail.description}` : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                    {perms.managePerms
                      ? "Дарж эрх нэмэх / хасаад Хадгалах дарна. Танд байхгүй эрхийг олгох боломжгүй."
                      : "Зөвхөн харах — эрх өөрчлөхөд roles:update шаардлагатай."}
                  </p>
                </div>

                <div className="p-5">
                  {roleLoading ? (
                    <div className="grid grid-cols-2 gap-2 animate-pulse">
                      {[...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="h-11 rounded-lg bg-slate-100 dark:bg-[#252630]"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {groupedPerms.map(([resource, resourcePerms]) => (
                        <div key={resource}>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {RESOURCE_LABELS[resource] ?? resource}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {resourcePerms!.map((perm) => {
                              const has = draftPerms.includes(perm.id);
                              const changed =
                                has !== assignedIds.includes(perm.id);
                              const { action } = splitPermission(perm.name);
                              // Өөрт байхгүй эрхийг олгох/хураах боломжгүй —
                              // backend-ийн escalation шалгалттай ижил.
                              const grantable = canGrantPermission(perm.name);
                              const editable = perms.managePerms && grantable;
                              return (
                                <button
                                  key={perm.id}
                                  type="button"
                                  disabled={
                                    !editable || savePermsMutation.isPending
                                  }
                                  title={
                                    !perms.managePerms
                                      ? "Эрх өөрчлөхөд roles:update шаардлагатай"
                                      : !grantable
                                        ? "Танд байхгүй эрхийг олгох боломжгүй"
                                        : perm.description || perm.name
                                  }
                                  onClick={() =>
                                    editable && togglePerm(perm.id)
                                  }
                                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                                    has
                                      ? "border-[#02c0ce]/40 bg-[#02c0ce]/5"
                                      : "border-slate-200 dark:border-[#37394d]"
                                  } ${changed ? "ring-2 ring-amber-400/40" : ""} ${
                                    editable
                                      ? "hover:border-[#02c0ce]/30 hover:bg-[#02c0ce]/5"
                                      : "cursor-not-allowed opacity-60"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[12px] font-medium text-slate-600 dark:text-slate-300">
                                      {ACTION_LABELS[action] ?? action}
                                    </p>
                                    <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                      {perm.name}
                                    </p>
                                  </div>
                                  {has ? (
                                    <span
                                      className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                      style={{ background: "#02c0ce" }}
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    !editable && (
                                      <Lock className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                                    )
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Хадгалах / Болих — өөрчлөлт байгаа үед л гарна */}
                {perms.managePerms && (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      {permsDirty ? (
                        <>
                          Хадгалаагүй өөрчлөлт:{" "}
                          {permsAdded.length > 0 && (
                            <span className="font-semibold text-[#02c0ce]">
                              +{permsAdded.length}
                            </span>
                          )}
                          {permsAdded.length > 0 && permsRemoved.length > 0 && " / "}
                          {permsRemoved.length > 0 && (
                            <span className="font-semibold text-[#f1556c]">
                              −{permsRemoved.length}
                            </span>
                          )}
                        </>
                      ) : (
                        "Өөрчлөлт байхгүй"
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      {permsDirty && (
                        <button
                          type="button"
                          onClick={() => setDraftPerms(assignedIds)}
                          disabled={savePermsMutation.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-60 dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-300"
                        >
                          <X className="h-3.5 w-3.5" />
                          Болих
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={confirmSavePerms}
                        disabled={!permsDirty || savePermsMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#02a3af] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savePermsMutation.isPending
                          ? "Хадгалж байна…"
                          : "Хадгалах"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
