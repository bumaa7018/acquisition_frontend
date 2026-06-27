"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, usersApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { User, Mail, Shield, Save, Loader2 } from "lucide-react";

const editSchema = z.object({
  first_name: z.string().min(1, "Нэр оруулна уу"),
  last_name: z.string().min(1, "Овог оруулна уу"),
  position: z.string().optional(),
  email: z.string().email("Имэйл буруу"),
});
type EditForm = z.infer<typeof editSchema>;

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-[#3a3c4e] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [localUser, setLocalUser] =
    useState<ReturnType<typeof authStorage.getUser>>(null);

  useEffect(() => {
    setLocalUser(authStorage.getUser());
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name,
        last_name: user.last_name,
        position: user.position ?? "",
        email: user.email,
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: (body: EditForm) => usersApi.update(user!.id, body),
    onSuccess: (updated) => {
      toast.success("Хувийн мэдээлэл шинэчлэгдлээ");
      authStorage.setUser(updated);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      reset({
        first_name: updated.first_name,
        last_name: updated.last_name,
        position: updated.position ?? "",
        email: updated.email,
      });
    },
    onError: (err) => toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  const initials = (user ?? localUser)?.first_name
    ? `${(user ?? localUser)!.first_name[0]}${(user ?? localUser)!.last_name?.[0] ?? ""}`.toUpperCase()
    : null;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">
          Хувийн мэдээлэл
        </h1>
        {/* <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
          Хувийн мэдээлэл
        </p> */}
      </div>

      {/* Avatar + info card */}
      <div className="ap-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white text-lg font-bold"
            style={{ background: "#02c0ce" }}
          >
            {initials ?? <User className="h-6 w-6" />}
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-36 rounded bg-slate-100 dark:bg-[#252630] animate-pulse" />
                <div className="h-3 w-48 rounded bg-slate-100 dark:bg-[#252630] animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-slate-800 dark:text-white">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {user?.email}
                </p>
                {user?.position && (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {user.position}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Roles */}
      {user?.roles && user.roles.length > 0 && (
        <div className="ap-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
              Роль & Эрх
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold"
                style={{ color: "#777edd", background: "#777edd18" }}
              >
                {role.name}
              </span>
            ))}
          </div>
          {user.roles.flatMap((r) => r.permissions ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.roles
                .flatMap((r) => r.permissions ?? [])
                .map((perm) => (
                  <span
                    key={perm.id}
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#252630]"
                  >
                    {perm.name}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      <div className="ap-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Мэдээлэл засах
          </p>
        </div>
        <form
          onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
          className="grid grid-cols-2 gap-4"
        >
          {(
            [
              ["first_name", "Нэр"],
              ["last_name", "Овог"],
              ["position", "Албан тушаал"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {label}
              </label>
              <input {...register(field)} className={inputCls} />
              {errors[field] && (
                <p className="mt-1 text-[11px] text-[#f1556c]">
                  {errors[field]?.message}
                </p>
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Имэйл
            </label>
            <input
              {...register("email")}
              type="email"
              className={`${inputCls} cursor-default bg-slate-50 dark:bg-[#252630] text-slate-400 dark:text-slate-500`}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-[#f1556c]">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="col-span-2 pt-1">
            <button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Хадгалах
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
