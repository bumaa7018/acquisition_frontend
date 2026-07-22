"use client";
import { Fragment, useState, useEffect, useRef } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi, assetSpecTypeApi, assetCalcTypeApi, documentTypeApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";
import { type Asset, type AssetCalculation, type Compensation, type CompensationHistory, type LandValuation, type LandValuationUpsert, type ValuationImportPayload, type ParcelFull, type User, type ValuationSubmission, type ValuationStatus, type ValuationType, VALUATION_STATUS_LABELS, VALUATION_TYPE_LABELS } from "@/types";
import { formatArea, formatDate, getApiError } from "@/lib/utils";
import {
  X,
  Plus,
  Trash2,
  Building2,
  ReceiptText,
  ChevronDown,
  ChevronRight,
  Calculator,
  CircleDollarSign,
  Camera,
  ImagePlus,
  CheckCircle,
  XCircle,
  History,
  Clock,
  CheckCheck,
  Pencil,
  Paperclip,
  FileText,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { COMP_TYPE_LABELS, ASSET_TYPE_LABELS, INP } from "./constants";
import { ValuationExcelImport } from "./valuation_excel_import";
import { AssetPhotoUpload } from "./asset_photo_upload";
import { ValuationSubmissionBar, ValuationTransitionModal, ValuationHistoryModal } from "./valuation_submission";
import type { AssetSpecType, AssetCalcType } from "@/types";
import {
  canEditValuationSubTab,
  canViewValuationSubTab,
  isExternalSpecialRole,
  isFinanceSpecialist,
  isProfessionalOrg,
} from "@/lib/role-utils";
import { EVALUATION_STATUS_NAME, type ValuationSubTabKey } from "@/lib/access-policy";
import {
  assetValuationRows,
  parcelValuations,
  sumCompensations,
  valuationTotals,
} from "@/lib/valuation-summary";
import type { LucideIcon } from "lucide-react";

const EMPTY_ASSET = {
  asset_number: "",
  asset_type: "real_state" as Asset["asset_type"],
  asset_name: "",
  floor_count: "",
  area_m2: "",
  owner_name: "",
  address: "",
  notes: "",
  unit: "",
  capacity: "",
  description: "",
};

type SpecValues = Record<number, string>;
type CalcValues = Record<number, { unit: string; value: string }>;

function emptySpecValues(types: AssetSpecType[]): SpecValues {
  return Object.fromEntries(types.map((t) => [t.id, ""]));
}
function emptyCalcValues(types: AssetCalcType[]): CalcValues {
  return Object.fromEntries(types.map((t) => [t.id, { unit: t.default_unit, value: "" }]));
}

const EMPTY_VALUATION = {
  compensation_type: "cash" as Compensation["compensation_type"],
  coverage_percent: "100",
  amount: "",
  compensation_date: "",
  note: "",
};

type ValuationForm = typeof EMPTY_VALUATION;

type SectionTone = {
  card: string;
  header: string;
  tableHead: string;
  footer: string;
  icon: string;
};

const LAND_TONE: SectionTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-emerald-200 dark:border-l-emerald-500/40",
  header: "bg-emerald-50/70 dark:bg-emerald-500/10",
  tableHead: "bg-emerald-50/55 dark:bg-emerald-500/10",
  footer: "bg-emerald-50/70 dark:bg-emerald-500/10",
  icon: "text-emerald-500",
};

const REAL_ESTATE_TONE: SectionTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-sky-200 dark:border-l-sky-500/40",
  header: "bg-sky-50/70 dark:bg-sky-500/10",
  tableHead: "bg-sky-50/55 dark:bg-sky-500/10",
  footer: "bg-sky-50/70 dark:bg-sky-500/10",
  icon: "text-sky-500",
};

const PROPERTY_TONE: SectionTone = {
  card: "ap-card overflow-hidden border-l-4 border-l-amber-200 dark:border-l-amber-500/40",
  header: "bg-amber-50/70 dark:bg-amber-500/10",
  tableHead: "bg-amber-50/55 dark:bg-amber-500/10",
  footer: "bg-amber-50/70 dark:bg-amber-500/10",
  icon: "text-amber-500",
};

function money(value: number) {
  return `${Math.round(Number(value) || 0).toLocaleString()}₮`;
}

function detailLabel(comp: Compensation) {
  return comp.note?.trim() || COMP_TYPE_LABELS[comp.compensation_type] || comp.compensation_type;
}

function orgUserName(user?: User) {
  if (!user) return "";
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
}

// Барилгын өртгийн хандлага — үл хөдлөх хөрөнгө бүрийг ХОЙШ БАГАНА болгож (Excel шиг)
// нэг хүснэгтэд харуулна. asset_calculation-г хөрөнгө бүрээр татаж, calc төрлөөр эгнээ болгоно.
function BuildingCostSection({
  acqId,
  assets,
  listCalcs,
}: {
  acqId: string;
  assets: Asset[];
  listCalcs: (a: string, id: string) => Promise<AssetCalculation[]>;
}) {
  const results = useQueries({
    queries: assets.map((a) => ({
      queryKey: ["asset-calcs", acqId, a.id],
      queryFn: () => listCalcs(acqId, a.id),
    })),
  });
  const cols = assets
    .map((asset, i) => ({ asset, calcs: (results[i]?.data ?? []).filter((c) => Number(c.value) !== 0) }))
    .filter((x) => x.calcs.length > 0);
  if (!cols.length) return null;

  // Эгнээний тодорхойлолт: calc төрлүүдийн нэгдэл (эхнийхээс эрэмбэ хадгална)
  const rowDefs: { name: string; unit: string; group: string }[] = [];
  const seen = new Set<string>();
  for (const { calcs } of cols)
    for (const c of calcs)
      if (!seen.has(c.calc_name)) {
        seen.add(c.calc_name);
        rowDefs.push({ name: c.calc_name, unit: c.unit, group: c.calc_group ?? "" });
      }
  const valOf = (calcs: AssetCalculation[], name: string) => {
    const c = calcs.find((x) => x.calc_name === name);
    return c ? Number(c.value).toLocaleString() : "—";
  };
  // Бүлэг (Итгэлцүүр г.м)-ийн rowspan-г тооцоолно
  const groupSpan = new Map<number, number>();
  const groupCovered = new Set<number>();
  for (let i = 0; i < rowDefs.length; ) {
    const g = rowDefs[i].group;
    if (g) {
      let j = i;
      while (j + 1 < rowDefs.length && rowDefs[j + 1].group === g) j++;
      groupSpan.set(i, j - i + 1);
      for (let k = i + 1; k <= j; k++) groupCovered.add(k);
      i = j + 1;
    } else i++;
  }

  return (
    <div className={REAL_ESTATE_TONE.card}>
      <div className={`flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${REAL_ESTATE_TONE.header}`}>
        <Calculator className={`h-4 w-4 ${REAL_ESTATE_TONE.icon}`} />
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Барилгын өртгийн хандлага</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead>
            <tr className={`border-b border-slate-100 dark:border-[#37394d] ${REAL_ESTATE_TONE.tableHead}`}>
              <th colSpan={2} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үзүүлэлт</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Хэмжих нэгж</th>
              {cols.map(({ asset }) => (
                <th key={asset.id} className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {asset.asset_name || "Барилга"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Барилгын талбай</td>
              <td className="px-4 py-2.5 text-slate-500">м²</td>
              {cols.map(({ asset }) => (
                <td key={asset.id} className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                  {formatArea(asset.area_m2)}
                </td>
              ))}
            </tr>
            {rowDefs.map((rd, idx) => (
              <tr key={rd.name}>
                {rd.group ? (
                  <>
                    {groupSpan.has(idx) && (
                      <td rowSpan={groupSpan.get(idx)} className="px-4 py-2.5 align-top font-medium text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-[#37394d]">
                        {rd.group}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{rd.name}</td>
                  </>
                ) : (
                  <td colSpan={2} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{rd.name}</td>
                )}
                <td className="px-4 py-2.5 text-slate-500">{rd.unit}</td>
                {cols.map(({ asset, calcs }) => (
                  <td key={asset.id} className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {valOf(calcs, rd.name)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Нэгтгэл — үнэлгээний нэгдсэн задаргааг Excel-ийн "нэгтгэл" хүснэгт шиг харуулна.
function ConsolidationCard({
  rows,
  total,
}: {
  rows: { label: string; value: number }[];
  total: number;
}) {
  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-[#37394d]">
        <CircleDollarSign className="h-4 w-4 text-[#02c0ce]" />
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Нэгтгэл</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]">
              <th className="w-12 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Д/д</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үнэлэгдсэн хөрөнгийн төрөл</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Мөнгөн дүн /₮/</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
            {rows.map((r, i) => (
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
              <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function RealEstateTab({
  acqId,
  parcelId,
  parcelCode,
  isLocked = false,
}: {
  acqId: string;
  parcelId: string;
  parcelCode: string;
  isLocked?: boolean;
}) {
  const queryClient = useQueryClient();
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();

  // Мэргэжлийн байгууллага бол бүх дуудлагыг /prof (profApi) руу чиглүүлнэ.
  // Бусад (дотоод) хэрэглэгчид landApi/parcelApi-г ашиглана.
  const svc = isProfOrg
    ? {
        getParcel: (a: string, p: string) => profApi.profGetParcel(a, p),
        getById: (a: string) => profApi.profGetAcquisition(a),
        listParcels: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string }) =>
          profApi.profListParcels(a, params),
        getAssets: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string; valuation_type?: string }) =>
          profApi.profListAssets(a, params),
        listCompensations: (a: string, p?: string, vt?: string) => profApi.profListCompensations(a, p, vt),
        getLandValuation: (a: string, p: string, vt?: string) => profApi.profGetLandValuation(a, p, vt),
        upsertLandValuation: (a: string, body: LandValuationUpsert) =>
          profApi.profUpsertLandValuation(a, body),
        importValuation: (a: string, body: ValuationImportPayload) => profApi.profImportValuation(a, body),
        deleteLandValuation: (a: string, p: string, vt?: string) => profApi.profDeleteLandValuation(a, p, vt),
        uploadAssetPhoto: (a: string, id: string, file: File) => profApi.profUploadAssetPhoto(a, id, file),
        createAsset: (a: string, body: Partial<Asset>) => profApi.profCreateAsset(a, body),
        upsertAssetSpecs: (a: string, id: string, specs: { spec_type_id: number; value: string }[]) =>
          profApi.profUpsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (a: string, id: string, calcs: { calc_type_id: number; unit: string; value: number }[]) =>
          profApi.profUpsertAssetCalculations(a, id, calcs),
        listAssetCalculations: (a: string, id: string) => profApi.profListAssetCalculations(a, id),
        listAssetSpecs: (a: string, id: string) => profApi.profListAssetSpecs(a, id),
        createCompensation: (a: string, body: Partial<Compensation>) => profApi.profCreateCompensation(a, body),
        deleteAsset: (a: string, id: string) => profApi.profDeleteAsset(a, id),
        deleteCompensation: (a: string, id: string) => profApi.profDeleteCompensation(a, id),
        listCompensationHistory: (a: string, id: string) => profApi.profListCompensationHistory(a, id),
        listDocuments: (p: string) => profApi.profListParcelDocuments(p),
        deleteDocument: (p: string, docId: string) => profApi.profDeleteParcelDocument(p, docId),
        getValuationSubmission: (a: string, p: string, vt?: string) => profApi.profGetValuationSubmission(a, p, vt),
        transitionValuationSubmission: (a: string, p: string, action: "submit" | "approve" | "return", note: string, vt?: string) =>
          profApi.profTransitionValuationSubmission(a, p, action, note, vt),
        listValuationSubmissionHistory: (a: string, p: string, vt?: string) => profApi.profListValuationSubmissionHistory(a, p, vt),
        setParcelIndependentOrg: (a: string, p: string, u: string | null) =>
          profApi.profSetParcelIndependentOrg(a, p, u),
        uploadDocument: (p: string, file: File, docTypeId?: number, name?: string) =>
          profApi.profUploadParcelDocument(p, file, docTypeId, name),
      }
    : {
        getParcel: (a: string, p: string) => landApi.getParcel(a, p),
        getById: (a: string) => landApi.getById(a),
        listParcels: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string }) =>
          landApi.getParcels(a, params),
        getAssets: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string; valuation_type?: string }) =>
          landApi.getAssets(a, params),
        listCompensations: (a: string, p?: string, vt?: string) => landApi.listCompensations(a, p, vt),
        getLandValuation: (a: string, p: string, vt?: string) => landApi.getLandValuation(a, p, vt),
        upsertLandValuation: (a: string, body: LandValuationUpsert) =>
          landApi.upsertLandValuation(a, body),
        importValuation: (a: string, body: ValuationImportPayload) => landApi.importValuation(a, body),
        deleteLandValuation: (a: string, p: string, vt?: string) => landApi.deleteLandValuation(a, p, vt),
        uploadAssetPhoto: (a: string, id: string, file: File) => landApi.uploadAssetPhoto(a, id, file),
        createAsset: (a: string, body: Partial<Asset>) => landApi.createAsset(a, body),
        upsertAssetSpecs: (a: string, id: string, specs: { spec_type_id: number; value: string }[]) =>
          landApi.upsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (a: string, id: string, calcs: { calc_type_id: number; unit: string; value: number }[]) =>
          landApi.upsertAssetCalculations(a, id, calcs),
        listAssetCalculations: (a: string, id: string) => landApi.listAssetCalculations(a, id),
        listAssetSpecs: (a: string, id: string) => landApi.listAssetSpecs(a, id),
        createCompensation: (a: string, body: Partial<Compensation>) => landApi.createCompensation(a, body),
        deleteAsset: (a: string, id: string) => landApi.deleteAsset(a, id).then(() => undefined),
        deleteCompensation: (a: string, id: string) => landApi.deleteCompensation(a, id).then(() => undefined),
        listCompensationHistory: (a: string, id: string) => landApi.listCompensationHistory(a, id),
        listDocuments: (p: string) => parcelApi.listDocuments(p),
        deleteDocument: (p: string, docId: string) => parcelApi.deleteDocument(p, docId),
        getValuationSubmission: (a: string, p: string, vt?: string) => landApi.getValuationSubmission(a, p, vt),
        transitionValuationSubmission: (a: string, p: string, action: "submit" | "approve" | "return", note: string, vt?: string) =>
          landApi.transitionValuationSubmission(a, p, action, note, vt),
        listValuationSubmissionHistory: (a: string, p: string, vt?: string) => landApi.listValuationSubmissionHistory(a, p, vt),
        setParcelIndependentOrg: (a: string, p: string, u: string | null) =>
          landApi.setParcelIndependentOrg(a, p, u),
        uploadDocument: (p: string, file: File, docTypeId?: number, name?: string) =>
          parcelApi.uploadDocument(p, file, docTypeId, name),
      };
  // null = хэрэглэгч гараар сонгоогүй — баталгаажсан урсгал (байвал) автоматаар нээгдэнэ
  const [subTab, setSubTab] = useState<ValuationSubTabKey | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ASSET);
  const [specValues, setSpecValues] = useState<SpecValues>({});
  const [calcValues, setCalcValues] = useState<CalcValues>({});
  const [valuationForm, setValuationForm] = useState(EMPTY_VALUATION);
  const [modalValuations, setModalValuations] = useState<ValuationForm[]>([
    { ...EMPTY_VALUATION },
  ]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const isFinance = isFinanceSpecialist();
  const [approveModal, setApproveModal] = useState<{ compId: string; note: string } | null>(null);
  const [landValuationForm, setLandValuationForm] = useState({ land_area_m2: "", base_price_per_m2: "" });
  const [landValuationEdited, setLandValuationEdited] = useState(false);
  const [landEditing, setLandEditing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ compId: string; note: string } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ compId: string; list: CompensationHistory[] } | null>(null);
  const [independentSelect, setIndependentSelect] = useState("");
  const [assignedIndependentOrg, setAssignedIndependentOrg] = useState<{ id: string; name?: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [subModal, setSubModal] = useState<{ action: "submit" | "approve" | "return"; note: string } | null>(null);
  const [subHistoryOpen, setSubHistoryOpen] = useState(false);
  const reportFileRef = useRef<HTMLInputElement | null>(null);

  const { data: specTypes = [] } = useQuery({
    queryKey: ["asset-spec-types"],
    queryFn: () => assetSpecTypeApi.list(),
    staleTime: 60_000,
  });

  const { data: calcTypes = [] } = useQuery({
    queryKey: ["asset-calc-types"],
    queryFn: () => assetCalcTypeApi.list(),
    staleTime: 60_000,
  });

  const { data: parcelData } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => svc.getParcel(acqId, parcelId),
    enabled: !!acqId && !!parcelId,
  });

  const effectiveParcelCode = parcelData?.parcel_id ?? parcelCode;

  const { data: acquisition } = useQuery({
    queryKey: ["land", acqId],
    queryFn: () => svc.getById(acqId),
    enabled: !!acqId,
  });

  // Дэд таб = үнэлгээний урсгал. Идэвхтэй урсгалыг өгөгдөл татахаас өмнө тодорхойлно.
  const subTabs: { key: ValuationSubTabKey; label: string; description: string }[] = [
    { key: "asset", label: "Үндсэн үнэлгээ", description: "Үндсэн мэргэжлийн байгууллагын үнэлгээ" },
    { key: "independent", label: "Хөндлөнгийн үнэлгээ", description: "Нэгж талбарт холбосон байгууллагын үнэлгээ" },
    { key: "mika", label: "МИКА", description: "МИКА-гийн үнэлгээ, хяналт" },
  ];
  const visibleSubTabs = isExternal
    ? subTabs.filter((item) => canViewValuationSubTab(item.key, parcelData, acquisition))
    : subTabs;
  // Тухайн нэгж талбарын үндсэн (санхүү баталгаажуулсан) урсгал
  const selectedType = parcelData?.selected_valuation_type ?? null;
  // Баталгаажсан урсгалын дэд табыг хамгийн эхэнд харуулна
  const orderedSubTabs = selectedType
    ? [
        ...visibleSubTabs.filter((item) => item.key === selectedType),
        ...visibleSubTabs.filter((item) => item.key !== selectedType),
      ]
    : visibleSubTabs;
  // Гараар сонгоогүй бол эхний (баталгаажсан) таб идэвхтэй байна
  const activeSubTab =
    subTab && orderedSubTabs.some((item) => item.key === subTab)
      ? subTab
      : orderedSubTabs[0]?.key ?? "asset";
  const activeType: ValuationType = activeSubTab as ValuationType;

  const { data: professionalOrgUsers = [] } = useQuery({
    queryKey: ["professional-org-users"],
    queryFn: () => landApi.listProfessionalOrgUsers(),
    enabled: !isExternal,
    staleTime: 60_000,
  });

  const { data: parcelListFallback } = useQuery({
    queryKey: ["land-parcels-independent-org", acqId, effectiveParcelCode],
    queryFn: () => svc.listParcels(acqId, { page: 1, page_size: 20, parcel_id: effectiveParcelCode }),
    enabled: !!acqId && !!effectiveParcelCode && !parcelData?.independent_org_id,
    staleTime: 30_000,
  });

  const fallbackParcel = parcelListFallback?.data?.find(
    (item) => item.id === parcelId || item.parcel_id === effectiveParcelCode,
  );

  // Сонгогчийг backend-ээс ирсэн холболтоор эхлүүлнэ. Detail response дээр
  // independent_org_id байхгүй ирвэл жагсаалтын endpoint-оос авсан тухайн parcel-ээр сэргээнэ.
  useEffect(() => {
    const orgId = parcelData?.independent_org_id || fallbackParcel?.independent_org_id;
    if (!orgId) return;

    const user = professionalOrgUsers.find((x) => x.id === orgId);
    const name = parcelData?.independent_org_name || fallbackParcel?.independent_org_name || orgUserName(user);
    setAssignedIndependentOrg({ id: orgId, name });
    setIndependentSelect(orgId);
  }, [
    fallbackParcel?.independent_org_id,
    fallbackParcel?.independent_org_name,
    parcelData?.independent_org_id,
    parcelData?.independent_org_name,
    professionalOrgUsers,
  ]);

  // Бүх өгөгдөл идэвхтэй урсгалаар (activeType) тусад нь татагдана — урсгалууд холилдохгүй.
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType],
    queryFn: () => svc.getAssets(acqId, { page: 1, page_size: 1000, parcel_id: effectiveParcelCode, valuation_type: activeType }),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
    queryFn: () => svc.listCompensations(acqId, effectiveParcelCode, activeType),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: landValuation } = useQuery<LandValuation | null>({
    queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType],
    queryFn: () => svc.getLandValuation(acqId, effectiveParcelCode, activeType),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  // Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв — урсгал бүрт тусдаа
  const { data: submission } = useQuery<ValuationSubmission | null>({
    queryKey: ["valuation-submission", acqId, parcelId, activeType],
    queryFn: () => svc.getValuationSubmission(acqId, parcelId, activeType).then((s) => s ?? null),
    enabled: !!acqId && !!parcelId,
  });
  const valStatus: ValuationStatus = submission?.status ?? "draft";
  const valStatusEditable = valStatus === "draft" || valStatus === "returned";

  const transitionMutation = useMutation({
    mutationFn: ({ action, note }: { action: "submit" | "approve" | "return"; note: string }) =>
      svc.transitionValuationSubmission(acqId, parcelId, action, note, activeType),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "submit"
          ? "Нөхөх олговор илгээгдлээ"
          : vars.action === "approve"
            ? "Нөхөх олговор баталгаажлаа"
            : "Нөхөх олговор буцаагдлаа",
      );
      setSubModal(null);
      // Зөвшөөрөхөд бусад урсгалууд "Хүчингүй" болдог тул БҮХ урсгалын төлөвийг дахин татна
      queryClient.invalidateQueries({ queryKey: ["valuation-submission", acqId, parcelId] });
      // Зөвшөөрөхөд үндсэн урсгал (selected_valuation_type) өөрчлөгдөнө → parcel дахин татна
      queryClient.invalidateQueries({ queryKey: ["parcel-full", acqId, parcelId] });
    },
    onError: (err) => toast.error(getApiError(err, "Төлөв шилжүүлэхэд алдаа гарлаа")),
  });

  // Үнэлгээний тайлан — нэгж талбарт ГАНЦ тайлан. Ердийн хавсралтын (parcel
  // documents) флоугоор "Хөрөнгийн үнэлгээний тайлан" төрөлтэй хадгалагдана,
  // Баримт бичиг табд бусад хавсралтын адил харагдана.
  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
    staleTime: Infinity,
    enabled: !!selectedType,
  });
  const reportDocType = docTypes.find((t) => t.type === "valuation_report");
  const { data: parcelDocs = [] } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => svc.listDocuments(parcelId),
    enabled: !!parcelId && !!selectedType,
  });
  const reportDoc = parcelDocs.find((d) => !!reportDocType && d.document_type_id === reportDocType.id);
  const reportMutation = useMutation({
    // Солих үед шинэ файлыг эхэлж амжилттай оруулсны ДАРАА хуучныг устгана —
    // алдаа гарвал хуучин тайлан хэвээр үлдэнэ.
    mutationFn: async ({ file, replaceDocId }: { file: File; replaceDocId?: string }) => {
      // Дэлгэцийн нэр нь хавсралтын төрлийн нэр; физик нэрийг backend
      // <нэгж талбарын дугаар>_<төрлийн код>.<өргөтгөл> хэлбэрээр өгнө.
      await svc.uploadDocument(parcelId, file, reportDocType?.id, reportDocType?.name);
      if (replaceDocId) await svc.deleteDocument(parcelId, replaceDocId);
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.replaceDocId ? "Үнэлгээний тайлан солигдлоо" : "Үнэлгээний тайлан хавсаргагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
    },
    onError: (err) => toast.error(getApiError(err, "Тайлан хавсаргахад алдаа гарлаа")),
  });

  const upsertLandValuationMutation = useMutation({
    mutationFn: () =>
      svc.upsertLandValuation(acqId, {
        parcel_id: effectiveParcelCode,
        valuation_type: activeType,
        land_area_m2: Number(landValuationForm.land_area_m2) || 0,
        base_price_per_m2: Number(landValuationForm.base_price_per_m2) || 0,
      }),
    onSuccess: () => {
      toast.success("Газрын үнэлгээ хадгалагдлаа");
      setLandEditing(false);
      setLandValuationEdited(false);
      queryClient.invalidateQueries({ queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Газрын үнэлгээ хадгалахад алдаа гарлаа")),
  });

  const deleteLandValuationMutation = useMutation({
    mutationFn: () => svc.deleteLandValuation(acqId, effectiveParcelCode, activeType),
    onSuccess: () => {
      toast.success("Газрын үнэлгээ устгагдлаа");
      setLandEditing(false);
      setLandValuationEdited(false);
      setLandValuationForm({ land_area_m2: "", base_price_per_m2: "" });
      queryClient.invalidateQueries({ queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Газрын үнэлгээ устгахад алдаа гарлаа")),
  });

  useEffect(() => {
    if (landValuation && !landValuationEdited) {
      setLandValuationForm({
        land_area_m2: landValuation.land_area_m2 ? String(landValuation.land_area_m2) : "",
        base_price_per_m2: landValuation.base_price_per_m2 ? String(landValuation.base_price_per_m2) : "",
      });
    }
  }, [landValuation, landValuationEdited]);

  const closeAssetModal = () => {
    setShowForm(false);
    setForm(EMPTY_ASSET);
    setSpecValues(emptySpecValues(specTypes));
    setCalcValues(emptyCalcValues(calcTypes));
    setModalValuations([{ ...EMPTY_VALUATION }]);
    setPhotos([]);
    setPhotoError(false);
  };

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      const created = await svc.createAsset(acqId, {
        parcel_id: effectiveParcelCode,
        valuation_type: activeType,
        asset_number: form.asset_number,
        asset_type: form.asset_type,
        asset_name: form.asset_name,
        floor_count: Number(form.floor_count) || 0,
        area_m2: Number(form.area_m2) || 0,
        owner_name: form.owner_name,
        address: form.address,
        notes: form.notes,
        unit: form.unit,
        capacity: form.capacity,
        description: form.description,
      });
      if (!created) throw new Error("Хөрөнгө үүсгэхэд алдаа гарлаа");

      if (form.asset_type === "real_state") {
        await svc.upsertAssetSpecs(acqId, created.id,
          specTypes.map((t) => ({ spec_type_id: t.id, value: specValues[t.id] ?? "" })),
        );
        await svc.upsertAssetCalculations(acqId, created.id,
          calcTypes.map((t) => ({
            calc_type_id: t.id,
            unit: calcValues[t.id]?.unit ?? t.default_unit,
            value: Number(calcValues[t.id]?.value) || 0,
          })),
        );
      }

      const valuationRows = modalValuations.filter((row) => Number(row.amount) > 0);
      await Promise.all(
        valuationRows.map((row) =>
          svc.createCompensation(acqId, {
            target_type: "asset",
            valuation_type: activeType,
            parcel_id: effectiveParcelCode,
            asset_id: created.id,
            compensation_type: row.compensation_type,
            coverage_percent: Number(row.coverage_percent) || 100,
            amount: Number(row.amount) || 0,
            compensation_date: row.compensation_date || undefined,
            note: row.note,
          }),
        ),
      );

      await Promise.all(
        photos.map((file) =>
          svc.uploadDocument(parcelId, file, undefined, `Хөрөнгийн зураг: ${form.asset_name || form.asset_number || "—"}`),
        ),
      );

      return created;
    },
    onSuccess: () => {
      toast.success("Хөрөнгө нэмэгдлээ");
      closeAssetModal();
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Хөрөнгө нэмэхэд алдаа гарлаа")),
  });

  const createCompensationMutation = useMutation({
    mutationFn: (assetId: string) =>
      svc.createCompensation(acqId, {
        target_type: "asset",
        valuation_type: activeType,
        parcel_id: effectiveParcelCode,
        asset_id: assetId,
        compensation_type: valuationForm.compensation_type,
        coverage_percent: Number(valuationForm.coverage_percent) || 100,
        amount: Number(valuationForm.amount) || 0,
        compensation_date: valuationForm.compensation_date || undefined,
        note: valuationForm.note,
      }),
    onSuccess: () => {
      toast.success("Үнэлгээний задаргаа нэмэгдлээ");
      setValuationForm(EMPTY_VALUATION);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Үнэлгээ нэмэхэд алдаа гарлаа")),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => svc.deleteAsset(acqId, assetId),
    onSuccess: () => {
      toast.success("Хөрөнгө устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const deleteCompensationMutation = useMutation({
    mutationFn: (compId: string) => svc.deleteCompensation(acqId, compId),
    onSuccess: () => {
      toast.success("Үнэлгээ устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Үнэлгээ устгахад алдаа гарлаа")),
  });

  const approveCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.approveCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ зөвшөөрөгдлөө");
      setApproveModal(null);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Зөвшөөрөхөд алдаа гарлаа")),
  });

  const rejectCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.rejectCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ татгалзагдлаа");
      setRejectModal(null);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
    },
    onError: (err) => toast.error(getApiError(err, "Татгалзахад алдаа гарлаа")),
  });

  const openHistory = async (compId: string) => {
    try {
      const list = await svc.listCompensationHistory(acqId, compId);
      setHistoryModal({ compId, list });
    } catch {
      toast.error("Түүх ачаалахад алдаа гарлаа");
    }
  };

  const independentOrgMutation = useMutation({
    mutationFn: (orgUserId: string | null) =>
      svc.setParcelIndependentOrg(acqId, parcelId, orgUserId),
    onSuccess: (_data, orgUserId) => {
      const u = orgUserId ? professionalOrgUsers.find((x) => x.id === orgUserId) : undefined;
      const orgName = orgUserName(u) || undefined;
      setAssignedIndependentOrg(orgUserId ? { id: orgUserId, name: orgName } : null);
      setIndependentSelect(orgUserId ?? "");
      // Холбогдсон төлөвийг шууд тусгана — getParcel эдгээр талбарыг буцаахгүй байсан ч
      // холболт харагдахгүй байхаас сэргийлж optimistic-оор кэшийг шинэчилнэ.
      queryClient.setQueryData<ParcelFull>(["parcel-full", acqId, parcelId], (old) =>
        old
          ? { ...old, independent_org_id: orgUserId ?? undefined, independent_org_name: orgName }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: ["land-parcels", acqId] });
      toast.success(
        orgUserId
          ? "Хөндлөнгийн байгууллага холбогдлоо"
          : "Хөндлөнгийн байгууллагын холболт салгагдлаа",
      );
    },
    onError: (err) => toast.error(getApiError(err, "Байгууллага холбох үед алдаа гарлаа")),
  });

  const parcelAssets = assets?.data ?? [];
  // Газрын үнэлгээнээс авто-үүсгэсэн олговрыг "Газрын олговр" картад давхар харуулахгүй
  // (газрын дүн нь дээрх "Газрын үнэлгээ" картад аль хэдийн харагдаж байгаа).
  const landComps = parcelValuations(allComps, effectiveParcelCode).filter(
    (c) => c.note !== "Газрын үнэлгээ",
  );
  const realStateRows = assetValuationRows(parcelAssets, allComps, "real_state");
  const propertyRows = assetValuationRows(parcelAssets, allComps, "property");
  const totals = valuationTotals(parcelAssets, allComps, effectiveParcelCode);

  const lvArea = Number(landValuationForm.land_area_m2) || 0;
  const lvPrice = Number(landValuationForm.base_price_per_m2) || 0;
  const lvTotal = lvArea * lvPrice;
  // Газрын нийт үнэ нь land_valuation (талбай×суурь үнэ)-ээс гарна — parcel-түвшний
  // нөхөн олговор (totals.landTotal) ашиглахгүй (импорт нь land-valuation-д хадгалдаг).
  const landTotalValue = lvTotal || landValuation?.total_value || totals.landTotal;
  const grandTotalValue = landTotalValue + totals.assetTotal;

  // Идэвхтэй урсгалын өөрийн илгээх төлөв Илгээсэн/Баталгаажсан бол засах боломжгүй.
  // Аль нэг урсгал баталгаажсан (selectedType) бол бусад урсгалууд идэвхгүй — засах/илгээх хаагдана.
  const canEditCurrent =
    !isLocked && !selectedType && canEditValuationSubTab(activeSubTab, parcelData, acquisition) && valStatusEditable;
  // Илгээх — идэвхтэй урсгалыг засах эрхтэй хэрэглэгч (таб бүрийн эзэн) төлөв засагдах үед.
  const canSubmitValuation =
    !isLocked && !selectedType && canEditValuationSubTab(activeSubTab, parcelData, acquisition) && valStatusEditable;
  // Баталгаажуулах/Буцаах — санхүүгийн мэргэжилтэн, идэвхтэй урсгал Илгээсэн төлөвтэй
  // бөгөөд үнэлгээний мэдээлэл (хөрөнгө/олговор/газрын үнэлгээ) орсон үед.
  // Аль нэг урсгал аль хэдийн баталгаажсан (selectedType) бол бусад табд товч гарахгүй —
  // нэгж талбарт зөвхөн НЭГ баталгаажсан үнэлгээ байна.
  const hasValuationData = parcelAssets.length > 0 || allComps.length > 0 || !!landValuation;
  const canReviewValuation = isFinance && valStatus === "submitted" && hasValuationData && !selectedType;
  // Үнэлгээний тайлан хавсаргах — ЗӨВХӨН баталгаажсан (сонгогдсон) урсгал дээр:
  // дотоод ажилтан эсвэл тухайн урсгалын эзэн мэргэжлийн байгууллага хавсаргана.
  const canUploadReport =
    !isLocked &&
    !!selectedType &&
    activeType === selectedType &&
    (!isExternal || (isProfOrg && canEditValuationSubTab(activeSubTab, parcelData, acquisition)));
  const orgDisplayName = (id: string) => orgUserName(professionalOrgUsers.find((x) => x.id === id));
  const currentIndependentOrgId = assignedIndependentOrg?.id || parcelData?.independent_org_id || "";
  const selectedIndependentOrgName =
    assignedIndependentOrg?.name ||
    parcelData?.independent_org_name ||
    orgDisplayName(currentIndependentOrgId) ||
    "—";
  const summaryItems: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Газрын үнэлгээ", value: landTotalValue, Icon: Calculator },
    { label: "Хөрөнгийн үнэлгээ", value: totals.assetTotal, Icon: Building2 },
    { label: "Нэгдсэн дүн", value: grandTotalValue, Icon: CircleDollarSign },
  ];

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "approved")
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><CheckCheck className="h-3 w-3" />Зөвшөөрсөн</span>;
    if (status === "rejected")
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400"><XCircle className="h-3 w-3" />Татгалзсан</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Clock className="h-3 w-3" />Хүлээгдэж байна</span>;
  };

  const renderAssetTable = (
    title: string,
    rows: ReturnType<typeof assetValuationRows>,
    emptyText: string,
    tone: SectionTone,
  ) => {
    const total = sumCompensations(rows.flatMap((row) => row.compensations));

    return (
      <div className={tone.card}>
        <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${tone.header}`}>
          <div className="flex items-center gap-2">
            <Building2 className={`h-4 w-4 ${tone.icon}`} />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">{title}</p>
          </div>
          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">{money(total)}</p>
        </div>

        {!rows.length ? (
          <div className="px-5 py-7 text-center text-[12px] text-slate-400">{emptyText}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className={`border-b border-slate-100 dark:border-[#37394d] ${tone.tableHead}`}>
                  {["Хөрөнгө", "Дугаар", "Талбай", "Эзэмшигч", "Нийт үнэлгээ", ""].map((head) => (
                    <th key={head} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                {rows.map(({ asset, compensations, total: assetTotal }) => {
                  const expanded = expandedAssetId === asset.id;
                  return (
                    <Fragment key={asset.id}>
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-[#252630]/50">
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                          {asset.asset_name || ASSET_TYPE_LABELS[asset.asset_type]}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{asset.asset_number || "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{formatArea(asset.area_m2)}</td>
                        <td className="px-4 py-3 text-slate-500">{asset.owner_name || "—"}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-slate-100">{money(assetTotal)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setExpandedAssetId(expanded ? null : asset.id)}
                              title={expanded ? "Хаах" : "Засах"}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                                expanded
                                  ? "bg-[#02c0ce]/10 text-[#02c0ce]"
                                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630]"
                              }`}
                            >
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                            </button>
                            {(assetTotal > 0 || asset.photo_pdf_url) && (
                              <AssetPhotoUpload
                                acqId={acqId}
                                asset={asset}
                                canEdit={canEditCurrent && assetTotal > 0}
                                uploadFn={svc.uploadAssetPhoto}
                                onDone={() =>
                                  queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType] })
                                }
                              />
                            )}
                            {canEditCurrent && (
                              <button
                                onClick={() =>
                                  setPendingConfirm({
                                    title: "Хөрөнгө устгах уу?",
                                    description: asset.asset_name || undefined,
                                    confirmLabel: "Устгах",
                                    confirmColor: "#f1556c",
                                    onConfirm: () => deleteAssetMutation.mutate(asset.id),
                                  })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${asset.id}-details`} className="bg-slate-50/60 dark:bg-[#1a1d20]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#1e1f27]">
                              <table className="w-full text-[12px]">
                                <thead>
                                  <tr className="border-b border-slate-100 dark:border-[#37394d]">
                                    {["Үнэлсэн хэсэг", "Хэлбэр", "Хувь", "Дүн", "Огноо", "Статус", ""].map((head) => (
                                      <th key={head} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        {head}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                                  {compensations.length ? (
                                    compensations.map((comp) => (
                                      <tr key={comp.id}>
                                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{detailLabel(comp)}</td>
                                        <td className="px-3 py-2.5 text-slate-500">{COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}</td>
                                        <td className="px-3 py-2.5 text-slate-500 tabular-nums">{comp.coverage_percent}%</td>
                                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{money(comp.amount)}</td>
                                        <td className="px-3 py-2.5 text-slate-400">{comp.compensation_date ? formatDate(comp.compensation_date) : "—"}</td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex flex-col gap-1">
                                            <StatusBadge status={comp.status} />
                                            {comp.review_note && comp.status === "approved" && (
                                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 max-w-[160px] truncate" title={comp.review_note}>
                                                {comp.review_note}
                                              </p>
                                            )}
                                            {comp.review_note && comp.status === "rejected" && (
                                              <p className="text-[10px] text-red-500 dark:text-red-400 max-w-[160px] truncate" title={comp.review_note}>
                                                {comp.review_note}
                                              </p>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <div className="inline-flex items-center gap-1">
                                            {isFinance && comp.status === "pending" && (
                                              <>
                                                <button
                                                  onClick={() => setApproveModal({ compId: comp.id, note: "" })}
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                                  title="Зөвшөөрөх"
                                                >
                                                  <CheckCircle className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => setRejectModal({ compId: comp.id, note: "" })}
                                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                  title="Татгалзах"
                                                >
                                                  <XCircle className="h-3.5 w-3.5" />
                                                </button>
                                              </>
                                            )}
                                            <button
                                              onClick={() => openHistory(comp.id)}
                                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
                                              title="Түүх харах"
                                            >
                                              <History className="h-3.5 w-3.5" />
                                            </button>
                                            {canEditCurrent && comp.status !== "approved" && (
                                              <button
                                                onClick={() =>
                                                  setPendingConfirm({
                                                    title: "Үнэлгээ устгах уу?",
                                                    confirmLabel: "Устгах",
                                                    confirmColor: "#f1556c",
                                                    onConfirm: () => deleteCompensationMutation.mutate(comp.id),
                                                  })
                                                }
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                                        Үнэлгээний задаргаа бүртгэгдээгүй
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>

                              {canEditCurrent && (
                                <div className="grid gap-3 border-t border-slate-100 p-3 dark:border-[#37394d] md:grid-cols-[1.4fr_120px_130px_150px_auto]">
                                  <input
                                    value={valuationForm.note}
                                    onChange={(e) => setValuationForm((prev) => ({ ...prev, note: e.target.value }))}
                                    placeholder="Үнэлсэн хэсэг"
                                    className={INP}
                                  />
                                  <select
                                    value={valuationForm.compensation_type}
                                    onChange={(e) =>
                                      setValuationForm((prev) => ({
                                        ...prev,
                                        compensation_type: e.target.value as Compensation["compensation_type"],
                                      }))
                                    }
                                    className={INP}
                                  >
                                    <option value="cash">Мөнгө</option>
                                    <option value="land_grant">Дүйцүүлсэн</option>
                                  </select>
                                  <input
                                    value={valuationForm.coverage_percent}
                                    onChange={(e) => setValuationForm((prev) => ({ ...prev, coverage_percent: e.target.value }))}
                                    type="number"
                                    placeholder="Хувь"
                                    className={INP}
                                  />
                                  <input
                                    value={valuationForm.amount}
                                    onChange={(e) => setValuationForm((prev) => ({ ...prev, amount: e.target.value }))}
                                    type="number"
                                    placeholder="Дүн"
                                    className={INP}
                                  />
                                  <button
                                    onClick={() => createCompensationMutation.mutate(asset.id)}
                                    disabled={createCompensationMutation.isPending || !Number(valuationForm.amount)}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Нэмэх
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={`border-t border-slate-200 dark:border-[#37394d] ${tone.footer}`}>
                  <td colSpan={4} className="px-4 py-3 text-right text-[12px] font-semibold text-slate-500">
                    Нийт үнэлгээ
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{money(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {orderedSubTabs.map((item) => {
          const active = activeSubTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setSubTab(item.key);
                setShowForm(false);
              }}
              className={`relative flex min-w-[170px] flex-col justify-center gap-1 px-5 py-3 text-left transition-colors ${
                active
                  ? "bg-[#02c0ce]/5 text-[#02c0ce] dark:bg-[#02c0ce]/10"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#252630]"
              }`}
            >
              {active && <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />}
              <span className="text-[12px] font-semibold">{item.label}</span>
              <span className="text-[10.5px] text-slate-400 dark:text-slate-500">{item.description}</span>
            </button>
          );
        })}
      </div>

      {/* Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв — урсгал бүрт тусдаа */}
      <ValuationSubmissionBar
        status={valStatus}
        submission={submission ?? null}
        typeLabel={VALUATION_TYPE_LABELS[activeType]}
        isSelected={selectedType === activeType}
        hasSelected={!!selectedType}
        canSubmit={canSubmitValuation}
        canReview={canReviewValuation}
        pending={transitionMutation.isPending}
        onAction={(action) => {
          // Илгээхийн өмнө "Үл хөдлөх" төрлийн хөрөнгө бүр зурагтай эсэхийг шалгана
          // (backend мөн адил шалгаж 422 буцаана).
          if (action === "submit") {
            const missingPhotos = parcelAssets.filter(
              (a) => a.asset_type === "real_state" && !a.photo_pdf_url,
            );
            if (missingPhotos.length > 0) {
              toast.error("Зураг оруулаагүй үл хөдлөх хөрөнгө байна", {
                description:
                  missingPhotos
                    .map((a) => a.asset_name || a.asset_number || "Нэргүй хөрөнгө")
                    .join(", ") + " — илгээхийн өмнө хөрөнгө бүрт зураг (PDF) хавсаргана уу.",
              });
              return;
            }
          }
          setSubModal({ action, note: "" });
        }}
        onHistory={() => setSubHistoryOpen(true)}
      />

      {/* Үнэлгээний тайлан — нэгж талбарт ГАНЦ тайлан. Зөвхөн баталгаажсан урсгал
          дээр харагдаж, "Чөлөөлсөн" болгохын өмнө заавал хавсаргагдсан байх ёстой. */}
      {!!selectedType && activeType === selectedType && (
        <div className="ap-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-[#37394d]">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-[#02c0ce]" />
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Үнэлгээний тайлан</p>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Нэгж талбарыг &ldquo;Чөлөөлсөн&rdquo; болгохын өмнө тайлан (PDF) хавсаргасан байх шаардлагатай
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText className={`h-4 w-4 shrink-0 ${reportDoc ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`} />
              {reportDoc ? (
                <a
                  href={reportDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[#02c0ce] hover:underline"
                >
                  <span className="truncate">{reportDoc.name || "Үнэлгээний тайлан"}</span>
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                </a>
              ) : (
                <p className="text-[13px] text-slate-400">Тайлан хавсаргаагүй байна</p>
              )}
            </div>
            {canUploadReport && !!reportDocType && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  ref={reportFileRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = "";
                    if (file.type !== "application/pdf") {
                      toast.error("Зөвхөн PDF файл оруулна уу");
                      return;
                    }
                    if (reportDoc) {
                      // Солихын өмнө баталгаажуулна — хуучин тайлан устана
                      setPendingConfirm({
                        title: "Үнэлгээний тайлан солих уу?",
                        description: `"${reportDoc.name}" файл шинэ "${file.name}" файлаар солигдож, хуучин нь устана.`,
                        confirmLabel: "Солих",
                        confirmColor: "#02c0ce",
                        onConfirm: () => reportMutation.mutate({ file, replaceDocId: reportDoc.id }),
                      });
                    } else {
                      reportMutation.mutate({ file });
                    }
                  }}
                />
                <button
                  onClick={() => reportFileRef.current?.click()}
                  disabled={reportMutation.isPending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-3 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-60"
                >
                  {reportMutation.isPending ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {reportDoc ? "Тайлан солих" : "Тайлан хавсаргах"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "independent" && (
        <div className="ap-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Хөндлөнгийн мэргэжлийн байгууллага</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Одоогийн холболт: {selectedIndependentOrgName}</p>
            </div>
            {/* Холбох/солих/салгах — зөвхөн "Үнэлгээ хийх" явцтай, үнэлгээ баталгаажаагүй үед */}
            {!isExternal &&
              parcelData?.status_name === EVALUATION_STATUS_NAME &&
              !selectedType && (
              <div className="flex items-center gap-2">
                <select
                  value={independentSelect}
                  onChange={(e) => setIndependentSelect(e.target.value)}
                  disabled={independentOrgMutation.isPending}
                  className="h-9 min-w-64 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all disabled:opacity-50"
                >
                  <option value="">— Сонгоно уу —</option>
                  {professionalOrgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {orgUserName(u)}
                      {u.position ? ` · ${u.position}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={
                    independentOrgMutation.isPending ||
                    !independentSelect ||
                    independentSelect === currentIndependentOrgId
                  }
                  onClick={() => {
                    const label = orgDisplayName(independentSelect) || "сонгосон байгууллага";
                    setPendingConfirm({
                      title: currentIndependentOrgId
                        ? "Хөндлөнгийн байгууллага солих"
                        : "Хөндлөнгийн байгууллага холбох",
                      description: currentIndependentOrgId
                        ? `Хөндлөнгийн үнэлгээг "${label}" байгууллагаар солих уу?`
                        : `Хөндлөнгийн үнэлгээг "${label}" байгууллагад холбох уу?`,
                      confirmLabel: currentIndependentOrgId ? "Солих" : "Холбох",
                      confirmColor: "#02c0ce",
                      onConfirm: () => independentOrgMutation.mutate(independentSelect),
                    });
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-3 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currentIndependentOrgId ? "Солих" : "Холбох"}
                </button>
                {currentIndependentOrgId && (
                  <button
                    type="button"
                    disabled={independentOrgMutation.isPending}
                    onClick={() => {
                      setPendingConfirm({
                        title: "Хөндлөнгийн байгууллага салгах",
                        description: "Хөндлөнгийн үнэлгээний байгууллагын холболтыг салгах уу?",
                        confirmLabel: "Салгах",
                        confirmColor: "#f1556c",
                        onConfirm: () => independentOrgMutation.mutate(null),
                      });
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 px-3 text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Салгах
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Хөрөнгийн бүртгэл — нэмэх/импортын товчнууд табын дээд хэсэгт */}
      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Хөрөнгийн бүртгэл</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{effectiveParcelCode || parcelId} нэгж талбар</p>
            </div>
          </div>
          {canEditCurrent && (
            <div className="flex items-center gap-2">
              <ValuationExcelImport
                acqId={acqId}
                parcelId={parcelId}
                parcelCode={effectiveParcelCode}
                valuationType={activeType}
                svc={svc}
                specTypes={specTypes}
                calcTypes={calcTypes}
                existingAssets={parcelAssets}
                existingComps={allComps}
                onDone={() => {
                  queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType] });
                  queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode, activeType] });
                  queryClient.invalidateQueries({ queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType] });
                }}
              />
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Хөрөнгө нэмэх
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ap-card grid grid-cols-3 divide-x divide-slate-100 overflow-hidden dark:divide-[#37394d]">
        {summaryItems.map(({ label, value, Icon }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 px-4 py-3">
            <Icon className="h-4 w-4 shrink-0 text-[#02c0ce]" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="truncate text-[14px] font-bold tabular-nums text-slate-800 dark:text-white">{money(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Газрын үнэлгээ — мэргэжлийн байгуулгын үнэлгээчин */}
      <div className={LAND_TONE.card}>
        <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${LAND_TONE.header}`}>
          <div className="flex items-center gap-2">
            <ReceiptText className={`h-4 w-4 ${LAND_TONE.icon}`} />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Газрын үнэлгээ</p>
          </div>
          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">{money(landTotalValue)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className={`border-b border-slate-100 dark:border-[#37394d] ${LAND_TONE.tableHead}`}>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үзүүлэлт</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Хэмжих нэгж</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Утга</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
              <tr>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Чөлөөлөлтөнд өртсөн газрын хэмжээ</td>
                <td className="px-4 py-3 text-slate-500">м²</td>
                <td className="px-4 py-3">
                  {canEditCurrent && landEditing ? (
                    <input
                      type="number"
                      value={landValuationForm.land_area_m2}
                      onChange={(e) => { setLandValuationEdited(true); setLandValuationForm((f) => ({ ...f, land_area_m2: e.target.value })); }}
                      placeholder="0"
                      className={`${INP} w-40 tabular-nums`}
                    />
                  ) : (
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {lvArea ? lvArea.toLocaleString() : "—"}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Газрын 1 м² талбайн суурь үнэ</td>
                <td className="px-4 py-3 text-slate-500">Төгрөг</td>
                <td className="px-4 py-3">
                  {canEditCurrent && landEditing ? (
                    <input
                      type="number"
                      value={landValuationForm.base_price_per_m2}
                      onChange={(e) => { setLandValuationEdited(true); setLandValuationForm((f) => ({ ...f, base_price_per_m2: e.target.value })); }}
                      placeholder="0"
                      className={`${INP} w-40 tabular-nums`}
                    />
                  ) : (
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {lvPrice ? lvPrice.toLocaleString() : "—"}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className={`border-t-2 border-slate-200 dark:border-[#37394d] ${LAND_TONE.footer}`}>
                <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">Газрын үнэлгээ</td>
                <td />
                <td className="px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-white">{money(lvTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Excel-ээс импортолсон үнэлгээний тайлангийн мэдээлэл (байгаа бол) */}
        {landValuation && (landValuation.appraiser_org_name || landValuation.ownership_cert_no || landValuation.source_file_name) && (
          <div className="grid gap-x-6 gap-y-1.5 border-t border-slate-100 px-5 py-3 text-[12px] dark:border-[#37394d] md:grid-cols-2 lg:grid-cols-3">
            {landValuation.ownership_cert_no && (
              <div><span className="text-slate-400">Өмчлөх эрхийн гэрчилгээ: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.ownership_cert_no}</span></div>
            )}
            {landValuation.appraiser_org_name && (
              <div><span className="text-slate-400">Үнэлгээний байгууллага: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.appraiser_org_name}</span></div>
            )}
            {landValuation.appraiser_director && (
              <div><span className="text-slate-400">Захирал: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.appraiser_director}</span></div>
            )}
            {landValuation.appraiser_reg_no && (
              <div><span className="text-slate-400">Регистр: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.appraiser_reg_no}</span></div>
            )}
            {landValuation.appraiser_contact && (
              <div><span className="text-slate-400">Холбоо барих: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.appraiser_contact}</span></div>
            )}
            {landValuation.source_file_name && (
              <div><span className="text-slate-400">Эх файл: </span><span className="text-slate-700 dark:text-slate-200">{landValuation.source_file_name}</span></div>
            )}
          </div>
        )}
        {canEditCurrent && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#37394d]">
            {landEditing ? (
              <>
                <button
                  onClick={() => {
                    setLandEditing(false);
                    setLandValuationEdited(false);
                    setLandValuationForm({
                      land_area_m2: landValuation?.land_area_m2 ? String(landValuation.land_area_m2) : "",
                      base_price_per_m2: landValuation?.base_price_per_m2 ? String(landValuation.base_price_per_m2) : "",
                    });
                  }}
                  disabled={upsertLandValuationMutation.isPending}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                >
                  Болих
                </button>
                <button
                  onClick={() => upsertLandValuationMutation.mutate()}
                  disabled={upsertLandValuationMutation.isPending || (!lvArea && !lvPrice)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                >
                  Хадгалах
                </button>
              </>
            ) : (
              <>
                {landValuation && (lvArea > 0 || lvPrice > 0) && (
                  <button
                    onClick={() =>
                      setPendingConfirm({
                        title: "Газрын үнэлгээ устгах уу?",
                        confirmLabel: "Устгах",
                        confirmColor: "#f1556c",
                        onConfirm: () => deleteLandValuationMutation.mutate(),
                      })
                    }
                    disabled={deleteLandValuationMutation.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-4 text-[12px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Устгах
                  </button>
                )}
                <button
                  onClick={() => setLandEditing(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90"
                >
                  Засах
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Existing land compensations */}
      {landComps.length > 0 && (
        <div className={LAND_TONE.card}>
          <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-[#37394d] ${LAND_TONE.header}`}>
            <div className="flex items-center gap-2">
              <ReceiptText className={`h-4 w-4 ${LAND_TONE.icon}`} />
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Газрын олговор</p>
            </div>
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">{money(totals.landTotal)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12px]">
              <thead>
                <tr className={`border-b border-slate-100 dark:border-[#37394d] ${LAND_TONE.tableHead}`}>
                  {["Үнэлгээ", "Хэлбэр", "Хувь", "Дүн", "Огноо"].map((head) => (
                    <th key={head} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                {landComps.map((comp) => (
                  <tr key={comp.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{detailLabel(comp)}</td>
                    <td className="px-4 py-3 text-slate-500">{COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}</td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{comp.coverage_percent}%</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-white">{money(comp.amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{comp.compensation_date ? formatDate(comp.compensation_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t border-slate-200 dark:border-[#37394d] ${LAND_TONE.footer}`}>
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-500">Нийт газрын олговор</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{money(totals.landTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}


      {assetsLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
        </div>
      ) : (
        <>
          {renderAssetTable("Үл хөдлөх хөрөнгийн үнэлгээ", realStateRows, "Үл хөдлөх хөрөнгө бүртгэгдээгүй", REAL_ESTATE_TONE)}
          {realStateRows.length > 0 && (
            <BuildingCostSection acqId={acqId} assets={realStateRows.map((r) => r.asset)} listCalcs={svc.listAssetCalculations} />
          )}
          {renderAssetTable("Эд хөрөнгийн үнэлгээ", propertyRows, "Эд хөрөнгө бүртгэгдээгүй", PROPERTY_TONE)}
          {(landTotalValue > 0 || totals.assetTotal > 0) && (
            <ConsolidationCard
              rows={[
                { label: "Газар", value: landTotalValue },
                { label: "Үл хөдлөх хөрөнгө", value: sumCompensations(realStateRows.flatMap((r) => r.compensations)) },
                { label: "Эд хөрөнгө", value: sumCompensations(propertyRows.flatMap((r) => r.compensations)) },
              ]}
              total={grandTotalValue}
            />
          )}
        </>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget && !createAssetMutation.isPending) closeAssetModal();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div>
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Хөрөнгө нэмэх</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Хөрөнгийн мэдээлэл болон үнэлгээний задаргааг хамт бүртгэнэ</p>
              </div>
              <button
                onClick={closeAssetModal}
                disabled={createAssetMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-[#252630] dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {/* Үндсэн мэдээлэл */}
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Үндсэн мэдээлэл</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Хөрөнгийн төрөл</p>
                  <select
                    value={form.asset_type}
                    onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value as Asset["asset_type"] }))}
                    className={INP}
                  >
                    <option value="real_state">Үл хөдлөх хөрөнгө</option>
                    <option value="property">Эд хөрөнгө</option>
                  </select>
                </div>
                {([
                  ["asset_number", "Дугаар", "text", "1"],
                  ["asset_name", "Үнэлж буй хөрөнгийн нэр", "text", "Амины орон сууц"],
                  ["unit", "Хэмжих нэгж", "text", "м², ширхэг..."],
                  ["capacity", "Хүчин чадал", "text", ""],
                  ["floor_count", "Давхрын тоо", "number", "2"],
                  ["area_m2", "Талбай (м²)", "number", "60"],
                  ["owner_name", "Эзэмшигч", "text", "Овог Нэр"],
                  ["address", "Хаяг", "text", "Хаяг..."],
                  ["notes", "Тайлбар", "text", "Тайлбар..."],
                ] as [keyof typeof form, string, string, string][]).map(([field, label, type, placeholder]) => (
                  <div key={field}>
                    <p className="mb-1 text-[11px] text-slate-400">{label}</p>
                    <input
                      type={type}
                      value={form[field] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className={INP}
                    />
                  </div>
                ))}
                <div className="md:col-span-4">
                  <p className="mb-1 text-[11px] text-slate-400">Үнэлж буй хөрөнгийн тодорхойлолт</p>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Тодорхойлолт..."
                    className={`${INP} resize-none`}
                  />
                </div>
              </div>

              {/* Барилгын үзүүлэлт — real_state type only */}
              {form.asset_type === "real_state" && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-sky-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Барилгын үзүүлэлт</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {specTypes.map((t) => (
                      <div key={t.id}>
                        <p className="mb-1 text-[11px] text-slate-400">{t.name}</p>
                        <input
                          type="text"
                          value={specValues[t.id] ?? ""}
                          onChange={(e) => setSpecValues((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          className={INP}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Байгааламжийн өртгийн хандлагаарх тооцоолол — real_state type only */}
              {form.asset_type === "real_state" && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 text-sky-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Байгааламжийн өртгийн хандлагаарх тооцоолол</p>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-[#37394d] dark:bg-[#1a1d20]">
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Үзүүлэлт</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-28">Хэмжих нэгж</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-40">Утга</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                        {/* Барилгын талбай — display only, from area_m2 */}
                        <tr>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">Барилгын талбай</td>
                          <td className="px-3 py-2 text-slate-400">м²</td>
                          <td className="px-3 py-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{form.area_m2 || "—"}</td>
                        </tr>
                        {calcTypes.map((t) => (
                          <tr key={t.id}>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{t.name}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={calcValues[t.id]?.unit ?? t.default_unit}
                                onChange={(e) => setCalcValues((prev) => ({ ...prev, [t.id]: { ...prev[t.id], unit: e.target.value } }))}
                                className={`${INP} text-[11px]`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={calcValues[t.id]?.value ?? ""}
                                onChange={(e) => setCalcValues((prev) => ({ ...prev, [t.id]: { ...prev[t.id], value: e.target.value } }))}
                                placeholder="0"
                                className={`${INP} tabular-nums`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Зургийн upload хэсэг */}
              <div className={`mt-4 overflow-hidden rounded-lg border ${photoError ? "border-red-400" : "border-slate-200 dark:border-white/[0.08]"}`}>
                <div className="flex items-center justify-between bg-slate-50/80 px-4 py-3 dark:bg-[#1a1d20]">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-slate-400" />
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                      Зурагнууд
                      <span className="ml-1 text-red-500">*</span>
                    </p>
                    {photoError && (
                      <span className="text-[11px] text-red-500">— дор хаяж 1 зураг оруулна уу</span>
                    )}
                  </div>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-300 dark:hover:bg-[#252630]">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Зураг нэмэх
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length > 0) {
                          setPhotos((prev) => [...prev, ...files]);
                          setPhotoError(false);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8 text-slate-400 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <Camera className="h-8 w-8 opacity-40" />
                    <p className="text-[12px]">Зураг сонгохын тулд дарна уу</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length > 0) {
                          setPhotos(files);
                          setPhotoError(false);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex flex-wrap gap-2 px-4 py-3">
                    {photos.map((file, idx) => (
                      <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="absolute bottom-0 left-0 right-0 truncate bg-slate-900/50 px-1 py-0.5 text-[9px] text-white">
                          {file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between bg-slate-50/80 px-4 py-3 dark:bg-[#1a1d20]">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-slate-400" />
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Үнэлгээний задаргаа</p>
                  </div>
                  <button
                    onClick={() => setModalValuations((rows) => [...rows, { ...EMPTY_VALUATION }])}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-300 dark:hover:bg-[#252630]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Мөр нэмэх
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-[12px]">
                    <thead>
                      <tr className="border-y border-slate-100 bg-slate-50/50 dark:border-[#37394d] dark:bg-[#1a1d20]">
                        {["Үнэлсэн хэсэг", "Хэлбэр", "Хувь", "Дүн", "Огноо", ""].map((head) => (
                          <th key={head} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                      {modalValuations.map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <input
                              value={row.note}
                              onChange={(e) =>
                                setModalValuations((rows) =>
                                  rows.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)),
                                )
                              }
                              placeholder="Жишээ: Суурь, хана, дээвэр"
                              className={INP}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.compensation_type}
                              onChange={(e) =>
                                setModalValuations((rows) =>
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, compensation_type: e.target.value as Compensation["compensation_type"] }
                                      : item,
                                  ),
                                )
                              }
                              className={INP}
                            >
                              <option value="cash">Мөнгө</option>
                              <option value="land_grant">Дүйцүүлсэн</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.coverage_percent}
                              onChange={(e) =>
                                setModalValuations((rows) =>
                                  rows.map((item, i) => (i === index ? { ...item, coverage_percent: e.target.value } : item)),
                                )
                              }
                              type="number"
                              className={INP}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.amount}
                              onChange={(e) =>
                                setModalValuations((rows) =>
                                  rows.map((item, i) => (i === index ? { ...item, amount: e.target.value } : item)),
                                )
                              }
                              type="number"
                              placeholder="Дүн"
                              className={INP}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.compensation_date}
                              onChange={(e) =>
                                setModalValuations((rows) =>
                                  rows.map((item, i) => (i === index ? { ...item, compensation_date: e.target.value } : item)),
                                )
                              }
                              type="date"
                              className={INP}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() =>
                                setModalValuations((rows) =>
                                  rows.length === 1 ? [{ ...EMPTY_VALUATION }] : rows.filter((_, i) => i !== index),
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={closeAssetModal}
                disabled={createAssetMutation.isPending}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={() => {
                  if (photos.length === 0) {
                    setPhotoError(true);
                    return;
                  }
                  createAssetMutation.mutate();
                }}
                disabled={createAssetMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
              >
                {createAssetMutation.isPending ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Зөвшөөрөх modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Үнэлгээ зөвшөөрөх</p>
              </div>
              <button
                onClick={() => setApproveModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="mb-2 text-[11px] text-slate-400">Шалгасан тайлбар</p>
              <textarea
                value={approveModal.note}
                onChange={(e) => setApproveModal((prev) => prev ? { ...prev, note: e.target.value } : null)}
                rows={3}
                placeholder="Жишээ: Үнэлгээний дүн зөв тооцоолсон байна. Зөвшөөрөв."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#252630] dark:text-slate-100"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() => setApproveModal(null)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={() => approveCompMutation.mutate({ compId: approveModal.compId, note: approveModal.note })}
                disabled={approveCompMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approveCompMutation.isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                <CheckCircle className="h-4 w-4" />
                Зөвшөөрөх
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Татгалзах modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Үнэлгээ татгалзах</p>
              <button
                onClick={() => setRejectModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="mb-2 text-[11px] text-slate-400">Татгалзах шалтгаан (заавал биш)</p>
              <textarea
                value={rejectModal.note}
                onChange={(e) => setRejectModal((prev) => prev ? { ...prev, note: e.target.value } : null)}
                rows={3}
                placeholder="Жишээ: Үнэлгээний дүн буруу тооцоолсон..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#252630] dark:text-slate-100"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() => setRejectModal(null)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={() => rejectCompMutation.mutate({ compId: rejectModal.compId, note: rejectModal.note })}
                disabled={rejectCompMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectCompMutation.isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Татгалзах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Түүх харах modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Татгалзсан түүх</p>
              </div>
              <button
                onClick={() => setHistoryModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {historyModal.list.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">Татгалзсан түүх байхгүй</p>
              ) : (
                <div className="space-y-3">
                  {historyModal.list.map((h) => {
                    const isApproved = h.status === "approved";
                    return (
                    <div key={h.id} className={`rounded-lg border p-4 ${isApproved ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "border-red-100 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isApproved
                            ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                            : <XCircle className="h-4 w-4 text-red-500" />}
                          <span className={`text-[12px] font-semibold ${isApproved ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {isApproved ? "Зөвшөөрсөн" : "Татгалзсан"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{h.reviewed_at ? formatDate(h.reviewed_at) : formatDate(h.archived_at)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[12px]">
                        <div>
                          <p className="text-slate-400">Дүн</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{money(h.amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Хэлбэр</p>
                          <p className="text-slate-600 dark:text-slate-300">{COMP_TYPE_LABELS[h.compensation_type as Compensation["compensation_type"]] ?? h.compensation_type}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Хувь</p>
                          <p className="text-slate-600 dark:text-slate-300">{h.coverage_percent}%</p>
                        </div>
                      </div>
                      {h.review_note && (
                        <div className="mt-2 rounded-md bg-red-100 px-3 py-2 dark:bg-red-500/10">
                          <p className="text-[11px] text-slate-400">Татгалзсан шалтгаан:</p>
                          <p className="text-[12px] text-red-700 dark:text-red-400">{h.review_note}</p>
                        </div>
                      )}
                      {h.reviewed_by && (
                        <p className="mt-1.5 text-[10px] text-slate-400">Хянасан: {h.reviewed_by}</p>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
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

      {subModal && (
        <ValuationTransitionModal
          action={subModal.action}
          note={subModal.note}
          pending={transitionMutation.isPending}
          onNote={(v) => setSubModal((m) => (m ? { ...m, note: v } : m))}
          onConfirm={() => transitionMutation.mutate({ action: subModal.action, note: subModal.note })}
          onClose={() => setSubModal(null)}
        />
      )}

      {subHistoryOpen && (
        <ValuationHistoryModal
          loader={() => svc.listValuationSubmissionHistory(acqId, parcelId, activeType)}
          onClose={() => setSubHistoryOpen(false)}
        />
      )}
    </div>
  );
}
