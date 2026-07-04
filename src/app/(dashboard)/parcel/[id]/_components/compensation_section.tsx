"use client";
import { Fragment, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi } from "@/lib/api";
import { type Compensation } from "@/types";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import {
  X, Plus, ChevronDown, ChevronUp, Trash2,
  ReceiptText, Building2, Wallet, Upload, FileText, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { TARGET_TYPE_LABELS, COMP_TYPE_LABELS, ASSET_TYPE_LABELS, INP } from "./constants";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const EMPTY_COMP = {
  target_type: "asset" as Compensation["target_type"],
  compensation_type: "cash" as Compensation["compensation_type"],
  coverage_percent: "",
  amount: "",
  compensation_date: "",
  note: "",
};

const EMPTY_GRANT = {
  amount: "",
  grant_date: "",
  note: "",
  land_area_m2: "",
  land_price: "",
  land_location: "",
  land_purpose: "",
  land_use_type: "",
  parcel_number: "",
  decree_number: "",
};

export function CompensationSection({
  acqId,
  parcelCode,
  parcelId,
}: {
  acqId: string;
  parcelCode: string;
  parcelId: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_COMP);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT);
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: allComps = [], isLoading } = useQuery({
    queryKey: ["compensations", acqId],
    queryFn: () => landApi.listCompensations(acqId),
    enabled: !!acqId,
  });
  const compensations = parcelCode
    ? allComps.filter((c) => c.parcel_id === parcelCode)
    : allComps;

  const { data: assetsResult } = useQuery({
    queryKey: ["parcel-assets", acqId, parcelCode],
    queryFn: () => landApi.getAssets(acqId, { page: 1, page_size: 100, parcel_id: parcelCode }),
    enabled: !!acqId && !!parcelCode,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["parcel-payments", parcelId],
    queryFn: () => parcelApi.listPayments(parcelId),
    enabled: !!parcelId,
  });

  const assets = assetsResult?.data ?? [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const comp = await landApi.createCompensation(acqId, {
        target_type: form.target_type,
        parcel_id: parcelCode,
        compensation_type: form.compensation_type,
        coverage_percent: Number(form.coverage_percent) || 0,
        amount: Number(form.amount) || 0,
        compensation_date: form.compensation_date || undefined,
        note: form.note || undefined,
      });
      if (form.compensation_type === "land_grant" && comp) {
        await landApi.createCompensationGrant(acqId, comp.id, {
          amount: Number(grantForm.amount) || 0,
          grant_date: grantForm.grant_date || undefined,
          note: grantForm.note || undefined,
          land_area_m2: Number(grantForm.land_area_m2) || 0,
          land_price: Number(grantForm.land_price) || 0,
          land_location: grantForm.land_location,
          land_purpose: grantForm.land_purpose,
          land_use_type: grantForm.land_use_type,
          parcel_number: grantForm.parcel_number,
          decree_number: grantForm.decree_number,
        });
      }
      return comp;
    },
    onSuccess: () => {
      toast.success("Нөхөн төлбөр нэмэгдлээ");
      setForm(EMPTY_COMP);
      setGrantForm(EMPTY_GRANT);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId] });
    },
    onError: (err) => toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (compId: string) => landApi.deleteCompensation(acqId, compId),
    onSuccess: () => {
      toast.success("Нөхөн төлбөр устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const [uploadingReportId, setUploadingReportId] = useState<string | null>(null);
  const reportFileRef = useRef<Record<string, HTMLInputElement | null>>({});

  const reportMutation = useMutation({
    mutationFn: ({ compId, file }: { compId: string; file: File }) =>
      landApi.uploadCompensationReport(acqId, compId, file),
    onSuccess: () => {
      toast.success("Үнэлгээний тайлан амжилттай хавсаргагдлаа");
      setUploadingReportId(null);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId] });
    },
    onError: (err) => toast.error(getApiError(err, "Тайлан хавсаргахад алдаа гарлаа")),
  });

  const cashTotal = compensations
    .filter((c) => c.compensation_type === "cash")
    .reduce((s, c) => s + c.amount, 0);
  const landGrantTotal = compensations
    .filter((c) => c.compensation_type === "land_grant")
    .reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Нөхөн төлбөр
          </p>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Болих" : "Нөхөн төлбөр нэмэх"}
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Нөхөн төлбөрийн төрөл</p>
                <select
                  value={form.target_type}
                  onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value as Compensation["target_type"] }))}
                  className={INP}
                >
                  <option value="parcel">Нэгж талбарын нөхөн төлбөр</option>
                  <option value="asset">Хөрөнгийн нөхөн төлбөр</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Нөхөн олговрын хэлбэр</p>
                <select
                  value={form.compensation_type}
                  onChange={(e) => setForm((f) => ({ ...f, compensation_type: e.target.value as Compensation["compensation_type"] }))}
                  className={INP}
                >
                  <option value="cash">Мөнгөн дүнгээр</option>
                  <option value="land_grant">Газраар дүйцүүлэх</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Хамрах хувь (%)</p>
                <input type="number" min="0" max="100" value={form.coverage_percent}
                  onChange={(e) => setForm((f) => ({ ...f, coverage_percent: e.target.value }))}
                  placeholder="100" className={INP} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Дүн (₮)</p>
                <input type="number" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className={INP} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Огноо</p>
                <input type="date" value={form.compensation_date}
                  onChange={(e) => setForm((f) => ({ ...f, compensation_date: e.target.value }))}
                  className={INP} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
                <input value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Тайлбар..." className={INP} />
              </div>
            </div>

            {form.compensation_type === "land_grant" && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#37394d]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Газрын нөхөн олговрын дэлгэрэнгүй
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {([
                    ["amount", "Газрын дүн (₮)", "number", "0"],
                    ["grant_date", "Олгосон огноо", "date", ""],
                    ["land_area_m2", "Талбай (м²)", "number", "0"],
                    ["land_price", "Газрын үнэ (₮/м²)", "number", "0"],
                    ["land_location", "Байршил", "text", "Байршил..."],
                    ["land_purpose", "Зориулалт", "text", "Зориулалт..."],
                    ["land_use_type", "Газрын ашиглалтын төрөл", "text", "..."],
                    ["parcel_number", "Нэгж талбарын дугаар", "text", "..."],
                    ["decree_number", "Тогтоолын дугаар", "text", "..."],
                  ] as [keyof typeof grantForm, string, string, string][]).map(([field, label, type, placeholder]) => (
                    <div key={field}>
                      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
                      <input type={type} value={grantForm[field]}
                        onChange={(e) => setGrantForm((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder={placeholder} className={INP} />
                    </div>
                  ))}
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
                    <input value={grantForm.note}
                      onChange={(e) => setGrantForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="Тайлбар..." className={INP} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.amount || createMutation.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Хадгалах
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
            ))}
          </div>
        ) : compensations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
            <ReceiptText className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Нөхөн төлбөрийн бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["Нөхөн төлбөрийн төрөл", "Нөхөн олговрын хэлбэр", "Хамрах хувь", "Дүн", "Огноо", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compensations.map((comp) => (
                  <Fragment key={comp.id}>
                    <tr className="border-b border-slate-100 dark:border-[#37394d] hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {TARGET_TYPE_LABELS[comp.target_type] ?? comp.target_type}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}>
                          {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 tabular-nums">{comp.coverage_percent}%</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                        {comp.amount.toLocaleString()}₮
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {comp.compensation_date ? formatDate(comp.compensation_date) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          {comp.grant && (
                            <button
                              onClick={() => setExpandedGrant(expandedGrant === comp.id ? null : comp.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                            >
                              {expandedGrant === comp.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => setPendingConfirm({ title: "Нөхөн төлбөр устгах уу?", confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(comp.id) })}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedGrant === comp.id && comp.grant && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0">
                          <div className="mx-4 mb-3 mt-1 rounded-xl bg-sky-50/70 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-2">
                              Газрын нөхөн олговрын дэлгэрэнгүй
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                              {([
                                ["Дүн", `${comp.grant.amount.toLocaleString()}₮`],
                                ["Олгосон огноо", comp.grant.grant_date ? formatDate(comp.grant.grant_date) : "—"],
                                ["Талбай", formatArea(comp.grant.land_area_m2)],
                                ["Газрын үнэ", `${comp.grant.land_price.toLocaleString()}₮/м²`],
                                ["Байршил", comp.grant.land_location || "—"],
                                ["Зориулалт", comp.grant.land_purpose || "—"],
                                ["Ашиглалтын төрөл", comp.grant.land_use_type || "—"],
                                ["Нэгж талбарын дугаар", comp.grant.parcel_number || "—"],
                                ["Тогтоолын дугаар", comp.grant.decree_number || "—"],
                              ] as [string, string][]).map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-[11px] text-sky-500">{label}</p>
                                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{value}</p>
                                </div>
                              ))}
                              {comp.grant.note && (
                                <div className="col-span-2 md:col-span-3">
                                  <p className="text-[11px] text-sky-500">Тайлбар</p>
                                  <p className="text-[13px] text-slate-600 dark:text-slate-300">{comp.grant.note}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {comp.status === "approved" && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0">
                          <div className="mx-4 mb-3 mt-1 rounded-xl border px-4 py-3
                            border-amber-100 dark:border-amber-800/30
                            bg-amber-50/60 dark:bg-amber-900/10">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                              Үнэлгээний тайлан
                            </p>
                            {comp.valuation_report_url ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                <a
                                  href={comp.valuation_report_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[13px] font-medium text-[#02c0ce] hover:underline"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {comp.valuation_report_name || "Үнэлгээний тайлан"}
                                </a>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">— Тайлан хавсаргагдсан</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="text-[12px] text-amber-600 dark:text-amber-400">
                                  Нэгж талбарыг &ldquo;Чөлөөлсөн&rdquo; болгохын өмнө үнэлгээний тайлан хавсаргах шаардлагатай.
                                </p>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                  className="hidden"
                                  ref={(el) => { reportFileRef.current[comp.id] = el; }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingReportId(comp.id);
                                    reportMutation.mutate({ compId: comp.id, file });
                                    e.target.value = "";
                                  }}
                                />
                                <button
                                  onClick={() => reportFileRef.current[comp.id]?.click()}
                                  disabled={uploadingReportId === comp.id && reportMutation.isPending}
                                  className="inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
                                >
                                  {uploadingReportId === comp.id && reportMutation.isPending ? (
                                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  Тайлан хавсаргах
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              {(cashTotal > 0 || landGrantTotal > 0) && (
                <tfoot>
                  {cashTotal > 0 && (
                    <tr className="border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                      <td colSpan={3} className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">Нийт мөнгөн дүн</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">{cashTotal.toLocaleString()}₮</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                  {landGrantTotal > 0 && (
                    <tr className="border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                      <td colSpan={3} className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">Нийт газрын нөхөн олговор</td>
                      <td className="px-4 py-2.5 font-bold text-sky-600 dark:text-sky-400 tabular-nums whitespace-nowrap">{landGrantTotal.toLocaleString()}₮</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Assets */}
      {assets.length > 0 && (
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Хөрөнгө ({assets.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["Дугаар", "Хөрөнгийн төрөл", "Нэр/Төрөл", "Давхар", "Талбай", "Эзэмшигч", "Хаяг", "Нөхөн олговрын хэлбэр", "Нөхөж төлөх дүн"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {assets.map((b) => {
                  const bComps = compensations.filter((c) => c.asset_id === b.id);
                  const cashComp = bComps.find((c) => c.compensation_type === "cash");
                  const grantComp = bComps.find((c) => c.compensation_type === "land_grant");
                  const totalAmt = bComps.reduce((s, c) => s + c.amount, 0);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{b.asset_number || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{ASSET_TYPE_LABELS[b.asset_type] ?? b.asset_type}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.asset_name || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{b.floor_count || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatArea(b.area_m2)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.owner_name || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500 min-w-[160px]">{b.address || "—"}</td>
                      <td className="px-4 py-2.5">
                        {bComps.length === 0 ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {cashComp && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400">Мөнгөн</span>}
                            {grantComp && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400">Газраар</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {totalAmt > 0 ? (
                          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{totalAmt.toLocaleString()}₮</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Төлбөр</p>
          </div>
          {totalPaid > 0 && (
            <span className="text-[13px] font-bold text-[#0acf97] tabular-nums">{totalPaid.toLocaleString()}₮</span>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
            <Wallet className="h-6 w-6 mb-1.5 opacity-30" />
            <p className="text-[12px]">Төлбөрийн бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["#", "Дүн", "Валют", "Огноо", "Тайлбар"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {payments.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-mono text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{p.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.currency}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{p.note || "—"}</td>
                  </tr>
                ))}
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
