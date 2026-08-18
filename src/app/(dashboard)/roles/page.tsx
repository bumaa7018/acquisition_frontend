"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { menusApi, rolesApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { canEditRolePermissions, canListPermissions, canViewRoles, hasPermission, hasRole } from "@/lib/role-utils";
import type { Menu } from "@/types";
import { Check, Lock, Menu as MenuIcon, Plus, Save, Shield, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const ACTION_LABELS: Record<string, string> = {
  read: "Харах",
  create: "Нэмэх",
  update: "Засах",
  delete: "Устгах",
  "structure:create": "Бүтэц нэмэх",
};

function actionOf(name: string, fallback?: string) {
  if (fallback) return fallback;
  const i = name.indexOf(":");
  return i >= 0 ? name.slice(i + 1) : name;
}

function permissionIds(menu?: Menu | null) {
  return (menu?.permissions ?? []).map((p) => p.id);
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [editRole, setEditRole] = useState({ name: "", description: "" });
  const [cap, setCap] = useState({
    view: false,
    manage: false,
    listPermissions: false,
    createRole: false,
    updateRole: false,
  });

  useEffect(() => {
    setCap({
      view: canViewRoles(),
      manage: canEditRolePermissions(),
      listPermissions: canListPermissions(),
      createRole: hasPermission("roles:create") || hasRole("admin"),
      updateRole: hasPermission("roles:update") || hasRole("admin"),
    });
    setReady(true);
  }, []);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
    enabled: ready && cap.view,
  });
  const menusQuery = useQuery({
    queryKey: ["menus"],
    queryFn: () => menusApi.list(),
    enabled: ready && cap.view && cap.listPermissions,
  });
  const roleQuery = useQuery({
    queryKey: ["role", selectedRole],
    queryFn: () => rolesApi.getById(selectedRole!),
    enabled: !!selectedRole && ready && cap.view,
  });

  const roles = useMemo(() => rolesQuery.data?.data ?? [], [rolesQuery.data]);
  const menus = useMemo(() => menusQuery.data?.data ?? [], [menusQuery.data]);
  const roleDetail = roleQuery.data;
  const availableMenu = useMemo(
    () => menus.find((m) => m.id === selectedMenu) ?? null,
    [menus, selectedMenu],
  );
  const assignedMenu = useMemo(
    () => (roleDetail?.menus ?? []).find((m) => m.id === selectedMenu) ?? null,
    [roleDetail, selectedMenu],
  );
  const assignedIds = useMemo(() => permissionIds(assignedMenu), [assignedMenu]);
  const added = draftPermissionIds.filter((id) => !assignedIds.includes(id));
  const removed = assignedIds.filter((id) => !draftPermissionIds.includes(id));
  const dirty = added.length > 0 || removed.length > 0;

  useEffect(() => {
    setEditRole({
      name: roleDetail?.name ?? "",
      description: roleDetail?.description ?? "",
    });
  }, [roleDetail?.id, roleDetail?.name, roleDetail?.description]);

  useEffect(() => {
    setDraftPermissionIds(assignedIds);
  }, [assignedIds, selectedMenu]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] });
    queryClient.invalidateQueries({ queryKey: ["role"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const createRoleMutation = useMutation({
    mutationFn: () => rolesApi.create(newRole),
    onSuccess: (role) => {
      toast.success("Роль үүслээ");
      setNewRole({ name: "", description: "" });
      setSelectedRole(role.id);
      invalidate();
    },
    onError: (err) => toast.error(getApiError(err, "Роль үүсгэхэд алдаа гарлаа")),
  });

  const updateRoleMutation = useMutation({
    mutationFn: () => rolesApi.update(selectedRole!, editRole),
    onSuccess: () => {
      toast.success("Роль шинэчлэгдлээ");
      invalidate();
    },
    onError: (err) => toast.error(getApiError(err, "Роль засахад алдаа гарлаа")),
  });

  const saveMutation = useMutation({
    mutationFn: () => rolesApi.setMenuPermissions(selectedRole!, selectedMenu!, draftPermissionIds),
    onSuccess: () => {
      toast.success("Menu permission хадгалагдлаа");
      invalidate();
    },
    onError: (err) => {
      toast.error(getApiError(err, "Menu permission хадгалахад алдаа гарлаа"));
      invalidate();
    },
  });

  const removeMenuMutation = useMutation({
    mutationFn: () => rolesApi.removeMenu(selectedRole!, selectedMenu!),
    onSuccess: () => {
      toast.success("Menu холбоос хасагдлаа");
      setDraftPermissionIds([]);
      invalidate();
    },
    onError: (err) => toast.error(getApiError(err, "Menu хасахад алдаа гарлаа")),
  });

  function guardUnsaved(next: () => void) {
    if (!dirty) {
      next();
      return;
    }
    setPendingConfirm({
      title: "Хадгалаагүй өөрчлөлт байна",
      description: "Сонголт соливол хадгалаагүй permission өөрчлөлт хаягдана.",
      confirmLabel: "Үргэлжлүүлэх",
      confirmColor: "#f59e0b",
      onConfirm: next,
    });
  }

  function confirmSave() {
    if (!selectedRole || !selectedMenu || !dirty) return;
    setPendingConfirm({
      title: "Permission тохиргоог хадгалах уу?",
      description: `Нэмэх: ${added.length}, хасах: ${removed.length}`,
      confirmLabel: "Хадгалах",
      confirmColor: "#02c0ce",
      onConfirm: () => saveMutation.mutate(),
    });
  }

  function confirmRemoveMenu() {
    if (!selectedRole || !selectedMenu) return;
    setPendingConfirm({
      title: "Menu холбоосыг хасах уу?",
      description: "Энэ role + menu дээрх бүх permission мөр sd_role_permission-оос устна.",
      confirmLabel: "Хасах",
      confirmColor: "#f1556c",
      onConfirm: () => removeMenuMutation.mutate(),
    });
  }

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
        <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
      </div>
    );
  }

  if (!cap.view) {
    return (
      <div className="ap-card p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-[#37394d]" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Энэ хуудсыг харах эрх байхгүй байна.</p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          Ролийн тохиргоо харахад <code>roles:read</code> эрх шаардлагатай.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Хэрэглэгчийн эрх</h1>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              Role {"->"} menu {"->"} permission бүтэцтэй system_id=10 тохиргоо
            </p>
          </div>
          <div className="text-[13px] text-slate-400 dark:text-slate-500">
            Роль: <span className="font-semibold text-slate-700 dark:text-slate-200">{roles.length}</span>
          </div>
        </div>

        {cap.createRole && (
          <div className="ap-card grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={newRole.name}
              onChange={(e) => setNewRole((v) => ({ ...v, name: e.target.value }))}
              placeholder="Шинэ role нэр"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-100"
            />
            <input
              value={newRole.description}
              onChange={(e) => setNewRole((v) => ({ ...v, description: e.target.value }))}
              placeholder="Тайлбар"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-100"
            />
            <button
              type="button"
              disabled={!newRole.name.trim() || createRoleMutation.isPending}
              onClick={() => createRoleMutation.mutate()}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Үүсгэх
            </button>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[280px_320px_1fr]">
          <div className="ap-card p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Role</p>
            {rolesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      guardUnsaved(() => {
                        setSelectedRole(role.id === selectedRole ? null : role.id);
                        setSelectedMenu(null);
                      })
                    }
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedRole === role.id
                        ? "border-[#02c0ce]/40 bg-[#02c0ce]/10"
                        : "border-transparent bg-slate-50 hover:border-slate-200 dark:bg-[#252630] dark:hover:border-[#37394d]"
                    }`}
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#02c0ce]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-slate-700 dark:text-slate-100">{role.name}</span>
                      <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {role.menus?.length ?? 0} menu · {role.permissions?.length ?? 0} permission
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ap-card p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Menu</p>
            {!selectedRole ? (
              <p className="py-8 text-center text-[13px] text-slate-400">Role сонгоно уу</p>
            ) : !cap.listPermissions ? (
              <p className="py-8 text-center text-[13px] text-slate-400">
                Menu харахад <code>permissions:read</code> эрх шаардлагатай.
              </p>
            ) : (
              <div className="space-y-1.5">
                {menus.map((menu) => {
                  const assigned = (roleDetail?.menus ?? []).some((m) => m.id === menu.id);
                  const active = selectedMenu === menu.id;
                  const menuTone = active
                    ? assigned
                      ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200 dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:ring-emerald-400/20"
                      : "border-[#02c0ce]/40 bg-[#02c0ce]/10"
                    : assigned
                      ? "border-emerald-300 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:hover:border-emerald-400/70"
                      : "border-slate-100 hover:border-slate-200 dark:border-[#252630] dark:hover:border-[#37394d]";
                  return (
                    <button
                      key={menu.id}
                      type="button"
                      onClick={() => guardUnsaved(() => setSelectedMenu(active ? null : menu.id))}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${menuTone}`}
                    >
                      <MenuIcon className={`mt-0.5 h-4 w-4 shrink-0 ${assigned ? "text-emerald-500" : "text-slate-400"}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-semibold ${assigned ? "text-emerald-800 dark:text-emerald-100" : "text-slate-700 dark:text-slate-100"}`}>
                          {menu.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {menu.code} · {(menu.permissions ?? []).length} permission
                        </span>
                      </span>
                      {assigned && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ap-card overflow-hidden">
            <div className="border-b border-slate-100 p-4 dark:border-[#37394d]">
              {selectedRole && cap.updateRole ? (
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={editRole.name}
                    onChange={(e) => setEditRole((v) => ({ ...v, name: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-100"
                  />
                  <input
                    value={editRole.description}
                    onChange={(e) => setEditRole((v) => ({ ...v, description: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#02c0ce] dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!editRole.name.trim() || updateRoleMutation.isPending}
                    onClick={() => updateRoleMutation.mutate()}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 disabled:opacity-50 dark:border-[#37394d] dark:text-slate-100"
                  >
                    <Save className="h-4 w-4" />
                    Role засах
                  </button>
                </div>
              ) : (
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-100">{roleDetail?.name ?? "Permission тохиргоо"}</p>
              )}
              <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
                Menu сонгоод sd_form_permission дээр зөвшөөрөгдсөн permission-үүдээс сонгож хадгална.
              </p>
            </div>

            <div className="p-4">
              {!selectedRole || !selectedMenu ? (
                <div className="flex h-64 items-center justify-center text-center text-[13px] text-slate-400">Role болон menu сонгоно уу</div>
              ) : roleQuery.isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(availableMenu?.permissions ?? []).map((perm) => {
                    const checked = draftPermissionIds.includes(perm.id);
                    const action = actionOf(perm.name, perm.action);
                    const editable = cap.manage && (hasRole("admin") || hasPermission(perm.name));
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        disabled={!editable || saveMutation.isPending}
                        onClick={() => editable && setDraftPermissionIds((prev) => (prev.includes(perm.id) ? prev.filter((x) => x !== perm.id) : [...prev, perm.id]))}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                          checked ? "border-[#02c0ce]/40 bg-[#02c0ce]/5" : "border-slate-200 dark:border-[#37394d]"
                        } ${editable ? "hover:border-[#02c0ce]/40" : "cursor-not-allowed opacity-60"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{ACTION_LABELS[action] ?? action}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{perm.name}</span>
                        </span>
                        {checked ? (
                          <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#02c0ce] text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : (
                          !editable && <Lock className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedRole && selectedMenu && cap.manage && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-[#37394d]">
                <p className="text-[12px] text-slate-500 dark:text-slate-400">{dirty ? `Хадгалаагүй: +${added.length} / -${removed.length}` : "Өөрчлөлт байхгүй"}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!assignedMenu || removeMenuMutation.isPending}
                    onClick={confirmRemoveMenu}
                    className="flex items-center gap-1.5 rounded-lg border border-[#f1556c]/30 px-4 py-2 text-[13px] font-semibold text-[#f1556c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Menu хасах
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      disabled={saveMutation.isPending}
                      onClick={() => setDraftPermissionIds(assignedIds)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 disabled:opacity-50 dark:border-[#37394d] dark:text-slate-300"
                    >
                      <X className="h-4 w-4" />
                      Болих
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!dirty || saveMutation.isPending}
                    onClick={confirmSave}
                    className="flex items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Хадгалах
                  </button>
                </div>
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
