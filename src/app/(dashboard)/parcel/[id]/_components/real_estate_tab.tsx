"use client";
import { Fragment, useState, useEffect, useRef, type ReactNode } from "react";
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  landApi,
  parcelApi,
  assetSpecTypeApi,
  assetCalcTypeApi,
  documentTypeApi,
} from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import {
  ConfirmDialog,
  type PendingConfirm,
} from "@/components/ui/confirm-dialog";
import {
  type Asset,
  type AssetCalculation,
  type AssetSpec,
  type Compensation,
  type CompensationHistory,
  type LandValuation,
  type LandValuationUpsert,
  type ValuationImportPayload,
  type ValuationNotesPayload,
  type ValuationSectionNote,
  type ParcelFull,
  type ValuationOrg,
  type ValuationSubmission,
  type ValuationStatus,
  type ValuationType,
  VALUATION_STATUS_LABELS,
  VALUATION_TYPE_LABELS,
} from "@/types";
import { formatArea, formatDate, getApiError } from "@/lib/utils";
import {
  X,
  Plus,
  Trash2,
  Building2,
  ReceiptText,
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
  Download,
  Upload,
  Truck,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { COMP_TYPE_LABELS, ASSET_TYPE_LABELS, INP } from "./constants";
import {
  VSection,
  VNote,
  VFileChip,
  VFootNote,
  VHeadRight,
  VKeyValueTable,
  VLandValuationTable,
  VAssetsTable,
  VBuildingSpecTable,
  VBuildingCostTable,
  VCostTable,
  VSummaryTable,
  V_COST_GROUPS,
  sectionHeading,
  type VAssetRow,
  type VCostRow,
} from "./valuation_view";
import {
  VALUATION_SECTION_ORDER,
  VALUATION_SECTION_LABELS,
  type ValuationSectionKey,
} from "@/lib/valuation-import";
import { ValuationExcelImport } from "./valuation_excel_import";
import {
  BuildingCostEditModal,
  BuildingSpecEditModal,
} from "./building_edit_modals";
import { recalcCostRow } from "@/lib/valuation-calc";
import {
  ValuationSubmissionBar,
  ValuationTransitionModal,
  ValuationHistoryModal,
} from "./valuation_submission";
import type { AssetSpecType, AssetCalcType } from "@/types";
import {
  canEditValuationSubTab,
  canViewValuationSubTab,
  getCurrentActor,
  isAdmin,
  isExternalSpecialRole,
  isFinanceSpecialist,
  isProfessionalOrg,
  isSeniorSpecialist,
  shouldUseProfessionalOrgApi,
} from "@/lib/role-utils";
import {
  canCancelValuationForActor,
  EVALUATION_STATUS_NAME,
  type ValuationSubTabKey,
} from "@/lib/access-policy";
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
  // Зөвхөн эд хөрөнгөд: аль зардлын хүснэгтэд харагдахыг тодорхойлно ("" = бусад эд хөрөнгө)
  cost_category: "",
};

type SpecValues = Record<number, string>;
type CalcValues = Record<number, { unit: string; value: string }>;

function isValuationStatus(value: unknown): value is ValuationStatus {
  return (
    value === "draft" ||
    value === "submitted" ||
    value === "approved" ||
    value === "returned" ||
    value === "rejected"
  );
}

function getParcelValuationStatus(
  statuses: ParcelFull["valuation_statuses"],
  valuationType: ValuationType,
): ValuationStatus | undefined {
  if (!statuses) return undefined;
  if (Array.isArray(statuses)) {
    const found = statuses.find(
      (row) =>
        row.valuation_type === valuationType && isValuationStatus(row.status),
    );
    return found?.status;
  }
  const status = statuses[valuationType];
  return isValuationStatus(status) ? status : undefined;
}

function emptySpecValues(types: AssetSpecType[]): SpecValues {
  return Object.fromEntries(types.map((t) => [t.id, ""]));
}
function emptyCalcValues(types: AssetCalcType[]): CalcValues {
  return Object.fromEntries(
    types.map((t) => [t.id, { unit: t.default_unit, value: "" }]),
  );
}

const EMPTY_VALUATION = {
  compensation_type: "cash" as Compensation["compensation_type"],
  coverage_percent: "100",
  amount: "",
  compensation_date: "",
  note: "",
};

type ValuationForm = typeof EMPTY_VALUATION;

function money(value: number) {
  return `${Math.round(Number(value) || 0).toLocaleString()}₮`;
}

function detailLabel(comp: Compensation) {
  return (
    comp.note?.trim() ||
    COMP_TYPE_LABELS[comp.compensation_type] ||
    comp.compensation_type
  );
}

function valuationOrgLabel(org?: ValuationOrg) {
  if (!org) return "";
  return org.name || org.short_name || org.register_no;
}

// Барилгын өртгийн хандлага (Хүснэгт-5) — asset_calculation-ыг барилга бүрээр
// татаж, Excel оруулах цонхтой ИЖИЛ хүснэгтээр (VBuildingCostTable) харуулна.
function BuildingCostSection({
  acqId,
  assets,
  listCalcs,
  note,
  title = "Барилгын өртгийн хандлагаарх тооцоолол",
  label,
  activeId,
  onSelect,
  onEdit,
}: {
  acqId: string;
  assets: Asset[];
  listCalcs: (a: string, id: string) => Promise<AssetCalculation[]>;
  note?: ReactNode;
  title?: string;
  label?: string;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const results = useQueries({
    queries: assets.map((a) => ({
      queryKey: ["asset-calcs", acqId, a.id],
      queryFn: () => listCalcs(acqId, a.id),
    })),
  });
  // Багана (барилга) нь БҮХ утга нь 0 үед л хасагдана — тэр нь импортод үүссэн
  // хоосон загвар. Дан ганц 0 утгатай МӨР хасагдахгүй: Excel дэх мөрийн
  // дараалал хэвээр байх ёстой (эс бөгөөс бүлгийн rowspan тасалдана).
  const columns = assets
    .map((asset, i) => ({ asset, calcs: results[i]?.data ?? [] }))
    .filter((x) => x.calcs.some((c) => Number(c.value) !== 0))
    .map(({ asset, calcs }) => ({
      id: asset.id,
      name: asset.asset_name || "Барилга",
      items: [
        { label: "Барилгын талбай", group: "", unit: "м²", value: asset.area_m2 ?? null },
        ...calcs.map((c) => ({
          label: c.calc_name,
          group: c.calc_group ?? "",
          unit: c.unit,
          value: Number(c.value),
        })),
      ],
    }));
  if (!columns.length) return null;

  return (
    <VSection icon={Calculator} title={title} tone="sky" right={<VHeadRight label={label} />}>
      <VBuildingCostTable columns={columns} activeId={activeId} onSelect={onSelect} onEdit={onEdit} />
      {note}
    </VSection>
  );
}

// Барилгын тодорхойлолт (Хүснэгт-4) — asset_spec-ийг барилга бүрээр багана болгож,
// оруулах цонхтой ИЖИЛ хүснэгтээр харуулна.
function BuildingSpecSection({
  acqId,
  assets,
  listSpecs,
  note,
  title = "Барилгын тодорхойлолт",
  label,
  activeId,
  onSelect,
  onEdit,
}: {
  acqId: string;
  assets: Asset[];
  listSpecs: (a: string, id: string) => Promise<AssetSpec[]>;
  note?: ReactNode;
  title?: string;
  label?: string;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const results = useQueries({
    queries: assets.map((a) => ({
      queryKey: ["asset-specs", acqId, a.id],
      queryFn: () => listSpecs(acqId, a.id),
    })),
  });
  const columns = assets
    .map((asset, i) => ({
      asset,
      specs: (results[i]?.data ?? []).filter((x) => (x.value ?? "").trim() !== ""),
    }))
    .filter((x) => x.specs.length > 0)
    .map(({ asset, specs }) => ({
      id: asset.id,
      name: asset.asset_name || "Барилга",
      items: [
        { label: "Давхрын тоо", value: asset.floor_count ? String(asset.floor_count) : "" },
        ...specs.map((sp) => ({ label: sp.spec_name, value: sp.value })),
        { label: "Талбай", value: formatArea(asset.area_m2) },
      ],
    }));
  if (!columns.length) return null;

  return (
    <VSection icon={Building2} title={title} tone="sky" right={<VHeadRight label={label} />}>
      <VBuildingSpecTable columns={columns} activeId={activeId} onSelect={onSelect} onEdit={onEdit} />
      {note}
    </VSection>
  );
}


// Хураангуй нэгтгэл (Хүснэгт-10) — оруулах цонхтой ижил хүснэгт.
function ConsolidationCard({
  rows,
  total,
  note,
  title = "Хөрөнгийн үнэлгээний хураангуй нэгтгэл",
  label,
}: {
  rows: { label: string; value: number }[];
  total: number;
  note?: ReactNode;
  title?: string;
  label?: string;
}) {
  return (
    <VSection
      icon={CircleDollarSign}
      title={title}
      tone="slate"
      right={
        <VHeadRight
          label={label}
          extra={<span className="font-semibold text-[#02c0ce]">{money(total)}</span>}
        />
      }
    >
      <VSummaryTable rows={rows} total={total} />
      {note}
    </VSection>
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
  const isAdminUser = isAdmin();
  const isSeniorUser = isSeniorSpecialist();
  const isInternalPrivileged = isAdminUser || isSeniorUser;
  const isInternalActor = !isExternal || isInternalPrivileged;
  const useProfApi = shouldUseProfessionalOrgApi();

  // Гадаад мэргэжлийн байгууллага бол бүх дуудлагыг /prof (profApi) руу чиглүүлнэ.
  // Бусад (дотоод) хэрэглэгчид landApi/parcelApi-г ашиглана.
  const svc = useProfApi
    ? {
        getParcel: (a: string, p: string) => profApi.profGetParcel(a, p),
        getById: (a: string) => profApi.profGetAcquisition(a),
        listParcels: (
          a: string,
          params?: { page?: number; page_size?: number; parcel_id?: string },
        ) => profApi.profListParcels(a, params),
        getAssets: (
          a: string,
          params?: {
            page?: number;
            page_size?: number;
            parcel_id?: string;
            valuation_type?: string;
          },
        ) => profApi.profListAssets(a, params),
        listCompensations: (a: string, p?: string, vt?: string) =>
          profApi.profListCompensations(a, p, vt),
        getLandValuation: (a: string, p: string, vt?: string) =>
          profApi.profGetLandValuation(a, p, vt),
        upsertLandValuation: (a: string, body: LandValuationUpsert) =>
          profApi.profUpsertLandValuation(a, body),
        importValuation: (a: string, body: ValuationImportPayload) =>
          profApi.profImportValuation(a, body),
        listValuationNotes: (a: string, p: string, vt?: string) =>
          profApi.profListValuationNotes(a, p, vt),
        saveValuationNotes: (a: string, body: ValuationNotesPayload) =>
          profApi.profSaveValuationNotes(a, body),
        deleteLandValuation: (a: string, p: string, vt?: string) =>
          profApi.profDeleteLandValuation(a, p, vt),
        uploadAssetPhoto: (a: string, id: string, file: File) =>
          profApi.profUploadAssetPhoto(a, id, file),
        createAsset: (a: string, body: Partial<Asset>) =>
          profApi.profCreateAsset(a, body),
        updateAsset: (a: string, id: string, body: Partial<Asset>) =>
          profApi.profUpdateAsset(a, id, body),
        upsertAssetSpecs: (
          a: string,
          id: string,
          specs: { spec_type_id: number; value: string }[],
        ) => profApi.profUpsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (
          a: string,
          id: string,
          calcs: { calc_type_id: number; unit: string; value: number; group?: string }[],
        ) => profApi.profUpsertAssetCalculations(a, id, calcs),
        listAssetCalculations: (a: string, id: string) =>
          profApi.profListAssetCalculations(a, id),
        listAssetSpecs: (a: string, id: string) =>
          profApi.profListAssetSpecs(a, id),
        createCompensation: (a: string, body: Partial<Compensation>) =>
          profApi.profCreateCompensation(a, body),
        updateCompensation: (a: string, id: string, body: Partial<Compensation>) =>
          profApi.profUpdateCompensation(a, id, body),
        deleteAsset: (a: string, id: string) => profApi.profDeleteAsset(a, id),
        deleteCompensation: (a: string, id: string) =>
          profApi.profDeleteCompensation(a, id),
        listCompensationHistory: (a: string, id: string) =>
          profApi.profListCompensationHistory(a, id),
        listDocuments: (p: string) => profApi.profListParcelDocuments(p),
        deleteDocument: (p: string, docId: string) =>
          profApi.profDeleteParcelDocument(p, docId),
        getValuationSubmission: (a: string, p: string, vt?: string) =>
          profApi.profGetValuationSubmission(a, p, vt),
        transitionValuationSubmission: (
          a: string,
          p: string,
          action: "submit" | "approve" | "return" | "cancel",
          note: string,
          vt?: string,
          file?: File | null,
        ) =>
          profApi.profTransitionValuationSubmission(
            a,
            p,
            action,
            note,
            vt,
            file,
          ),
        listValuationSubmissionHistory: (a: string, p: string, vt?: string) =>
          profApi.profListValuationSubmissionHistory(a, p, vt),
        listValuationSnapshots: (a: string, p: string, vt?: string) =>
          profApi.profListValuationSnapshots(a, p, vt),
        setParcelIndependentOrg: (a: string, p: string, u: string | null) =>
          profApi.profSetParcelIndependentOrg(a, p, u),
        uploadDocument: (
          p: string,
          file: File,
          docTypeId?: number,
          name?: string,
        ) => profApi.profUploadParcelDocument(p, file, docTypeId, name),
      }
    : {
        getParcel: (a: string, p: string) => landApi.getParcel(a, p),
        getById: (a: string) => landApi.getById(a),
        listParcels: (
          a: string,
          params?: { page?: number; page_size?: number; parcel_id?: string },
        ) => landApi.getParcels(a, params),
        getAssets: (
          a: string,
          params?: {
            page?: number;
            page_size?: number;
            parcel_id?: string;
            valuation_type?: string;
          },
        ) => landApi.getAssets(a, params),
        listCompensations: (a: string, p?: string, vt?: string) =>
          landApi.listCompensations(a, p, vt),
        getLandValuation: (a: string, p: string, vt?: string) =>
          landApi.getLandValuation(a, p, vt),
        upsertLandValuation: (a: string, body: LandValuationUpsert) =>
          landApi.upsertLandValuation(a, body),
        importValuation: (a: string, body: ValuationImportPayload) =>
          landApi.importValuation(a, body),
        listValuationNotes: (a: string, p: string, vt?: string) =>
          landApi.listValuationNotes(a, p, vt),
        saveValuationNotes: (a: string, body: ValuationNotesPayload) =>
          landApi.saveValuationNotes(a, body),
        deleteLandValuation: (a: string, p: string, vt?: string) =>
          landApi.deleteLandValuation(a, p, vt),
        uploadAssetPhoto: (a: string, id: string, file: File) =>
          landApi.uploadAssetPhoto(a, id, file),
        createAsset: (a: string, body: Partial<Asset>) =>
          landApi.createAsset(a, body),
        updateAsset: (a: string, id: string, body: Partial<Asset>) =>
          landApi.updateAsset(a, id, body),
        upsertAssetSpecs: (
          a: string,
          id: string,
          specs: { spec_type_id: number; value: string }[],
        ) => landApi.upsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (
          a: string,
          id: string,
          calcs: { calc_type_id: number; unit: string; value: number; group?: string }[],
        ) => landApi.upsertAssetCalculations(a, id, calcs),
        listAssetCalculations: (a: string, id: string) =>
          landApi.listAssetCalculations(a, id),
        listAssetSpecs: (a: string, id: string) =>
          landApi.listAssetSpecs(a, id),
        createCompensation: (a: string, body: Partial<Compensation>) =>
          landApi.createCompensation(a, body),
        updateCompensation: (a: string, id: string, body: Partial<Compensation>) =>
          landApi.updateCompensation(a, id, body),
        deleteAsset: (a: string, id: string) =>
          landApi.deleteAsset(a, id).then(() => undefined),
        deleteCompensation: (a: string, id: string) =>
          landApi.deleteCompensation(a, id).then(() => undefined),
        listCompensationHistory: (a: string, id: string) =>
          landApi.listCompensationHistory(a, id),
        listDocuments: (p: string) => parcelApi.listDocuments(p),
        deleteDocument: (p: string, docId: string) =>
          parcelApi.deleteDocument(p, docId),
        getValuationSubmission: (a: string, p: string, vt?: string) =>
          landApi.getValuationSubmission(a, p, vt),
        transitionValuationSubmission: (
          a: string,
          p: string,
          action: "submit" | "approve" | "return" | "cancel",
          note: string,
          vt?: string,
          file?: File | null,
        ) =>
          landApi.transitionValuationSubmission(a, p, action, note, vt, file),
        listValuationSubmissionHistory: (a: string, p: string, vt?: string) =>
          landApi.listValuationSubmissionHistory(a, p, vt),
        listValuationSnapshots: (a: string, p: string, vt?: string) =>
          landApi.listValuationSnapshots(a, p, vt),
        setParcelIndependentOrg: (a: string, p: string, u: string | null) =>
          landApi.setParcelIndependentOrg(a, p, u),
        uploadDocument: (
          p: string,
          file: File,
          docTypeId?: number,
          name?: string,
        ) => parcelApi.uploadDocument(p, file, docTypeId, name),
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
  const isFinance = isFinanceSpecialist();
  const [approveModal, setApproveModal] = useState<{
    compId: string;
    note: string;
  } | null>(null);
  const [landValuationForm, setLandValuationForm] = useState({
    land_area_m2: "",
    base_price_per_m2: "",
    // Хүснэгт-2 (Газрын эрх зүйн байдал)-ын ЦОРЫН ГАНЦ засагддаг талбар.
    // Бусад мөр нь бүртгэлээс (нэгж талбарын дугаар, нийт хэмжээ) татагддаг
    // тул гараар засагдахгүй.
    ownership_cert_no: "",
  });
  const [landValuationEdited, setLandValuationEdited] = useState(false);
  const [landEditing, setLandEditing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{
    compId: string;
    note: string;
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<{
    compId: string;
    list: CompensationHistory[];
  } | null>(null);
  const [independentSelect, setIndependentSelect] = useState("");
  const [assignedIndependentOrg, setAssignedIndependentOrg] = useState<{
    id: string;
    name?: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  // file — ЗААВАЛ БИШ хавсралт (буцаах/цуцлах үед асуугдана).
  // report/photos — ЗӨВХӨН илгээх үед: "Үнэлгээний тайлан" ба "Ажлын зураг".
  // Эдгээр нь нэгж талбарын БАРИМТ болж хадгалагдана (илгээлтийн мөрөнд биш).
  const [subModal, setSubModal] = useState<{
    action: "submit" | "approve" | "return" | "cancel";
    note: string;
    file?: File | null;
    report?: File | null;
    photos?: File[];
  } | null>(null);
  const [subHistoryOpen, setSubHistoryOpen] = useState(false);

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
  const subTabs: {
    key: ValuationSubTabKey;
    label: string;
    description: string;
  }[] = [
    {
      key: "asset",
      label: "Үндсэн үнэлгээ",
      description: "Үндсэн мэргэжлийн байгууллагын үнэлгээ",
    },
    {
      key: "independent",
      label: "Хөндлөнгийн үнэлгээ",
      description: "Нэгж талбарт холбосон байгууллагын үнэлгээ",
    },
    { key: "mika", label: "МИКА", description: "МИКА-гийн үнэлгээ, хяналт" },
  ];
  const visibleSubTabs = isInternalActor
    ? subTabs
    : subTabs.filter((item) =>
        canViewValuationSubTab(item.key, parcelData, acquisition),
      );
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
      : (orderedSubTabs[0]?.key ?? "asset");
  const activeType: ValuationType = activeSubTab as ValuationType;

  // Хараат бус үнэлгээчнээр томилох БАЙГУУЛЛАГУУД (өмнө нь хэрэглэгчид байв).
  const { data: valuationOrgs = [] } = useQuery({
    // ["valuation-orgs", ...] иерархи — valuation-org-page.tsx-ийн qk-г үз.
    queryKey: ["valuation-orgs", "options"],
    queryFn: () => landApi.listValuationOrgs(),
    enabled: isInternalActor,
    staleTime: 60_000,
  });

  const { data: parcelListFallback } = useQuery({
    queryKey: ["land-parcels-independent-org", acqId, effectiveParcelCode],
    queryFn: () =>
      svc.listParcels(acqId, {
        page: 1,
        page_size: 20,
        parcel_id: effectiveParcelCode,
      }),
    enabled:
      !!acqId && !!effectiveParcelCode && !parcelData?.independent_org_id,
    staleTime: 30_000,
  });

  const fallbackParcel = parcelListFallback?.data?.find(
    (item) => item.id === parcelId || item.parcel_id === effectiveParcelCode,
  );

  // Сонгогчийг backend-ээс ирсэн холболтоор эхлүүлнэ. Detail response дээр
  // independent_org_id байхгүй ирвэл жагсаалтын endpoint-оос авсан тухайн parcel-ээр сэргээнэ.
  useEffect(() => {
    const orgId =
      parcelData?.independent_org_id || fallbackParcel?.independent_org_id;
    if (!orgId) return;

    const org = valuationOrgs.find((x) => x.id === orgId);
    const name =
      parcelData?.independent_org_name ||
      fallbackParcel?.independent_org_name ||
      valuationOrgLabel(org);
    setAssignedIndependentOrg({ id: orgId, name });
    setIndependentSelect(orgId);
  }, [
    fallbackParcel?.independent_org_id,
    fallbackParcel?.independent_org_name,
    parcelData?.independent_org_id,
    parcelData?.independent_org_name,
    valuationOrgs,
  ]);

  // Бүх өгөгдөл идэвхтэй урсгалаар (activeType) тусад нь татагдана — урсгалууд холилдохгүй.
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType],
    queryFn: () =>
      svc.getAssets(acqId, {
        page: 1,
        page_size: 1000,
        parcel_id: effectiveParcelCode,
        valuation_type: activeType,
      }),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
    queryFn: () =>
      svc.listCompensations(acqId, effectiveParcelCode, activeType),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: landValuation } = useQuery<LandValuation | null>({
    queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType],
    queryFn: () => svc.getLandValuation(acqId, effectiveParcelCode, activeType),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  // Хүснэгт бүрийн ТАЙЛБАР (Excel-ийн "ТАЙЛБАР:" мөр эсвэл гараас бичсэн).
  // Хуучин хувилбарын backend дээр энэ маршрут байхгүй (404) — тайлбар нь табын
  // НЭМЭЛТ мэдээлэл тул алдааг залгиж, хоосноор үргэлжлүүлнэ (таб эвдрэхгүй)
  // ба дахин оролдлого хийж хүсэлт үржүүлэхгүй.
  const { data: sectionNotes = [] } = useQuery<ValuationSectionNote[]>({
    queryKey: ["valuation-notes", acqId, effectiveParcelCode, activeType],
    queryFn: () =>
      svc
        .listValuationNotes(acqId, effectiveParcelCode, activeType)
        .catch(() => [] as ValuationSectionNote[]),
    enabled: !!acqId && !!effectiveParcelCode,
    retry: false,
  });
  const noteOf = (key: ValuationSectionKey) =>
    sectionNotes.find((n) => n.section_key === key)?.note ?? "";
  // Excel-ээс ирсэн хүснэгтийн таних мэдээлэл (дугаар, "Хүснэгт-N", гарчиг, дараалал).
  const secMeta = (key: ValuationSectionKey) =>
    sectionNotes.find((n) => n.section_key === key);
  /**
   * Хүснэгтийн гарчиг ("3.3 Газрын үнэлгээ") ба "Хүснэгт-3" шошго.
   * Excel-ээс хадгалагдсан утга байвал түүнийг, эс бөгөөс ЗАГВАРЫН СТАНДАРТ
   * дугаарлалтыг хэрэглэнэ — ингэснээр дугаар хаана ч хоосон харагдахгүй.
   */
  const head = (key: ValuationSectionKey) => {
    const m = secMeta(key);
    return sectionHeading(key, {
      no: m?.section_no,
      label: m?.table_label,
      title: m?.title,
    });
  };
  /**
   * Хүснэгтүүдийг ЯГ Excel-ийн дарааллаар эрэмбэлнэ. Оруулсан файлаас
   * `sort_order` ирсэн бол түүгээр, эс бөгөөс загварын өгөгдмөл (3.1 → 5.1)
   * дарааллаар. Ингэснээр загварын дугаарлалт өөрчлөгдвөл дэлгэц дагана.
   */
  const orderedSections = (items: [ValuationSectionKey, ReactNode][]) =>
    items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const rank = ([key]: [ValuationSectionKey, ReactNode]) => {
          const m = secMeta(key);
          if (m && m.sort_order != null && (m.section_no || m.table_label))
            return m.sort_order;
          return VALUATION_SECTION_ORDER.indexOf(key);
        };
        const d = rank(a.item) - rank(b.item);
        return d !== 0 ? d : a.i - b.i;
      })
      .map(({ item: [key, node] }) => <Fragment key={key}>{node}</Fragment>);

  const saveNoteMutation = useMutation({
    mutationFn: (body: ValuationNotesPayload) =>
      svc.saveValuationNotes(acqId, body),
    onSuccess: () => {
      toast.success("Тайлбар хадгалагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["valuation-notes", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Тайлбар хадгалахад алдаа гарлаа")),
  });
  // Нэг хүснэгтийн тайлбарыг дангаар нь хадгална (бусад хэсгийнх хэвээр үлдэнэ).
  const saveNote = (key: ValuationSectionKey, note: string) =>
    saveNoteMutation.mutate({
      parcel_id: effectiveParcelCode,
      valuation_type: activeType,
      notes: { [key]: note },
    });

  // Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв — урсгал бүрт тусдаа
  const { data: submission } = useQuery<ValuationSubmission | null>({
    queryKey: ["valuation-submission", acqId, parcelId, activeType],
    queryFn: () =>
      svc
        .getValuationSubmission(acqId, parcelId, activeType)
        .then((s) => s ?? null),
    enabled: !!acqId && !!parcelId,
  });
  const fallbackValStatus = getParcelValuationStatus(
    parcelData?.valuation_statuses,
    activeType,
  );
  const valStatus: ValuationStatus =
    submission?.status ?? fallbackValStatus ?? "draft";
  const valStatusEditable = valStatus === "draft" || valStatus === "returned";

  const transitionMutation = useMutation({
    // file — буцаалтад заавал биш, цуцлалтад заавал PDF хавсралт.
    // report/photos — ИЛГЭЭХ үед: эхлээд нэгж талбарын БАРИМТ болгож
    // хавсаргаад (Үнэлгээний тайлан / Ажлын зураг), дараа нь шилжилт хийнэ.
    // Backend нь тэр хоёр баримт байгаа эсэхийг шалгаж байж илгээлтийг авна.
    mutationFn: async ({
      action,
      note,
      file,
      report,
      photos,
    }: {
      action: "submit" | "approve" | "return" | "cancel";
      note: string;
      file?: File | null;
      report?: File | null;
      photos?: File[];
    }) => {
      if (action === "submit") {
        if (report) {
          await svc.uploadDocument(parcelId, report, reportDocType?.id, reportDocType?.name);
          // Хуучин тайланг СОЛИНО — нэгж талбарт ганц баталгаажсан тайлан байна.
          if (reportDoc) await svc.deleteDocument(parcelId, reportDoc.id);
        }
        for (const photo of photos ?? []) {
          await svc.uploadDocument(parcelId, photo, workPhotoDocType?.id, workPhotoDocType?.name);
        }
        if (report || (photos?.length ?? 0) > 0) {
          await queryClient.invalidateQueries({ queryKey: ["parcel-documents", parcelId] });
        }
      }
      return svc.transitionValuationSubmission(
        acqId,
        parcelId,
        action,
        note,
        activeType,
        file,
      );
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "submit"
          ? "Нөхөх олговор илгээгдлээ"
          : vars.action === "approve"
            ? "Нөхөх олговор баталгаажлаа"
            : vars.action === "cancel"
              ? "Баталгаажсан үнэлгээ хүчингүй болж, түүхэд хадгалагдлаа"
              : "Нөхөх олговор буцаагдлаа",
      );
      setSubModal(null);
      if (vars.action === "cancel") {
        setLandEditing(false);
        setLandValuationEdited(false);
        setLandValuationForm({ land_area_m2: "", base_price_per_m2: "", ownership_cert_no: "" });
        queryClient.setQueryData(
          ["parcel-assets", acqId, effectiveParcelCode, activeType],
          (old: typeof assets | undefined) =>
            old ? { ...old, data: [], total: 0 } : old,
        );
        queryClient.setQueryData(
          ["compensations", acqId, effectiveParcelCode, activeType],
          [],
        );
        queryClient.setQueryData(
          ["land-valuation", acqId, effectiveParcelCode, activeType],
          null,
        );
      }
      // Зөвшөөрөхөд бусад урсгалууд "Хүчингүй" болдог тул БҮХ урсгалын төлөвийг дахин татна
      queryClient.invalidateQueries({
        queryKey: ["valuation-submission", acqId, parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["valuation-snapshots", acqId, parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["valuation-history", acqId, parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["parcel-status-history", parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["parcel-status-history", acqId, parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["parcel-available-statuses", acqId, parcelId],
      });
      // Зөвшөөрөхөд үндсэн урсгал (selected_valuation_type) өөрчлөгдөнө → parcel дахин татна
      queryClient.invalidateQueries({
        queryKey: ["parcel-full", acqId, parcelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["parcel-assets", acqId, effectiveParcelCode],
      });
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode],
      });
      queryClient.invalidateQueries({
        queryKey: ["land-valuation", acqId, effectiveParcelCode],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Төлөв шилжүүлэхэд алдаа гарлаа")),
  });

  // Үнэлгээний тайлан — нэгж талбарт ГАНЦ тайлан. Ердийн хавсралтын (parcel
  // documents) флоугоор "Хөрөнгийн үнэлгээний тайлан" төрөлтэй хадгалагдана,
  // Баримт бичиг табд бусад хавсралтын адил харагдана.
  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
    staleTime: Infinity,
  });
  const reportDocType = docTypes.find((t) => t.type === "valuation_report");
  // "Үнэлгээний хүснэгт" — Excel-ээр оруулсан ЭХ файл (импортын үед хадгалагдана).
  const sourceDocType = docTypes.find((t) => t.type === "valuation_source");
  const { data: parcelDocs = [] } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => svc.listDocuments(parcelId),
    enabled: !!parcelId,
  });
  const reportDoc = parcelDocs.find(
    (d) => !!reportDocType && d.document_type_id === reportDocType.id,
  );
  // Үнэлгээг оруулсан эх Excel — хамгийн сүүлд орсныг нь авна.
  const sourceDoc = sourceDocType
    ? [...parcelDocs]
        .filter((d) => d.document_type_id === sourceDocType.id)
        .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))[0]
    : undefined;
  // "Ажлын зураг" — хээрийн ажлын зургууд. Хөрөнгө тус бүрийн зургийг
  // СОЛЬСОН: илгээхэд тайлантай хамт заавал хавсаргана (backend мөн шалгана).
  const workPhotoDocType = docTypes.find((t) => t.type === "work_photo");
  const workPhotoDocs = workPhotoDocType
    ? parcelDocs.filter((d) => d.document_type_id === workPhotoDocType.id)
    : [];
  // Тайлан БҮРТГЭГДСЭН эсэх — backend-ийн цуцлалтын шалгалттай ИЖИЛ: шинэ
  // флоугийн parcel_document ЭСВЭЛ баталгаажсан олговрын valuation_report_url
  // (хуучин өгөгдөл) аль нэг нь хангалттай. Зөвхөн эхнийхийг шалгавал хуучин
  // өгөгдөлтэй нэгж талбарын цуцлалт frontend дээр шалтгаангүй хаагдана.
  const legacyReportComp = allComps.find(
    (c) => c.status === "approved" && !!c.valuation_report_url,
  );
  const upsertLandValuationMutation = useMutation({
    mutationFn: () =>
      svc.upsertLandValuation(acqId, {
        parcel_id: effectiveParcelCode,
        valuation_type: activeType,
        land_area_m2: Number(landValuationForm.land_area_m2) || 0,
        base_price_per_m2: Number(landValuationForm.base_price_per_m2) || 0,
        ownership_cert_no: landValuationForm.ownership_cert_no,
      }),
    onSuccess: () => {
      toast.success("Газрын үнэлгээ хадгалагдлаа");
      setLandEditing(false);
      setLandValuationEdited(false);
      queryClient.invalidateQueries({
        queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType],
      });
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Газрын үнэлгээ хадгалахад алдаа гарлаа")),
  });

  const deleteLandValuationMutation = useMutation({
    mutationFn: () =>
      svc.deleteLandValuation(acqId, effectiveParcelCode, activeType),
    onSuccess: () => {
      toast.success("Газрын үнэлгээ устгагдлаа");
      setLandEditing(false);
      setLandValuationEdited(false);
      setLandValuationForm({ land_area_m2: "", base_price_per_m2: "", ownership_cert_no: "" });
      queryClient.invalidateQueries({
        queryKey: ["land-valuation", acqId, effectiveParcelCode, activeType],
      });
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Газрын үнэлгээ устгахад алдаа гарлаа")),
  });

  useEffect(() => {
    if (landValuation && !landValuationEdited) {
      setLandValuationForm({
        land_area_m2: landValuation.land_area_m2
          ? String(landValuation.land_area_m2)
          : "",
        base_price_per_m2: landValuation.base_price_per_m2
          ? String(landValuation.base_price_per_m2)
          : "",
        ownership_cert_no: landValuation.ownership_cert_no ?? "",
      });
    } else if (!landValuation && !landValuationEdited) {
      setLandValuationForm({ land_area_m2: "", base_price_per_m2: "", ownership_cert_no: "" });
    }
  }, [landValuation, landValuationEdited]);

  const closeAssetModal = () => {
    setShowForm(false);
    setForm(EMPTY_ASSET);
    setSpecValues(emptySpecValues(specTypes));
    setCalcValues(emptyCalcValues(calcTypes));
    setModalValuations([{ ...EMPTY_VALUATION }]);
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
        // Зардлын ангилал нь хүснэгтийн бүлэглэлд ашиглагддаг тул notes-д хадгална
        // (Excel импорт мөн "… · <ангилал>" гэж бичдэг — нэг дүрэм).
        notes: [form.notes, form.cost_category].filter(Boolean).join(" · "),
        unit: form.unit,
        capacity: form.capacity,
        description: form.description,
      });
      if (!created) throw new Error("Хөрөнгө үүсгэхэд алдаа гарлаа");

      if (form.asset_type === "real_state") {
        await svc.upsertAssetSpecs(
          acqId,
          created.id,
          specTypes.map((t) => ({
            spec_type_id: t.id,
            value: specValues[t.id] ?? "",
          })),
        );
        await svc.upsertAssetCalculations(
          acqId,
          created.id,
          calcTypes.map((t) => ({
            calc_type_id: t.id,
            unit: calcValues[t.id]?.unit ?? t.default_unit,
            value: Number(calcValues[t.id]?.value) || 0,
          })),
        );
      }

      const valuationRows = modalValuations.filter(
        (row) => Number(row.amount) > 0,
      );
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

      return created;
    },
    onSuccess: () => {
      toast.success("Хөрөнгө нэмэгдлээ");
      closeAssetModal();
      queryClient.invalidateQueries({
        queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType],
      });
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Хөрөнгө нэмэхэд алдаа гарлаа")),
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
      setCompModal(null);
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Үнэлгээ нэмэхэд алдаа гарлаа")),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => svc.deleteAsset(acqId, assetId),
    onSuccess: () => {
      toast.success("Хөрөнгө устгагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType],
      });
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const deleteCompensationMutation = useMutation({
    mutationFn: (compId: string) => svc.deleteCompensation(acqId, compId),
    onSuccess: () => {
      toast.success("Үнэлгээ устгагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) =>
      toast.error(getApiError(err, "Үнэлгээ устгахад алдаа гарлаа")),
  });

  const approveCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.approveCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ зөвшөөрөгдлөө");
      setApproveModal(null);
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
    },
    onError: (err) => toast.error(getApiError(err, "Зөвшөөрөхөд алдаа гарлаа")),
  });

  const rejectCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.rejectCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ татгалзагдлаа");
      setRejectModal(null);
      queryClient.invalidateQueries({
        queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
      });
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
    mutationFn: (orgId: string | null) =>
      svc.setParcelIndependentOrg(acqId, parcelId, orgId),
    onSuccess: (_data, orgId) => {
      const org = orgId ? valuationOrgs.find((x) => x.id === orgId) : undefined;
      const orgName = valuationOrgLabel(org) || undefined;
      setAssignedIndependentOrg(orgId ? { id: orgId, name: orgName } : null);
      setIndependentSelect(orgId ?? "");
      // Холбогдсон төлөвийг шууд тусгана — getParcel эдгээр талбарыг буцаахгүй байсан ч
      // холболт харагдахгүй байхаас сэргийлж optimistic-оор кэшийг шинэчилнэ.
      queryClient.setQueryData<ParcelFull>(
        ["parcel-full", acqId, parcelId],
        (old) =>
          old
            ? {
                ...old,
                independent_org_id: orgId ?? undefined,
                independent_org_name: orgName,
              }
            : old,
      );
      queryClient.invalidateQueries({ queryKey: ["land-parcels", acqId] });
      toast.success(
        orgId
          ? "Хөндлөнгийн байгууллага холбогдлоо"
          : "Хөндлөнгийн байгууллагын холболт салгагдлаа",
      );
    },
    onError: (err) =>
      toast.error(getApiError(err, "Байгууллага холбох үед алдаа гарлаа")),
  });

  const parcelAssets = assets?.data ?? [];
  // Газрын үнэлгээнээс авто-үүсгэсэн олговрыг "Газрын олговр" картад давхар харуулахгүй
  // (газрын дүн нь дээрх "Газрын үнэлгээ" картад аль хэдийн харагдаж байгаа).
  const landComps = parcelValuations(allComps, effectiveParcelCode).filter(
    (c) => c.note !== "Газрын үнэлгээ",
  );
  const realStateRows = assetValuationRows(
    parcelAssets,
    allComps,
    "real_state",
  );
  const propertyRows = assetValuationRows(parcelAssets, allComps, "property");
  const totals = valuationTotals(parcelAssets, allComps, effectiveParcelCode);

  const lvArea = Number(landValuationForm.land_area_m2) || 0;
  const lvPrice = Number(landValuationForm.base_price_per_m2) || 0;
  const lvTotal = lvArea * lvPrice;
  // Газрын нийт үнэ нь land_valuation (талбай×суурь үнэ)-ээс гарна — parcel-түвшний
  // нөхөн олговор (totals.landTotal) ашиглахгүй (импорт нь land-valuation-д хадгалдаг).
  const landTotalValue =
    lvTotal || landValuation?.total_value || totals.landTotal;
  const grandTotalValue = landTotalValue + totals.assetTotal;

  // Идэвхтэй урсгалын өөрийн илгээх төлөв Илгээсэн/Баталгаажсан бол засах боломжгүй.
  // Аль нэг урсгал баталгаажсан (selectedType) бол бусад урсгалууд идэвхгүй — засах/илгээх хаагдана.
  const canEditCurrent =
    !isLocked &&
    !selectedType &&
    canEditValuationSubTab(activeSubTab, parcelData, acquisition) &&
    valStatusEditable;
  // Илгээх — идэвхтэй урсгалыг засах эрхтэй хэрэглэгч (таб бүрийн эзэн) төлөв засагдах үед.
  const canSubmitValuation =
    !isLocked &&
    !selectedType &&
    canEditValuationSubTab(activeSubTab, parcelData, acquisition) &&
    valStatusEditable;
  // Баталгаажуулах/Буцаах — санхүүгийн мэргэжилтэн, идэвхтэй урсгал Илгээсэн төлөвтэй
  // бөгөөд үнэлгээний мэдээлэл (хөрөнгө/олговор/газрын үнэлгээ) орсон үед.
  // Аль нэг урсгал аль хэдийн баталгаажсан (selectedType) бол бусад табд товч гарахгүй —
  // нэгж талбарт зөвхөн НЭГ баталгаажсан үнэлгээ байна.
  const hasValuationData =
    parcelAssets.length > 0 || allComps.length > 0 || !!landValuation;
  const canReviewValuation =
    isFinance && valStatus === "submitted" && hasValuationData && !selectedType;
  const isCurrentApprovedValuation = valStatus === "approved";
  const canCancelValuation = canCancelValuationForActor(
    getCurrentActor(),
    acquisition,
    valStatus,
    isLocked,
  );
  const orgDisplayName = (id: string) =>
    valuationOrgLabel(valuationOrgs.find((x) => x.id === id));
  const currentIndependentOrgId =
    assignedIndependentOrg?.id || parcelData?.independent_org_id || "";
  const selectedIndependentOrgName =
    assignedIndependentOrg?.name ||
    parcelData?.independent_org_name ||
    orgDisplayName(currentIndependentOrgId) ||
    "—";
  // Дээд мөрийн дүнгүүд — доорх "Нэгтгэл" хүснэгттэй ЯГ ижил задаргаа:
  // газар / үл хөдлөх / эд хөрөнгө-зардал, эцэст нь НЭГТГЭЛ дүн (тодруулсан).
  const summaryItems: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Газрын үнэлгээ", value: landTotalValue, Icon: Calculator },
    {
      label: "Үл хөдлөх хөрөнгө",
      value: sumCompensations(realStateRows.flatMap((r) => r.compensations)),
      Icon: Building2,
    },
    {
      label: "Эд хөрөнгө, зардал",
      value: sumCompensations(propertyRows.flatMap((r) => r.compensations)),
      Icon: Boxes,
    },
  ];

  // Excel-ийн 3.6–3.9 хүснэгтүүд. Импортын үед зардлын мөрүүд нь "эд хөрөнгө"
  // болж хадгалагддаг (asset.description = зардлын хүснэгтийн нэр) тул эндээс
  // ангилан, Excel-тэй ижил тусдаа хүснэгт болгож харуулна.
  const costMatched = new Set<string>();
  const costSections = V_COST_GROUPS.map((g) => {
    const rows = propertyRows.filter((r) => {
      const hay = `${r.asset.description ?? ""} ${r.asset.notes ?? ""} ${r.asset.asset_name ?? ""}`;
      const hit = g.match.test(hay);
      if (hit) costMatched.add(r.asset.id);
      return hit;
    });
    return { key: g.key, title: g.title, rows };
  });
  costSections.unshift({
    key: "other_assets" as ValuationSectionKey,
    title: "Бусад эд хөрөнгийн үнэлгээ",
    rows: propertyRows.filter((r) => !costMatched.has(r.asset.id)),
  });

  // Хөрөнгийн танилцуулгын хүснэгт (Excel-ийн Хүснэгт-1-тэй ижил бүтэц)
  const assetTableRows: VAssetRow[] = [...realStateRows, ...propertyRows].map((row, i) => ({
    id: row.asset.id,
    seq: i + 1,
    name: row.asset.asset_name || ASSET_TYPE_LABELS[row.asset.asset_type],
    kind: row.asset.asset_type,
    unit: row.asset.unit,
    qty: row.asset.area_m2 || null,
    total: row.total,
    description: row.asset.description || "",
  }));

  // Баруун талын дэлгэрэнгүйд харуулах сонгосон хөрөнгө
  const selectedAssetRow =
    [...realStateRows, ...propertyRows].find((r) => r.asset.id === expandedAssetId) ?? null;

  // Сонгосон хөрөнгийн ЗАСВАРЛАХ маягт (аль ч хүснэгтийн мөрөөс ижил ажиллана)
  const assetFormOf = (a: Asset | undefined | null) => ({
    asset_name: a?.asset_name ?? "",
    unit: a?.unit ?? "",
    area_m2: a?.area_m2 ? String(a.area_m2) : "",
    unit_price: a?.unit_price ? String(a.unit_price) : "",
    owner_name: a?.owner_name ?? "",
    asset_number: a?.asset_number ?? "",
    description: a?.description ?? "",
  });
  const [assetEditForm, setAssetEditForm] = useState(assetFormOf(null));
  // Хөрөнгийн мэдээллийг засах нь ТУСДАА үйлдэл — попапаар (баруун самбар нь
  // зөвхөн ХАРАХ). Хүснэгтийн арын баганын товч эсвэл самбарын "Засах" нээнэ.
  const [assetModal, setAssetModal] = useState<string | null>(null);
  // Үнэлгээ (олговор) нэмэх нь ТУСДАА үйлдэл — хүснэгтийн дээрх товчоор попап
  // нээгдэнэ (дэлгэрэнгүй самбар нь зөвхөн ХАРАХ/ЗАСАХ-д зориулагдсан).
  const [compModal, setCompModal] = useState<{ assetId: string } | null>(null);
  // Попапд засагдаж буй хөрөнгө (маягтыг нээх үед дүүргэнэ).
  const modalAsset =
    [...realStateRows, ...propertyRows].find((r) => r.asset.id === assetModal)?.asset ?? null;
  const assetEditDirty =
    !!modalAsset && JSON.stringify(assetEditForm) !== JSON.stringify(assetFormOf(modalAsset));

  /** Хүснэгтийн мөрөөс: дэлгэрэнгүйг баруун талд нээх, эсвэл засах попап дуудах. */
  const openAsset = (id: string, edit = false) => {
    setExpandedAssetId(id);
    if (edit) {
      const row = [...realStateRows, ...propertyRows].find((r) => r.asset.id === id);
      setAssetEditForm(assetFormOf(row?.asset ?? null));
      setAssetModal(id);
    }
  };

  // Хүснэгт-4/5 нь БАГАНААР барилгаа илэрхийлдэг тул засах попап нь тухайн
  // барилгын id-гаар нээгдэнэ (мөрийн харандаа биш, баганын толгойн товч).
  const [costEditId, setCostEditId] = useState<string | null>(null);
  const [specEditId, setSpecEditId] = useState<string | null>(null);
  const invalidateValuationData = () => {
    queryClient.invalidateQueries({
      queryKey: ["parcel-assets", acqId, effectiveParcelCode, activeType],
    });
    queryClient.invalidateQueries({
      queryKey: ["compensations", acqId, effectiveParcelCode, activeType],
    });
    queryClient.invalidateQueries({ queryKey: ["asset-calcs", acqId] });
    queryClient.invalidateQueries({ queryKey: ["asset-specs", acqId] });
  };

  const updateAssetMutation = useMutation({
    mutationFn: async () => {
      if (!assetModal) throw new Error("Хөрөнгө сонгогдоогүй байна");
      const qty = Number(assetEditForm.area_m2) || 0;
      const price = Number(assetEditForm.unit_price) || 0;
      const updated = await svc.updateAsset(acqId, assetModal, {
        asset_name: assetEditForm.asset_name,
        unit: assetEditForm.unit,
        area_m2: qty,
        unit_price: price,
        owner_name: assetEditForm.owner_name,
        asset_number: assetEditForm.asset_number,
        description: assetEditForm.description,
      });
      // НИЙТ ҮНЭ = тоо хэмжээ × нэгж үнэ. Энэ дүн нь нөхөх олговрын мөрөнд
      // хадгалагддаг тул хамт шинэчлэхгүй бол хүснэгтийн "Нийт үнэ", хэсгийн
      // нийлбэр, "Нэгдсэн дүн" гурав хуучин тоогоо хадгална.
      // ҮЛ ХӨДЛӨХ хөрөнгө энд ОРОХГҮЙ: түүний дүн Хүснэгт-5-ын өртгийн
      // гинжээс (нөхөн орлуулах өртөг) гардаг.
      const row = [...realStateRows, ...propertyRows].find(
        (r) => r.asset.id === assetModal,
      );
      if (row && row.asset.asset_type !== "real_state") {
        const { total } = recalcCostRow({
          qty,
          unitPrice: price,
          total: null,
          changed: "unitPrice",
        });
        if (total != null && total > 0) {
          const target = row.compensations[0];
          if (target) {
            await svc.updateCompensation(acqId, target.id, {
              target_type: "asset",
              parcel_id: effectiveParcelCode,
              asset_id: row.asset.id,
              compensation_type: target.compensation_type,
              coverage_percent: target.coverage_percent,
              amount: total,
              note: target.note,
            });
          } else {
            await svc.createCompensation(acqId, {
              target_type: "asset",
              valuation_type: activeType,
              parcel_id: effectiveParcelCode,
              asset_id: row.asset.id,
              compensation_type: "cash",
              coverage_percent: 100,
              amount: total,
              note: "Нийт үнэ (тоо хэмжээ × нэгж үнэ)",
            });
          }
        }
      }
      return updated;
    },
    onSuccess: () => {
      toast.success("Хөрөнгийн мэдээлэл шинэчлэгдлээ");
      setAssetModal(null);
      invalidateValuationData();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "approved")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckCheck className="h-3 w-3" />
          Зөвшөөрсөн
        </span>
      );
    if (status === "rejected")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Татгалзсан
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        Хүлээгдэж байна
      </span>
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
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span className="text-[12px] font-semibold">{item.label}</span>
              <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв — урсгал бүрт тусдаа */}
      <ValuationSubmissionBar
        status={valStatus}
        submission={submission ?? null}
        typeLabel={VALUATION_TYPE_LABELS[activeType]}
        isSelected={selectedType === activeType || isCurrentApprovedValuation}
        hasSelected={!!selectedType}
        canSubmit={canSubmitValuation}
        canReview={canReviewValuation}
        canCancel={canCancelValuation}
        pending={transitionMutation.isPending}
        onAction={(action) => {
          // ИЛГЭЭХ: баталгаажсан тайлан ба ажлын зургийг цонхон дотор нэхнэ
          // (хөрөнгө тус бүрийн зураг шаардахаа больсон — backend мөн адил).
          // Хүчингүй болгоход зөвхөн ҮНДЭСЛЭЛИЙН файл хавсаргагдана.
          setSubModal({ action, note: "", file: null, report: null, photos: [] });
        }}
        onHistory={() => setSubHistoryOpen(true)}
      />

      {/* ҮНЭЛГЭЭНИЙ ФАЙЛУУД — тайлан ба эх хүснэгт нэг мөрөнд, татах товчтой.
          Тайланг ИЛГЭЭХ цонхноос хавсаргадаг тул энд зөвхөн ХАРАХ/ТАТАХ. */}
      {(reportDoc || legacyReportComp || sourceDoc) && (
        <div className="ap-card flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Үнэлгээний файлууд
          </span>
          {(reportDoc || legacyReportComp) && (
            <VFileChip
              label="Үнэлгээний тайлан"
              name={reportDoc?.name || legacyReportComp?.valuation_report_name}
              href={reportDoc?.file_url ?? legacyReportComp?.valuation_report_url}
              tone="emerald"
            />
          )}
          {sourceDoc && (
            <VFileChip
              label="Үнэлгээний хүснэгт"
              name={sourceDoc.name}
              href={sourceDoc.file_url}
            />
          )}
        </div>
      )}

      {activeSubTab === "independent" && (
        <div className="ap-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
                Хөндлөнгийн мэргэжлийн байгууллага
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Одоогийн холболт: {selectedIndependentOrgName}
              </p>
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
                    {valuationOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {valuationOrgLabel(org)}
                        {org.register_no ? ` · ${org.register_no}` : ""}
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
                      const label =
                        orgDisplayName(independentSelect) ||
                        "сонгосон байгууллага";
                      setPendingConfirm({
                        title: currentIndependentOrgId
                          ? "Хөндлөнгийн байгууллага солих"
                          : "Хөндлөнгийн байгууллага холбох",
                        description: currentIndependentOrgId
                          ? `Хөндлөнгийн үнэлгээг "${label}" байгууллагаар солих уу?`
                          : `Хөндлөнгийн үнэлгээг "${label}" байгууллагад холбох уу?`,
                        confirmLabel: currentIndependentOrgId
                          ? "Солих"
                          : "Холбох",
                        confirmColor: "#02c0ce",
                        onConfirm: () =>
                          independentOrgMutation.mutate(independentSelect),
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
                          description:
                            "Хөндлөнгийн үнэлгээний байгууллагын холболтыг салгах уу?",
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

      <div className="ap-card grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden dark:divide-[#37394d] sm:grid-cols-4 sm:divide-y-0">
        {summaryItems.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="flex min-w-0 items-center gap-3 px-4 py-3"
          >
            <Icon className="h-4 w-4 shrink-0 text-[#02c0ce]" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="truncate text-[14px] font-bold tabular-nums text-slate-800 dark:text-white">
                {money(value)}
              </p>
            </div>
          </div>
        ))}
        {/* НЭГТГЭЛ — хамгийн ард, бусдаас ялгарах өнгөтэй. */}
        <div className="flex min-w-0 items-center gap-3 bg-[#02c0ce]/8 px-4 py-3 dark:bg-[#02c0ce]/12">
          <CircleDollarSign className="h-4 w-4 shrink-0 text-[#02c0ce]" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#02c0ce]">
              Нэгдсэн дүн
            </p>
            <p className="truncate text-[15px] font-bold tabular-nums text-[#02c0ce]">
              {money(grandTotalValue)}
            </p>
          </div>
        </div>
      </div>

      {assetsLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
        </div>
      ) : (
        /* Үнэлгээний хүснэгтүүд — Excel оруулах цонхтой ИЖИЛ бүтэц, ижил компонент.
           Зүүн багана = хүснэгтүүд (тайлбар нь хүснэгт бүрийн доор), баруун багана =
           тоон мэдээлэл, үйлдэл, сонгосон хөрөнгийн дэлгэрэнгүй. */
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Хүснэгтүүд нь ЗӨВХӨН Excel-ийн дугаар/дарааллаар эрэмбэлэгдэнэ:
                оруулсан файлын `sort_order`-ийг ашиглана, байхгүй бол загварын
                өгөгдмөл (3.1 → 5.1) дараалал. */}
            {orderedSections([
              /* eslint-disable react/jsx-key -- key-г orderedSections Fragment дээр өгнө */
              ["land_legal", (
            /* Газрын эрх зүйн байдал */
            <VSection
              icon={ReceiptText}
              title={head("land_legal").title}
              tone="emerald"
              right={<VHeadRight label={head("land_legal").label} />}
            >
              <VKeyValueTable
                rows={[
                  ["Нэгж талбарын дугаар", effectiveParcelCode || parcelId],
                  [
                    "Гэрчилгээний дугаар",
                    canEditCurrent && landEditing ? (
                      <input
                        value={landValuationForm.ownership_cert_no}
                        onChange={(e) => {
                          setLandValuationEdited(true);
                          setLandValuationForm((f) => ({
                            ...f,
                            ownership_cert_no: e.target.value,
                          }));
                        }}
                        placeholder="Гэрчилгээний дугаар"
                        className={`${INP} w-48`}
                      />
                    ) : (
                      landValuation?.ownership_cert_no || "—"
                    ),
                  ],
                  [
                    "Нэгж талбарын нийт хэмжээ",
                    parcelData?.area_m2 ? formatArea(parcelData.area_m2) : "—",
                  ],
                  ["Чөлөөлөлтөнд өртсөн хэмжээ", lvArea ? formatArea(lvArea) : "—"],
                ]}
              />
              <VNote
                sectionKey="land_legal"
                value={noteOf("land_legal")}
                canEdit={canEditCurrent}
                saving={saveNoteMutation.isPending}
                onSave={(text) => saveNote("land_legal", text)}
              />
            </VSection>
              )],
              ["land_valuation", (
            /* Газрын үнэлгээ */
            <VSection
              icon={Calculator}
              title={head("land_valuation").title}
              tone="emerald"
              right={
                <VHeadRight
                  label={head("land_valuation").label}
                  extra={
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {money(landTotalValue)}
                    </span>
                  }
                />
              }
            >
              <VLandValuationTable
                total={lvTotal}
                areaCell={
                  canEditCurrent && landEditing ? (
                    <input
                      type="number"
                      value={landValuationForm.land_area_m2}
                      onChange={(e) => {
                        setLandValuationEdited(true);
                        setLandValuationForm((f) => ({ ...f, land_area_m2: e.target.value }));
                      }}
                      placeholder="0"
                      className={`${INP} w-32 text-right tabular-nums`}
                    />
                  ) : (
                    <span className="font-semibold">{lvArea ? lvArea.toLocaleString() : "—"}</span>
                  )
                }
                priceCell={
                  canEditCurrent && landEditing ? (
                    <input
                      type="number"
                      value={landValuationForm.base_price_per_m2}
                      onChange={(e) => {
                        setLandValuationEdited(true);
                        setLandValuationForm((f) => ({ ...f, base_price_per_m2: e.target.value }));
                      }}
                      placeholder="0"
                      className={`${INP} w-32 text-right tabular-nums`}
                    />
                  ) : (
                    <span className="font-semibold">{lvPrice ? lvPrice.toLocaleString() : "—"}</span>
                  )
                }
              />
              {canEditCurrent && (
                <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-[#37394d]">
                  {landEditing ? (
                    <>
                      <button
                        onClick={() => {
                          setLandEditing(false);
                          setLandValuationEdited(false);
                          setLandValuationForm({
                            land_area_m2: landValuation?.land_area_m2 ? String(landValuation.land_area_m2) : "",
                            base_price_per_m2: landValuation?.base_price_per_m2
                              ? String(landValuation.base_price_per_m2)
                              : "",
                            ownership_cert_no: landValuation?.ownership_cert_no ?? "",
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
                        className="inline-flex h-8 items-center rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
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
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-[12px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Устгах
                        </button>
                      )}
                      <button
                        onClick={() => setLandEditing(true)}
                        className="inline-flex h-8 items-center rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90"
                      >
                        Засах
                      </button>
                    </>
                  )}
                </div>
              )}
              <VNote
                sectionKey="land_valuation"
                value={noteOf("land_valuation")}
                canEdit={canEditCurrent}
                saving={saveNoteMutation.isPending}
                onSave={(text) => saveNote("land_valuation", text)}
              />
            </VSection>
              )],
              ["property_desc", (
            /* Хөрөнгийн тодорхойлолт — мөр дээр дарж баруун талд дэлгэрэнгүйг харна */
            <VSection
              icon={Boxes}
              title={head("property_desc").title}
              tone="sky"
              right={
                <VHeadRight
                  label={head("property_desc").label}
                  extra={
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400">{parcelAssets.length} хөрөнгө</span>
                      {canEditCurrent && parcelAssets.length > 0 && (
                        <button
                          onClick={() => {
                            // Маягтыг цэвэрлэж нээнэ — сонгосон мөр байвал тэр
                            // хөрөнгийг урьдчилан сонгоно.
                            setValuationForm(EMPTY_VALUATION);
                            setCompModal({
                              assetId: selectedAssetRow?.asset.id ?? parcelAssets[0].id,
                            });
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#02c0ce]/40 bg-[#02c0ce]/5 px-2.5 text-[11px] font-semibold text-[#02c0ce] hover:bg-[#02c0ce]/10"
                        >
                          <Plus className="h-3 w-3" /> Үнэлгээ нэмэх
                        </button>
                      )}
                    </span>
                  }
                />
              }
            >
              <VAssetsTable
                rows={assetTableRows}
                activeId={expandedAssetId}
                onRowClick={(row) => openAsset(row.id)}
                // ЗАСАХ товч нь зөвхөн ИЛГЭЭГЭЭГҮЙ/БУЦААГДСАН төлөвт гарна:
                // илгээсэн үнэлгээг санхүү хянаж байгаа тул тоо өөрчлөгдөж
                // болохгүй (backend мөн ижил дүрмээр хаана).
                renderActions={
                  canEditCurrent
                    ? (row) => (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAsset(row.id, true);
                          }}
                          title="Засах"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#02c0ce] dark:text-slate-400 dark:hover:bg-[#252630]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )
                    : undefined
                }
              />
              <VNote
                sectionKey="property_desc"
                value={noteOf("property_desc")}
                canEdit={canEditCurrent}
                saving={saveNoteMutation.isPending}
                onSave={(text) => saveNote("property_desc", text)}
              />
            </VSection>
              )],
              ["building_spec", (
            /* Барилгын тодорхойлолт (asset_spec) */
            realStateRows.length > 0 && (
              <BuildingSpecSection
                acqId={acqId}
                assets={realStateRows.map((r) => r.asset)}
                listSpecs={svc.listAssetSpecs}
                onEdit={canEditCurrent ? setSpecEditId : undefined}
                activeId={expandedAssetId}
                onSelect={(id) => setExpandedAssetId(expandedAssetId === id ? null : id)}
                title={head("building_spec").title}
                label={head("building_spec").label}
                note={
                  <VNote
                    sectionKey="building_spec"
                    value={noteOf("building_spec")}
                    canEdit={canEditCurrent}
                    saving={saveNoteMutation.isPending}
                    onSave={(text) => saveNote("building_spec", text)}
                  />
                }
              />
            )
              )],
              ["building_cost", (
            /* Барилгын өртгийн хандлага (asset_calculation) */
            realStateRows.length > 0 && (
              <BuildingCostSection
                acqId={acqId}
                assets={realStateRows.map((r) => r.asset)}
                listCalcs={svc.listAssetCalculations}
                onEdit={canEditCurrent ? setCostEditId : undefined}
                activeId={expandedAssetId}
                onSelect={(id) => setExpandedAssetId(expandedAssetId === id ? null : id)}
                title={head("building_cost").title}
                label={head("building_cost").label}
                note={
                  <VNote
                    sectionKey="building_cost"
                    value={noteOf("building_cost")}
                    canEdit={canEditCurrent}
                    saving={saveNoteMutation.isPending}
                    onSave={(text) => saveNote("building_cost", text)}
                  />
                }
              />
            )
              )],
              /* Бусад эд хөрөнгө ба зардлын хүснэгтүүд (Excel-ийн 3.6–3.9) */
            ...costSections.map(({ key, title, rows }): [ValuationSectionKey, ReactNode] => [
              key,
              rows.length === 0 && !noteOf(key) && !canEditCurrent ? null : (
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
                          {money(sumCompensations(rows.flatMap((r) => r.compensations)))}
                        </span>
                      }
                    />
                  }
                >
                  <VCostTable
                    rows={rows.map((r) => ({
                      id: r.asset.id,
                      name: r.asset.asset_name || "—",
                      unit: r.asset.unit,
                      qty: r.asset.area_m2 || null,
                      unitPrice: r.asset.unit_price || null,
                      total: r.total,
                    }))}
                    activeId={expandedAssetId}
                    onRowClick={(row) => openAsset(row.id)}
                    renderActions={
                      canEditCurrent
                        ? (row) => (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAsset(row.id, true);
                              }}
                              title="Засах"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#02c0ce] dark:text-slate-400 dark:hover:bg-[#252630]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )
                        : undefined
                    }
                  />
                  <VNote
                    sectionKey={key}
                    value={noteOf(key)}
                    canEdit={canEditCurrent}
                    saving={saveNoteMutation.isPending}
                    onSave={(text) => saveNote(key, text)}
                  />
                </VSection>
              ),
            ]),
              ["summary", (
            /* Нэгтгэл */
            <ConsolidationCard
              rows={[
                { label: "Газрын үнэлгээ", value: landTotalValue },
                {
                  label: "Үл хөдлөх хөрөнгө",
                  value: sumCompensations(realStateRows.flatMap((r) => r.compensations)),
                },
                {
                  label: "Эд хөрөнгө, зардал",
                  value: sumCompensations(propertyRows.flatMap((r) => r.compensations)),
                },
              ]}
              total={grandTotalValue}
              title={head("summary").title}
              label={head("summary").label}
              note={
                <VNote
                  sectionKey="summary"
                  value={noteOf("summary")}
                  canEdit={canEditCurrent}
                  saving={saveNoteMutation.isPending}
                  onSave={(text) => saveNote("summary", text)}
                />
              }
            />
              )],
              ["certification", (
            /* Дүгнэлт, баталгаа — хүснэгтгүй, зөвхөн тайлбартай хэсгүүд */
            (canEditCurrent || noteOf("conclusion") || noteOf("certification")) && (
              <VSection icon={FileText} title="Дүгнэлт, үнэлгээний баталгаа" tone="slate">
                {(["conclusion", "certification"] as ValuationSectionKey[]).map((k) => (
                  <VNote
                    key={k}
                    sectionKey={k}
                    label={VALUATION_SECTION_LABELS[k]}
                    value={noteOf(k)}
                    canEdit={canEditCurrent}
                    saving={saveNoteMutation.isPending}
                    onSave={(text) => saveNote(k, text)}
                  />
                ))}
              </VSection>
            )
              )],
              /* eslint-enable react/jsx-key */
            ])}
          </div>
          {/* ── Баруун багана: тоон мэдээлэл, үйлдэл, дэлгэрэнгүй ── */}
          <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
            {/* АЖЛЫН ЗУРАГ — хээрийн ажлын зургууд баруун баганад. Зураг нь
                `/api/files/...` гарцаар (cookie-гоор эрх шалгагдана) тарагддаг
                тул <img> шууд ажиллана; дарвал бүтэн хэмжээгээр нээнэ. */}
            {workPhotoDocs.length > 0 && (
              <div className="ap-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#37394d]">
                  <Camera className="h-4 w-4 text-slate-400" />
                  <p className="text-[12px] font-semibold text-slate-700 dark:text-white">
                    Ажлын зураг
                  </p>
                  <span className="ml-auto text-[11px] tabular-nums text-slate-400">
                    {workPhotoDocs.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-3">
                  {workPhotoDocs.map((doc) => {
                    const isImage =
                      (doc.file_type ?? "").startsWith("image/") ||
                      /\.(jpe?g|png)$/i.test(doc.name ?? "");
                    return (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        title={doc.name}
                        className="group relative block h-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-[#252630]"
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={doc.file_url}
                            alt={doc.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                            <FileText className="h-5 w-5" />
                            <span className="px-1 text-[10px]">PDF</span>
                          </span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Үйлдэл — Excel импорт, хөрөнгө нэмэх (баруун баганад, босоо байрлалтай) */}
            <div className="ap-card overflow-hidden">
              <div className="flex flex-col gap-3 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-white">
                      Хөрөнгийн бүртгэл
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {effectiveParcelCode || parcelId} нэгж талбар
                    </p>
                  </div>
                </div>
                {canEditCurrent && (
                  <div className="flex flex-col gap-2 [&>*]:w-full [&_button]:w-full [&_button]:justify-center">
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
                      sourceDocTypeId={sourceDocType?.id}
                      onDone={() => {
                        queryClient.invalidateQueries({
                          queryKey: [
                            "parcel-assets",
                            acqId,
                            effectiveParcelCode,
                            activeType,
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "compensations",
                            acqId,
                            effectiveParcelCode,
                            activeType,
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "land-valuation",
                            acqId,
                            effectiveParcelCode,
                            activeType,
                          ],
                        });
                        queryClient.invalidateQueries({
                          queryKey: [
                            "valuation-notes",
                            acqId,
                            effectiveParcelCode,
                            activeType,
                          ],
                        });
                        // Эх Excel нь "Үнэлгээний хүснэгт" баримт болж орсон
                        queryClient.invalidateQueries({
                          queryKey: ["parcel-documents", parcelId],
                        });
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

            {selectedAssetRow ? (
              <VSection
                icon={Building2}
                title={selectedAssetRow.asset.asset_name || "Хөрөнгийн дэлгэрэнгүй"}
                tone="sky"
                right={
                  <button
                    onClick={() => setExpandedAssetId(null)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Хаах"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                }
              >
                {/* Хөрөнгийн мэдээлэл — АНХНААСАА зөвхөн ХАРАХ. Засах нь хүснэгтийн
                    арын баганын "Засах" товчоор нээгдэнэ. */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-[12px]">
                    {(
                      [
                        ["Нэр", selectedAssetRow.asset.asset_name || "—", true],
                        ["Төрөл", ASSET_TYPE_LABELS[selectedAssetRow.asset.asset_type], false],
                        ["Хэмжих нэгж", selectedAssetRow.asset.unit || "—", false],
                        ["Хүчин чадал", formatArea(selectedAssetRow.asset.area_m2), false],
                        [
                          "Нэгж үнэ",
                          selectedAssetRow.asset.unit_price
                            ? money(selectedAssetRow.asset.unit_price)
                            : "—",
                          false,
                        ],
                        ["Эзэмшигч", selectedAssetRow.asset.owner_name || "—", false],
                        ["Дугаар", selectedAssetRow.asset.asset_number || "—", false],
                      ] as [string, string, boolean][]
                    ).map(([label, value, wide]) => (
                      <div key={label} className={wide ? "col-span-2" : ""}>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                        <p className="text-slate-700 dark:text-slate-200">{value}</p>
                      </div>
                    ))}
                    {selectedAssetRow.asset.description && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          Тодорхойлолт
                        </p>
                        <p className="whitespace-pre-line text-slate-600 dark:text-slate-300">
                          {selectedAssetRow.asset.description}
                        </p>
                      </div>
                    )}
                    {canEditCurrent && (
                      <div className="col-span-2 flex justify-end">
                        <button
                          onClick={() => openAsset(selectedAssetRow.asset.id, true)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Засах
                        </button>
                      </div>
                    )}
                  </div>
                <VFootNote>
                  Нийт үнэлгээ:{" "}
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {money(selectedAssetRow.total)}
                  </span>
                </VFootNote>

                {/* Үнэлгээний задаргаа (нөхөн олговрууд) */}
                <div className="border-t border-slate-100 dark:border-[#37394d]">
                  {selectedAssetRow.compensations.length ? (
                    selectedAssetRow.compensations.map((comp) => (
                      <div
                        key={comp.id}
                        className="flex items-start justify-between gap-2 border-b border-slate-50 px-4 py-2.5 last:border-0 dark:border-[#37394d]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] text-slate-700 dark:text-slate-200">
                            {detailLabel(comp)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type} ·{" "}
                            {comp.coverage_percent}% ·{" "}
                            {comp.compensation_date ? formatDate(comp.compensation_date) : "—"}
                          </p>
                          <div className="mt-1">
                            <StatusBadge status={comp.status} />
                          </div>
                          {comp.review_note && (
                            <p
                              className={`mt-1 text-[10px] ${comp.status === "rejected" ? "text-red-500" : "text-emerald-600"}`}
                            >
                              {comp.review_note}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[12px] font-semibold tabular-nums text-slate-800 dark:text-white">
                            {money(comp.amount)}
                          </span>
                          <div className="inline-flex items-center gap-0.5">
                            {isFinance && comp.status === "pending" && (
                              <>
                                <button
                                  onClick={() => setApproveModal({ compId: comp.id, note: "" })}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                  title="Зөвшөөрөх"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setRejectModal({ compId: comp.id, note: "" })}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  title="Татгалзах"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openHistory(comp.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
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
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                title="Устгах"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-[12px] text-slate-400">
                      Үнэлгээний задаргаа бүртгэгдээгүй
                    </p>
                  )}
                </div>

              </VSection>
            ) : (
              <VSection icon={Building2} title="Хөрөнгийн дэлгэрэнгүй" tone="sky">
                <p className="px-4 py-4 text-[12px] text-slate-400">
                  Хүснэгтээс хөрөнгө сонгоход үнэлгээний задаргаа, зураг, үйлдлүүд энд харагдана.
                </p>
              </VSection>
            )}

            {/* Газрын олговор */}
            {landComps.length > 0 && (
              <VSection
                icon={ReceiptText}
                title="Газрын олговор"
                tone="emerald"
                right={
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {money(totals.landTotal)}
                  </span>
                }
              >
                {landComps.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between gap-2 border-b border-slate-50 px-4 py-2.5 text-[12px] last:border-0 dark:border-[#37394d]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-slate-700 dark:text-slate-200">{detailLabel(comp)}</p>
                      <p className="text-[10px] text-slate-400">
                        {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type} ·{" "}
                        {comp.coverage_percent}%
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-white">
                      {money(comp.amount)}
                    </span>
                  </div>
                ))}
              </VSection>
            )}

            {/* Үнэлгээний тайлангийн мэдээлэл (Excel-ээс импортолсон) */}
            {landValuation &&
              (landValuation.appraiser_org_name ||
                landValuation.ownership_cert_no ||
                landValuation.source_file_name) && (
                <VSection icon={FileText} title="Үнэлгээний тайлангийн мэдээлэл" tone="slate">
                  <div className="grid gap-1.5 px-4 py-3 text-[11px]">
                    {[
                      ["Үнэлгээний байгууллага", landValuation.appraiser_org_name],
                      ["Захирал", landValuation.appraiser_director],
                      ["Регистр", landValuation.appraiser_reg_no],
                      ["Тусгай зөвшөөрөл", landValuation.appraiser_license],
                      ["Холбоо барих", landValuation.appraiser_contact],
                    ]
                      .filter(([, v]) => !!v)
                      .map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-2">
                          <span className="text-slate-400">{label}</span>
                          <span className="truncate text-right text-slate-700 dark:text-slate-200" title={value as string}>
                            {value}
                          </span>
                        </div>
                      ))}
                  </div>
                  {/* ЭХ файл — татаж авах боломжтой (импортын үед хадгалагдсан
                      "Үнэлгээний хүснэгт" баримт). Хуучин өгөгдөлд зөвхөн НЭР
                      байгаа тул холбоосгүй чип болж харагдана. */}
                  {(sourceDoc || landValuation.source_file_name) && (
                    <div className="border-t border-slate-100 px-4 py-2.5 dark:border-[#37394d]">
                      <VFileChip
                        label="Эх файл"
                        name={sourceDoc?.name || landValuation.source_file_name}
                        href={sourceDoc?.file_url}
                      />
                    </div>
                  )}
                </VSection>
              )}
          </aside>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !createAssetMutation.isPending
            )
              closeAssetModal();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div>
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Хөрөнгө нэмэх
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Хөрөнгийн мэдээлэл болон үнэлгээний задаргааг хамт бүртгэнэ
                </p>
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
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Үндсэн мэдээлэл
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">
                    Хөрөнгийн төрөл
                  </p>
                  <select
                    value={form.asset_type}
                    onChange={(e) => {
                      const next = e.target.value as Asset["asset_type"];
                      // Үл хөдлөх рүү шилжихэд зардлын ангилал утгагүй болно
                      setForm((f) => ({
                        ...f,
                        asset_type: next,
                        cost_category: next === "property" ? f.cost_category : "",
                      }));
                    }}
                    className={INP}
                  >
                    <option value="real_state">Үл хөдлөх хөрөнгө</option>
                    <option value="property">Эд хөрөнгө</option>
                  </select>
                </div>
                {(
                  [
                    ["asset_number", "Дугаар", "text", "1"],
                    [
                      "asset_name",
                      "Үнэлж буй хөрөнгийн нэр",
                      "text",
                      "Амины орон сууц",
                    ],
                    ["unit", "Хэмжих нэгж", "text", "м², ширхэг..."],
                    ["capacity", "Хүчин чадал", "text", ""],
                    ["floor_count", "Давхрын тоо", "number", "2"],
                    ["area_m2", "Талбай (м²)", "number", "60"],
                    ["owner_name", "Эзэмшигч", "text", "Овог Нэр"],
                    ["address", "Хаяг", "text", "Хаяг..."],
                    ["notes", "Тайлбар", "text", "Тайлбар..."],
                  ] as [keyof typeof form, string, string, string][]
                ).map(([field, label, type, placeholder]) => (
                  <div key={field}>
                    <p className="mb-1 text-[11px] text-slate-400">{label}</p>
                    <input
                      type={type}
                      value={form[field] as string}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className={INP}
                    />
                  </div>
                ))}
                {form.asset_type === "property" && (
                  <div>
                    <p className="mb-1 text-[11px] text-slate-400">
                      Зардлын ангилал
                    </p>
                    <select
                      value={form.cost_category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cost_category: e.target.value }))
                      }
                      className={INP}
                    >
                      <option value="">Бусад эд хөрөнгө</option>
                      {V_COST_GROUPS.map((g) => (
                        <option key={g.key} value={g.title}>
                          {g.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-4">
                  <p className="mb-1 text-[11px] text-slate-400">
                    Үнэлж буй хөрөнгийн тодорхойлолт
                  </p>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
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
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Барилгын үзүүлэлт
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {specTypes.map((t) => (
                      <div key={t.id}>
                        <p className="mb-1 text-[11px] text-slate-400">
                          {t.name}
                        </p>
                        <input
                          type="text"
                          value={specValues[t.id] ?? ""}
                          onChange={(e) =>
                            setSpecValues((prev) => ({
                              ...prev,
                              [t.id]: e.target.value,
                            }))
                          }
                          className={INP}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Байгууламжийн өртгийн хандлагаарх тооцоолол — real_state type only */}
              {form.asset_type === "real_state" && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 text-sky-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Байгууламжийн өртгийн хандлагаарх тооцоолол
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-[#37394d] dark:bg-[#1a1d20]">
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Үзүүлэлт
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-28">
                            Хэмжих нэгж
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-40">
                            Утга
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
                        {/* Барилгын талбай — display only, from area_m2 */}
                        <tr>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            Барилгын талбай
                          </td>
                          <td className="px-3 py-2 text-slate-400">м²</td>
                          <td className="px-3 py-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                            {form.area_m2 || "—"}
                          </td>
                        </tr>
                        {calcTypes.map((t) => (
                          <tr key={t.id}>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                              {t.name}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={calcValues[t.id]?.unit ?? t.default_unit}
                                onChange={(e) =>
                                  setCalcValues((prev) => ({
                                    ...prev,
                                    [t.id]: {
                                      ...prev[t.id],
                                      unit: e.target.value,
                                    },
                                  }))
                                }
                                className={`${INP} text-[11px]`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={calcValues[t.id]?.value ?? ""}
                                onChange={(e) =>
                                  setCalcValues((prev) => ({
                                    ...prev,
                                    [t.id]: {
                                      ...prev[t.id],
                                      value: e.target.value,
                                    },
                                  }))
                                }
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
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between bg-slate-50/80 px-4 py-3 dark:bg-[#1a1d20]">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-slate-400" />
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                      Үнэлгээний задаргаа
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setModalValuations((rows) => [
                        ...rows,
                        { ...EMPTY_VALUATION },
                      ])
                    }
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
                        {[
                          "Үнэлсэн хэсэг",
                          "Хэлбэр",
                          "Хувь",
                          "Дүн",
                          "Огноо",
                          "",
                        ].map((head) => (
                          <th
                            key={head}
                            className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                          >
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
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, note: e.target.value }
                                      : item,
                                  ),
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
                                      ? {
                                          ...item,
                                          compensation_type: e.target
                                            .value as Compensation["compensation_type"],
                                        }
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
                                  rows.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          coverage_percent: e.target.value,
                                        }
                                      : item,
                                  ),
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
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, amount: e.target.value }
                                      : item,
                                  ),
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
                                  rows.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          compensation_date: e.target.value,
                                        }
                                      : item,
                                  ),
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
                                  rows.length === 1
                                    ? [{ ...EMPTY_VALUATION }]
                                    : rows.filter((_, i) => i !== index),
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
                onClick={() => createAssetMutation.mutate()}
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

      {/* Хөрөнгийн мэдээлэл ЗАСАХ попап — хүснэгтийн арын баганын товчоор нээгдэнэ. */}
      {assetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updateAssetMutation.isPending) setAssetModal(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <Pencil className="h-4.5 w-4.5 text-[#02c0ce]" />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Хөрөнгийн мэдээлэл засах
                </p>
              </div>
              <button
                onClick={() => setAssetModal(null)}
                disabled={updateAssetMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {(
                [
                  ["asset_name", "Нэр", "text"],
                  ["unit", "Хэмжих нэгж", "text"],
                  ["area_m2", "Хүчин чадал", "number"],
                  ["unit_price", "Нэгж үнэ", "number"],
                  ["owner_name", "Эзэмшигч", "text"],
                  ["asset_number", "Дугаар", "text"],
                ] as [keyof typeof assetEditForm, string, string][]
              ).map(([field, label, type]) => (
                <div key={String(field)} className={field === "asset_name" ? "col-span-2" : ""}>
                  <p className="mb-1 text-[11px] text-slate-400">{label}</p>
                  <input
                    type={type}
                    value={assetEditForm[field]}
                    onChange={(e) => setAssetEditForm((f) => ({ ...f, [field]: e.target.value }))}
                    className={`${INP} ${type === "number" ? "tabular-nums" : ""}`}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <p className="mb-1 text-[11px] text-slate-400">Тодорхойлолт</p>
                <textarea
                  value={assetEditForm.description}
                  onChange={(e) =>
                    setAssetEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className={`${INP} h-auto resize-none py-2`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() =>
                  setPendingConfirm({
                    title: "Хөрөнгө устгах уу?",
                    description: assetEditForm.asset_name || undefined,
                    confirmLabel: "Устгах",
                    confirmColor: "#f1556c",
                    onConfirm: () => {
                      deleteAssetMutation.mutate(assetModal);
                      setAssetModal(null);
                    },
                  })
                }
                disabled={updateAssetMutation.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-[13px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Устгах
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setAssetModal(null)}
                  disabled={updateAssetMutation.isPending}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                >
                  Болих
                </button>
                <button
                  onClick={() => updateAssetMutation.mutate()}
                  disabled={updateAssetMutation.isPending || !assetEditDirty}
                  className="inline-flex h-9 items-center rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Хүснэгт-5 (өртгийн тооцоолол) засах — утга солиход бүрэн/элэгдэл/нөхөн
          орлуулах өртөг ба хөрөнгийн олговрын дүн хамт дахин бодогдоно. */}
      {costEditId &&
        (() => {
          const row = realStateRows.find((r) => r.asset.id === costEditId);
          if (!row) return null;
          return (
            <BuildingCostEditModal
              acqId={acqId}
              asset={row.asset}
              calcTypes={calcTypes}
              compensations={row.compensations}
              parcelCode={effectiveParcelCode}
              valuationType={activeType}
              svc={svc}
              onClose={() => setCostEditId(null)}
              onSaved={invalidateValuationData}
            />
          );
        })()}

      {/* Хүснэгт-4 (барилгын тодорхойлолт) засах. */}
      {specEditId &&
        (() => {
          const row = realStateRows.find((r) => r.asset.id === specEditId);
          if (!row) return null;
          return (
            <BuildingSpecEditModal
              acqId={acqId}
              asset={row.asset}
              specTypes={specTypes}
              svc={svc}
              onClose={() => setSpecEditId(null)}
              onSaved={invalidateValuationData}
            />
          );
        })()}

      {/* Үнэлгээ (нөхөн олговор) нэмэх попап — ТУСДАА үйлдэл тул дэлгэрэнгүй
          самбарт биш, хүснэгтийн дээрх товчоор нээгдэнэ. */}
      {compModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createCompensationMutation.isPending)
              setCompModal(null);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-[#02c0ce]" />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Үнэлгээ нэмэх
                </p>
              </div>
              <button
                onClick={() => setCompModal(null)}
                disabled={createCompensationMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <div>
                <p className="mb-1 text-[11px] text-slate-400">Хөрөнгө</p>
                <select
                  value={compModal.assetId}
                  onChange={(e) => setCompModal({ assetId: e.target.value })}
                  className={INP}
                >
                  {parcelAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_name || ASSET_TYPE_LABELS[a.asset_type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-slate-400">Үнэлсэн хэсэг</p>
                <input
                  value={valuationForm.note}
                  onChange={(e) => setValuationForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Жишээ: Барилгын нөхөн орлуулах өртөг"
                  className={INP}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Хэлбэр</p>
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
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Хувь</p>
                  <input
                    value={valuationForm.coverage_percent}
                    onChange={(e) =>
                      setValuationForm((prev) => ({ ...prev, coverage_percent: e.target.value }))
                    }
                    type="number"
                    placeholder="100"
                    className={`${INP} tabular-nums`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Дүн (₮)</p>
                  <input
                    value={valuationForm.amount}
                    onChange={(e) =>
                      setValuationForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    type="number"
                    placeholder="0"
                    className={`${INP} tabular-nums`}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Огноо</p>
                  <input
                    value={valuationForm.compensation_date}
                    onChange={(e) =>
                      setValuationForm((prev) => ({
                        ...prev,
                        compensation_date: e.target.value,
                      }))
                    }
                    type="date"
                    className={INP}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() => setCompModal(null)}
                disabled={createCompensationMutation.isPending}
                className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={() => createCompensationMutation.mutate(compModal.assetId)}
                disabled={createCompensationMutation.isPending || !Number(valuationForm.amount)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Нэмэх
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
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Үнэлгээ зөвшөөрөх
                </p>
              </div>
              <button
                onClick={() => setApproveModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="mb-2 text-[11px] text-slate-400">
                Шалгасан тайлбар
              </p>
              <textarea
                value={approveModal.note}
                onChange={(e) =>
                  setApproveModal((prev) =>
                    prev ? { ...prev, note: e.target.value } : null,
                  )
                }
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
                onClick={() =>
                  approveCompMutation.mutate({
                    compId: approveModal.compId,
                    note: approveModal.note,
                  })
                }
                disabled={approveCompMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approveCompMutation.isPending && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
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
              <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                Үнэлгээ татгалзах
              </p>
              <button
                onClick={() => setRejectModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="mb-2 text-[11px] text-slate-400">
                Татгалзах шалтгаан (заавал биш)
              </p>
              <textarea
                value={rejectModal.note}
                onChange={(e) =>
                  setRejectModal((prev) =>
                    prev ? { ...prev, note: e.target.value } : null,
                  )
                }
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
                onClick={() =>
                  rejectCompMutation.mutate({
                    compId: rejectModal.compId,
                    note: rejectModal.note,
                  })
                }
                disabled={rejectCompMutation.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectCompMutation.isPending && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
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
                <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                  Татгалзсан түүх
                </p>
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
                <p className="py-8 text-center text-[13px] text-slate-400">
                  Татгалзсан түүх байхгүй
                </p>
              ) : (
                <div className="space-y-3">
                  {historyModal.list.map((h) => {
                    const isApproved = h.status === "approved";
                    return (
                      <div
                        key={h.id}
                        className={`rounded-lg border p-4 ${isApproved ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "border-red-100 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5"}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isApproved ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={`text-[12px] font-semibold ${isApproved ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                            >
                              {isApproved ? "Зөвшөөрсөн" : "Татгалзсан"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {h.reviewed_at
                              ? formatDate(h.reviewed_at)
                              : formatDate(h.archived_at)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[12px]">
                          <div>
                            <p className="text-slate-400">Дүн</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {money(h.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Хэлбэр</p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {COMP_TYPE_LABELS[
                                h.compensation_type as Compensation["compensation_type"]
                              ] ?? h.compensation_type}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Хувь</p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {h.coverage_percent}%
                            </p>
                          </div>
                        </div>
                        {h.review_note && (
                          <div className="mt-2 rounded-md bg-red-100 px-3 py-2 dark:bg-red-500/10">
                            <p className="text-[11px] text-slate-400">
                              Татгалзсан шалтгаан:
                            </p>
                            <p className="text-[12px] text-red-700 dark:text-red-400">
                              {h.review_note}
                            </p>
                          </div>
                        )}
                        {h.reviewed_by && (
                          <p className="mt-1.5 text-[10px] text-slate-400">
                            Хянасан: {h.reviewed_by}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
          file={subModal.file}
          submitFiles={{
            report: subModal.report ?? null,
            photos: subModal.photos ?? [],
            hasReport: !!reportDoc,
            hasPhotos: workPhotoDocs.length > 0,
          }}
          pending={transitionMutation.isPending}
          onNote={(v) => setSubModal((m) => (m ? { ...m, note: v } : m))}
          onFile={(f) => setSubModal((m) => (m ? { ...m, file: f } : m))}
          onSubmitFiles={(patch) => setSubModal((m) => (m ? { ...m, ...patch } : m))}
          onConfirm={() =>
            transitionMutation.mutate({
              action: subModal.action,
              note: subModal.note,
              file: subModal.file,
              report: subModal.report,
              photos: subModal.photos,
            })
          }
          onClose={() => setSubModal(null)}
        />
      )}

      {subHistoryOpen && (
        <ValuationHistoryModal
          loader={() =>
            svc.listValuationSubmissionHistory(acqId, parcelId, activeType)
          }
          snapshotLoader={() =>
            svc.listValuationSnapshots(acqId, parcelId, activeType)
          }
          calcTypes={calcTypes}
          // ОДООГИЙН урсгалын файлуудыг түүх рүү ДАМЖУУЛАХГҮЙ: хүчингүй болсон
          // үнэлгээний "Дэлгэрэнгүй" нь зөвхөн ТУХАЙН үнэлгээний файлыг
          // (snapshot дээр хуулагдсан тайлан/эх Excel) харуулна. Одоогийн
          // тайлан/хүснэгт нь энэ табын "Тайлан" мөр болон Баримт бичиг
          // хэсгээс татагдана.
          onClose={() => setSubHistoryOpen(false)}
        />
      )}
    </div>
  );
}
