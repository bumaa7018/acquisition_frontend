"use client";

// Мэргэжлийн байгууллагын нөхөн олговрын үнэлгээний Excel-ийг ХӨРӨНГИЙН ҮНЭЛГЭЭ хэсэгт
// оруулах модуль. Excel-ийг ЗӨВХӨН browser дээр задалж (parse), файлыг сервер рүү илгээхгүй.
// Урьдчилан харах (preview) дээр хэрэглэгч шалгаж/зассаны дараа одоо байгаа
// Asset / Compensation / LandValuation API (svc)-аар системд бөөнөөр үүсгэнэ.
// svc нь эцэг компонентоос ирэх тул хандах эрхийн (RBAC) чиглүүлэлт хэвээр хадгалагдана.

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  FileSpreadsheet,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CircleAlert,
  CheckCircle2,
  Building2,
  ReceiptText,
  Boxes,
  Truck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { INP } from "./constants";
import type {
  Asset,
  AssetCalcType,
  AssetSpecType,
  Compensation,
  ValuationImportAssetPayload,
  ValuationImportPayload,
  ValuationImportResult,
} from "@/types";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";
import { getApiError } from "@/lib/utils";
import { similarity } from "@/lib/valuation-import/fuzzy";
import {
  parseValuationFile,
  validateParsed,
  fileSha256,
  type AssetKind,
  type ParsedAsset,
  type ParsedValuation,
} from "@/lib/valuation-import";

// svc-ийн энэ модульд шаардлагатай дэд хэсэг (real_estate_tab-ийн svc үүнд нийцнэ).
// Бүх импорт нэг API дуудлагаар (backend транзакц) хийгдэнэ.
export interface ValuationImportSvc {
  importValuation: (a: string, body: ValuationImportPayload) => Promise<ValuationImportResult | undefined>;
}

interface Props {
  acqId: string;
  parcelId: string;
  parcelCode: string;
  svc: ValuationImportSvc;
  specTypes: AssetSpecType[];
  calcTypes: AssetCalcType[];
  // Тухайн нэгж талбарт одоо байгаа хөрөнгө/үнэлгээ — дахин импортлоход эдгээрийг устгана
  existingAssets: Asset[];
  existingComps: Compensation[];
  onDone: () => void;
}

const nf = new Intl.NumberFormat("mn-MN");
function money(v: number | null | undefined) {
  return v == null ? "—" : `${nf.format(Math.round(v))}₮`;
}
function num(v: number | null | undefined) {
  return v == null ? "—" : nf.format(v);
}

const KIND_LABEL: Record<AssetKind, string> = {
  real_state: "Үл хөдлөх хөрөнгө",
  property: "Эд хөрөнгө",
};

type Phase = "idle" | "parsing" | "preview" | "submitting";

/**
 * Барилгын өртгийн задаргааг DB-ийн calc type-уудтай тааруулж утга оноох.
 * Скаляр утгуудыг (нэгж өртөг, нөхөн орлуулах өртөг) calc type-ийн CODE-оор найдвартай
 * онооно; итгэлцүүрүүдийг нэрээр нь fuzzy тааруулна (code таарахгүй бол мөн fuzzy).
 * Тохирох слот байхгүй утга (жишээ: "төвлөрсөн бус халаалт") 0 хэвээр үлдэнэ.
 */
function mapBuildingCalcs(
  building: NonNullable<ParsedAsset["building"]>,
  calcTypes: AssetCalcType[],
): NonNullable<ValuationImportAssetPayload["calculations"]> {
  const out: NonNullable<ValuationImportAssetPayload["calculations"]> = [];
  for (const it of building.items) {
    if (it.value == null) continue;
    // Зөвхөн ЖИНХЭНЭ талбайн мөрийг алгасна (area_m2-д хадгалагдана).
    // Анхаар: "...талбайн төсөвт ӨРТӨГ" мөрөнд "талбай" орох тул өртөг/үнэ агуулаагүйг л алгасна.
    if (/талбай/i.test(it.label) && !/өртөг|үнэ/i.test(it.label)) continue;

    // Одоо байгаа calc type-тай тааруулах: эхлээд scalar-уудыг утгаар нь, дараа нь нэрээр fuzzy
    let match: AssetCalcType | undefined;
    if (/төсөвт өртөг|жишиг/i.test(it.label)) match = calcTypes.find((t) => t.code === "unit_cost");
    else if (/нөхөн орлуулах/i.test(it.label)) match = calcTypes.find((t) => t.code === "net_replacement_cost");
    if (!match) {
      let best: { t: AssetCalcType; s: number } | null = null;
      for (const t of calcTypes) {
        const s = similarity(t.name, it.label);
        if (!best || s > best.s) best = { t, s };
      }
      if (best && best.s >= 0.6) match = best.t;
    }

    if (match) out.push({ calc_type_id: match.id, unit: match.default_unit, value: it.value });
    // Тохирох төрөлгүй бол нэрээр нь илгээж, backend автоматаар calc type (бүлэгтэй) үүсгэнэ
    else out.push({ name: it.label, group: it.group, unit: it.unit, value: it.value });
  }
  return out;
}

export function ValuationExcelImport({
  acqId,
  parcelId,
  parcelCode,
  svc,
  specTypes,
  calcTypes,
  existingAssets,
  existingComps,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [data, setData] = useState<ParsedValuation | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingCount = existingAssets.length + existingComps.length;

  const reset = () => {
    setPhase("idle");
    setData(null);
    setFileName("");
    setFileHash("");
    setPendingConfirm(null);
  };
  const close = () => {
    if (phase === "submitting") return;
    setOpen(false);
    reset();
  };

  const handleFile = useCallback(async (file: File) => {
    if (!/\.xlsx?$/.test(file.name.toLowerCase())) {
      toast.error("Зөвхөн Excel (.xlsx) файл оруулна уу");
      return;
    }
    setFileName(file.name);
    setPhase("parsing");
    try {
      const parsed = await parseValuationFile(file);
      const hash = await fileSha256(file); // алдаа шидэхгүй ("" буцаана)
      setData(parsed);
      setFileHash(hash);
      setPhase("preview");
    } catch (err) {
      console.error("Excel parse error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Excel задлахад алдаа гарлаа: ${msg}`);
      reset();
    }
  }, []);

  // ── preview дээр өгөгдөл засах ──
  const revalidate = (next: ParsedValuation): ParsedValuation => ({
    ...next,
    warnings: validateParsed(next),
  });
  const patchAsset = (idx: number, patch: Partial<ParsedAsset>) => {
    setData((prev) => {
      if (!prev) return prev;
      const assets = prev.assets.map((a, i) => (i === idx ? { ...a, ...patch } : a));
      return revalidate({ ...prev, assets });
    });
  };
  const patchLand = (patch: Partial<ParsedValuation["land"]>) => {
    setData((prev) => (prev ? revalidate({ ...prev, land: { ...prev.land, ...patch } }) : prev));
  };
  // Preview дээр оруулахгүй мөрийг хасах
  const removeAsset = (idx: number) => {
    setData((prev) =>
      prev ? revalidate({ ...prev, assets: prev.assets.filter((_, i) => i !== idx) }) : prev,
    );
  };
  const removeClearance = (idx: number) => {
    setData((prev) =>
      prev ? { ...prev, clearance: prev.clearance.filter((_, i) => i !== idx) } : prev,
    );
  };

  const errors = data?.warnings.filter((w) => w.level === "error") ?? [];
  const warnings = data?.warnings.filter((w) => w.level === "warning") ?? [];
  const canSubmit = !!data && errors.length === 0;

  // Нэгтгэлийн тооцоолол (preview дээр харуулна)
  const landTotal = data?.land.totalValue ?? 0;
  const buildingTotal =
    data?.assets.filter((a) => a.kind === "real_state").reduce((s, a) => s + (a.totalPrice ?? 0), 0) ?? 0;
  const propertyTotal =
    data?.assets.filter((a) => a.kind === "property").reduce((s, a) => s + (a.totalPrice ?? 0), 0) ?? 0;
  const clearanceTotal = data?.clearance.reduce((s, c) => s + (c.totalPrice ?? 0), 0) ?? 0;
  const grandTotal = landTotal + buildingTotal + propertyTotal + clearanceTotal;

  // "Системд оруулах" дарахад: хуучин мэдээлэл байвал баталгаажуулаад, дараа нь оруулна.
  const handleSubmitClick = () => {
    if (!canSubmit) return;
    if (existingCount > 0) {
      setPendingConfirm({
        title: "Мэдээллийг шинэчлэх",
        description:
          `Энэ нэгж талбарт аль хэдийн ${existingAssets.length} хөрөнгө, ${existingComps.length} үнэлгээ бүртгэгдсэн байна. ` +
          "Үргэлжлүүлбэл хуучин бүх хөрөнгө, үнэлгээг УСТГААД, Excel-ийн шинэ мэдээллээр бүрэн солино.",
        confirmLabel: "Устгаад шинэчлэх",
        confirmColor: "#f1556c",
        onConfirm: runImport,
      });
    } else {
      runImport();
    }
  };

  const runImport = async () => {
    if (!data || !canSubmit) return;
    setPhase("submitting");

    // Бүх хөрөнгийг НЭГ payload болгон бэлдэнэ. Барилга (real_state)-д spec/calc-ыг
    // client дээр бэлдэж дамжуулна. Газар чөлөөлөх/түр суурьшуулах зардлыг эд хөрөнгө болгоно.
    const assets: ValuationImportAssetPayload[] = data.assets.map((a) => {
      const isRealState = a.kind === "real_state";
      return {
        asset_number: a.seqNo != null ? String(a.seqNo) : "",
        asset_type: a.kind ?? "property",
        asset_name: a.name,
        area_m2: a.quantity ?? 0,
        unit: a.unit,
        description: a.description,
        owner_name: data.land.ownerName,
        notes: "Excel-ээс импортолсон",
        unit_price: a.unitPrice ?? 0,
        compensation_amount: a.totalPrice ?? 0,
        specs: isRealState ? specTypes.map((t) => ({ spec_type_id: t.id, value: "" })) : undefined,
        calculations: isRealState
          ? a.building
            ? mapBuildingCalcs(a.building, calcTypes)
            : calcTypes.map((t) => ({ calc_type_id: t.id, unit: t.default_unit, value: 0 }))
          : undefined,
      };
    });

    for (const c of data.clearance) {
      if (c.totalPrice && c.totalPrice > 0) {
        assets.push({
          asset_type: "property",
          asset_name: c.name,
          area_m2: c.quantity ?? 0,
          unit: c.unit,
          description: c.category,
          owner_name: data.land.ownerName,
          notes: c.category ? `Excel-ээс импортолсон · ${c.category}` : "Excel-ээс импортолсон",
          unit_price: c.unitPrice ?? 0,
          compensation_amount: c.totalPrice,
        });
      }
    }

    const payload: ValuationImportPayload = {
      parcel_id: parcelCode,
      replace: true, // хуучин хөрөнгө/олговрыг backend дээр нэг транзакцаар эхлээд устгана
      land: {
        land_area_m2: data.land.affectedAreaM2 ?? 0,
        base_price_per_m2: data.land.basePriceM2 ?? 0,
        ownership_cert_no: data.land.certNo || undefined,
        appraiser_org_name: data.org.name || undefined,
        appraiser_reg_no: data.org.regNo || undefined,
        appraiser_state_reg_no: data.org.stateRegNo || undefined,
        appraiser_director: data.org.director || undefined,
        appraiser_license: data.org.license || undefined,
        appraiser_address: data.org.address || undefined,
        appraiser_contact: data.org.contact || undefined,
        source_file_name: fileName || undefined,
        source_file_hash: fileHash || undefined,
      },
      assets,
    };

    try {
      // Бүх устгал + оруулалт НЭГ API дуудлагаар (backend транзакц)
      await svc.importValuation(acqId, payload);
      toast.success("Хөрөнгийн үнэлгээ системд амжилттай орлоо");
      onDone();
      close();
    } catch (err) {
      toast.error(getApiError(err, "Хадгалах явцад алдаа гарлаа"));
      setPhase("preview");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#02c0ce]/40 bg-[#02c0ce]/5 px-4 text-[13px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/10"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel-ээс оруулах
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            {/* Толгой */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#02c0ce]" />
                <div>
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                    Хөрөнгийн үнэлгээ — Excel оруулах
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {fileName || "Нөхөн олговрын үнэлгээний Excel файлыг сонгоно уу"}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                disabled={phase === "submitting"}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {/* ── Файл сонгох ── */}
              {(phase === "idle" || phase === "parsing") && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
                    dragOver
                      ? "border-[#02c0ce] bg-[#02c0ce]/5"
                      : "border-slate-200 hover:bg-slate-50 dark:border-white/[0.12] dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {phase === "parsing" ? (
                    <>
                      <Loader2 className="h-9 w-9 animate-spin text-[#02c0ce]" />
                      <p className="text-[13px] text-slate-500">Excel задалж байна…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-9 w-9 text-slate-300" />
                      <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                        Excel файлыг чирж оруулах эсвэл дарж сонгоно уу
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Файл серверт илгээгдэхгүй — зөвхөн таны төхөөрөмж дээр боловсруулагдана
                      </p>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* ── Preview ── */}
              {(phase === "preview" || phase === "submitting") && data && (
                <div className="flex flex-col gap-4">
                  {/* Хуучин мэдээлэл солигдох анхааруулга */}
                  {existingCount > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-[12px] text-amber-700 dark:text-amber-400">
                        Энэ нэгж талбарт аль хэдийн <b>{existingAssets.length}</b> хөрөнгө, <b>{existingComps.length}</b> үнэлгээ
                        бүртгэгдсэн байна. Оруулах үед <b>хуучин бүх мэдээлэл устгагдаж</b>, Excel-ийн шинэ мэдээллээр солигдоно.
                      </span>
                    </div>
                  )}

                  {/* Алдаа / анхааруулга */}
                  {(errors.length > 0 || warnings.length > 0) && (
                    <div className="grid gap-2">
                      {errors.map((w, i) => (
                        <div
                          key={`e${i}`}
                          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
                        >
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{w.message}</span>
                        </div>
                      ))}
                      {warnings.map((w, i) => (
                        <div
                          key={`w${i}`}
                          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Байгууллага */}
                  {data.org.name && (
                    <Section icon={ReceiptText} title="Үнэлгээний байгууллага" tone="slate">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3 text-[12px] md:grid-cols-3">
                        <Field label="Нэр" value={data.org.name} />
                        <Field label="Захирал" value={data.org.director} />
                        <Field label="Регистр" value={data.org.regNo} />
                        <Field label="Улсын бүртгэл" value={data.org.stateRegNo} />
                        <Field label="Холбоо барих" value={data.org.contact} />
                        <Field label="Хаяг" value={data.org.address} />
                      </div>
                    </Section>
                  )}

                  {/* Газрын үнэлгээ */}
                  <Section icon={ReceiptText} title="Газрын үнэлгээ" tone="emerald">
                    <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
                      <LabeledInput
                        label="Өмчлөгч / эзэмшигч"
                        value={data.land.ownerName}
                        onChange={(v) => patchLand({ ownerName: v })}
                      />
                      <LabeledNumber
                        label="Чөлөөлөгдөх талбай (м²)"
                        value={data.land.affectedAreaM2}
                        onChange={(v) => patchLand({ affectedAreaM2: v })}
                      />
                      <LabeledNumber
                        label="1 м² суурь үнэ (₮)"
                        value={data.land.basePriceM2}
                        onChange={(v) => patchLand({ basePriceM2: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[12px] dark:border-[#37394d]">
                      <span className="text-slate-500">
                        Гэрчилгээ: {data.land.certNo || "—"} · Нэгж талбар: {data.land.parcelNo || "—"}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        Газрын үнэ: {money((data.land.affectedAreaM2 ?? 0) * (data.land.basePriceM2 ?? 0))}
                      </span>
                    </div>
                  </Section>

                  {/* Хөрөнгийн тодорхойлолт */}
                  <Section icon={Boxes} title="Хөрөнгийн тодорхойлолт" tone="sky">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-[12px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
                            {["№", "Нэр", "Төрөл", "Нэгж", "Тоо/талбай", "Нийт үнэ", "Тодорхойлолт", ""].map(
                              (h, hi) => (
                                <th
                                  key={hi}
                                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                          {data.assets.map((a, idx) => (
                            <tr key={idx} className={a.kind == null ? "bg-red-50/40 dark:bg-red-500/5" : ""}>
                              <td className="px-3 py-2 text-slate-400">{a.seqNo ?? "—"}</td>
                              <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                                {a.name}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={a.kind ?? ""}
                                  onChange={(e) =>
                                    patchAsset(idx, { kind: (e.target.value || null) as AssetKind | null })
                                  }
                                  className={`h-8 rounded-md border px-2 text-[11px] outline-none focus:border-[#02c0ce] dark:bg-[#1e1f27] ${
                                    a.kind == null
                                      ? "border-red-300 text-red-600"
                                      : "border-slate-200 text-slate-700 dark:border-white/[0.08] dark:text-slate-200"
                                  }`}
                                >
                                  <option value="">— сонгох —</option>
                                  <option value="real_state">{KIND_LABEL.real_state}</option>
                                  <option value="property">{KIND_LABEL.property}</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-slate-500">{a.unit || "—"}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={a.quantity ?? ""}
                                  onChange={(e) =>
                                    patchAsset(idx, {
                                      quantity: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="h-8 w-24 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={a.totalPrice ?? ""}
                                  onChange={(e) =>
                                    patchAsset(idx, {
                                      totalPrice: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="h-8 w-32 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                                />
                              </td>
                              <td
                                className="max-w-[280px] truncate px-3 py-2 text-slate-400"
                                title={a.description}
                              >
                                {a.description || "—"}
                                {a.building && (
                                  <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
                                    барилгын өртөг
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAsset(idx)}
                                  disabled={phase === "submitting"}
                                  title="Энэ хөрөнгийг оруулахгүй"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {data.assets.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                                Хөрөнгө олдсонгүй
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  {/* Барилгын өртгийн хандлага — барилга бүр ХОЙШ БАГАНА (Excel шиг) */}
                  {(() => {
                    const blds = data.assets.filter((a) => a.building).map((a) => ({ name: a.name, b: a.building! }));
                    if (!blds.length) return null;
                    // Мөрийн жагсаалт = бүх барилгын items-ийн нэгдэл (эрэмбийг хадгална).
                    const rowDefs: { label: string; unit: string; group: string }[] = [];
                    const seen = new Set<string>();
                    for (const { b } of blds)
                      for (const it of b.items)
                        if (!seen.has(it.label)) {
                          seen.add(it.label);
                          rowDefs.push({ label: it.label, unit: it.unit, group: it.group });
                        }
                    // Бүлгийн (Итгэлцүүр г.м) rowspan
                    const gSpan = new Map<number, number>();
                    const gCovered = new Set<number>();
                    for (let i = 0; i < rowDefs.length; ) {
                      const g = rowDefs[i].group;
                      if (g) {
                        let j = i;
                        while (j + 1 < rowDefs.length && rowDefs[j + 1].group === g) j++;
                        gSpan.set(i, j - i + 1);
                        for (let k = i + 1; k <= j; k++) gCovered.add(k);
                        i = j + 1;
                      } else i++;
                    }
                    const valOf = (b: (typeof blds)[number]["b"], label: string) => {
                      const it = b.items.find((x) => x.label === label);
                      if (!it) return "—";
                      if (it.value != null) return nf.format(it.value);
                      return it.raw || "—"; // тоон биш (текст) утгыг түүхийгээр нь харуулна
                    };
                    return (
                      <Section icon={Building2} title="Барилгын өртгийн хандлага" tone="sky">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] text-[12px]">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
                                <th colSpan={2} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үзүүлэлт</th>
                                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Хэмжих нэгж</th>
                                {blds.map((x, i) => (
                                  <th key={i} className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">{x.name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                              {rowDefs.map((rd, ri) => {
                                const strong = /нөхөн орлуулах/i.test(rd.label);
                                return (
                                  <tr key={ri}>
                                    {rd.group ? (
                                      <>
                                        {gSpan.has(ri) && (
                                          <td rowSpan={gSpan.get(ri)} className="px-4 py-2.5 align-top font-medium text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-[#37394d]">
                                            {rd.group}
                                          </td>
                                        )}
                                        <td className={`px-4 py-2.5 text-slate-700 dark:text-slate-200 ${strong ? "font-semibold" : ""}`}>{rd.label}</td>
                                      </>
                                    ) : (
                                      <td colSpan={2} className={`px-4 py-2.5 text-slate-700 dark:text-slate-200 ${strong ? "font-semibold" : ""}`}>{rd.label}</td>
                                    )}
                                    <td className="px-4 py-2.5 text-slate-500">{rd.unit}</td>
                                    {blds.map((x, ci) => (
                                      <td key={ci} className={`px-4 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-100 ${strong ? "font-bold" : "font-medium"}`}>
                                        {valOf(x.b, rd.label)}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    );
                  })()}

                  {/* Түр суурьшуулах / чөлөөлөх зардал */}
                  {data.clearance.length > 0 && (
                    <Section icon={Truck} title="Газар чөлөөлөх / түр суурьшуулах зардал" tone="amber">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
                              {["Ангилал", "Нэр", "Нэгж", "Тоо", "Нэгж үнэ", "Нийт үнэ", ""].map((h, hi) => (
                                <th
                                  key={hi}
                                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                            {data.clearance.map((c, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-slate-400">{c.category}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{c.name}</td>
                                <td className="px-3 py-2 text-slate-500">{c.unit || "—"}</td>
                                <td className="px-3 py-2 tabular-nums text-slate-500">{num(c.quantity)}</td>
                                <td className="px-3 py-2 tabular-nums text-slate-500">{money(c.unitPrice)}</td>
                                <td className="px-3 py-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                                  {money(c.totalPrice)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeClearance(i)}
                                    disabled={phase === "submitting"}
                                    title="Энэ зардлыг оруулахгүй"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  )}

                  {/* Нэгтгэл — Excel шиг хүснэгт */}
                  <Section icon={ReceiptText} title="Нэгтгэл" tone="slate">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-[12px]">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
                            <th className="w-12 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Д/д</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үнэлэгдсэн хөрөнгийн төрөл</th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Мөнгөн дүн /₮/</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                          {[
                            { label: "Газар", value: landTotal },
                            { label: "Барилга", value: buildingTotal },
                            { label: "Бусад эд хөрөнгийн үнэлгээ", value: propertyTotal },
                            { label: "Түр суурьшуулах зардал", value: clearanceTotal },
                          ].map((r, i) => (
                            <tr key={r.label}>
                              <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">{money(r.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50/70 dark:border-[#37394d] dark:bg-[#1a1d20]">
                            <td />
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">Нөхөн олговрын нийт дүн</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-[#02c0ce]">{money(grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Section>
                </div>
              )}
            </div>

            {/* Хөл */}
            {(phase === "preview" || phase === "submitting") && data && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
                <div className="text-[11px] text-slate-400">
                  {phase === "submitting"
                    ? "Хадгалж байна…"
                    : errors.length > 0
                      ? `${errors.length} алдаа засах шаардлагатай`
                      : "Шалгаад системд оруулна уу"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={reset}
                    disabled={phase === "submitting"}
                    className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                  >
                    Өөр файл
                  </button>
                  <button
                    onClick={handleSubmitClick}
                    disabled={!canSubmit || phase === "submitting"}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                  >
                    {phase === "submitting" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Системд оруулах
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

// ── Туслах жижиг компонентууд ──

const TONES: Record<string, string> = {
  slate: "border-l-slate-200 dark:border-l-slate-500/40",
  emerald: "border-l-emerald-200 dark:border-l-emerald-500/40",
  sky: "border-l-sky-200 dark:border-l-sky-500/40",
  amber: "border-l-amber-200 dark:border-l-amber-500/40",
};

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof Building2;
  title: string;
  tone: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-l-4 border-slate-200 dark:border-white/[0.08] ${TONES[tone]}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-[#37394d] dark:bg-[#1a1d20]">
        <Icon className="h-4 w-4 text-slate-400" />
        <p className="text-[12px] font-semibold text-slate-700 dark:text-white">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="truncate text-slate-700 dark:text-slate-200" title={value}>
        {value}
      </p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-400">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={INP} />
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-400">{label}</p>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${INP} tabular-nums`}
      />
    </div>
  );
}
