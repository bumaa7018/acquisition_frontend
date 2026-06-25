"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { RIGHT_TYPE_LABELS, type AU } from "@/types";
import { formatDate, formatArea } from "@/lib/utils";
import { RefreshCw, Calculator } from "lucide-react";
import { toast } from "sonner";
import { CompensationSection } from "./compensation_section";

function calcAreaFromWkt(wkt: string): number | null {
  try {
    // Strip EWKT SRID prefix if present: "SRID=4326;POLYGON..."
    const cleaned = wkt.replace(/^SRID=\d+;/i, "");
    const coordStr = cleaned.replace(/^[A-Z\s]+\(\(/, "").replace(/\)\).*$/, "");
    const coords = coordStr.split(",").map((p) => {
      const [x, y] = p.trim().split(/\s+/).map(Number);
      return [x, y] as [number, number];
    });
    if (coords.length < 3) return null;

    // Detect CRS: geographic (degrees) if x in [-180,180] and y in [-90,90]
    const isGeographic = coords.every(([x, y]) => x >= -180 && x <= 180 && y >= -90 && y <= 90);

    if (isGeographic) {
      // Spherical excess formula for EPSG:4326
      const R = 6378137;
      const toRad = (d: number) => (d * Math.PI) / 180;
      let area = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[(i + 1) % coords.length];
        area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
      }
      return Math.abs((area * R * R) / 2);
    } else {
      // Planar shoelace formula for projected CRS (UTM etc., coordinates in meters)
      let area = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[(i + 1) % coords.length];
        area += x1 * y2 - x2 * y1;
      }
      return Math.abs(area / 2);
    }
  } catch {
    return null;
  }
}

function findAdminUnit(aus: AU[] | null | undefined, au1Code: string, au2Code: string, au3Code: string) {
  return aus?.find((au) => au.au1_code === au1Code && au.au2_code === au2Code && au.au3_code === au3Code);
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

export function GeneralTab({ acqId, parcelId }: { acqId: string; parcelId: string }) {
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
    queryFn: () => landApi.getAssets(acqId, { page: 1, page_size: 100, parcel_id: data?.parcel_id }),
    enabled: !!acqId && !!data?.parcel_id,
  });

  const [editingMeta, setEditingMeta] = useState(false);
  const [dbChanged, setDbChanged] = useState(false);
  const [changedParcelId, setChangedParcelId] = useState("");
  const [acquisitionAreaM2, setAcquisitionAreaM2] = useState<string>("");
  const [areaAutoCalc, setAreaAutoCalc] = useState(false);

  useEffect(() => {
    if (data) {
      setDbChanged(data.db_changed ?? false);
      setChangedParcelId(data.changed_parcel_id ?? "");
      setAcquisitionAreaM2(String(data.acquisition_area_m2 ?? ""));
      setAreaAutoCalc(false);
    }
  }, [data]);

  const handleAutoCalcArea = useCallback(() => {
    if (!data?.acquisition_geom_wkt) return;
    const calc = calcAreaFromWkt(data.acquisition_geom_wkt);
    if (calc != null) {
      setAcquisitionAreaM2(String(Math.round(calc)));
      setAreaAutoCalc(true);
      toast.success("Талбай тооцоологдлоо");
    } else {
      toast.error("Геометриас талбай тооцоолох боломжгүй");
    }
  }, [data?.acquisition_geom_wkt]);

  const metaMutation = useMutation({
    mutationFn: () => {
      const areaVal = parseFloat(acquisitionAreaM2);
      return landApi.updateParcelMeta(
        acqId, parcelId, dbChanged, changedParcelId,
        isNaN(areaVal) ? undefined : areaVal,
      );
    },
    onSuccess: () => {
      toast.success("Мэдээлэл хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
      setEditingMeta(false);
      setAreaAutoCalc(false);
    },
    onError: () => toast.error("Хадгалахад алдаа гарлаа"),
  });

  const syncMutation = useMutation({
    mutationFn: () => landApi.syncParcel(acqId, parcelId),
    onSuccess: () => {
      toast.success("Нэгж талбарын мэдээлэл шинэчлэгдлээ");
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
      queryClient.invalidateQueries({ queryKey: ["land", acqId] });
      window.location.reload();
    },
    onError: () => toast.error("Нэгж талбарын мэдээлэл дуудахад алдаа гарлаа"),
  });

  const row = (label: string, value?: React.ReactNode) => (
    <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0">
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">{label}</span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{value || "—"}</span>
    </div>
  );

  if (isLoading)
    return (
      <div className="ap-card p-5 animate-pulse space-y-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-100 dark:bg-[#252630]" />)}
      </div>
    );
  if (!data)
    return <div className="ap-card p-10 text-center text-[13px] text-slate-400">Мэдээлэл олдсонгүй</div>;

  const adminUnit = findAdminUnit(acquisition?.aus, data.au1_code, data.au2_code, data.au3_code);

  const parcelComps = compensations.filter((c) => c.parcel_id === data.parcel_id);
  const assets = assetsData?.data ?? [];
  const parcelLandValue = parcelComps.filter((c) => c.target_type === "parcel").reduce((s, c) => s + c.amount, 0);
  const realStateAssetIds = new Set(assets.filter((a) => a.asset_type === "real_state").map((a) => a.id));
  const propertyAssetIds = new Set(assets.filter((a) => a.asset_type === "property").map((a) => a.id));
  const realStateComp = parcelComps.filter((c) => c.target_type === "asset" && c.asset_id && realStateAssetIds.has(c.asset_id)).reduce((s, c) => s + c.amount, 0);
  const propertyComp = parcelComps.filter((c) => c.target_type === "asset" && c.asset_id && propertyAssetIds.has(c.asset_id)).reduce((s, c) => s + c.amount, 0);
  const totalComp = parcelLandValue + realStateComp + propertyComp;

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
              onClick={() => { if (!confirm("Нэгж талбарын мэдээлэл дуудах уу?")) return; syncMutation.mutate(); }}
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
          {row("Аймаг/Нийслэл", formatAdminUnit(adminUnit?.au1_name, data.au1_code))}
          {row("Сум/Дүүрэг", formatAdminUnit(adminUnit?.au2_name, data.au2_code))}
          {row("Баг/Хороо", formatAdminUnit(adminUnit?.au3_name, data.au3_code))}
          {row("Эрхийн төрөл", RIGHT_TYPE_LABELS[data.right_type])}
          {row("Газрын зориулалт", data.landuse)}
          {row("Эрх эхэлсэн", data.valid_from ? formatDate(data.valid_from) : undefined)}
          {row("Эрх дуусах", data.valid_till ? formatDate(data.valid_till) : undefined)}
          {row("Нийт талбай", formatArea(data.area_m2))}
          {row("Чөлөөлөгдөх талбай", highlightArea(formatArea(data.acquisition_area_m2)))}
          {row("Үлдэх газрын хэмжээ",
            data.remaining_area_m2 != null
              ? formatArea(data.remaining_area_m2)
              : formatArea((data.area_m2 || 0) - (data.acquisition_area_m2 || 0))
          )}
        </div>

        {/* Эзэмшигч */}
        <div className="ap-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Эзэмшигч</p>
          {data.detail ? (
            <>
              {row("Овог нэр", `${data.detail.holder_last_name ?? ""} ${data.detail.holder_name ?? ""}`.trim())}
              {row("Регистрийн дугаар", data.detail.holder_register_no)}
              {row("Иргэний үнэмлэх", data.detail.holder_civil_id)}
              {row("Утас", data.detail.holder_phone)}
              {row("И-мэйл", data.detail.holder_email)}
              {row("Эзэмшигчийн төрөл", data.detail.holder_type)}
              <div className="mt-5">
                <div className="h-px w-full bg-[#e2e8f0] dark:bg-[#37394d]" />
                <p className="pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Өргөдлийн мэдээлэл</p>
              </div>
              {row("Өргөдлийн дугаар", data.detail.app_no)}
              {row("Шийдвэрийн дугаар", data.detail.decision_no)}
              {row("Шийдвэрийн огноо", data.detail.decision_date ? formatDate(data.detail.decision_date) : undefined)}
              {row("Гэрээний дугаар", data.detail.contract_no)}
              {row("Гэрчилгээний дугаар", data.detail.certificate_no)}
            </>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-8">Эзэмшигчийн мэдээлэл байхгүй</p>
          )}
        </div>
      </div>

      {/* Газрын үнэлгээ */}
      {data.detail && (data.detail.valuation_zone || data.detail.base_price_per_ha != null || data.detail.auction_price != null) && (
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Газрын үнэлгээ</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                  {["#", "Газрын суурь үнэлгээний зэрэглэл / Бүс", "Газрын суурь үнэ /1га/", "Дуудлага худалдааны анхны үнийн итгэлцүүр", "Дуудлага худалдааны анхны үнэ", "Нийт"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">1</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{data.detail.valuation_zone || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {data.detail.base_price_per_ha != null ? data.detail.base_price_per_ha.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {data.detail.auction_coeff != null ? data.detail.auction_coeff : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                    {data.detail.auction_price != null ? data.detail.auction_price.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-white">
                    {data.detail.auction_price != null ? `${data.detail.auction_price.toLocaleString()}₮` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Нөхөн төлбөрийн дүн */}
      {parcelComps.length > 0 && (
        <div className="ap-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Нөхөн төлбөрийн дүн</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
            {row("Нөлөөлөлд өртсөн газрын үнэ", parcelLandValue > 0 ? `${parcelLandValue.toLocaleString()} ₮` : "—")}
            {row("Үл хөдлөх хөрөнгийн нөхөн төлбөр", realStateComp > 0 ? `${realStateComp.toLocaleString()} ₮` : "—")}
            {row("Эд хөрөнгийн нөхөн төлбөр", propertyComp > 0 ? `${propertyComp.toLocaleString()} ₮` : "—")}
            {row("Нийт нөхөн төлбөр", totalComp > 0 ? <span className="font-bold text-[#02c0ce]">{totalComp.toLocaleString()} ₮</span> : "—")}
          </div>
        </div>
      )}

      {/* Мэдээллийн сангийн өөрчлөлт */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Мэдээллийн сангийн өөрчлөлт</p>
          {editingMeta ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingMeta(false);
                  setDbChanged(data.db_changed ?? false);
                  setChangedParcelId(data.changed_parcel_id ?? "");
                  setAcquisitionAreaM2(String(data.acquisition_area_m2 ?? ""));
                  setAreaAutoCalc(false);
                }}
                className="h-7 px-3 rounded-lg text-[12px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
              >Болих</button>
              <button
                onClick={() => metaMutation.mutate()}
                disabled={metaMutation.isPending}
                className="h-7 px-3 rounded-lg text-[12px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >Хадгалах</button>
            </div>
          ) : (
            <button onClick={() => setEditingMeta(true)} className="h-7 px-3 rounded-lg text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/10 transition-colors">
              Засах
            </button>
          )}
        </div>
        <div className="px-5 divide-y divide-slate-100 dark:divide-[#37394d]">
          {/* Чөлөөлөгдөх талбай */}
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">Чөлөөлөгдөх талбай (м²)</span>
            {editingMeta ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="number"
                  value={acquisitionAreaM2}
                  onChange={(e) => { setAcquisitionAreaM2(e.target.value); setAreaAutoCalc(false); }}
                  placeholder="Талбай оруулах..."
                  className="h-8 w-44 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
                />
                {data.acquisition_geom_wkt && (
                  <button
                    type="button"
                    onClick={handleAutoCalcArea}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#02c0ce]/30 bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Хилээс тооцоолох
                  </button>
                )}
                {areaAutoCalc && (
                  <span className="text-[11px] text-[#0acf97] font-medium">Автоматаар тооцоологдсон</span>
                )}
              </div>
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {data.acquisition_area_m2 != null ? formatArea(data.acquisition_area_m2) : "—"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">Мэдээллийн санд өөрчлөлт орсон эсэх</span>
            {editingMeta ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dbChanged} onChange={(e) => setDbChanged(e.target.checked)} className="w-4 h-4 accent-[#02c0ce]" />
                <span className="text-[13px] text-slate-700 dark:text-slate-200">{dbChanged ? "Тийм" : "Үгүй"}</span>
              </label>
            ) : (
              <span className={`text-[13px] font-medium ${data.db_changed ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"}`}>
                {data.db_changed ? "Тийм" : "Үгүй"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">Өөрчлөгдсөн нэгж талбарын дугаар</span>
            {editingMeta ? (
              <input
                type="text" value={changedParcelId}
                onChange={(e) => setChangedParcelId(e.target.value)}
                placeholder="Нэгж талбарын дугаар..."
                className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
              />
            ) : (
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{data.changed_parcel_id || "—"}</span>
            )}
          </div>
        </div>
      </div>

      <CompensationSection acqId={acqId} parcelCode={data.parcel_id} parcelId={parcelId} />
    </div>
  );
}
