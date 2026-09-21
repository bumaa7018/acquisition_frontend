"use client";

// Хүснэгт-4 (Барилгын тодорхойлолт) ба Хүснэгт-5 (Өртгийн хандлагаарх
// тооцоолол)-ын ЗАСАХ попапууд.
//
// Яагаад тусдаа файл: энэ хоёр хүснэгт нь мөр биш БАГАНААР барилгаа
// илэрхийлдэг тул бусад хүснэгтийн "сүүлийн багана дахь харандаа"-гаас өөр
// байдлаар (баганын толгойн товчоор) засагдана. Логик нь өөрөө жижиг биш —
// өртгийн гинжийг дахин бодож, хөрөнгийн олговрын дүнг хамт шинэчилнэ.
//
// ТООЦООЛОЛ: бүх томьёо `@/lib/valuation-calc`-д. Энд зөвхөн дэлгэц ба
// хадгалалт. Ингэснээр оруулах цонх, таб, шалгалт гурав ижил дүрэмтэй.

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, Building2, X } from "lucide-react";
import { toast } from "sonner";

import type {
  Asset,
  AssetCalcType,
  AssetCalculation,
  AssetSpec,
  AssetSpecType,
  Compensation,
  ValuationType,
} from "@/types";
import { getApiError } from "@/lib/utils";
import {
  recalcBuildingCost,
  isCoefficientRow,
  isFullCostRow,
  isDepreciationAmountRow,
  isNetCostRow,
  type BuildingCalcRow,
} from "@/lib/valuation-calc";

const INP =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-white";

function money(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value).toLocaleString()}₮`;
}

function Shell({
  title,
  icon,
  busy,
  onClose,
  onSave,
  saveDisabled,
  children,
}: {
  title: string;
  icon: "cost" | "spec";
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  children: React.ReactNode;
}) {
  const Icon = icon === "cost" ? Calculator : Building2;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <Icon className="h-4.5 w-4.5 text-[#02c0ce]" />
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">{title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <button
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
          >
            Болих
          </button>
          <button
            onClick={onSave}
            disabled={busy || saveDisabled}
            className="inline-flex h-9 items-center rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
          >
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}

export interface BuildingCostEditProps {
  acqId: string;
  asset: Asset;
  calcTypes: AssetCalcType[];
  /** Тухайн ХӨРӨНГИЙН нөхөх олговрын мөрүүд — дүн нь энд шинэчлэгдэнэ. */
  compensations: Compensation[];
  parcelCode: string;
  valuationType: ValuationType;
  svc: {
    listAssetCalculations: (a: string, id: string) => Promise<AssetCalculation[]>;
    upsertAssetCalculations: (
      a: string,
      id: string,
      calcs: { calc_type_id: number; unit: string; value: number; group?: string }[],
    ) => Promise<unknown>;
    updateAsset: (a: string, id: string, body: Partial<Asset>) => Promise<Asset | undefined>;
    createCompensation: (a: string, body: Partial<Compensation>) => Promise<Compensation | undefined>;
    updateCompensation: (
      a: string,
      id: string,
      body: Partial<Compensation>,
    ) => Promise<Compensation | undefined>;
  };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Хүснэгт-5 засах. Оролт нь нэгжийн өртөг, итгэлцүүр, элэгдлийн хувь, талбай;
 * үлдсэн мөрүүд (бүрэн орлуулах, элэгдлийн дүн, нөхөн орлуулах) нь АВТОМАТ
 * бодогдоно — тэдгээрийг гараар бичихийг зөвшөөрвөл хүснэгт өөртэйгөө зөрнө.
 */
export function BuildingCostEditModal({
  acqId,
  asset,
  calcTypes,
  compensations,
  parcelCode,
  valuationType,
  svc,
  onClose,
  onSaved,
}: BuildingCostEditProps) {
  const { data: saved, isLoading } = useQuery({
    queryKey: ["asset-calcs", acqId, asset.id],
    queryFn: () => svc.listAssetCalculations(acqId, asset.id),
  });
  const [rows, setRows] = useState<BuildingCalcRow[] | null>(null);
  const [area, setArea] = useState<string>(
    asset.area_m2 ? String(asset.area_m2) : "",
  );

  // Хадгалагдсан мөрүүдийг ДАРААЛАЛ нь хэвээр ачаална (Excel-ийн дараалал).
  const current: BuildingCalcRow[] =
    rows ??
    (saved ?? []).map((c) => ({
      calc_type_id: c.calc_type_id,
      code: calcTypes.find((t) => t.id === c.calc_type_id)?.code,
      label: c.calc_name || calcTypes.find((t) => t.id === c.calc_type_id)?.name || "Үзүүлэлт",
      group: c.calc_group ?? "",
      unit: c.unit ?? "",
      value: Number(c.value) || 0,
    }));

  const result = useMemo(
    () => recalcBuildingCost(current, Number(area) || null),
    [current, area],
  );

  const setValue = (index: number, raw: string) => {
    const next = [...current];
    next[index] = { ...next[index], value: Number(raw) || 0 };
    setRows(next);
  };

  const save = useMutation({
    mutationFn: async () => {
      const areaM2 = Number(area) || 0;
      await svc.upsertAssetCalculations(
        acqId,
        asset.id,
        result.rows.map((r) => ({
          calc_type_id: r.calc_type_id,
          unit: r.unit,
          value: r.value,
          group: r.group,
        })),
      );
      // Хөрөнгийн талбай/нэгж үнэ нь Хүснэгт-3.1-д харагддаг тул хамт шинэчилнэ
      // (эс бөгөөс хоёр хүснэгт өөр өөр тоо харуулна).
      await svc.updateAsset(acqId, asset.id, {
        area_m2: areaM2,
        unit_price: result.unitCost ?? asset.unit_price ?? 0,
      });
      // ОЛГОВРЫН ДҮН — нөхөн орлуулах өртгөөр шинэчлэгдэнэ. Ингэснээр
      // "Үл хөдлөх хөрөнгө" ба "Нэгдсэн дүн" автоматаар өөрчлөгдөнө.
      const net = result.netCost;
      if (net != null && net > 0) {
        const target = compensations[0];
        if (target) {
          await svc.updateCompensation(acqId, target.id, {
            target_type: "asset",
            parcel_id: parcelCode,
            asset_id: asset.id,
            compensation_type: target.compensation_type,
            coverage_percent: target.coverage_percent,
            amount: net,
            note: target.note,
          });
        } else {
          await svc.createCompensation(acqId, {
            target_type: "asset",
            valuation_type: valuationType,
            parcel_id: parcelCode,
            asset_id: asset.id,
            compensation_type: "cash",
            coverage_percent: 100,
            amount: net,
            note: "Барилгын нөхөн орлуулах өртөг",
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Тооцоолол шинэчлэгдлээ");
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const derived = (r: BuildingCalcRow) =>
    isFullCostRow(r) || isDepreciationAmountRow(r) || isNetCostRow(r);

  return (
    <Shell
      title={`${asset.asset_name || "Барилга"} — өртгийн тооцоолол`}
      icon="cost"
      busy={save.isPending}
      onClose={onClose}
      onSave={() => save.mutate()}
      saveDisabled={isLoading || current.length === 0}
    >
      {isLoading ? (
        <p className="py-6 text-center text-[13px] text-slate-400">Уншиж байна…</p>
      ) : (
        <>
          <div className="mb-3">
            <p className="mb-1 text-[11px] text-slate-400">Барилгын талбай (м²)</p>
            <input
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={`${INP} tabular-nums`}
            />
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-y border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400 dark:border-[#37394d]">
                <th className="px-2 py-2">Үзүүлэлт</th>
                <th className="px-2 py-2">Бүлэг</th>
                <th className="px-2 py-2">Нэгж</th>
                <th className="px-2 py-2 text-right">Утга</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#2b2d3a]">
              {result.rows.map((r, i) => (
                <tr key={`${r.calc_type_id}-${i}`}>
                  <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{r.label}</td>
                  <td className="px-2 py-1.5 text-slate-400">{r.group || "—"}</td>
                  <td className="px-2 py-1.5 text-slate-400">{r.unit || "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {derived(r) ? (
                      // Үр дүнгийн мөр — гараар бичихгүй, дээрх оролтоос бодогдоно.
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                        {money(r.value)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        value={r.value}
                        onChange={(e) => setValue(i, e.target.value)}
                        className={`${INP} h-8 w-40 text-right tabular-nums`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] dark:bg-[#252630]">
            <p className="text-slate-500 dark:text-slate-400">
              Итгэлцүүрийн үржвэр:{" "}
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {result.coefficientProduct.toFixed(4)}
              </span>{" "}
              ({current.filter(isCoefficientRow).length} мөр)
            </p>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              Нөхөн орлуулах өртөг (олговрын дүн болно):{" "}
              <span className="font-semibold tabular-nums text-[#02c0ce]">
                {money(result.netCost)}
              </span>
            </p>
          </div>
        </>
      )}
    </Shell>
  );
}

export interface BuildingSpecEditProps {
  acqId: string;
  asset: Asset;
  specTypes: AssetSpecType[];
  svc: {
    listAssetSpecs: (a: string, id: string) => Promise<AssetSpec[]>;
    upsertAssetSpecs: (
      a: string,
      id: string,
      specs: { spec_type_id: number; value: string }[],
    ) => Promise<unknown>;
    updateAsset: (a: string, id: string, body: Partial<Asset>) => Promise<Asset | undefined>;
  };
  onClose: () => void;
  onSaved: () => void;
}

/** Хүснэгт-4 засах — үзүүлэлт бүр текст утгатай, давхрын тоо/талбай хөрөнгө дээр. */
export function BuildingSpecEditModal({
  acqId,
  asset,
  specTypes,
  svc,
  onClose,
  onSaved,
}: BuildingSpecEditProps) {
  const { data: saved, isLoading } = useQuery({
    queryKey: ["asset-specs", acqId, asset.id],
    queryFn: () => svc.listAssetSpecs(acqId, asset.id),
  });
  const [values, setValues] = useState<Record<number, string> | null>(null);
  const [floors, setFloors] = useState(asset.floor_count ? String(asset.floor_count) : "");
  const [area, setArea] = useState(asset.area_m2 ? String(asset.area_m2) : "");

  const current: Record<number, string> =
    values ??
    Object.fromEntries((saved ?? []).map((sp) => [sp.spec_type_id, sp.value ?? ""]));

  const save = useMutation({
    mutationFn: async () => {
      await svc.upsertAssetSpecs(
        acqId,
        asset.id,
        specTypes.map((t) => ({ spec_type_id: t.id, value: current[t.id] ?? "" })),
      );
      await svc.updateAsset(acqId, asset.id, {
        floor_count: Number(floors) || 0,
        area_m2: Number(area) || 0,
      });
    },
    onSuccess: () => {
      toast.success("Барилгын тодорхойлолт шинэчлэгдлээ");
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  return (
    <Shell
      title={`${asset.asset_name || "Барилга"} — тодорхойлолт`}
      icon="spec"
      busy={save.isPending}
      onClose={onClose}
      onSave={() => save.mutate()}
      saveDisabled={isLoading}
    >
      {isLoading ? (
        <p className="py-6 text-center text-[13px] text-slate-400">Уншиж байна…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Давхрын тоо</p>
            <input
              type="number"
              value={floors}
              onChange={(e) => setFloors(e.target.value)}
              className={`${INP} tabular-nums`}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Талбай (м²)</p>
            <input
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={`${INP} tabular-nums`}
            />
          </div>
          {specTypes.map((t) => (
            <div key={t.id}>
              <p className="mb-1 text-[11px] text-slate-400">{t.name}</p>
              <input
                value={current[t.id] ?? ""}
                onChange={(e) =>
                  setValues({ ...current, [t.id]: e.target.value })
                }
                className={INP}
              />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
