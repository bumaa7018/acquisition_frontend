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
import { logger } from "@/lib/logger";
import { similarity } from "@/lib/valuation-import/fuzzy";
import {
  VSection,
  VNoteInput,
  VHeadRight,
  VKeyValueTable,
  VLandValuationTable,
  VAssetsTable,
  VBuildingSpecTable,
  VBuildingCostTable,
  VCostTable,
  VSummaryTable,
  V_COST_GROUPS,
  costGroupKey,
  sectionHeading,
  type VAssetRow,
  type VCostRow,
} from "./valuation_view";
import {
  parseValuationFile,
  validateParsed,
  fileSha256,
  VALUATION_SECTION_KEYS,
  VALUATION_SECTION_LABELS,
  type AssetKind,
  type ParsedAsset,
  type ParsedValuation,
  type ValuationSectionKey,
} from "@/lib/valuation-import";

// svc-ийн энэ модульд шаардлагатай дэд хэсэг (real_estate_tab-ийн svc үүнд нийцнэ).
// Бүх импорт нэг API дуудлагаар (backend транзакц) хийгдэнэ.
export interface ValuationImportSvc {
  importValuation: (a: string, body: ValuationImportPayload) => Promise<ValuationImportResult | undefined>;
  /** Эх Excel файлыг "Үнэлгээний хүснэгт" баримт болгон хадгалахад. */
  uploadDocument: (
    parcelId: string,
    file: File,
    docTypeId?: number,
    name?: string,
  ) => Promise<unknown>;
}

interface Props {
  acqId: string;
  parcelId: string;
  parcelCode: string;
  valuationType?: "asset" | "independent" | "mika";
  svc: ValuationImportSvc;
  specTypes: AssetSpecType[];
  calcTypes: AssetCalcType[];
  // Тухайн нэгж талбарт одоо байгаа хөрөнгө/үнэлгээ — дахин импортлоход эдгээрийг устгана
  existingAssets: Asset[];
  existingComps: Compensation[];
  /** "Үнэлгээний хүснэгт" баримтын төрлийн id — эх файлыг хадгалахад. */
  sourceDocTypeId?: number;
  onDone: () => void;
}

const nf = new Intl.NumberFormat("mn-MN");
function money(v: number | null | undefined) {
  return v == null ? "—" : `${nf.format(Math.round(v))}₮`;
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

/**
 * Барилгын тодорхойлолтын (Хүснэгт-4) үзүүлэлтийг DB-ийн spec төрлүүдтэй нэрээр
 * тааруулна. Таарахгүй үзүүлэлт (загварт шинээр нэмэгдсэн) хоосон үлдэнэ —
 * spec нь ТӨРӨЛД суурилсан тул нэрээр шинэ төрөл үүсгэх боломжгүй.
 */
function mapBuildingSpecs(
  spec: NonNullable<ParsedAsset["spec"]>,
  specTypes: AssetSpecType[],
): { spec_type_id: number; value: string }[] {
  return specTypes.map((t) => {
    let best: { value: string; score: number } | null = null;
    for (const item of spec.items) {
      const score = similarity(t.name, item.label);
      if (!best || score > best.score) best = { value: item.value, score };
    }
    return { spec_type_id: t.id, value: best && best.score >= 0.6 ? best.value : "" };
  });
}

export function ValuationExcelImport({
  acqId,
  parcelId,
  parcelCode,
  valuationType = "asset",
  svc,
  specTypes,
  calcTypes,
  existingAssets,
  existingComps,
  sourceDocTypeId,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [data, setData] = useState<ParsedValuation | null>(null);
  const [fileName, setFileName] = useState("");
  // Эх файлыг ХАДГАЛНА — импорт амжилттай болсны дараа "Үнэлгээний хүснэгт"
  // баримт болгон байршуулж, дараа нь татаж авах боломжтой болгоно.
  const [sourceFile, setSourceFile] = useState<File | null>(null);
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
    setSourceFile(null);
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
    setSourceFile(file);
    setPhase("parsing");
    try {
      const parsed = await parseValuationFile(file);
      const hash = await fileSha256(file); // алдаа шидэхгүй ("" буцаана)
      setData(parsed);
      setFileHash(hash);
      setPhase("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("excel parse failed", { fileName: file.name, error: msg });
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
  // Excel-ээс уншсан ТАЙЛБАР-ыг оруулахын өмнө засах боломжтой
  const patchNote = (key: ValuationSectionKey, note: string) => {
    setData((prev) => (prev ? { ...prev, notes: { ...prev.notes, [key]: note } } : prev));
  };
  const patchClearance = (idx: number, patch: Partial<ParsedValuation["clearance"][number]>) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            clearance: prev.clearance.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
          }
        : prev,
    );
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

  // Хүснэгтийн гарчиг/шошго — Excel-ээс ирсэн дугаар, эс бөгөөс загварын стандарт.
  const head = (key: ValuationSectionKey) => sectionHeading(key, data?.sections?.[key]);

  // Нэгтгэлийн тооцоолол (хүснэгтүүдэд хэрэглэгдэнэ)
  const landTotal = data?.land.totalValue ?? 0;
  const buildingTotal =
    data?.assets.filter((a) => a.kind === "real_state").reduce((s, a) => s + (a.totalPrice ?? 0), 0) ?? 0;
  const propertyTotal =
    data?.assets.filter((a) => a.kind === "property").reduce((s, a) => s + (a.totalPrice ?? 0), 0) ?? 0;
  const clearanceTotal = data?.clearance.reduce((s, c) => s + (c.totalPrice ?? 0), 0) ?? 0;
  const grandTotal = landTotal + buildingTotal + propertyTotal + clearanceTotal;

  // ── Дэлгэцийн хүснэгтэд буулгах өгөгдөл (нийтлэг хүснэгтийн бүтцэд) ──
  const assetRows: VAssetRow[] = (data?.assets ?? []).map((a, i) => ({
    id: String(i),
    seq: a.seqNo,
    name: a.name,
    kind: a.kind,
    unit: a.unit,
    qty: a.quantity,
    total: a.totalPrice,
    description: a.description,
    badge: a.building ? (
      <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
        барилгын өртөг
      </span>
    ) : undefined,
  }));
  const specColumns = (data?.assets ?? [])
    .filter((a) => a.spec)
    .map((a) => ({ name: a.name, items: a.spec!.items }));
  const buildingAssets = (data?.assets ?? [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !!a.building || a.kind === "real_state");
  const costColumns = (data?.assets ?? [])
    .filter((a) => a.building)
    .map((a) => ({ name: a.name, items: a.building!.items }));

  // 3.6 бусад эд хөрөнгө + 3.7–3.9 зардлын хүснэгтүүд (Excel-тэй ижил тусдаа хүснэгт)
  const propertyCostRows: VCostRow[] = (data?.assets ?? [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === "property")
    .map(({ a, i }) => ({
      id: `a${i}`,
      name: a.name,
      unit: a.unit,
      qty: a.quantity,
      unitPrice: a.unitPrice,
      total: a.totalPrice,
    }));
  const costSections: {
    key: ValuationSectionKey;
    title: string;
    rows: VCostRow[];
    total: number;
    remove?: (id: string) => void;
    patch?: (
      id: string,
      patch: { qty?: number | null; unitPrice?: number | null; total?: number | null },
    ) => void;
  }[] = [
    {
      key: "other_assets" as ValuationSectionKey,
      title: "Бусад эд хөрөнгө",
      rows: propertyCostRows,
      total: propertyTotal,
      remove: (id: string) => removeAsset(Number(id.slice(1))),
      patch: (id: string, patch: { qty?: number | null; unitPrice?: number | null; total?: number | null }) =>
        patchAsset(Number(id.slice(1)), {
          quantity: patch.qty,
          unitPrice: patch.unitPrice,
          totalPrice: patch.total,
        }),
    },
    ...V_COST_GROUPS.map((g) => {
      const picked = (data?.clearance ?? [])
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => (costGroupKey(c.category) ?? "clearance_cost") === g.key);
      return {
        key: g.key,
        title: g.title,
        rows: picked.map(({ c, i }) => ({
          id: `c${i}`,
          name: c.name,
          unit: c.unit,
          qty: c.quantity,
          unitPrice: c.unitPrice,
          total: c.totalPrice,
        })),
        total: picked.reduce((sum, { c }) => sum + (c.totalPrice ?? 0), 0),
        remove: (id: string) => removeClearance(Number(id.slice(1))),
        patch: (
          id: string,
          patch: { qty?: number | null; unitPrice?: number | null; total?: number | null },
        ) =>
          patchClearance(Number(id.slice(1)), {
            quantity: patch.qty,
            unitPrice: patch.unitPrice,
            totalPrice: patch.total,
          }),
      };
    }),
  ].filter((sec) => sec.rows.length > 0 || !!data?.notes?.[sec.key]);

  const errors = data?.warnings.filter((w) => w.level === "error") ?? [];
  const warnings = data?.warnings.filter((w) => w.level === "warning") ?? [];
  const canSubmit = !!data && errors.length === 0;

  // Нэгтгэлийн тооцоолол (preview дээр харуулна)

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
        floor_count: a.floorCount ?? 0,
        // Барилгын тодорхойлолтын хүснэгт (шинэ загвар) байвал утгыг нь онооно
        specs: isRealState
          ? a.spec
            ? mapBuildingSpecs(a.spec, specTypes)
            : specTypes.map((t) => ({ spec_type_id: t.id, value: "" }))
          : undefined,
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
      valuation_type: valuationType,
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
      // Хүснэгт бүрийн ТАЙЛБАР — хоосон биш утгуудыг л илгээнэ
      section_notes: Object.fromEntries(
        Object.entries(data.notes ?? {}).filter(([, v]) => (v ?? "").trim() !== ""),
      ),
      // Хүснэгтийн дугаар/нэр/дараалал — дэлгэц дээр Excel-ийнхээрээ харагдана.
      // Тайлбаргүй хүснэгтийг ч илгээнэ (дугаар/дараалал нь хадгалагдана).
      sections: VALUATION_SECTION_KEYS.flatMap((key) => {
        const meta = data.sections?.[key];
        const note = (data.notes?.[key] ?? "").trim();
        if (!meta && !note) return [];
        return [
          {
            key,
            note,
            section_no: meta?.no ?? "",
            table_label: meta?.label ?? "",
            title: meta?.title ?? VALUATION_SECTION_LABELS[key],
            sort_order: meta?.order ?? VALUATION_SECTION_KEYS.indexOf(key),
          },
        ];
      }),
    };

    try {
      // Бүх устгал + оруулалт НЭГ API дуудлагаар (backend транзакц)
      await svc.importValuation(acqId, payload);
      // Эх Excel-ийг баримт болгон хадгална. Амжилтгүй болбол импортыг
      // БУЦААХГҮЙ — үнэлгээ аль хэдийн орсон, зөвхөн эх файл дутуу үлдэнэ.
      if (sourceFile && sourceDocTypeId) {
        try {
          await svc.uploadDocument(
            parcelId,
            sourceFile,
            sourceDocTypeId,
            `Үнэлгээний хүснэгт: ${fileName}`,
          );
        } catch (err) {
          logger.warn("valuation source file upload failed", { error: String(err) });
          toast.warning("Үнэлгээ орсон ч эх Excel файлыг хадгалж чадсангүй");
        }
      }
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
                    <VSection icon={ReceiptText} title="Үнэлгээний байгууллага" tone="slate">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3 text-[12px] md:grid-cols-3">
                        <Field label="Нэр" value={data.org.name} />
                        <Field label="Захирал" value={data.org.director} />
                        <Field label="Регистр" value={data.org.regNo} />
                        <Field label="Улсын бүртгэл" value={data.org.stateRegNo} />
                        <Field label="Холбоо барих" value={data.org.contact} />
                        <Field label="Хаяг" value={data.org.address} />
                      </div>
                    </VSection>
                  )}

                  {/* 3.1 Үнэлж буй хөрөнгүүдийн танилцуулга */}
                  <VSection
                    icon={Boxes}
                    title={head("property_desc").title}
                    tone="sky"
                    right={
                      <VHeadRight
                        label={head("property_desc").label}
                        extra={<span className="text-slate-400">{data.assets.length} хөрөнгө</span>}
                      />
                    }
                  >
                    <VAssetsTable
                      rows={assetRows}
                      renderKind={(row, i) => (
                        <select
                          value={row.kind ?? ""}
                          onChange={(e) =>
                            patchAsset(i, { kind: (e.target.value || null) as AssetKind | null })
                          }
                          className={`h-8 rounded-md border px-2 text-[11px] outline-none focus:border-[#02c0ce] dark:bg-[#1e1f27] ${
                            row.kind == null
                              ? "border-red-300 text-red-600"
                              : "border-slate-200 text-slate-700 dark:border-white/[0.08] dark:text-slate-200"
                          }`}
                        >
                          <option value="">— сонгох —</option>
                          <option value="real_state">{KIND_LABEL.real_state}</option>
                          <option value="property">{KIND_LABEL.property}</option>
                        </select>
                      )}
                      renderQty={(row, i) => (
                        <input
                          type="number"
                          value={row.qty ?? ""}
                          onChange={(e) =>
                            patchAsset(i, {
                              quantity: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-8 w-24 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                        />
                      )}
                      renderActions={(row, i) => (
                        <button
                          type="button"
                          onClick={() => removeAsset(i)}
                          disabled={phase === "submitting"}
                          title="Энэ хөрөнгийг оруулахгүй"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      emptyText="Хөрөнгө олдсонгүй"
                    />
                    <VNoteInput
                      sectionKey="property_desc"
                      value={data.notes?.property_desc ?? ""}
                      onChange={(v) => patchNote("property_desc", v)}
                      disabled={phase === "submitting"}
                    />
                  </VSection>

                  {/* 3.2 Газрын эрх зүйн байдал */}
                  <VSection
                    icon={ReceiptText}
                    title={head("land_legal").title}
                    tone="emerald"
                    right={<VHeadRight label={head("land_legal").label} />}
                  >
                    <VKeyValueTable
                      rows={[
                        [
                          "Газар өмчлөгчийн овог нэр",
                          <input
                            key="owner"
                            value={data.land.ownerName}
                            onChange={(e) => patchLand({ ownerName: e.target.value })}
                            className={INP}
                          />,
                        ],
                        ["Газрын гэрчилгээний дугаар", data.land.certNo || "—"],
                        ["Нэгж талбарын дугаар", data.land.parcelNo || "—"],
                        ["Улсын бүртгэлийн дугаар", data.land.stateRegNo || "—"],
                        ["Газрын зориулалт", data.land.purpose || "—"],
                        ["Газрын байршил", data.land.location || "—"],
                      ]}
                    />
                    <VNoteInput
                      sectionKey="land_legal"
                      value={data.notes?.land_legal ?? ""}
                      onChange={(v) => patchNote("land_legal", v)}
                      disabled={phase === "submitting"}
                    />
                  </VSection>

                  {/* 3.3 Газрын үнэлгээ */}
                  <VSection
                    icon={ReceiptText}
                    title={head("land_valuation").title}
                    tone="emerald"
                    right={
                      <VHeadRight
                        label={head("land_valuation").label}
                        extra={
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {money(landTotal)}
                          </span>
                        }
                      />
                    }
                  >
                    <VLandValuationTable
                      areaCell={
                        <input
                          type="number"
                          value={data.land.affectedAreaM2 ?? ""}
                          onChange={(e) =>
                            patchLand({
                              affectedAreaM2: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className={`${INP} w-32 text-right tabular-nums`}
                        />
                      }
                      priceCell={
                        <input
                          type="number"
                          value={data.land.basePriceM2 ?? ""}
                          onChange={(e) =>
                            patchLand({
                              basePriceM2: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className={`${INP} w-32 text-right tabular-nums`}
                        />
                      }
                      total={landTotal}
                    />
                    <VNoteInput
                      sectionKey="land_valuation"
                      value={data.notes?.land_valuation ?? ""}
                      onChange={(v) => patchNote("land_valuation", v)}
                      disabled={phase === "submitting"}
                    />
                  </VSection>

                  {/* 3.4 Барилгын тодорхойлолт */}
                  {specColumns.length > 0 && (
                    <VSection
                      icon={Building2}
                      title={head("building_spec").title}
                      tone="sky"
                      right={<VHeadRight label={head("building_spec").label} />}
                    >
                      <VBuildingSpecTable columns={specColumns} />
                      <VNoteInput
                        sectionKey="building_spec"
                        value={data.notes?.building_spec ?? ""}
                        onChange={(v) => patchNote("building_spec", v)}
                        disabled={phase === "submitting"}
                      />
                    </VSection>
                  )}

                  {/* 3.5 Барилгын өртгийн хандлага */}
                  {costColumns.length > 0 && (
                    <VSection
                      icon={Building2}
                      title={head("building_cost").title}
                      tone="sky"
                      right={
                        <VHeadRight
                          label={head("building_cost").label}
                          extra={
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {money(buildingTotal)}
                            </span>
                          }
                        />
                      }
                    >
                      <VBuildingCostTable columns={costColumns} />
                      {/* Барилгын ОРУУЛАХ дүн — 3.1 хүснэгтэд үнэ давхардуулахгүйн тулд
                          барилгын үнэлгээг ЗӨВХӨН энд засна. */}
                      <div className="grid gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#37394d]">
                        {buildingAssets.map(({ a, i }) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="truncate text-[12px] text-slate-500">
                              {a.name} — системд орох үнэлгээ
                            </span>
                            <input
                              type="number"
                              value={a.totalPrice ?? ""}
                              onChange={(e) =>
                                patchAsset(i, {
                                  totalPrice: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0"
                              className="h-8 w-36 shrink-0 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                            />
                          </div>
                        ))}
                      </div>
                      <VNoteInput
                        sectionKey="building_cost"
                        value={data.notes?.building_cost ?? ""}
                        onChange={(v) => patchNote("building_cost", v)}
                        disabled={phase === "submitting"}
                      />
                    </VSection>
                  )}

                  {/* 3.6 Бусад эд хөрөнгө + 3.7–3.9 зардлын хүснэгтүүд */}
                  {costSections.map(({ key, title, rows, total, remove, patch }) => (
                    <VSection
                      key={key}
                      icon={key === "other_assets" ? Boxes : Truck}
                      title={head(key).title}
                      tone={key === "other_assets" ? "sky" : "amber"}
                      right={
                        <VHeadRight
                          label={head(key).label}
                          extra={
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {money(total)}
                            </span>
                          }
                        />
                      }
                    >
                      <VCostTable
                        rows={rows}
                        renderQty={
                          patch
                            ? (row) => (
                                <input
                                  type="number"
                                  value={row.qty ?? ""}
                                  onChange={(e) =>
                                    patch(row.id, {
                                      qty: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="h-8 w-20 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                                />
                              )
                            : undefined
                        }
                        renderUnitPrice={
                          patch
                            ? (row) => (
                                <input
                                  type="number"
                                  value={row.unitPrice ?? ""}
                                  onChange={(e) =>
                                    patch(row.id, {
                                      unitPrice: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  className="h-8 w-28 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                                />
                              )
                            : undefined
                        }
                        renderTotal={
                          patch
                            ? (row) => (
                                <input
                                  type="number"
                                  value={row.total ?? ""}
                                  onChange={(e) =>
                                    patch(row.id, {
                                      total: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="h-8 w-32 rounded-md border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27]"
                                />
                              )
                            : undefined
                        }
                        renderActions={
                          remove
                            ? (row) => (
                                <button
                                  type="button"
                                  onClick={() => remove(row.id)}
                                  disabled={phase === "submitting"}
                                  title="Энэ зардлыг оруулахгүй"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )
                            : undefined
                        }
                      />
                      <VNoteInput
                        sectionKey={key}
                        value={data.notes?.[key] ?? ""}
                        onChange={(v) => patchNote(key, v)}
                        disabled={phase === "submitting"}
                      />
                    </VSection>
                  ))}

                  {/* 4.1 Хураангуй нэгтгэл */}
                  <VSection
                    icon={ReceiptText}
                    title={head("summary").title}
                    tone="slate"
                    right={
                      <VHeadRight
                        label={head("summary").label}
                        extra={<span className="font-semibold text-[#02c0ce]">{money(grandTotal)}</span>}
                      />
                    }
                  >
                    <VSummaryTable
                      rows={[
                        { label: "Газрын үнэлгээ", value: landTotal },
                        { label: "Үл хөдлөх хөрөнгө", value: buildingTotal },
                        { label: "Эд хөрөнгө, зардал", value: propertyTotal + clearanceTotal },
                      ]}
                      total={grandTotal}
                    />
                    <VNoteInput
                      sectionKey="summary"
                      value={data.notes?.summary ?? ""}
                      onChange={(v) => patchNote("summary", v)}
                      disabled={phase === "submitting"}
                    />
                  </VSection>

                  {/* 4.2 / 5.1 — хүснэгтгүй, зөвхөн тайлбартай хэсгүүд */}
                  <VSection icon={FileSpreadsheet} title="Дүгнэлт, үнэлгээний баталгаа" tone="slate">
                    {(["conclusion", "certification"] as ValuationSectionKey[]).map((k) => (
                      <VNoteInput
                        key={k}
                        sectionKey={k}
                        withLabel
                        value={data.notes?.[k] ?? ""}
                        onChange={(v) => patchNote(k, v)}
                        disabled={phase === "submitting"}
                      />
                    ))}
                  </VSection>
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
