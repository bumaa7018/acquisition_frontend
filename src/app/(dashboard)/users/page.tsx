"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { UserPlus, Trash2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createSchema = z.object({
  email: z.string().email("Имэйл буруу"),
  password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт"),
  first_name: z.string().min(1, "Нэр оруулна уу"),
  last_name: z.string().min(1, "Овог оруулна уу"),
});
type CreateForm = z.infer<typeof createSchema>;

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

export default function UsersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ page: 1, page_size: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateForm) => usersApi.create(body),
    onSuccess: () => {
      toast.success("Хэрэглэгч үүслээ");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const fields: [keyof CreateForm, string, string][] = [
    ["first_name", "Нэр", "text"],
    ["last_name", "Овог", "text"],
    ["email", "Имэйл", "email"],
    ["password", "Нууц үг", "password"],
  ];

  const HEADERS = ["Хэрэглэгч", "Имэйл", "Роль", ""];

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
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
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
              ) : !data?.data.length ? (
                <tr>
                  <td
                    colSpan={4}
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
                      <button
                        onClick={() => {
                          if (confirm("Устгах уу?"))
                            deleteMutation.mutate(user.id);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
