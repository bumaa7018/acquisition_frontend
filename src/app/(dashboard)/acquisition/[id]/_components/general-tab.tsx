"use client";
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Pencil, Save, X, Calculator } from "lucide-react";
import { landApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { isProfessionalOrg } from "@/lib/role-utils";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import { calcAreaFromWkt } from "@/lib/geometry-utils";
import { STATUS_LABELS } from "@/types";
import { STATUS_CFG } from "./shared";

export function GeneralTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const isProfOrg = isProfessionalOrg();
  const { data: acq } = useQuery({
    queryKey: ["land", id],
    queryFn: () => (isProfOrg ? profApi.profGetAcquisition(id) : landApi.getById(id)),
  });
  // Санхүүжилтийн эх үүсвэр дэлгэрэнгүй API-тай хамт ирдэг — тусдаа дуудлага хийхгүй
  const fundingSources = acq?.funding_sources ?? [];
  const { data: generalCategories = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
  });
  const { data: professionalOrgUsers = [] } = useQuery({
    queryKey: ["professional-org-users"],
    queryFn: () => landApi.listProfessionalOrgUsers(),
    enabled: canEdit,
    staleTime: 60_000,
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    acquisition_name: "",
    implementing_org: "",
    reason: "",
    responsible_org: "",
    start_date: "",
    end_date: "",
  });
  const [generalCategoryId, setGeneralCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [professionalOrgId, setProfessionalOrgId] = useState<string>("");
  const { data: subCategories = [] } = useQuery({
    queryKey: ["acquisition-categories", generalCategoryId],
    queryFn: () => landApi.listCategories(generalCategoryId!),
    enabled: !!generalCategoryId,
    staleTime: Infinity,
  });
  const [areaM2, setAreaM2] = useState<string>("");
  const [areaAutoCalc, setAreaAutoCalc] = useState(false);
  const [boundaryFile, setBoundaryFile] = useState<File | null>(null);

  useEffect(() => {
    if (acq) {
      setForm({
        acquisition_name: acq.acquisition_name ?? "",
        implementing_org: acq.implementing_org ?? "",
        reason: acq.reason ?? "",
        responsible_org: acq.responsible_org ?? "",
        start_date: acq.start_date ?? "",
        end_date: acq.end_date ?? "",
      });
      setGeneralCategoryId(acq.general_category_id ?? null);
      setSubCategoryId(acq.sub_category_id ?? null);
      setProfessionalOrgId(acq.professional_org_id ?? "");
      setAreaM2(String(acq.area_m2 ?? ""));
      setAreaAutoCalc(false);
      setBoundaryFile(null);
    }
  }, [acq]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (form.start_date) fd.append("start_date", form.start_date);
      if (form.end_date) fd.append("end_date", form.end_date);
      else if (acq?.end_date) fd.append("clear_end_date", "true");
      fd.append("acquisition_name", form.acquisition_name);
      fd.append("implementing_org", form.implementing_org);
      fd.append("reason", form.reason);
      fd.append("responsible_org", form.responsible_org);
      if (generalCategoryId)
        fd.append("general_category_id", String(generalCategoryId));
      if (subCategoryId)
        fd.append("sub_category_id", String(subCategoryId));
      if (professionalOrgId) {
        fd.append("professional_org_id", professionalOrgId);
      } else if (acq?.professional_org_id) {
        fd.append("clear_professional_org", "true");
      }
      const areaVal = parseFloat(areaM2);
      if (!isNaN(areaVal) && areaVal > 0)
        fd.append("area_m2", String(areaVal));
      if (boundaryFile) fd.append("shapefile", boundaryFile);
      return landApi.update(id, fd);
    },
    onSuccess: () => {
      toast.success("Хадгалагдлаа");
      setEditing(false);
      setAreaAutoCalc(false);
      setBoundaryFile(null);
      queryClient.invalidateQueries({ queryKey: ["land", id] });
      queryClient.invalidateQueries({ queryKey: ["land-parcels", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  if (!acq) return null;
  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1];
  const parcelCount = acq.parcel_count ?? 0;
  const totalAcqAreaM2 = Number(acq.area_m2) || 0;
  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const resetForm = () => {
    setForm({
      acquisition_name: acq.acquisition_name ?? "",
      implementing_org: acq.implementing_org ?? "",
      reason: acq.reason ?? "",
      responsible_org: acq.responsible_org ?? "",
      start_date: acq.start_date ?? "",
      end_date: acq.end_date ?? "",
    });
    setGeneralCategoryId(acq.general_category_id ?? null);
    setSubCategoryId(acq.sub_category_id ?? null);
    setProfessionalOrgId(acq.professional_org_id ?? "");
    setAreaM2(String(acq.area_m2 ?? ""));
    setAreaAutoCalc(false);
    setBoundaryFile(null);
  };

  const row = (label: string, value: React.ReactNode, last = false) => (
    <div
      key={label}
      className={`flex items-center gap-3 py-2.5 ${last ? "" : "border-b border-slate-100 dark:border-[#37394d]"}`}
    >
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
        {label}
      </span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="ap-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
          Мэдээлэл
        </p>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold transition-colors hover:text-[#02c0ce]"
                style={{ color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#02c0ce";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#02c0ce14";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#e2e8f0";
                  (e.currentTarget as HTMLButtonElement).style.background = "";
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Засах
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    resetForm();
                  }}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Болих
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
                >
                  {saveMutation.isPending ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Хадгалах
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Two columns separated by vertical line */}
      <div className="grid md:grid-cols-2">
        {/* Left — Үндсэн мэдээлэл */}
        <div className="px-5 py-4" style={{ borderRight: "1px solid #e2e8f0" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Үндсэн мэдээлэл
          </p>
          {row("Төлөвлөгөөний дугаар", acq.plan_code)}
          {row("Төлөвлөгөөний нэр", acq.plan_name)}
          {editing && (
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
                Хил солих файл
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label className="inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2.5 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce]/60 hover:text-[#02c0ce] transition-colors">
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {boundaryFile ? boundaryFile.name : "Файл сонгох"}
                  </span>
                  <input
                    type="file"
                    accept=".zip,.shp"
                    className="hidden"
                    onChange={(e) => setBoundaryFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {boundaryFile && (
                  <button
                    type="button"
                    onClick={() => setBoundaryFile(null)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
          {row(
            "Статус",
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: sc.color, background: sc.bg }}
            >
              {STATUS_LABELS[acq.status] ?? "Тодорхойгүй"}
            </span>,
          )}
          {/* Талбай — засах горимд input + хилээс тооцоолох товч */}
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">Талбай</span>
            {editing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  value={areaM2}
                  onChange={(e) => { setAreaM2(e.target.value); setAreaAutoCalc(false); }}
                  placeholder="м² оруулах..."
                  className="h-7 w-36 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2.5 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
                {acq.geometry_wkt && (
                  <button
                    type="button"
                    onClick={() => {
                      const calc = calcAreaFromWkt(acq.geometry_wkt);
                      if (calc != null) {
                        setAreaM2(String(Math.round(calc)));
                        setAreaAutoCalc(true);
                        toast.success("Талбай тооцоологдлоо");
                      } else {
                        toast.error("Геометриас талбай тооцоолох боломжгүй");
                      }
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/10 px-2.5 text-[11px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors whitespace-nowrap"
                  >
                    <Calculator className="h-3 w-3" />
                    Хилээс тооцоолох
                  </button>
                )}
                {areaAutoCalc && (
                  <span className="text-[11px] text-[#0acf97] font-medium whitespace-nowrap">Автоматаар тооцоологдсон</span>
                )}
              </div>
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {formatArea(acq.area_m2)}
              </span>
            )}
          </div>
          {row("Үүсгэсэн", formatDate(acq.created_at))}
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
              Эхлэх огноо
            </span>
            {editing ? (
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
                className="h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
              />
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {formatDate(acq.start_date)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
              Дуусах огноо
            </span>
            {editing ? (
              <input
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
                className="h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
              />
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.end_date ? formatDate(acq.end_date) : "—"}
              </span>
            )}
          </div>

          {/* Нэгж талбарын тоо ба нийт чөлөөлөгдөх талбай */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#37394d] flex flex-col gap-0">
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">Нэгж талбарын тоо</span>
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                {parcelCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    {parcelCount}
                    <span className="text-[11px] font-normal text-slate-400">нэгж талбар</span>
                  </span>
                ) : (
                  "0 нэгж талбар"
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 py-2.5">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">Нийт нөлөөлөлд өртсөн талбай</span>
              <span className="text-[13px] font-semibold">
                {totalAcqAreaM2 > 0 ? (
                  <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                    {formatArea(totalAcqAreaM2)}
                  </span>
                ) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Right — Төслийн мэдээлэл */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Төслийн мэдээлэл
          </p>
          {(
            [
              ["Төслийн нэр", "acquisition_name", "Нэр оруулна уу"],
              [
                "Хэрэгжүүлэгч байгууллага",
                "implementing_org",
                "Байгууллагын нэр",
              ],
              ["Хариуцах байгууллага", "responsible_org", "Байгууллагын нэр"],
            ] as [string, keyof typeof form, string][]
          ).map(([label, key, ph]) => (
            <div
              key={key}
              className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]"
            >
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
                {label}
              </span>
              {editing ? (
                <input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={ph}
                  className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
              ) : (
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {(form[key] as string) || "—"}
                </span>
              )}
            </div>
          ))}
          {/* Санхүүжилтийн эх үүсвэр — дэлгэрэнгүй API-ийн funding_sources талбараас */}
          <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40 pt-0.5">
              Санхүүжилтийн эх үүсвэр
            </span>
            <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
              {fundingSources.length > 0
                ? fundingSources.map((s) =>
                    [s.organization_name, s.source_type].filter(Boolean).join(" — ")
                  ).join(", ")
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
              Ерөнхий ангилал
            </span>
            {editing ? (
              <select
                value={generalCategoryId ?? ""}
                onChange={(e) => {
                  setGeneralCategoryId(e.target.value ? Number(e.target.value) : null);
                  setSubCategoryId(null);
                }}
                className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
              >
                <option value="">— Сонгоно уу —</option>
                {generalCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.general_category_name || "—"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
              Дэд ангилал
            </span>
            {editing ? (
              <select
                value={subCategoryId ?? ""}
                onChange={(e) =>
                  setSubCategoryId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={!generalCategoryId}
                className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all disabled:opacity-50"
              >
                <option value="">— Сонгоно уу —</option>
                {subCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.sub_category_name || "—"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
              Мэргэжлийн байгууллага
            </span>
            {editing ? (
              <select
                value={professionalOrgId}
                onChange={(e) => setProfessionalOrgId(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
              >
                <option value="">— Сонгоно уу —</option>
                {professionalOrgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    {u.position ? ` · ${u.position}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.professional_org_name || "—"}
              </span>
            )}
          </div>
          {acq.decree_number && (
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
                НЗД захирамжийн дугаар
              </span>
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.decree_number}
              </span>
            </div>
          )}
          {acq.decree_date && (
            <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">
                НЗД захирамжийн огноо
              </span>
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {acq.decree_date}
              </span>
            </div>
          )}
          <div className="py-2.5">
            <div className="flex items-start gap-3">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40 pt-1">
                Чөлөөлөх шалтгаан
              </span>
              {editing ? (
                <textarea
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  rows={3}
                  placeholder="Тайлбар..."
                  className="flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
                />
              ) : (
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex-1">
                  {form.reason || "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
