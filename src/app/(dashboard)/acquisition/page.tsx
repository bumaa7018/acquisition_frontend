"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, authApi } from "@/lib/api";
import { STATUS_LABELS, ACQ_STATUS } from "@/types";
import type { Plan, LandAcquisition } from "@/types";
import { formatDate, formatArea, getApiError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Search,
  Trash2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  X,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: "#02c0ce", bg: "#02c0ce18" },
  2: { color: "#0acf97", bg: "#0acf9718" },
  3: { color: "#8391a2", bg: "#8391a218" },
  4: { color: "#f1556c", bg: "#f1556c18" },
};

const PAGE_SIZE = 15;

import { hasPermission, hasRole, isProfessionalOrg, isExternalSpecialRole, getCurrentUserId } from "@/lib/role-utils";
import { UserSelect as EmployeeSelect } from "@/components/ui/user-select";
import { PlanSelect } from "../parcel/_components/plan_select";
import { AcquisitionSelect } from "../parcel/_components/acquisition_select";
import { PlanCodeSearch, PlanBoundaryPreview, planHasBoundary } from "@/components/ui/plan-code-search";

// ── Create Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
}

function CreateModal({ onClose }: CreateModalProps) {
  const queryClient = useQueryClient();

  // Step 1: plan select
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2: form fields
  const [projectName, setProjectName] = useState("");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [implementingOrg, setImplementingOrg] = useState("");
  const [reason, setReason] = useState("");
  const [responsibleOrg, setResponsibleOrg] = useState("");
  const [generalCategoryId, setGeneralCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);

  const { data: generalCategories = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
  });
  const { data: subCategories = [] } = useQuery({
    queryKey: ["acquisition-categories", generalCategoryId],
    queryFn: () => landApi.listCategories(generalCategoryId!),
    enabled: !!generalCategoryId,
    staleTime: Infinity,
  });

  const createMutation = useMutation({
    // Санхүүгийн эх үүсвэр энд бүртгэгдэхээ больсон — захирамжийн төсөлд нэгж
    // талбар холбоход сонгосон эх үүсвэрээр backend өөрөө хадгална.
    mutationFn: (fd: FormData) => landApi.create(fd),
    onSuccess: (acq) => {
      toast.success("Чөлөөлөлт амжилттай бүртгэгдлээ");
      if (acq.aus?.length) {
        const auNames = acq.aus.map((a) => a.au3_code).join(", ");
        toast.info(`Огтлолцох баг: ${auNames}`);
      }
      queryClient.invalidateQueries({ queryKey: ["land"] });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Бүртгэх үед алдаа гарлаа")),
  });

  const handleSubmit = () => {
    // Төлөвлөгөө ОЛДООГҮЙ бол чөлөөлөлт үүсгэхгүй (1-р алхмын хамгаалалт).
    // Backend руу ЗӨВХӨН нэгж талбарын дугаарыг явуулна — төлөвлөгөөг тэндээс
    // нь хайж олоод, шалгаж, чөлөөлөлттэй холбох ажлыг backend хийнэ.
    const planParcelId = plan?.parcel_id || "";
    if (!plan || !planParcelId) {
      toast.error("Газар зохион байгуулалтын төлөвлөгөөг нэгж талбарын дугаараар хайж олно уу");
      setStep(1);
      return;
    }
    if (!startDate || !projectName.trim()) {
      toast.error("Бүх заавал талбаруудыг бөглөнө үү");
      return;
    }
    // Чөлөөлөлтийн хил нь ТӨЛӨВЛӨГӨӨНИЙ хилээс хуулагдана — хилгүй
    // төлөвлөгөөгөөр цааш үргэлжлэх боломжгүй (backend ч 422 буцаана).
    if (!planHasBoundary(plan)) {
      toast.error("Төлөвлөгөөнд хил бүртгэгдээгүй тул чөлөөлөлт үүсгэх боломжгүй");
      setStep(1);
      return;
    }
    if (!generalCategoryId) {
      toast.error("Ерөнхий ангилал сонгоно уу");
      return;
    }
    if (!subCategoryId) {
      toast.error("Дэд ангилал сонгоно уу");
      return;
    }
    const fd = new FormData();
    fd.append("plan_parcel_id", planParcelId);
    fd.append("start_date", startDate);
    fd.append("acquisition_name", projectName);
    fd.append("implementing_org", implementingOrg);
    fd.append("reason", reason);
    fd.append("responsible_org", responsibleOrg);
    if (generalCategoryId)
      fd.append("general_category_id", String(generalCategoryId));
    if (subCategoryId)
      fd.append("sub_category_id", String(subCategoryId));
    createMutation.mutate(fd);
  };

  const inputCls =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const labelCls =
    "block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1e1f27] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={() => {
                  setStep(1);
                  setPlan(null);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-[15px] font-bold text-slate-800 dark:text-white">
                Газар чөлөөлөлт нэмэх
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {step === 1
                  ? "Алхам 1/2 — Төлөвлөгөө хайх"
                  : "Алхам 2/2 — Мэдээлэл бөглөх"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: step >= s ? "#02c0ce" : "#e2e8f0" }}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Газар зохион байгуулалтын төлөвлөгөөний нэгж талбарын дугаарыг оруулж хайна уу.
                Чөлөөлөлтийн хил нь олдсон төлөвлөгөөний хилээс хуулагдана.
              </p>
              <div>
                <label className={labelCls}>Төлөвлөгөөний нэгж талбарын дугаар *</label>
                <PlanCodeSearch
                  plan={plan}
                  onFound={setPlan}
                  onReset={() => setPlan(null)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => plan && planHasBoundary(plan) && setStep(2)}
                  disabled={!plan || !planHasBoundary(plan)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[13px] font-semibold text-white hover:bg-[#02aebb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    !plan
                      ? "Эхлээд төлөвлөгөө хайж олно уу"
                      : !planHasBoundary(plan)
                        ? "Төлөвлөгөөнд хил бүртгэгдээгүй тул үргэлжлүүлэх боломжгүй"
                        : undefined
                  }
                >

                  Үргэлжлүүлэх
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plan info card */}
              {plan && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#02c0ce]/8 dark:bg-[#02c0ce]/10 border border-solid border-[#02c0ce]/20">
                  <CheckCircle className="h-4 w-4 text-[#02c0ce] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-mono font-semibold text-[#02c0ce]">
                      {plan.parcel_id || plan.plan_code}
                    </p>
                    {plan.name && (
                      <p className="text-[12px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                        {plan.name}
                      </p>
                    )}
                    {(plan.area_m2 ?? 0) > 0 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatArea(plan.area_m2 ?? 0)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Бүртгэхийн ӨМНӨХ шалгалт: чөлөөлөлтийн хил болох
                  төлөвлөгөөний хил (1-р алхамтай ижил геометр). */}
              {plan && <PlanBoundaryPreview plan={plan} height={160} />}

              {/* Form fields */}
              <div>
                <label className={labelCls}>Чөлөөлөлтийн нэр *</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Чөлөөлөлтийн нэр оруулна уу"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelCls}>Ерөнхий ангилал *</label>
                <select
                  value={generalCategoryId ?? ""}
                  onChange={(e) => {
                    setGeneralCategoryId(e.target.value ? Number(e.target.value) : null);
                    setSubCategoryId(null);
                  }}
                  className={inputCls}
                >
                  <option value="">— Сонгоно уу —</option>
                  {generalCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Дэд ангилал *</label>
                <select
                  value={subCategoryId ?? ""}
                  onChange={(e) =>
                    setSubCategoryId(e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={!generalCategoryId}
                  className={inputCls + (!generalCategoryId ? " opacity-50 cursor-not-allowed" : "")}
                >
                  <option value="">
                    {generalCategoryId ? "— Сонгоно уу —" : "— Эхлээд ерөнхий ангилал сонгоно уу —"}
                  </option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Эхлэх огноо *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Хэрэгжүүлэгч байгууллага</label>
                <input
                  value={implementingOrg}
                  onChange={(e) => setImplementingOrg(e.target.value)}
                  placeholder="Байгууллагын нэр"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Хариуцах байгууллага</label>
                <input
                  value={responsibleOrg}
                  onChange={(e) => setResponsibleOrg(e.target.value)}
                  placeholder="Байгууллагын нэр"
                  className={inputCls}
                />
              </div>

              {/* Санхүүжилтийн эх үүсвэрийг ЭНД асуухгүй: захирамжийн төсөлд
                  нэгж талбар холбоход сонгосон эх үүсвэрээр чөлөөлөлтийн
                  санхүүжилт бүрдэж, шинэчлэгдэж хадгалагдана. */}

              <div>
                <label className={labelCls}>Чөлөөлөх шалтгаан</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Чөлөөлөх шалтгааны тайлбар..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
                />
              </div>

              {/* Чөлөөлөлтийн ХИЛ — гараас оруулахгүй, төлөвлөгөөнөөс хуулагдана */}
              <div className="flex items-start gap-2 rounded-lg border border-[#02c0ce]/20 bg-[#02c0ce]/8 dark:bg-[#02c0ce]/10 px-3 py-2.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#02c0ce]" />
                <p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Чөлөөлөлтийн хилийг{" "}
                  <span className="font-semibold text-[#02c0ce]">
                    төлөвлөгөөний хилээс автоматаар
                  </span>{" "}
                  хуулж авна. Талбайн хэмжээ мөн тэр хилээс тооцогдоно.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            Цуцлах
          </button>
          {step === 1 ? null : (
            <button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                !startDate ||
                !projectName.trim()
              }
              className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {createMutation.isPending && (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Бүртгэх
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_DRAFT = {
  planCode: "",
  acqId: "",
  acqName: "",
  status: 0,
  genCat: 0,
  subCat: 0,
  employeeId: "",
  employeeName: "",
  year: 0,
};
type AcqDraft = typeof EMPTY_DRAFT;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 + 1 }, (_, i) => CURRENT_YEAR - i);

export default function LandPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<AcqDraft>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<AcqDraft>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const queryClient = useQueryClient();

  const canCreate = hasPermission("land:create") && hasRole("admin", "senior_specialist", "Ахлах мэргэжилтэн");
  const isExternal = isExternalSpecialRole();
  const currentUserId = getCurrentUserId();
  const isProfOrg = isProfessionalOrg();
  // Гадаад ролиудад (санхүү, МИКА; мэрг. байгууллага /my_acquisitions руу шилжинэ)
  // зөвхөн "Хээрийн судалгаа" төлөвтэй чөлөөлөлт харагдана — backend ч мөн шүүнэ.
  const onlyFieldSurvey = isExternal;
  const isEmployee = hasRole("employee", "Энгийн ажилтан");

  // Мэргэжлийн байгууллага /my_acquisitions руу redirect хийнэ
  useEffect(() => {
    if (isProfOrg) router.replace("/my_acquisitions");
  }, [isProfOrg, router]);

  // Энгийн ажилтан эрхтэй бол өөрийгөө автоматаар сонгоно
  const { data: meData } = useQuery({
    queryKey: ["users-me"],
    queryFn: () => authApi.me(),
    staleTime: Infinity,
    enabled: isEmployee,
  });
  useEffect(() => {
    if (isEmployee && meData) {
      const id = meData.id ?? currentUserId ?? "";
      const label = `${meData.last_name ?? ""} ${meData.first_name ?? ""}`.trim();
      if (id) setDraft(d => ({ ...d, employeeId: id, employeeName: label }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meData]);

  const { data: genCats = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
  });
  const { data: subCats = [] } = useQuery({
    queryKey: ["acquisition-categories", draft.genCat],
    queryFn: () => landApi.listCategories(draft.genCat),
    enabled: draft.genCat > 0,
    staleTime: Infinity,
  });

  function applySearch() {
    setFilter({ ...draft });
    setPage(1);
  }

  function clearAll() {
    setDraft(EMPTY_DRAFT);
    setFilter(EMPTY_DRAFT);
    setPage(1);
  }

  const hasFilter = !!(
    draft.planCode || draft.acqName || draft.status || draft.genCat || draft.subCat || draft.employeeId || draft.year
  );

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["land", page, filter],
    queryFn: () =>
      landApi.list({
        page,
        page_size: PAGE_SIZE,
        plan_code: filter.planCode || undefined,
        acquisition_name: filter.acqName || undefined,
        status: onlyFieldSurvey ? ACQ_STATUS.FIELD_SURVEY : filter.status || undefined,
        general_category_id: filter.genCat || undefined,
        sub_category_id: filter.subCat || undefined,
        assigned_user_id: filter.employeeId || undefined,
        years: filter.year ? [filter.year] : undefined,
      }),
    enabled: !isProfOrg,
  });

  const filteredAcquisitions: LandAcquisition[] = rawData?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => landApi.delete(id),
    onSuccess: () => {
      toast.success("Чөлөөлөлт устгагдлаа");
      queryClient.invalidateQueries({ queryKey: ["land"] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгах боломжгүй (зөвхөн NEW статустай)")),
  });

  const total = rawData?.total ?? 0;
  const displayData = filteredAcquisitions;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const HEADERS = [
    "Төлөвлөгөө",
    "Чөлөөлөлтийн нэр",
    "Ерөнхий ангилал",
    "Дэд ангилал",
    "Статус",
    "Талбай",
    "Эхлэх",
    "Нэгж талбар",
    "",
  ];

  if (isProfOrg) return null;

  return (
    <>
    <div className="flex flex-col gap-5">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Газар чөлөөлөлт
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Нийт {total} чөлөөлөлтийн бүртгэл
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Нэмэх
          </button>
        )}
      </div>

      <div className="ap-card overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <PlanSelect
            value={draft.planCode}
            onChange={(code) => setDraft(d => ({ ...d, planCode: code }))}
            className="flex-1 min-w-0"
          />
          <AcquisitionSelect
            selectedId={draft.acqId}
            onSelect={(id, label) => setDraft(d => ({ ...d, acqId: id, acqName: label }))}
            onClear={() => setDraft(d => ({ ...d, acqId: "", acqName: "" }))}
            className="flex-1 min-w-0"
          />
          <select
            value={draft.genCat}
            onChange={(e) => setDraft(d => ({ ...d, genCat: Number(e.target.value), subCat: 0 }))}
            className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
          >
            <option value={0}>Ерөнхий ангилал</option>
            {genCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={draft.subCat}
            onChange={(e) => setDraft(d => ({ ...d, subCat: Number(e.target.value) }))}
            disabled={draft.genCat === 0}
            className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all disabled:opacity-50"
          >
            <option value={0}>Дэд ангилал</option>
            {subCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!onlyFieldSurvey && (
            <select
              value={draft.status}
              onChange={(e) => setDraft(d => ({ ...d, status: Number(e.target.value) }))}
              className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
            >
              <option value={0}>Бүх төлөв</option>
              <option value={1}>Шинэ</option>
              <option value={2}>Хээрийн судалгаа</option>
              <option value={3}>Баталгаажсан</option>
              <option value={4}>Цуцлагдсан</option>
            </select>
          )}
          <EmployeeSelect
            selectedId={draft.employeeId}
            selectedLabel={draft.employeeName}
            onSelect={(id, label) => setDraft(d => ({ ...d, employeeId: id, employeeName: label }))}
            onClear={() => setDraft(d => ({ ...d, employeeId: "", employeeName: "" }))}
            placeholder="Ажилтан сонгох…"
            className="flex-1 min-w-0"
          />
          <select
            value={draft.year}
            onChange={(e) => setDraft(d => ({ ...d, year: Number(e.target.value) }))}
            className="w-24 shrink-0 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
          >
            <option value={0}>Бүх он</option>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={applySearch}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors shrink-0"
          >
            <Search className="h-3.5 w-3.5" />
            Хайх
          </button>
          {hasFilter && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 h-9 px-3 rounded-lg border border-rose-300 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-400/10 text-[12px] font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-400/20 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {HEADERS.map((h) => (
                      <td key={h} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-slate-100 dark:bg-[#252630]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !displayData.length ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-[13px] text-slate-400 dark:text-slate-500"
                  >
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    Бичлэг олдсонгүй
                  </td>
                </tr>
              ) : (
                displayData.map((land) => {
                  const sc = STATUS_CFG[land.status] ?? STATUS_CFG[1];
                  return (
                    <tr
                      key={land.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                    >
                      <td className="px-5 py-3.5 max-w-[200px]">
                        <p className="font-semibold text-[#02c0ce] truncate">
                          {land.plan_code}
                        </p>
                        {land.plan_name ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            {land.plan_name}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            —
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 max-w-[200px]">
                        {land.acquisition_name ? (
                          <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate">
                            {land.acquisition_name}
                          </p>
                        ) : (
                          <p className="text-[13px] text-slate-400 dark:text-slate-500">
                            —
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-600 dark:text-slate-300 max-w-[160px]">
                        <span className="truncate block">{land.general_category_name || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-600 dark:text-slate-300 max-w-[160px]">
                        <span className="truncate block">{land.sub_category_name || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: sc.color, background: sc.bg }}
                        >
                          {STATUS_LABELS[land.status] ?? "Тодорхойгүй"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        {formatArea(land.area_m2)}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-400">
                        {formatDate(land.start_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <MapPin className="h-3.5 w-3.5" />
                          {land.parcel_count ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          {isExternal && land.status === ACQ_STATUS.CONFIRMED ? (
                            <span
                              title="Баталгаажсан чөлөөлөлтийн дэлгэрэнгүй мэдээлэлд хандах боломжгүй"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-not-allowed select-none"
                            >
                              🔒 Хаалттай
                            </span>
                          ) : (
                            <Link
                              prefetch={false}
                              href={`/acquisition/${land.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap"
                            >
                              Дэлгэрэнгүй
                            </Link>
                          )}
                          {!isExternal && hasPermission("land:delete") && (
                            <button
                              onClick={() => setPendingConfirm({ title: "Устгах уу?", confirmLabel: "Устгах", confirmColor: "#f1556c", onConfirm: () => deleteMutation.mutate(land.id) })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-[#37394d]">
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {total === 0
              ? "Бичлэг олдсонгүй"
              : `Нийт ${total} бичлэгийн ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}-г харуулж байна`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from(
              { length: Math.min(totalPages, 7) },
              (_, i) => i + 1,
            ).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium border transition-colors",
                  page === p
                    ? "bg-[#02c0ce] text-white border-[#02c0ce]"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce]",
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
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
