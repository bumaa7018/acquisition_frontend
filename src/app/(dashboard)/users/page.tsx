"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, rolesApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { UserPlus, Trash2, X, Users, Pencil, KeyRound } from "lucide-react";
import type { User } from "@/types";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createSchema = z
  .object({
    first_name: z.string().min(1, "Нэр оруулна уу"),
    last_name: z.string().min(1, "Овог оруулна уу"),
    username: z
      .string()
      .min(1, "Хэрэглэгчийн нэр оруулна уу")
      .regex(/^[a-zA-Z0-9_]+$/, "Зөвхөн англи үсэг, тоо, доогуур зураас (_)"),
    position: z.string().optional(),
    email: z.string().email("Имэйл буруу"),
    password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт"),
    confirm_password: z.string().min(1, "Нууц үгийг давтана уу"),
    is_active: z.boolean().default(true),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirm_password"],
  });
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  first_name: z.string().min(1, "Нэр оруулна уу"),
  last_name: z.string().min(1, "Овог оруулна уу"),
  username: z
    .string()
    .min(1, "Хэрэглэгчийн нэр оруулна уу")
    .regex(/^[a-zA-Z0-9_]+$/, "Зөвхөн англи үсэг, тоо, доогуур зураас (_)"),
  position: z.string().optional(),
  email: z.string().email("Имэйл буруу"),
  is_active: z.boolean().default(true),
});
type EditForm = z.infer<typeof editSchema>;

const pwSchema = z
  .object({
    new_password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт"),
    confirm_password: z.string().min(1, "Нууц үгийг давтана уу"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirm_password"],
  });
type PwForm = z.infer<typeof pwSchema>;

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

export default function UsersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<string | null>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ page: 1, page_size: 50 }),
  });
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: async ({ confirm_password: _, role, ...body }: CreateForm & { role: string | null }) => {
      const user = await usersApi.create({ ...body });
      if (role && user?.id) {
        await usersApi.update(user.id, { role_ids: [role] });
      }
      return user;
    },
    onSuccess: () => {
      toast.success("Хэрэглэгч үүслээ");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setSelectedRole(null);
      reset();
    },
    onError: (err) => toast.error(getApiError(err, "Үүсгэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success("Устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгах боломжгүй")),
  });

  const pwMutation = useMutation({
    mutationFn: ({ password }: { password: string }) =>
      usersApi.changePassword(pwUser!.id, password),
    onSuccess: () => {
      toast.success("Нууц үг шинэчлэгдлээ");
      setPwUser(null);
      pwReset();
    },
    onError: (err) =>
      toast.error(getApiError(err, "Нууц үг солиход алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ role, ...body }: EditForm & { role: string | null }) =>
      usersApi.update(editingUser!.id, {
        ...body,
        role_ids: role ? [role] : [],
      }),
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setEditRole(null);
      editReset();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { is_active: true },
  });

  const {
    register: editRegister,
    handleSubmit: editHandleSubmit,
    reset: editReset,
    formState: { errors: editErrors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const {
    register: pwRegister,
    handleSubmit: pwHandleSubmit,
    reset: pwReset,
    formState: { errors: pwErrors },
  } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  function openEdit(user: User) {
    setEditingUser(user);
    setEditRole(user.roles?.[0]?.id ?? null);
    setShowCreate(false);
    editReset({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username ?? "",
      position: user.position ?? "",
      email: user.email,
      is_active: user.is_active !== false,
    });
  }

  const fields: [keyof CreateForm, string, string][] = [
    ["first_name", "Нэр", "text"],
    ["last_name", "Овог", "text"],
    ["username", "Хэрэглэгчийн нэр (username)", "text"],
    ["position", "Албан тушаал", "text"],
    ["email", "Имэйл", "email"],
  ];

  const editFields: [keyof EditForm, string, string][] = [
    ["first_name", "Нэр", "text"],
    ["last_name", "Овог", "text"],
    ["username", "Хэрэглэгчийн нэр (username)", "text"],
    ["position", "Албан тушаал", "text"],
    ["email", "Имэйл", "email"],
  ];

  const HEADERS = [
    "Хэрэглэгч",
    "Хэрэглэгчийн нэр",
    "Албан тушаал",
    "Имэйл",
    "Роль",
    "Идэвхитэй",
    "",
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Хэрэглэгчид
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Нийт {data?.total ?? 0} хэрэглэгч
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          {showCreate ? (
            <X className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {showCreate ? "Болих" : "Нэмэх"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            Шинэ хэрэглэгч
          </p>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate({ ...d, role: selectedRole }))}
            className="grid grid-cols-2 gap-4"
          >
            {fields.map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {label}
                </label>
                <input type={type} {...register(field)} className={inputCls} />
                {errors[field] && (
                  <p className="mt-1 text-[11px] text-[#f1556c]">
                    {errors[field]?.message}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Роль
              </label>
              <select
                value={selectedRole ?? ""}
                onChange={(e) => setSelectedRole(e.target.value || null)}
                className={inputCls}
                disabled={rolesLoading}
              >
                <option value="">— Роль сонгох —</option>
                {rolesData?.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 border-t border-slate-100 dark:border-[#37394d]" />
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Нууц үг
              </label>
              <input
                type="password"
                {...register("password")}
                className={inputCls}
              />
              {errors.password && (
                <p className="mt-1 text-[11px] text-[#f1556c]">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Нууц үг давтах
              </label>
              <input
                type="password"
                {...register("confirm_password")}
                className={inputCls}
              />
              {errors.confirm_password && (
                <p className="mt-1 text-[11px] text-[#f1556c]">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  {...register("is_active")}
                  className="sr-only peer"
                />
                <div className="relative h-5 w-9 rounded-full bg-slate-200 dark:bg-[#37394d] transition-colors peer-checked:bg-[#02c0ce] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  Идэвхитэй
                </span>
              </label>
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                Үүсгэх
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setSelectedRole(null);
                  reset();
                }}
                className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingUser && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            Хэрэглэгч засах — {editingUser.first_name} {editingUser.last_name}
          </p>
          <form
            onSubmit={editHandleSubmit((d) => updateMutation.mutate({ ...d, role: editRole }))}
            className="grid grid-cols-2 gap-4"
          >
            {editFields.map(([field, label, type]) => (
              <div key={field}>
                <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  {...editRegister(field)}
                  className={inputCls}
                />
                {editErrors[field] && (
                  <p className="mt-1 text-[11px] text-[#f1556c]">
                    {editErrors[field]?.message}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Роль
              </label>
              <select
                value={editRole ?? ""}
                onChange={(e) => setEditRole(e.target.value || null)}
                className={inputCls}
                disabled={rolesLoading}
              >
                <option value="">— Роль сонгох —</option>
                {rolesData?.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  {...editRegister("is_active")}
                  className="sr-only peer"
                />
                <div className="relative h-5 w-9 rounded-full bg-slate-200 dark:bg-[#37394d] transition-colors peer-checked:bg-[#02c0ce] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  Идэвхитэй
                </span>
              </label>
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                Хадгалах
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditRole(null);
                }}
                className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change password form */}
      {pwUser && (
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">
            Нууц үг солих — {pwUser.first_name} {pwUser.last_name}
          </p>
          <form
            onSubmit={pwHandleSubmit((d) =>
              pwMutation.mutate({ password: d.new_password }),
            )}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Шинэ нууц үг
              </label>
              <input
                type="password"
                {...pwRegister("new_password")}
                className={inputCls}
              />
              {pwErrors.new_password && (
                <p className="mt-1 text-[11px] text-[#f1556c]">
                  {pwErrors.new_password.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Нууц үг давтах
              </label>
              <input
                type="password"
                {...pwRegister("confirm_password")}
                className={inputCls}
              />
              {pwErrors.confirm_password && (
                <p className="mt-1 text-[11px] text-[#f1556c]">
                  {pwErrors.confirm_password.message}
                </p>
              )}
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button
                type="submit"
                disabled={pwMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                Хадгалах
              </button>
              <button
                type="button"
                onClick={() => {
                  setPwUser(null);
                  pwReset();
                }}
                className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table card */}
      <div className="ap-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {HEADERS.map((h) => (
                      <td key={h} className="px-5 py-4">
                        <div className="h-4 rounded bg-slate-100 dark:bg-[#252630]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-[13px] text-[#f1556c]"
                  >
                    Алдаа гарлаа:{" "}
                    {(error as { message?: string })?.message ??
                      "Сервертэй холбогдож чадсангүй"}
                  </td>
                </tr>
              ) : !data?.data.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-[13px] text-slate-400 dark:text-slate-500"
                  >
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    Хэрэглэгч олдсонгүй
                  </td>
                </tr>
              ) : (
                data.data.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold"
                          style={{ background: "#02c0ce" }}
                        >
                          {user.first_name?.[0]?.toUpperCase()}
                        </div>
                        <p className="font-medium text-slate-800 dark:text-white">
                          {user.first_name} {user.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[12px]">
                      {user.username || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {user.position || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {user.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              color: "#777edd",
                              background: "#777edd18",
                            }}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.is_active !== false ? (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: "#02c0ce", background: "#02c0ce18" }}
                        >
                          Идэвхитэй
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: "#f1556c", background: "#f1556c18" }}
                        >
                          Идэвхгүй
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(user)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 dark:bg-[#252630] text-slate-500 dark:text-slate-400 hover:bg-[#02c0ce]/10 hover:text-[#02c0ce] transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setPwUser(user);
                            setEditingUser(null);
                            setShowCreate(false);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 dark:bg-[#252630] text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Устгах уу?"))
                              deleteMutation.mutate(user.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
