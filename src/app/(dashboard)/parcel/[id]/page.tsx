"use client";
import React, { useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi } from "@/lib/api";
import {
  STATUS_LABELS,
  RIGHT_TYPE_LABELS,
  type AU,
  type Asset,
  type Compensation,
  type CompensationGrant,
} from "@/types";
import { formatDate, formatArea } from "@/lib/utils";
import {
  ArrowLeft,
  Info,
  FileText,
  Upload,
  Trash2,
  Download,
  MapPin,
  Wallet,
  Paperclip,
  Plus,
  X,
  RefreshCw,
  Building2,
  ReceiptText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import dynamic from "next/dynamic";

const ParcelMap = dynamic(
  () => import("@/components/ParcelMap").then((m) => m.ParcelMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: "#02c0ce", bg: "#02c0ce18" },
  2: { color: "#f59e0b", bg: "#f59e0b18" },
  3: { color: "#0acf97", bg: "#0acf9718" },
  4: { color: "#f1556c", bg: "#f1556c18" },
};

type Tab = "general" | "realEstate" | "documents" | "payment" | "map";

function findAdminUnit(
  aus: AU[] | null | undefined,
  au1Code: string,
  au2Code: string,
  au3Code: string,
) {
  return aus?.find(
    (au) =>
      au.au1_code === au1Code &&
      au.au2_code === au2Code &&
      au.au3_code === au3Code,
  );
}

function formatAdminUnit(name: string | undefined, code: string) {
  return name ? `${name} (${code})` : code;
}

function highlightArea(value: string) {
  return (
    <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
      {value}
    </span>
  );
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  real_state: "Үл хөдлөх хөрөнгө",
  property: "Эд хөрөнгө",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  parcel: "Нэгж талбарын нөхөн төлбөр",
  asset: "Хөрөнгийн нөхөн төлбөр",
};

const COMP_TYPE_LABELS: Record<string, string> = {
  cash: "Мөнгөн дүн",
  land_grant: "Газрын нөхөн олговор",
};

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

// ─── Compensation section (used in GeneralTab) ────────────────────────────────
function CompensationSection({
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
    queryFn: () =>
      landApi.getAssets(acqId, {
        page: 1,
        page_size: 100,
        parcel_id: parcelCode,
      }),
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
      // Compensation эхлээд үүсгэнэ
      const comp = await landApi.createCompensation(acqId, {
        target_type: form.target_type,
        parcel_id: parcelCode,
        compensation_type: form.compensation_type,
        coverage_percent: Number(form.coverage_percent) || 0,
        amount: Number(form.amount) || 0,
        compensation_date: form.compensation_date || undefined,
        note: form.note || undefined,
      });
      // land_grant бол grant-г compensation.id-тай холбон үүсгэнэ
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
    onError: () => toast.error("Нэмэхэд алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (compId: string) => landApi.deleteCompensation(acqId, compId),
    onSuccess: () => {
      toast.success("Нөхөн төлбөр устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId] });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

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
            {showForm ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {showForm ? "Болих" : "Нөхөн төлбөр нэмэх"}
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-1">
                  Нөхөн төлбөрийн төрөл
                </p>
                <select
                  value={form.target_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      target_type: e.target
                        .value as Compensation["target_type"],
                    }))
                  }
                  className={inp}
                >
                  <option value="parcel">Нэгж талбарын нөхөн төлбөр</option>
                  <option value="asset">Хөрөнгийн нөхөн төлбөр</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">
                  Нөхөн олговрын хэлбэр
                </p>
                <select
                  value={form.compensation_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compensation_type: e.target
                        .value as Compensation["compensation_type"],
                    }))
                  }
                  className={inp}
                >
                  <option value="cash">Мөнгөн дүнгээр</option>
                  <option value="land_grant">Газраар дүйцүүлэх</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">
                  Хамрах хувь (%)
                </p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.coverage_percent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, coverage_percent: e.target.value }))
                  }
                  placeholder="100"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Дүн (₮)</p>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Огноо</p>
                <input
                  type="date"
                  value={form.compensation_date}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      compensation_date: e.target.value,
                    }))
                  }
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
                <input
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Тайлбар..."
                  className={inp}
                />
              </div>
            </div>

            {form.compensation_type === "land_grant" && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#37394d]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Газрын нөхөн олговрын дэлгэрэнгүй
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Газрын дүн (₮)
                    </p>
                    <input
                      type="number"
                      value={grantForm.amount}
                      onChange={(e) =>
                        setGrantForm((f) => ({ ...f, amount: e.target.value }))
                      }
                      placeholder="0"
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Олгосон огноо
                    </p>
                    <input
                      type="date"
                      value={grantForm.grant_date}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          grant_date: e.target.value,
                        }))
                      }
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Талбай (м²)
                    </p>
                    <input
                      type="number"
                      value={grantForm.land_area_m2}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          land_area_m2: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Газрын үнэ (₮/м²)
                    </p>
                    <input
                      type="number"
                      value={grantForm.land_price}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          land_price: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">Байршил</p>
                    <input
                      value={grantForm.land_location}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          land_location: e.target.value,
                        }))
                      }
                      placeholder="Байршил..."
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">Зориулалт</p>
                    <input
                      value={grantForm.land_purpose}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          land_purpose: e.target.value,
                        }))
                      }
                      placeholder="Зориулалт..."
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Газрын ашиглалтын төрөл
                    </p>
                    <input
                      value={grantForm.land_use_type}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          land_use_type: e.target.value,
                        }))
                      }
                      placeholder="..."
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Нэгж талбарын дугаар
                    </p>
                    <input
                      value={grantForm.parcel_number}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          parcel_number: e.target.value,
                        }))
                      }
                      placeholder="..."
                      className={inp}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Тогтоолын дугаар
                    </p>
                    <input
                      value={grantForm.decree_number}
                      onChange={(e) =>
                        setGrantForm((f) => ({
                          ...f,
                          decree_number: e.target.value,
                        }))
                      }
                      placeholder="..."
                      className={inp}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
                    <input
                      value={grantForm.note}
                      onChange={(e) =>
                        setGrantForm((f) => ({ ...f, note: e.target.value }))
                      }
                      placeholder="Тайлбар..."
                      className={inp}
                    />
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
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
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
                  {[
                    "Нөхөн төлбөрийн төрөл",
                    "Нөхөн олговрын хэлбэр",
                    "Хамрах хувь",
                    "Дүн",
                    "Огноо",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compensations.map((comp) => (
                  <React.Fragment key={comp.id}>
                    <tr className="border-b border-slate-100 dark:border-[#37394d] hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {TARGET_TYPE_LABELS[comp.target_type] ??
                          comp.target_type}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}
                        >
                          {COMP_TYPE_LABELS[comp.compensation_type] ??
                            comp.compensation_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 tabular-nums">
                        {comp.coverage_percent}%
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                        {comp.amount.toLocaleString()}₮
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {comp.compensation_date
                          ? formatDate(comp.compensation_date)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          {comp.grant && (
                            <button
                              onClick={() =>
                                setExpandedGrant(
                                  expandedGrant === comp.id ? null : comp.id,
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                              title="Газрын нөхөн олговор"
                            >
                              {expandedGrant === comp.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm("Нөхөн төлбөр устгах уу?"))
                                deleteMutation.mutate(comp.id);
                            }}
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
                              {(
                                [
                                  [
                                    "Дүн",
                                    `${comp.grant.amount.toLocaleString()}₮`,
                                  ],
                                  [
                                    "Олгосон огноо",
                                    comp.grant.grant_date
                                      ? formatDate(comp.grant.grant_date)
                                      : "—",
                                  ],
                                  [
                                    "Талбай",
                                    formatArea(comp.grant.land_area_m2),
                                  ],
                                  [
                                    "Газрын үнэ",
                                    `${comp.grant.land_price.toLocaleString()}₮/м²`,
                                  ],
                                  ["Байршил", comp.grant.land_location || "—"],
                                  ["Зориулалт", comp.grant.land_purpose || "—"],
                                  [
                                    "Ашиглалтын төрөл",
                                    comp.grant.land_use_type || "—",
                                  ],
                                  [
                                    "Нэгж талбарын дугаар",
                                    comp.grant.parcel_number || "—",
                                  ],
                                  [
                                    "Тогтоолын дугаар",
                                    comp.grant.decree_number || "—",
                                  ],
                                ] as [string, string][]
                              ).map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-[11px] text-sky-500">
                                    {label}
                                  </p>
                                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                    {value}
                                  </p>
                                </div>
                              ))}
                              {comp.grant.note && (
                                <div className="col-span-2 md:col-span-3">
                                  <p className="text-[11px] text-sky-500">
                                    Тайлбар
                                  </p>
                                  <p className="text-[13px] text-slate-600 dark:text-slate-300">
                                    {comp.grant.note}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {(cashTotal > 0 || landGrantTotal > 0) && (
                <tfoot>
                  {cashTotal > 0 && (
                    <tr className="border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                      <td
                        colSpan={3}
                        className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400"
                      >
                        Нийт мөнгөн дүн
                      </td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                        {cashTotal.toLocaleString()}₮
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                  {landGrantTotal > 0 && (
                    <tr className="border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                      <td
                        colSpan={3}
                        className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400"
                      >
                        Нийт газрын нөхөн олговор
                      </td>
                      <td className="px-4 py-2.5 font-bold text-sky-600 dark:text-sky-400 tabular-nums whitespace-nowrap">
                        {landGrantTotal.toLocaleString()}₮
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Assets ──────────────────────────────────────────────────────── */}
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
                  {[
                    "Дугаар",
                    "Хөрөнгийн төрөл",
                    "Нэр/Төрөл",
                    "Давхар",
                    "Талбай",
                    "Эзэмшигч",
                    "Хаяг",
                    "Нөхөн олговрын хэлбэр",
                    "Нөхөж төлөх дүн",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {assets.map((b) => {
                  const bComps = compensations.filter(
                    (c) => c.asset_id === b.id,
                  );
                  const cashComp = bComps.find(
                    (c) => c.compensation_type === "cash",
                  );
                  const grantComp = bComps.find(
                    (c) => c.compensation_type === "land_grant",
                  );
                  const totalAmt = bComps.reduce((s, c) => s + c.amount, 0);
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                        {b.asset_number || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {ASSET_TYPE_LABELS[b.asset_type] ?? b.asset_type}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {b.asset_name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                        {b.floor_count || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {formatArea(b.area_m2)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {b.owner_name || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 min-w-[160px]">
                        {b.address || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {bComps.length === 0 ? (
                          <span className="text-slate-300 dark:text-slate-600">
                            —
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {cashComp && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400">
                                Мөнгөн
                              </span>
                            )}
                            {grantComp && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400">
                                Газраар
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {totalAmt > 0 ? (
                          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                            {totalAmt.toLocaleString()}₮
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">
                            —
                          </span>
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

      {/* ── Payments ────────────────────────────────────────────────────── */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Төлбөр
            </p>
          </div>
          {totalPaid > 0 && (
            <span className="text-[13px] font-bold text-[#0acf97] tabular-nums">
              {totalPaid.toLocaleString()}₮
            </span>
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
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {payments.map((p, i) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[12px] font-mono text-slate-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{p.currency}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">
                      {p.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── General tab ──────────────────────────────────────────────────────────────
function GeneralTab({ acqId, parcelId }: { acqId: string; parcelId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId,
  });
  const { data: acquisition } = useQuery({
    queryKey: ["land", acqId],
    queryFn: () => landApi.getById(acqId),
    enabled: !!acqId,
  });
  const { data: compensations = [] } = useQuery({
    queryKey: ["compensations", acqId],
    queryFn: () => landApi.listCompensations(acqId),
    enabled: !!acqId,
  });
  const { data: assetsData } = useQuery({
    queryKey: ["parcel-assets", acqId, data?.parcel_id],
    queryFn: () =>
      landApi.getAssets(acqId, {
        page: 1,
        page_size: 100,
        parcel_id: data?.parcel_id,
      }),
    enabled: !!acqId && !!data?.parcel_id,
  });

  const [editingMeta, setEditingMeta] = useState(false);
  const [dbChanged, setDbChanged] = useState(false);
  const [changedParcelId, setChangedParcelId] = useState("");

  React.useEffect(() => {
    if (data) {
      setDbChanged(data.db_changed ?? false);
      setChangedParcelId(data.changed_parcel_id ?? "");
    }
  }, [data]);

  const metaMutation = useMutation({
    mutationFn: () =>
      landApi.updateParcelMeta(acqId, parcelId, dbChanged, changedParcelId),
    onSuccess: () => {
      toast.success("Мэдээлэл хадгалагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-full", acqId, parcelId],
      });
      setEditingMeta(false);
    },
    onError: () => toast.error("Хадгалахад алдаа гарлаа"),
  });

  const syncMutation = useMutation({
    mutationFn: () => landApi.syncParcel(acqId, parcelId),
    onSuccess: () => {
      toast.success("Нэгж талбарын мэдээлэл шинэчлэгдлээ");
      queryClient.invalidateQueries({
        queryKey: ["parcel-full", acqId, parcelId],
      });
      queryClient.invalidateQueries({ queryKey: ["land", acqId] });
      window.location.reload();
    },
    onError: () => toast.error("Нэгж талбарын мэдээлэл дуудахад алдаа гарлаа"),
  });

  const handleSync = () => {
    if (!confirm("Нэгж талбарын мэдээлэл дуудах уу?")) return;
    syncMutation.mutate();
  };

  const row = (label: string, value?: React.ReactNode) => (
    <div
      key={label}
      className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0"
    >
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">
        {label}
      </span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );

  if (isLoading)
    return (
      <div className="ap-card p-5 animate-pulse space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 rounded bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  if (!data)
    return (
      <div className="ap-card p-10 text-center text-[13px] text-slate-400">
        Мэдээлэл олдсонгүй
      </div>
    );

  const adminUnit = findAdminUnit(
    acquisition?.aus,
    data.au1_code,
    data.au2_code,
    data.au3_code,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid md:grid-cols-2 gap-5">
        {/* Талбарын мэдээлэл */}
        <div className="ap-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Талбарын мэдээлэл
            </p>
            <button
              onClick={handleSync}
              disabled={!acqId || syncMutation.isPending}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#0acf97]/10 px-3 text-[12px] font-semibold text-[#0acf97] transition-colors hover:bg-[#0acf97]/20 disabled:opacity-50"
            >
              {syncMutation.isPending ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0acf97] border-t-transparent animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Нэгж талбарын мэдээлэл дуудах
            </button>
          </div>
          {row("Дугаар", <span className="font-mono">{data.parcel_id}</span>)}
          {row(
            "Аймаг/Нийслэл",
            formatAdminUnit(adminUnit?.au1_name, data.au1_code),
          )}
          {row(
            "Сум/Дүүрэг",
            formatAdminUnit(adminUnit?.au2_name, data.au2_code),
          )}
          {row(
            "Баг/Хороо",
            formatAdminUnit(adminUnit?.au3_name, data.au3_code),
          )}
          {row("Эрхийн төрөл", RIGHT_TYPE_LABELS[data.right_type])}
          {row("Газрын зориулалт", data.landuse)}
          {row(
            "Эрх эхэлсэн",
            data.valid_from ? formatDate(data.valid_from) : undefined,
          )}
          {row(
            "Эрх дуусах",
            data.valid_till ? formatDate(data.valid_till) : undefined,
          )}
          {row("Нийт талбай", formatArea(data.area_m2))}
          {row(
            "Чөлөөлөгдөх талбай",
            highlightArea(formatArea(data.acquisition_area_m2)),
          )}
          {row(
            "Үлдэх газрын хэмжээ",
            data.remaining_area_m2 != null
              ? formatArea(data.remaining_area_m2)
              : formatArea(
                  (data.area_m2 || 0) - (data.acquisition_area_m2 || 0),
                ),
          )}
        </div>

        {/* Эзэмшигч */}
        <div className="ap-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Эзэмшигч
          </p>
          {data.detail ? (
            <>
              {row(
                "Овог нэр",
                `${data.detail.holder_last_name ?? ""} ${data.detail.holder_name ?? ""}`.trim(),
              )}
              {row("Регистрийн дугаар", data.detail.holder_register_no)}
              {row("Иргэний үнэмлэх", data.detail.holder_civil_id)}
              {row("Утас", data.detail.holder_phone)}
              {row("И-мэйл", data.detail.holder_email)}
              {row("Эзэмшигчийн төрөл", data.detail.holder_type)}
              <div className="mt-5">
                <div className="h-px w-full bg-[#e2e8f0] dark:bg-[#37394d]" />
                <p className="pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Өргөдлийн мэдээлэл
                </p>
              </div>
              {row("Өргөдлийн дугаар", data.detail.app_no)}
              {row("Шийдвэрийн дугаар", data.detail.decision_no)}
              {row(
                "Шийдвэрийн огноо",
                data.detail.decision_date
                  ? formatDate(data.detail.decision_date)
                  : undefined,
              )}
              {row("Гэрээний дугаар", data.detail.contract_no)}
              {row("Гэрчилгээний дугаар", data.detail.certificate_no)}
            </>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-8">
              Эзэмшигчийн мэдээлэл байхгүй
            </p>
          )}
        </div>
      </div>

      {/* Газрын үнэлгээ */}
      {data.detail &&
        (data.detail.valuation_zone ||
          data.detail.base_price_per_ha != null ||
          data.detail.auction_price != null) && (
          <div className="ap-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Газрын үнэлгээ
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                    {[
                      "#",
                      "Газрын суурь үнэлгээний зэрэглэл / Бүс",
                      "Газрын суурь үнэ /1га/",
                      "Дуудлага худалдааны анхны үнийн итгэлцүүр",
                      "Дуудлага худалдааны анхны үнэ",
                      "Нийт",
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
                <tbody>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      1
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {data.detail.valuation_zone || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                      {data.detail.base_price_per_ha != null
                        ? data.detail.base_price_per_ha.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                      {data.detail.auction_coeff != null
                        ? data.detail.auction_coeff
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                      {data.detail.auction_price != null
                        ? data.detail.auction_price.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-white">
                      {data.detail.auction_price != null
                        ? `${data.detail.auction_price.toLocaleString()}₮`
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Нөхөн төлбөрийн дүн */}
      {(() => {
        const parcelComps = compensations.filter(
          (c) => c.parcel_id === data.parcel_id,
        );
        const assets = assetsData?.data ?? [];
        const parcelLandValue = parcelComps
          .filter((c) => c.target_type === "parcel")
          .reduce((s, c) => s + c.amount, 0);
        const realStateAssetIds = new Set(
          assets.filter((a) => a.asset_type === "real_state").map((a) => a.id),
        );
        const propertyAssetIds = new Set(
          assets.filter((a) => a.asset_type === "property").map((a) => a.id),
        );
        const realStateComp = parcelComps
          .filter(
            (c) =>
              c.target_type === "asset" &&
              c.asset_id &&
              realStateAssetIds.has(c.asset_id),
          )
          .reduce((s, c) => s + c.amount, 0);
        const propertyComp = parcelComps
          .filter(
            (c) =>
              c.target_type === "asset" &&
              c.asset_id &&
              propertyAssetIds.has(c.asset_id),
          )
          .reduce((s, c) => s + c.amount, 0);
        const totalComp = parcelLandValue + realStateComp + propertyComp;
        if (parcelComps.length === 0) return null;
        return (
          <div className="ap-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Нөхөн төлбөрийн дүн
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
              {row(
                "Нөлөөлөлд өртсөн газрын үнэ",
                parcelLandValue > 0
                  ? `${parcelLandValue.toLocaleString()} ₮`
                  : "—",
              )}
              {row(
                "Үл хөдлөх хөрөнгийн нөхөн төлбөр",
                realStateComp > 0 ? `${realStateComp.toLocaleString()} ₮` : "—",
              )}
              {row(
                "Эд хөрөнгийн нөхөн төлбөр",
                propertyComp > 0 ? `${propertyComp.toLocaleString()} ₮` : "—",
              )}
              {row(
                "Нийт нөхөн төлбөр",
                totalComp > 0 ? (
                  <span className="font-bold text-[#02c0ce]">
                    {totalComp.toLocaleString()} ₮
                  </span>
                ) : (
                  "—"
                ),
              )}
            </div>
          </div>
        );
      })()}

      {/* Мэдээллийн сангийн өөрчлөлт */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Мэдээллийн сангийн өөрчлөлт
          </p>
          {editingMeta ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingMeta(false);
                  setDbChanged(data.db_changed ?? false);
                  setChangedParcelId(data.changed_parcel_id ?? "");
                }}
                className="h-7 px-3 rounded-lg text-[12px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
              >
                Болих
              </button>
              <button
                onClick={() => metaMutation.mutate()}
                disabled={metaMutation.isPending}
                className="h-7 px-3 rounded-lg text-[12px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                Хадгалах
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingMeta(true)}
              className="h-7 px-3 rounded-lg text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors"
            >
              Засах
            </button>
          )}
        </div>
        <div className="px-5 divide-y divide-slate-100 dark:divide-[#37394d]">
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">
              Мэдээллийн санд өөрчлөлт орсон эсэх
            </span>
            {editingMeta ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dbChanged}
                  onChange={(e) => setDbChanged(e.target.checked)}
                  className="w-4 h-4 accent-[#02c0ce]"
                />
                <span className="text-[13px] text-slate-700 dark:text-slate-200">
                  {dbChanged ? "Тийм" : "Үгүй"}
                </span>
              </label>
            ) : (
              <span
                className={`text-[13px] font-medium ${data.db_changed ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"}`}
              >
                {data.db_changed ? "Тийм" : "Үгүй"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">
              Өөрчлөгдсөн нэгж талбарын дугаар
            </span>
            {editingMeta ? (
              <input
                type="text"
                value={changedParcelId}
                onChange={(e) => setChangedParcelId(e.target.value)}
                placeholder="Нэгж талбарын дугаар..."
                className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
              />
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {data.changed_parcel_id || "—"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────
function DocumentsTab({ parcelId }: { parcelId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => parcelApi.listDocuments(parcelId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => parcelApi.uploadDocument(parcelId, file),
    onSuccess: () => {
      toast.success("Баримт бичиг хавсаргагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-documents", parcelId],
      });
    },
    onError: () => toast.error("Файл хавсаргахад алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => parcelApi.deleteDocument(parcelId, docId),
    onSuccess: () => {
      toast.success("Баримт бичиг устгагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-documents", parcelId],
      });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  const formatSize = (b: number) =>
    b < 1024 * 1024
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Баримт бичгүүд
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Дээд хэмжээ 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 10 * 1024 * 1024) {
                toast.error("10MB хэтэрлээ");
                return;
              }
              uploadMutation.mutate(f);
              e.target.value = "";
            }
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
        >
          {uploadMutation.isPending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Нэмэх
        </button>
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]"
            />
          ))}
        </div>
      ) : !docs.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Paperclip className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Баримт бичиг байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {doc.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={doc.file_url}
                  download={doc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => {
                    if (confirm("Баримт бичиг устгах уу?"))
                      deleteMutation.mutate(doc.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payment tab ──────────────────────────────────────────────────────────────
function PaymentTab({
  parcelId,
  acqId,
  parcelCode,
}: {
  parcelId: string;
  acqId: string;
  parcelCode: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "MNT",
    paid_at: "",
    note: "",
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["parcel-payments", parcelId],
    queryFn: () => parcelApi.listPayments(parcelId),
  });

  const { data: parcelData } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const effectiveCode = parcelData?.parcel_id ?? parcelCode;

  const { data: compensations = [] } = useQuery({
    queryKey: ["compensations", acqId, effectiveCode],
    queryFn: () => landApi.listCompensations(acqId, effectiveCode),
    enabled: !!acqId && !!effectiveCode,
  });

  const cashTotal = compensations
    .filter((c) => c.compensation_type === "cash")
    .reduce((s, c) => s + c.amount, 0);
  const landGrantTotal = compensations
    .filter((c) => c.compensation_type === "land_grant")
    .reduce((s, c) => s + c.amount, 0);

  const addMutation = useMutation({
    mutationFn: () =>
      parcelApi.addPayment(parcelId, {
        amount: Number(form.amount),
        currency: form.currency,
        paid_at: form.paid_at || undefined,
        note: form.note,
      }),
    onSuccess: () => {
      toast.success("Төлбөр бүртгэгдлээ");
      setForm({ amount: "", currency: "MNT", paid_at: "", note: "" });
      setShowForm(false);
      queryClient.invalidateQueries({
        queryKey: ["parcel-payments", parcelId],
      });
    },
    onError: () => toast.error("Бүртгэхэд алдаа гарлаа"),
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const detail = parcelData?.detail;
  const hasValuation = !!(
    detail?.valuation_zone ||
    detail?.base_price_per_ha ||
    detail?.auction_price
  );

  const [editValuation, setEditValuation] = useState(false);
  const [vForm, setVForm] = useState({
    zone: "",
    base_price: "",
    coeff: "",
    auction_price: "",
  });

  const valuationMutation = useMutation({
    mutationFn: () =>
      landApi.updateParcelValuation(acqId, parcelId, {
        valuation_zone: vForm.zone,
        base_price_per_ha: vForm.base_price ? Number(vForm.base_price) : null,
        auction_coeff: vForm.coeff ? Number(vForm.coeff) : null,
        auction_price: vForm.auction_price ? Number(vForm.auction_price) : null,
      }),
    onSuccess: () => {
      toast.success("Үнэлгээ хадгалагдлаа");
      setEditValuation(false);
      queryClient.invalidateQueries({
        queryKey: ["parcel-full", acqId, parcelId],
      });
    },
    onError: () => toast.error("Хадгалахад алдаа гарлаа"),
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Land valuation */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Газрын үнэлгээ
          </p>
          {!editValuation && (
            <button
              onClick={() => {
                setVForm({
                  zone: detail?.valuation_zone ?? "",
                  base_price: detail?.base_price_per_ha?.toString() ?? "",
                  coeff: detail?.auction_coeff?.toString() ?? "",
                  auction_price: detail?.auction_price?.toString() ?? "",
                });
                setEditValuation(true);
              }}
              className="text-[12px] font-medium text-[#02c0ce] hover:underline"
            >
              {hasValuation ? "Засах" : "Мэдээлэл оруулах"}
            </button>
          )}
        </div>

        {editValuation ? (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Газрын суурь үнэлгээний зэрэглэл / Бүс
                </label>
                <input
                  value={vForm.zone}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, zone: e.target.value }))
                  }
                  className={inp}
                  placeholder="Жишээ: А бүс, 1-р зэрэглэл"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Газрын суурь үнэ /1га/
                </label>
                <input
                  value={vForm.base_price}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, base_price: e.target.value }))
                  }
                  className={inp}
                  placeholder="0"
                  type="number"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Дуудлага худалдааны анхны үнийн итгэлцүүр
                </label>
                <input
                  value={vForm.coeff}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, coeff: e.target.value }))
                  }
                  className={inp}
                  placeholder="1.0"
                  type="number"
                  step="0.0001"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Дуудлага худалдааны анхны үнэ
                </label>
                <input
                  value={vForm.auction_price}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, auction_price: e.target.value }))
                  }
                  className={inp}
                  placeholder="0"
                  type="number"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => valuationMutation.mutate()}
                disabled={valuationMutation.isPending}
                className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
              >
                {valuationMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
              <button
                onClick={() => setEditValuation(false)}
                className="rounded-lg border border-slate-200 dark:border-white/[0.08] px-4 py-2 text-[13px] text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
              >
                Цуцлах
              </button>
            </div>
          </div>
        ) : hasValuation ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                  {[
                    "#",
                    "Газрын суурь үнэлгээний зэрэглэл / Бүс",
                    "Газрын суурь үнэ /1га/",
                    "Дуудлага худалдааны анхны үнийн итгэлцүүр",
                    "Дуудлага худалдааны анхны үнэ",
                    "Нийт",
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
              <tbody>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    1
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {detail?.valuation_zone || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.base_price_per_ha != null
                      ? detail.base_price_per_ha.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.auction_coeff != null ? detail.auction_coeff : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {detail?.auction_price != null
                      ? detail.auction_price.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-white">
                    {detail?.auction_price != null
                      ? `${detail.auction_price.toLocaleString()}₮`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
            Газрын үнэлгээний мэдээлэл бүртгэгдээгүй
          </div>
        )}
      </div>

      {/* Compensation breakdown */}
      {compensations.length > 0 && (
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Үнэлгээний мэдээлэл
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#37394d] px-5">
            {compensations.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-400/15">
                    {comp.target_type === "parcel" ? (
                      <MapPin className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                  </span>
                  <div>
                    <span className="text-[13px] text-slate-600 dark:text-slate-300">
                      {TARGET_TYPE_LABELS[comp.target_type] ?? comp.target_type}
                    </span>
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}
                    >
                      {COMP_TYPE_LABELS[comp.compensation_type]}
                    </span>
                    {comp.coverage_percent > 0 && (
                      <span className="ml-2 text-[12px] text-slate-400">
                        {comp.coverage_percent}%
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {comp.amount.toLocaleString()}₮
                </span>
              </div>
            ))}
            <div className="flex items-start justify-between py-3.5">
              <span className="text-[13px] font-bold text-slate-800 dark:text-white">
                Нийт мөнгөн дүн
              </span>
              <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {cashTotal.toLocaleString()}₮
              </span>
            </div>
            {landGrantTotal > 0 && (
              <div className="flex items-center justify-between py-3">
                <span className="text-[13px] text-slate-500 dark:text-slate-400">
                  Газрын нөхөн олговор
                </span>
                <span className="text-[13px] font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                  {landGrantTotal.toLocaleString()}₮
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
              Нийт төлсөн
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {totalPaid.toLocaleString()}{" "}
              <span className="text-[14px] font-medium text-slate-400">₮</span>
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "Болих" : "Төлбөр нэмэх"}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#37394d] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Дүн</p>
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
                className={inp}
              />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Валют</p>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className={inp}
              >
                <option value="MNT">MNT</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Огноо</p>
              <input
                type="date"
                value={form.paid_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paid_at: e.target.value }))
                }
                className={inp}
              />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Тайлбар..."
                className={inp}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.amount || addMutation.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Хадгалах
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Төлбөрийн түүх
          </p>
        </div>
        {isLoading ? (
          <div className="p-5 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : !payments.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Wallet className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Төлбөрийн бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["#", "Дүн", "Огноо", "Тайлбар", "Бүртгэсэн"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {payments.map((p, i) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                  >
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                      {p.amount.toLocaleString()} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {p.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.created_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Real estate tab ──────────────────────────────────────────────────────────
const EMPTY_ASSET = {
  asset_number: "",
  asset_type: "real_state" as Asset["asset_type"],
  asset_name: "",
  floor_count: "",
  area_m2: "",
  owner_name: "",
  address: "",
  notes: "",
};

function RealEstateTab({
  acqId,
  parcelId,
  parcelCode,
}: {
  acqId: string;
  parcelId: string;
  parcelCode: string;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ASSET);

  const { data: parcelData } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const effectiveParcelCode = parcelData?.parcel_id ?? parcelCode;

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["parcel-assets", acqId, effectiveParcelCode],
    queryFn: () =>
      landApi.getAssets(acqId, {
        page: 1,
        page_size: 1000,
        parcel_id: effectiveParcelCode,
      }),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      landApi.createAsset(acqId, {
        parcel_id: parcelData?.parcel_id ?? parcelCode,
        asset_number: form.asset_number,
        asset_type: form.asset_type,
        asset_name: form.asset_name,
        floor_count: Number(form.floor_count) || 0,
        area_m2: Number(form.area_m2) || 0,
        owner_name: form.owner_name,
        address: form.address,
        notes: form.notes,
      }),
    onSuccess: () => {
      toast.success("Хөрөнгө нэмэгдлээ");
      setForm(EMPTY_ASSET);
      setShowForm(false);
      queryClient.invalidateQueries({
        queryKey: ["parcel-assets", acqId, effectiveParcelCode],
      });
    },
    onError: () => toast.error("Хөрөнгө нэмэхэд алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => landApi.deleteAsset(acqId, assetId),
    onSuccess: () => {
      toast.success("Хөрөнгө устгагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-assets", acqId, effectiveParcelCode],
      });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId],
    queryFn: () => landApi.listCompensations(acqId),
    enabled: !!acqId,
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const parcelAssets = assets?.data ?? [];
  const compsByAsset = allComps.reduce<Record<string, typeof allComps>>(
    (acc, c) => {
      if (c.asset_id) (acc[c.asset_id] ??= []).push(c);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="ap-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                Хөрөнгийн мэдээлэл
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {effectiveParcelCode || parcelId} нэгж талбарын хөрөнгийн
                мэдээлэл
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "Болих" : "Хөрөнгийн мэдээлэл оруулах"}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-1">
                  Хөрөнгийн төрөл
                </p>
                <select
                  value={form.asset_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      asset_type: e.target.value as Asset["asset_type"],
                    }))
                  }
                  className={inp}
                >
                  <option value="real_state">Үл хөдлөх хөрөнгө</option>
                  <option value="property">Эд хөрөнгө</option>
                </select>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Дугаар</p>
                <input
                  value={form.asset_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, asset_number: e.target.value }))
                  }
                  placeholder="1"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Төрөл</p>
                <input
                  value={form.asset_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, asset_name: e.target.value }))
                  }
                  placeholder="Амины орон сууц"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Давхар</p>
                <input
                  type="number"
                  value={form.floor_count}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, floor_count: e.target.value }))
                  }
                  placeholder="2"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Талбай (м²)</p>
                <input
                  type="number"
                  value={form.area_m2}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, area_m2: e.target.value }))
                  }
                  placeholder="60"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Эзэмшигч</p>
                <input
                  value={form.owner_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, owner_name: e.target.value }))
                  }
                  placeholder="Овог Нэр"
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Хаяг</p>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Хаяг..."
                  className={inp}
                />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
                <input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Тайлбар..."
                  className={inp}
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
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
      </div>

      {/* Asset cards */}
      {assetsLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-slate-100 dark:bg-[#252630]"
            />
          ))}
        </div>
      ) : !parcelAssets.length ? (
        <div className="ap-card flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
          <Building2 className="h-7 w-7 mb-2 opacity-30" />
          <p className="text-[13px]">Хөрөнгийн мэдээлэл байхгүй</p>
        </div>
      ) : (
        parcelAssets.map((asset) => {
          const assetComps = compsByAsset[asset.id] ?? [];
          return (
            <div key={asset.id} className="ap-card overflow-hidden">
              {/* Asset header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/60 dark:bg-[#1a1d20]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-500/10">
                    <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                      {asset.asset_name ||
                        ASSET_TYPE_LABELS[asset.asset_type] ||
                        "Хөрөнгө"}
                      {asset.asset_number ? ` №${asset.asset_number}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}{" "}
                      · {asset.address || "—"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Хөрөнгө устгах уу?"))
                      deleteMutation.mutate(asset.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Asset info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 dark:bg-[#37394d]">
                {[
                  [
                    "Хөрөнгийн төрөл",
                    ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type,
                  ],
                  ["Давхар", asset.floor_count || "—"],
                  ["Талбай", formatArea(asset.area_m2)],
                  ["Эзэмшигч", asset.owner_name || "—"],
                  ["Тайлбар", asset.notes || "—"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-white dark:bg-[#1e1f27] px-4 py-3"
                  >
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
                      {label}
                    </p>
                    <p className="text-[13px] text-slate-700 dark:text-slate-200 font-medium truncate">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Compensation sub-section */}
              {assetComps.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 px-5 py-2.5 border-t border-slate-100 dark:border-[#37394d] bg-slate-50/60 dark:bg-[#1a1d20]">
                    <ReceiptText className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Нөхөн төлбөр
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-[#37394d]">
                          {[
                            "Нөхөн төлбөрийн төрөл",
                            "Хэлбэр",
                            "Хувь",
                            "Дүн",
                            "Огноо",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                        {assetComps.map((comp) => (
                          <tr
                            key={comp.id}
                            className="hover:bg-slate-50/40 dark:hover:bg-[#252630]/50 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                              {TARGET_TYPE_LABELS[comp.target_type] ??
                                comp.target_type}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}
                              >
                                {COMP_TYPE_LABELS[comp.compensation_type] ??
                                  comp.compensation_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                              {comp.coverage_percent}%
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                              {comp.amount.toLocaleString()}₮
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                              {comp.compensation_date
                                ? formatDate(comp.compensation_date)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-5 py-3 border-t border-dashed border-slate-200 dark:border-[#37394d] text-slate-400 dark:text-slate-500">
                  <ReceiptText className="h-3.5 w-3.5 opacity-50" />
                  <p className="text-[11px]">Нөхөн төлбөр бүртгэгдээгүй</p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const acqId = searchParams.get("acq") ?? "";
  const [tab, setTab] = useState<Tab>("general");

  const { data: parcel } = useQuery({
    queryKey: ["parcel-full", acqId, id],
    queryFn: () => landApi.getParcel(acqId, id),
    enabled: !!acqId,
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general",
      label: "Ерөнхий мэдээлэл",
      icon: <Info className="h-4 w-4" />,
    },
    {
      key: "realEstate",
      label: "Хөрөнгийн мэдээлэл",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      key: "documents",
      label: "Баримт бичиг",
      icon: <Paperclip className="h-4 w-4" />,
    },
    { key: "payment", label: "Төлбөр", icon: <Wallet className="h-4 w-4" /> },
    { key: "map", label: "Байршил", icon: <MapPin className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/parcel"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white font-mono">
              {parcel?.parcel_id ?? id}
            </h1>
          </div>
          {acqId && parcel && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              {RIGHT_TYPE_LABELS[parcel.right_type] ?? "—"} · {parcel.au3_code}
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[110px] whitespace-nowrap transition-all select-none
                ${active ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"}`}
            >
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span
                className={
                  active
                    ? "text-[#02c0ce]"
                    : "text-slate-400 dark:text-slate-500"
                }
              >
                {t.icon}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-wide ${active ? "text-[#02c0ce]" : ""}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "general" && <GeneralTab acqId={acqId} parcelId={id} />}
      {tab === "realEstate" && (
        <RealEstateTab
          acqId={acqId}
          parcelId={id}
          parcelCode={parcel?.parcel_id ?? ""}
        />
      )}
      {tab === "documents" && <DocumentsTab parcelId={id} />}
      {tab === "payment" && (
        <PaymentTab
          parcelId={id}
          acqId={acqId}
          parcelCode={parcel?.parcel_id ?? ""}
        />
      )}
      {tab === "map" && (
        <div className="ap-card p-5">
          <ParcelMap parcelId={parcel?.parcel_id ?? ""} acquisitionId={acqId} />
        </div>
      )}
    </div>
  );
}
