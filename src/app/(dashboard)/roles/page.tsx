"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi, permissionsApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { Shield, Plus, X, Trash2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

export default function RolesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const queryClient = useQueryClient();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });
  const { data: permsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionsApi.list(),
  });

  const createRoleMutation = useMutation({
    mutationFn: ({
      name,
      description,
    }: {
      name: string;
      description?: string;
    }) => rolesApi.create({ name, description }),
    onSuccess: () => {
      toast.success("Роль үүслээ");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    },
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string;
      name: string;
      description?: string;
    }) => rolesApi.update(id, { name, description }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setEditingId(null);
    },
    onError: (err) => toast.error(getApiError(err, "Засварлахад алдаа гарлаа")),
  });
  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRole(null);
    },
  });
  const assignPermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) =>
      rolesApi.assignPermission(roleId, permId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
    onError: (err) => toast.error(getApiError(err, "Эрх нэмэхэд алдаа")),
  });
  const removePermMutation = useMutation({
    mutationFn: ({ roleId, permId }: { roleId: string; permId: string }) =>
      rolesApi.removePermission(roleId, permId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  const role = rolesData?.data.find((r) => r.id === selectedRole);
  const assignedIds = new Set(role?.permissions?.map((p) => p.id) ?? []);

  const submit = () => {
    if (newName.trim())
      createRoleMutation.mutate({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Эрх & Роль
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Системийн хандалтын эрхийн тохиргоо
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          {showCreate ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Роль нэмэх
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-3">
            Шинэ роль
          </p>
          <div className="flex flex-col gap-3 max-w-md">
            <input
              placeholder="Ролийн нэр *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <input
              placeholder="Тайлбар (заавал биш)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={createRoleMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                Үүсгэх
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setNewDesc("");
                }}
                className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Roles list */}
        <div className="ap-card p-5">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
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
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-6">
              Роль олдсонгүй
            </p>
          ) : (
            <div className="space-y-1.5">
              {rolesData.data.map((r) => (
                <div
                  key={r.id}
                  className={`w-full rounded-lg border transition-all ${
                    r.id === selectedRole
                      ? "bg-[#02c0ce]/10 border-[#02c0ce]/30"
                      : "bg-slate-50 dark:bg-[#252630] border-transparent hover:border-slate-200 dark:hover:border-[#37394d]"
                  }`}
                >
                  {editingId === r.id ? (
                    <div className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2.5 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 mb-2"
                        placeholder="Ролийн нэр *"
                      />
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2.5 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 mb-2"
                        placeholder="Тайлбар (заавал биш)"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() =>
                            editName.trim() &&
                            updateRoleMutation.mutate({
                              id: r.id,
                              name: editName.trim(),
                              description: editDesc.trim() || undefined,
                            })
                          }
                          disabled={updateRoleMutation.isPending}
                          className="flex items-center gap-1 rounded-md bg-[#02c0ce] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
                        >
                          <Check className="h-3 w-3" />
                          Хадгалах
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Болих
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-3.5 cursor-pointer"
                      onClick={() =>
                        setSelectedRole(r.id === selectedRole ? null : r.id)
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Shield
                          className={`h-4 w-4 shrink-0 ${r.id === selectedRole ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-[13px] font-medium truncate ${r.id === selectedRole ? "text-[#02c0ce]" : "text-slate-700 dark:text-slate-200"}`}
                          >
                            {r.name}
                          </p>
                          {r.permissions?.length > 0 && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {r.permissions.length} эрх
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(r.id);
                            setEditName(r.name);
                            setEditDesc(r.description ?? "");
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 dark:bg-[#37394d] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#444] transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Устгах уу?"))
                              deleteRoleMutation.mutate(r.id);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions panel */}
        <div className="lg:col-span-2">
          {!selectedRole ? (
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
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                  {role?.description}
                </p>
                {/* <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Дарж эрх нэмэх / хасах
                </p> */}
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-2">
                  {permsData?.data?.map((perm) => {
                    const has = assignedIds.has(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => {
                          if (has)
                            removePermMutation.mutate({
                              roleId: selectedRole,
                              permId: perm.id,
                            });
                          else
                            assignPermMutation.mutate({
                              roleId: selectedRole,
                              permId: perm.id,
                            });
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                          has
                            ? "border-[#02c0ce]/40 bg-[#02c0ce]/5"
                            : "border-slate-200 dark:border-[#37394d] hover:border-[#02c0ce]/30 hover:bg-[#02c0ce]/5"
                        }`}
                      >
                        <span className="font-mono text-[12px] text-slate-600 dark:text-slate-300">
                          {perm.name}
                        </span>
                        {has && (
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: "#02c0ce" }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
