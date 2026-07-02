"use client";
import { Fragment, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi, assetSpecTypeApi, assetCalcTypeApi } from "@/lib/api";
import { profApi } from "@/lib/prof-api";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";
import { type Asset, type Compensation, type CompensationHistory, type LandValuation, type ParcelFull, type User } from "@/types";
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
} from "lucide-react";
import { toast } from "sonner";
import { COMP_TYPE_LABELS, ASSET_TYPE_LABELS, INP } from "./constants";
import type { AssetSpecType, AssetCalcType } from "@/types";
import {
  canEditValuationSubTab,
  canViewValuationSubTab,
  isExternalSpecialRole,
  isFinanceSpecialist,
  isProfessionalOrg,
} from "@/lib/role-utils";
import type { ValuationSubTabKey } from "@/lib/access-policy";
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
        getAssets: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string }) =>
          profApi.profListAssets(a, params),
        listCompensations: (a: string, p?: string) => profApi.profListCompensations(a, p),
        getLandValuation: (a: string, p: string) => profApi.profGetLandValuation(a, p),
        upsertLandValuation: (a: string, body: { parcel_id: string; land_area_m2: number; base_price_per_m2: number }) =>
          profApi.profUpsertLandValuation(a, body),
        createAsset: (a: string, body: Partial<Asset>) => profApi.profCreateAsset(a, body),
        upsertAssetSpecs: (a: string, id: string, specs: { spec_type_id: number; value: string }[]) =>
          profApi.profUpsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (a: string, id: string, calcs: { calc_type_id: number; unit: string; value: number }[]) =>
          profApi.profUpsertAssetCalculations(a, id, calcs),
        createCompensation: (a: string, body: Partial<Compensation>) => profApi.profCreateCompensation(a, body),
        deleteAsset: (a: string, id: string) => profApi.profDeleteAsset(a, id),
        deleteCompensation: (a: string, id: string) => profApi.profDeleteCompensation(a, id),
        listCompensationHistory: (a: string, id: string) => profApi.profListCompensationHistory(a, id),
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
        getAssets: (a: string, params?: { page?: number; page_size?: number; parcel_id?: string }) =>
          landApi.getAssets(a, params),
        listCompensations: (a: string, p?: string) => landApi.listCompensations(a, p),
        getLandValuation: (a: string, p: string) => landApi.getLandValuation(a, p),
        upsertLandValuation: (a: string, body: { parcel_id: string; land_area_m2: number; base_price_per_m2: number }) =>
          landApi.upsertLandValuation(a, body),
        createAsset: (a: string, body: Partial<Asset>) => landApi.createAsset(a, body),
        upsertAssetSpecs: (a: string, id: string, specs: { spec_type_id: number; value: string }[]) =>
          landApi.upsertAssetSpecs(a, id, specs),
        upsertAssetCalculations: (a: string, id: string, calcs: { calc_type_id: number; unit: string; value: number }[]) =>
          landApi.upsertAssetCalculations(a, id, calcs),
        createCompensation: (a: string, body: Partial<Compensation>) => landApi.createCompensation(a, body),
        deleteAsset: (a: string, id: string) => landApi.deleteAsset(a, id).then(() => undefined),
        deleteCompensation: (a: string, id: string) => landApi.deleteCompensation(a, id).then(() => undefined),
        listCompensationHistory: (a: string, id: string) => landApi.listCompensationHistory(a, id),
        setParcelIndependentOrg: (a: string, p: string, u: string | null) =>
          landApi.setParcelIndependentOrg(a, p, u),
        uploadDocument: (p: string, file: File, docTypeId?: number, name?: string) =>
          parcelApi.uploadDocument(p, file, docTypeId, name),
      };
  const [subTab, setSubTab] = useState<ValuationSubTabKey>("asset");
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
  const [rejectModal, setRejectModal] = useState<{ compId: string; note: string } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ compId: string; list: CompensationHistory[] } | null>(null);
  const [independentSelect, setIndependentSelect] = useState("");
  const [assignedIndependentOrg, setAssignedIndependentOrg] = useState<{ id: string; name?: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

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

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ["parcel-assets", acqId, effectiveParcelCode],
    queryFn: () => svc.getAssets(acqId, { page: 1, page_size: 1000, parcel_id: effectiveParcelCode }),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: allComps = [] } = useQuery({
    queryKey: ["compensations", acqId, effectiveParcelCode],
    queryFn: () => svc.listCompensations(acqId, effectiveParcelCode),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const { data: landValuation } = useQuery<LandValuation | null>({
    queryKey: ["land-valuation", acqId, effectiveParcelCode],
    queryFn: () => svc.getLandValuation(acqId, effectiveParcelCode),
    enabled: !!acqId && !!effectiveParcelCode,
  });

  const upsertLandValuationMutation = useMutation({
    mutationFn: () =>
      svc.upsertLandValuation(acqId, {
        parcel_id: effectiveParcelCode,
        land_area_m2: Number(landValuationForm.land_area_m2) || 0,
        base_price_per_m2: Number(landValuationForm.base_price_per_m2) || 0,
      }),
    onSuccess: () => {
      toast.success("Газрын үнэлгээ хадгалагдлаа");
      queryClient.invalidateQueries({ queryKey: ["land-valuation", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Газрын үнэлгээ хадгалахад алдаа гарлаа")),
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
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Хөрөнгө нэмэхэд алдаа гарлаа")),
  });

  const createCompensationMutation = useMutation({
    mutationFn: (assetId: string) =>
      svc.createCompensation(acqId, {
        target_type: "asset",
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
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Үнэлгээ нэмэхэд алдаа гарлаа")),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) => svc.deleteAsset(acqId, assetId),
    onSuccess: () => {
      toast.success("Хөрөнгө устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["parcel-assets", acqId, effectiveParcelCode] });
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const deleteCompensationMutation = useMutation({
    mutationFn: (compId: string) => svc.deleteCompensation(acqId, compId),
    onSuccess: () => {
      toast.success("Үнэлгээ устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Үнэлгээ устгахад алдаа гарлаа")),
  });

  const approveCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.approveCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ зөвшөөрөгдлөө");
      setApproveModal(null);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
    },
    onError: (err) => toast.error(getApiError(err, "Зөвшөөрөхөд алдаа гарлаа")),
  });

  const rejectCompMutation = useMutation({
    mutationFn: ({ compId, note }: { compId: string; note: string }) =>
      landApi.rejectCompensation(acqId, compId, note),
    onSuccess: () => {
      toast.success("Үнэлгээ татгалзагдлаа");
      setRejectModal(null);
      queryClient.invalidateQueries({ queryKey: ["compensations", acqId, effectiveParcelCode] });
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
  const landComps = parcelValuations(allComps, effectiveParcelCode);
  const realStateRows = assetValuationRows(parcelAssets, allComps, "real_state");
  const propertyRows = assetValuationRows(parcelAssets, allComps, "property");
  const totals = valuationTotals(parcelAssets, allComps, effectiveParcelCode);

  const lvArea = Number(landValuationForm.land_area_m2) || 0;
  const lvPrice = Number(landValuationForm.base_price_per_m2) || 0;
  const lvTotal = lvArea * lvPrice;

  const subTabs: { key: ValuationSubTabKey; label: string; description: string }[] = [
    { key: "asset", label: "Хөрөнгийн үнэлгээ", description: "Үндсэн мэргэжлийн байгууллагын үнэлгээ" },
    { key: "independent", label: "Хөндлөнгийн үнэлгээ", description: "Нэгж талбарт холбосон байгууллагын үнэлгээ" },
    { key: "mika", label: "МИКА", description: "МИКА хяналт, санхүүгийн баталгаажуулалт" },
  ];
  const visibleSubTabs = isExternal
    ? subTabs.filter((item) => canViewValuationSubTab(item.key, parcelData, acquisition))
    : subTabs;
  const activeSubTab = visibleSubTabs.some((item) => item.key === subTab)
    ? subTab
    : visibleSubTabs[0]?.key ?? "asset";
  const canEditCurrent = !isLocked && canEditValuationSubTab(activeSubTab, parcelData, acquisition);
  const orgDisplayName = (id: string) => orgUserName(professionalOrgUsers.find((x) => x.id === id));
  const currentIndependentOrgId = assignedIndependentOrg?.id || parcelData?.independent_org_id || "";
  const selectedIndependentOrgName =
    assignedIndependentOrg?.name ||
    parcelData?.independent_org_name ||
    orgDisplayName(currentIndependentOrgId) ||
    "—";
  const summaryItems: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Газрын үнэлгээ", value: totals.landTotal, Icon: Calculator },
    { label: "Хөрөнгийн үнэлгээ", value: totals.assetTotal, Icon: Building2 },
    { label: "Нэгдсэн дүн", value: totals.total, Icon: CircleDollarSign },
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
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                            >
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              Дэлгэрэнгүй
                            </button>
                            {activeSubTab !== "mika" && canEditCurrent && (
                              <button
                                onClick={() => {
                                  if (confirm("Хөрөнгө устгах уу?")) deleteAssetMutation.mutate(asset.id);
                                }}
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
                                                onClick={() => {
                                                  if (confirm("Үнэлгээ устгах уу?")) deleteCompensationMutation.mutate(comp.id);
                                                }}
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

                              {activeSubTab !== "mika" && canEditCurrent && (
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
        {visibleSubTabs.map((item) => {
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

      {activeSubTab === "independent" && (
        <div className="ap-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Хөндлөнгийн мэргэжлийн байгууллага</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Одоогийн холболт: {selectedIndependentOrgName}</p>
            </div>
            {!isExternal && (
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
          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">{money(lvTotal || totals.landTotal)}</p>
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
                  {canEditCurrent ? (
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
                  {canEditCurrent ? (
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
        {canEditCurrent && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#37394d]">
            <button
              onClick={() => upsertLandValuationMutation.mutate()}
              disabled={upsertLandValuationMutation.isPending || (!lvArea && !lvPrice)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
            >
              Хадгалах
            </button>
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

      <div className="ap-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Хөрөнгийн бүртгэл</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{effectiveParcelCode || parcelId} нэгж талбар</p>
            </div>
          </div>
          {activeSubTab !== "mika" && canEditCurrent && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Хөрөнгө нэмэх
            </button>
          )}
        </div>
      </div>

      {assetsLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
          <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#252630]" />
        </div>
      ) : (
        <>
          {renderAssetTable("Үл хөдлөх хөрөнгийн үнэлгээ", realStateRows, "Үл хөдлөх хөрөнгө бүртгэгдээгүй", REAL_ESTATE_TONE)}
          {renderAssetTable("Эд хөрөнгийн үнэлгээ", propertyRows, "Эд хөрөнгө бүртгэгдээгүй", PROPERTY_TONE)}
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
    </div>
  );
}
