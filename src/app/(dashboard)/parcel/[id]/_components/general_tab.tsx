"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { RIGHT_TYPE_LABELS, type AU } from "@/types";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import { RefreshCw, Calculator, Database, BarChart2, Activity, Check, X, AlertCircle } from "lucide-react";
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

const SYNC_STEPS = [
  {
    key: "cadastral",
    label: "Кадастын мэдээлэл",
    Icon: Database,
    color: "#3b82f6",
    subSteps: [
      { label: "Нэгж талбарын ерөнхий мэдээлэл", detail: "Кадастрын системээс нэгж талбарын мэдээлэл татаж байна...", isRealApi: true },
      { label: "Гэрээ дүгнэсэн акт файл", detail: "Гэрээ дүгнэсэн акт файлыг бэлтгэж байна..." },
    ],
  },
  {
    key: "valuation",
    label: "Төлбөр үнэлгээний мэдээлэл",
    Icon: BarChart2,
    color: "#f59e0b",
    subSteps: [
      { label: "Газрын үнэлгээний мэдээлэл", detail: "Газрын үнэлгээний мэдээлэл татаж байна..." },
      { label: "Тооцоо нийлсэн акт", detail: "Тооцоо нийлсэн акт бэлтгэж байна..." },
      { label: "Байршлын үнэлгээ тооцоолол", detail: "Газрын үнэлгээг байршлаар тооцоолж байна..." },
    ],
  },
  {
    key: "monitoring",
    label: "Мониторингийн мэдээлэл",
    Icon: Activity,
    color: "#10b981",
    subSteps: [
      { label: "Дүгнэлтийн мэдээлэл", detail: "Дүгнэлтийн мэдээллийг файлаар бэлтгэж байна..." },
    ],
  },
] as const;

const TOTAL_SUB_STEPS = SYNC_STEPS.reduce((s, step) => s + step.subSteps.length, 0);

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
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncCurrentStepIdx, setSyncCurrentStepIdx] = useState(-1);
  const [syncCurrentSubStepIdx, setSyncCurrentSubStepIdx] = useState(-1);
  const [syncDoneSubSteps, setSyncDoneSubSteps] = useState<string[]>([]);
  const [syncFailedSubSteps, setSyncFailedSubSteps] = useState<string[]>([]);
  const [syncDoneSteps, setSyncDoneSteps] = useState<number[]>([]);
  const [syncDetail, setSyncDetail] = useState("");
  const [syncFinished, setSyncFinished] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const startSync = useCallback(async () => {
    if (!acqId || !data?.parcel_id) return;
    const parcelCode = data.parcel_id;
    setSyncOpen(true);
    setSyncRunning(true);
    setSyncCurrentStepIdx(0);
    setSyncCurrentSubStepIdx(0);
    setSyncDoneSubSteps([]);
    setSyncFailedSubSteps([]);
    setSyncDoneSteps([]);
    setSyncDetail(SYNC_STEPS[0].subSteps[0].detail);
    setSyncFinished(false);
    setSyncError(null);

    const minDelay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // API function for each sub-step [stepIdx][subStepIdx]
    const apiFns: (() => Promise<unknown>)[][] = [
      [
        () => landApi.syncParcel(acqId, parcelCode),
        () => landApi.syncContractAct(acqId, parcelCode),
      ],
      [
        () => landApi.syncValuation(acqId, parcelCode),
        () => landApi.syncSettlementAct(acqId, parcelCode),
        () => landApi.syncLocationValuation(acqId, parcelCode),
      ],
      [
        () => landApi.syncMonitoring(acqId, parcelCode),
      ],
    ];

    let failCount = 0;
    for (let si = 0; si < SYNC_STEPS.length; si++) {
      const step = SYNC_STEPS[si];
      for (let ssi = 0; ssi < step.subSteps.length; ssi++) {
        setSyncCurrentStepIdx(si);
        setSyncCurrentSubStepIdx(ssi);
        setSyncDetail(step.subSteps[ssi].detail);
        const subKey = `${si}-${ssi}`;
        try {
          await Promise.all([apiFns[si][ssi](), minDelay(1500)]);
          setSyncDoneSubSteps((prev) => [...prev, subKey]);
        } catch {
          failCount++;
          setSyncFailedSubSteps((prev) => [...prev, subKey]);
        }
      }
      setSyncDoneSteps((prev) => [...prev, si]);
    }

    setSyncRunning(false);
    setSyncFinished(true);
    setSyncDetail(
      failCount > 0
        ? `${failCount} мэдээлэл татаж авах амжилтгүй боллоо`
        : "Бүх мэдээлэл амжилттай татагдлаа!",
    );
    queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
    queryClient.invalidateQueries({ queryKey: ["land", acqId] });
  }, [acqId, data, queryClient]);

  const handleSyncClose = useCallback(() => {
    if (syncRunning) return;
    setSyncOpen(false);
    if (syncFinished) window.location.reload();
  }, [syncRunning, syncFinished]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(10);

  useEffect(() => {
    if (!confirmOpen) return;
    setConfirmCountdown(10);
    const interval = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setConfirmOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmOpen]);

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
              onClick={() => setConfirmOpen(true)}
              disabled={!acqId || syncOpen || confirmOpen}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#0acf97]/10 px-3 text-[12px] font-semibold text-[#0acf97] transition-colors hover:bg-[#0acf97]/20 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
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

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Icon + title */}
            <div className="flex flex-col items-center px-6 pt-7 pb-5 text-center">
              <div className="relative mb-4">
                {/* Countdown ring */}
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className="text-slate-100 dark:text-[#2d2f3a]" />
                  <circle cx="22" cy="22" r="19" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round"
                    className="text-[#0acf97] transition-all duration-1000 ease-linear"
                    strokeDasharray={`${2 * Math.PI * 19}`}
                    strokeDashoffset={`${2 * Math.PI * 19 * (1 - confirmCountdown / 10)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[18px] font-bold tabular-nums text-slate-700 dark:text-white leading-none">
                    {confirmCountdown}
                  </span>
                </div>
              </div>

              <p className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">
                Нэгж талбарын мэдээлэл дуудах уу?
              </p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Кадастрын системээс нэгж талбарын мэдээлэл шинэчлэн татаж авах болно.
                Одоогийн мэдээлэл шинэчлэгдэнэ.
              </p>
              <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {confirmCountdown} секундын дараа автоматаар цуцлагдана
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 dark:bg-[#37394d]" />

            {/* Buttons */}
            <div className="flex">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-r border-slate-100 dark:border-[#37394d]"
              >
                Болих
              </button>
              <button
                onClick={() => { setConfirmOpen(false); startSync(); }}
                className="flex-1 py-3.5 text-[13px] font-semibold text-[#0acf97] hover:bg-[#0acf97]/5 transition-colors"
              >
                Тийм, дуудах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync progress modal */}
      {syncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 ${syncFinished ? "bg-emerald-500/15" : syncError ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                  {syncFinished ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : syncError ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-white leading-tight">Нэгж талбарын мэдээлэл дуудах</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                    {syncFinished ? "Амжилттай дууслаа" : syncError ? "Алдаа гарлаа" : "Боловсруулж байна..."}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSyncClose}
                disabled={syncRunning}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 py-3 bg-slate-50/60 dark:bg-[#191b22] border-b border-slate-100 dark:border-[#37394d]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Нийт явц</span>
                <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {syncDoneSubSteps.length} / {TOTAL_SUB_STEPS}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-[#2d2f3a] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${syncError ? "bg-red-500" : syncFinished ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${(syncDoneSubSteps.length / TOTAL_SUB_STEPS) * 100}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="px-5 py-4 space-y-5">
              {SYNC_STEPS.map((step, si) => {
                const StepIcon = step.Icon;
                const isDone = syncDoneSteps.includes(si);
                const isRunning = !isDone && syncCurrentStepIdx === si;
                const isPending = syncCurrentStepIdx < si && !isDone;

                return (
                  <div key={step.key}>
                    {/* Main step row */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
                          isDone
                            ? "shadow-sm"
                            : isRunning
                            ? "shadow-md ring-2"
                            : "border-2 border-dashed border-slate-200 dark:border-[#37394d]"
                        }`}
                        style={
                          isDone
                            ? { background: step.color }
                            : isRunning
                            ? { background: step.color + "20", boxShadow: `0 0 0 2px ${step.color}50` }
                            : {}
                        }
                      >
                        {isDone ? (
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                        ) : isRunning ? (
                          <>
                            <StepIcon className="h-3.5 w-3.5" style={{ color: step.color }} />
                            <span
                              className="absolute inset-0 rounded-xl animate-ping opacity-30"
                              style={{ background: step.color }}
                            />
                          </>
                        ) : (
                          <span className="text-[12px] font-bold text-slate-300 dark:text-slate-600">{si + 1}</span>
                        )}
                      </div>

                      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                        <span
                          className={`text-[13px] font-semibold transition-colors duration-300 truncate ${
                            isPending ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"
                          }`}
                          style={isRunning ? { color: step.color } : {}}
                        >
                          {step.label}
                        </span>
                        {isDone && (
                          <span
                            className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: step.color + "18", color: step.color }}
                          >
                            Дууссан
                          </span>
                        )}
                        {isRunning && (
                          <span className="shrink-0 text-[10px] font-medium animate-pulse" style={{ color: step.color }}>
                            Боловсруулж байна
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sub-steps */}
                    <div className="ml-4 pl-7 border-l-2 border-dashed border-slate-100 dark:border-[#2d2f3a] space-y-2">
                      {step.subSteps.map((subStep, ssi) => {
                        const subKey = `${si}-${ssi}`;
                        const subDone = syncDoneSubSteps.includes(subKey);
                        const subFailed = syncFailedSubSteps.includes(subKey);
                        const subRunning = !subDone && !subFailed && syncCurrentStepIdx === si && syncCurrentSubStepIdx === ssi;

                        return (
                          <div key={ssi} className="flex items-center gap-2.5">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                              style={
                                subDone
                                  ? { background: step.color }
                                  : subFailed
                                  ? { background: "#ef4444" }
                                  : subRunning
                                  ? { border: `2px solid ${step.color}60` }
                                  : { border: "1.5px dashed #cbd5e1" }
                              }
                            >
                              {subDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                              {subFailed && <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                              {subRunning && (
                                <span className="h-2 w-2 rounded-full animate-ping" style={{ background: step.color }} />
                              )}
                            </div>
                            <span
                              className={`text-[12px] transition-colors duration-300 ${
                                subDone
                                  ? "text-slate-600 dark:text-slate-300"
                                  : subFailed
                                  ? "text-red-400 dark:text-red-400"
                                  : subRunning
                                  ? "font-medium"
                                  : "text-slate-300 dark:text-slate-600"
                              }`}
                              style={subRunning ? { color: step.color } : {}}
                            >
                              {subStep.label}
                              {subFailed && <span className="ml-1.5 text-[10px] font-semibold opacity-80">· Амжилтгүй</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-[#191b22] border-t border-slate-100 dark:border-[#37394d]">
              {syncError ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-red-500 min-w-0">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="text-[12px] truncate">{syncError}</p>
                  </div>
                  <button
                    onClick={handleSyncClose}
                    className="shrink-0 h-8 px-4 rounded-lg bg-slate-200 dark:bg-[#2d2f3a] text-slate-700 dark:text-slate-200 text-[12px] font-semibold hover:bg-slate-300 dark:hover:bg-[#383a47] transition-colors"
                  >
                    Хаах
                  </button>
                </div>
              ) : syncFinished ? (
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex items-center gap-2 min-w-0 ${syncFailedSubSteps.length > 0 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {syncFailedSubSteps.length > 0
                      ? <AlertCircle className="h-4 w-4 shrink-0" />
                      : <Check className="h-4 w-4 shrink-0" />}
                    <p className="text-[12px] font-medium truncate">{syncDetail}</p>
                  </div>
                  <button
                    onClick={handleSyncClose}
                    className={`shrink-0 h-8 px-4 rounded-lg text-white text-[12px] font-semibold transition-colors ${syncFailedSubSteps.length > 0 ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                  >
                    Дуусгах
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                      style={{ background: syncCurrentStepIdx >= 0 ? SYNC_STEPS[syncCurrentStepIdx].color : "#3b82f6" }}
                    />
                    <span
                      className="relative inline-flex h-3 w-3 rounded-full"
                      style={{ background: syncCurrentStepIdx >= 0 ? SYNC_STEPS[syncCurrentStepIdx].color : "#3b82f6" }}
                    />
                  </span>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300 truncate">
                    {syncDetail || "Бэлтгэж байна..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
