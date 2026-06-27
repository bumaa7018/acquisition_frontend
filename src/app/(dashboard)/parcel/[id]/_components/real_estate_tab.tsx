"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { type Asset } from "@/types";
import { formatArea, formatDate, getApiError } from "@/lib/utils";
import { X, Plus, Trash2, Building2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { TARGET_TYPE_LABELS, COMP_TYPE_LABELS, ASSET_TYPE_LABELS, INP } from "./constants";

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

export function RealEstateTab({
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
    queryFn: () => landApi.getAssets(acqId, { page: 1, page_size: 1000, parcel_id: effectiveParcelCode }),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId],
    queryFn: () => landApi.listCompensations(acqId),
    enabled: !!acqId,
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
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Хөрөнгө нэмэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => landApi.deleteAsset(acqId, assetId),
    onSuccess: () => {
      toast.success("Хөрөнгө устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const parcelAssets = assets?.data ?? [];
  const compsByAsset = allComps.reduce<Record<string, typeof allComps>>((acc, c) => {
    if (c.asset_id) (acc[c.asset_id] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Хөрөнгийн мэдээлэл</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {effectiveParcelCode || parcelId} нэгж талбарын хөрөнгийн мэдээлэл
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Болих" : "Хөрөнгийн мэдээлэл оруулах"}
          </button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Хөрөнгийн төрөл</p>
                <select value={form.asset_type} onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value as Asset["asset_type"] }))} className={INP}>
                  <option value="real_state">Үл хөдлөх хөрөнгө</option>
                  <option value="property">Эд хөрөнгө</option>
                </select>
              </div>
              {([
                ["asset_number", "Дугаар", "text", "1"],
                ["asset_name", "Төрөл", "text", "Амины орон сууц"],
                ["floor_count", "Давхар", "number", "2"],
                ["area_m2", "Талбай (м²)", "number", "60"],
                ["owner_name", "Эзэмшигч", "text", "Овог Нэр"],
                ["address", "Хаяг", "text", "Хаяг..."],
                ["notes", "Тайлбар", "text", "Тайлбар..."],
              ] as [keyof typeof form, string, string, string][]).map(([field, label, type, placeholder]) => (
                <div key={field}>
                  <p className="text-[11px] text-slate-400 mb-1">{label}</p>
                  <input type={type} value={form[field] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder} className={INP} />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Plus className="h-4 w-4" />}
                Хадгалах
              </button>
            </div>
          </div>
        )}
      </div>

      {assetsLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(2)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-[#252630]" />)}
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
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/60 dark:bg-[#1a1d20]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-500/10">
                    <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                      {asset.asset_name || ASSET_TYPE_LABELS[asset.asset_type] || "Хөрөнгө"}
                      {asset.asset_number ? ` №${asset.asset_number}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type} · {asset.address || "—"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm("Хөрөнгө устгах уу?")) deleteMutation.mutate(asset.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 dark:bg-[#37394d]">
                {([
                  ["Хөрөнгийн төрөл", ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type],
                  ["Давхар", asset.floor_count || "—"],
                  ["Талбай", formatArea(asset.area_m2)],
                  ["Эзэмшигч", asset.owner_name || "—"],
                  ["Тайлбар", asset.notes || "—"],
                ] as [string, string | number][]).map(([label, value]) => (
                  <div key={label} className="bg-white dark:bg-[#1e1f27] px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-[13px] text-slate-700 dark:text-slate-200 font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>

              {assetComps.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 px-5 py-2.5 border-t border-slate-100 dark:border-[#37394d] bg-slate-50/60 dark:bg-[#1a1d20]">
                    <ReceiptText className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Нөхөн төлбөр</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-[#37394d]">
                          {["Нөхөн төлбөрийн төрөл", "Хэлбэр", "Хувь", "Дүн", "Огноо"].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                        {assetComps.map((comp) => (
                          <tr key={comp.id} className="hover:bg-slate-50/40 dark:hover:bg-[#252630]/50 transition-colors">
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{TARGET_TYPE_LABELS[comp.target_type] ?? comp.target_type}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${comp.compensation_type === "cash" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400"}`}>
                                {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 tabular-nums">{comp.coverage_percent}%</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{comp.amount.toLocaleString()}₮</td>
                            <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{comp.compensation_date ? formatDate(comp.compensation_date) : "—"}</td>
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
