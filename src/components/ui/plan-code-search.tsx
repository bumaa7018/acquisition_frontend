"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Search } from "lucide-react";
import { planApi } from "@/lib/api";
import type { Plan } from "@/types";
import { formatArea, getApiError } from "@/lib/utils";
import type { PreviewGeometry } from "@/components/map/geometry-preview-map";

// OpenLayers нь browser-only тул SSR-гүйгээр ачаална. Төлөвлөгөө хайх мөч
// хүртэл зураг хэрэггүй учир кодыг ч тэр үед л татна.
const GeometryPreviewMap = dynamic(() => import("@/components/map/geometry-preview-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] w-full animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
  ),
});

/** Төлөвлөгөөний хилийн өнгө — давхаргын 'v_acquisition_plan'-тай ижил. */
const PLAN_BOUNDARY_COLOR = "#a855f7";

/**
 * Төлөвлөгөөний НЭГЖ ТАЛБАРЫН ДУГААР оруулж, "Хайх" дарж дундын сервисээс
 * (backend → middleware /plan/project) татна.
 *
 * ЯАГААД ХУВААЛЦСАН КОМПОНЕНТ: чөлөөлөлт ҮҮСГЭХ ба чөлөөлөлтийн ХИЛ ЗАСАХ
 * хоёр газар ЯГ ИЖИЛ урсгалаар төлөвлөгөө хайна — чөлөөлөлтийн хил нь
 * олдсон төлөвлөгөөний хилээс хуулагддаг тул хайлт хоёуланд нь адил байх
 * ёстой.
 */
export function PlanCodeSearch({
  plan,
  onFound,
  onReset,
  autoFocus = false,
  notFoundHint = "Дугаарыг шалгаад дахин хайна уу — төлөвлөгөө олдохгүй бол чөлөөлөлт үүсгэх боломжгүй.",
  compareGeometry,
  mapHeight,
}: {
  plan: Plan | null;
  onFound: (plan: Plan) => void;
  onReset: () => void;
  autoFocus?: boolean;
  /** Олдоогүй үеийн нэмэлт тайлбар (үүсгэх/засах контекст өөр өөр). */
  notFoundHint?: string;
  /**
   * Зураг дээр ХАМТ харуулах нэмэлт геометр — хил СОЛИХОД одоогийн хилийг
   * шинэтэй зэрэгцүүлж харуулахад.
   */
  compareGeometry?: PreviewGeometry;
  mapHeight?: number;
}) {
  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState<string | null>(null);

  const searchMutation = useMutation({
    // withBoundary — олдсон хилийг ЗУРАГ дээр харуулах учир геометрийг хамт татна.
    mutationFn: (value: string) => planApi.search(value, { withBoundary: true }),
    onSuccess: (found) => {
      if (!found) {
        setNotFound("Төлөвлөгөө олдсонгүй");
        onReset();
        return;
      }
      setNotFound(null);
      onFound(found);
    },
    onError: (err) => {
      setNotFound(getApiError(err, "Төлөвлөгөө олдсонгүй"));
      onReset();
    },
  });

  const trimmed = code.trim();
  const search = () => {
    if (!trimmed) {
      setNotFound("Төлөвлөгөөний нэгж талбарын дугаарыг оруулна уу");
      return;
    }
    searchMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <input
          type="text"
          placeholder="Төлөвлөгөөний нэгж талбарын дугаар"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setNotFound(null);
            // Дугаар өөрчлөгдмөгц өмнөх хайлтын үр дүн хүчингүй — цааш
            // үргэлжлэхийг дахин хайх хүртэл хаана.
            if (plan) onReset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          className="h-9 flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] font-mono text-slate-800 dark:text-slate-200 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onClick={search}
          disabled={!trimmed || searchMutation.isPending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[13px] font-semibold text-white hover:bg-[#02aebb] disabled:opacity-50 transition-colors"
        >
          {searchMutation.isPending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Хайх
        </button>
      </div>

      {notFound && (
        <div className="flex items-start gap-2 rounded-lg bg-[#f1556c]/8 border border-[#f1556c]/20 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-[#f1556c] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#f1556c]">
            {notFound}. {notFoundHint}
          </p>
        </div>
      )}

      {plan && (
        <PlanInfoCard plan={plan} compareGeometry={compareGeometry} mapHeight={mapHeight} />
      )}
    </div>
  );
}

/** Төлөвлөгөөнд хил байгаа эсэх — байхгүй бол цааш үргэлжлэх БОЛОМЖГҮЙ. */
export function planHasBoundary(plan: Plan | null): boolean {
  return !!plan && plan.has_boundary !== false;
}

/**
 * Төлөвлөгөөний ХИЛ — газрын зураг дээр.
 *
 * Хилгүй төлөвлөгөөнд огт зурагдахгүй (шалтгааныг PlanInfoCard дор
 * анхааруулгаар харуулна).
 */
export function PlanBoundaryPreview({
  plan,
  height = 200,
  compareGeometry,
}: {
  plan: Plan;
  height?: number;
  compareGeometry?: PreviewGeometry;
}) {
  if (!planHasBoundary(plan)) return null;
  return (
    <GeometryPreviewMap
      height={height}
      geometries={[
        ...(compareGeometry ? [compareGeometry] : []),
        {
          wkt: plan.boundary_wkt,
          color: PLAN_BOUNDARY_COLOR,
          label: "Төлөвлөгөөний хил",
          filled: true,
        },
      ]}
      emptyText="Төлөвлөгөөний хил татагдсангүй"
    />
  );
}

/** Олдсон төлөвлөгөөний мэдээлэл + ХИЛ (газрын зураг дээр) */
export function PlanInfoCard({
  plan,
  compareGeometry,
  mapHeight = 200,
}: {
  plan: Plan;
  compareGeometry?: PreviewGeometry;
  mapHeight?: number;
}) {
  const rows: Array<[string, string | undefined | null]> = [
    ["Нэр", plan.name],
    // Бүтээн байгуулалтын ажил — төлөвлөгөөний нэгж талбар дээр хийгдэх ажил
    ["Бүтээн байгуулалт", plan.gazner],
    ["Төрөл", plan.plan_type_name],
    ["Талбарын дугаар", plan.parcel_id],
    ["Талбай", (plan.area_m2 ?? 0) > 0 ? formatArea(plan.area_m2 ?? 0) : undefined],
    ["Батлагдсан", plan.approved_date],
    [
      "Хугацаа",
      plan.start_date || plan.end_date ? `${plan.start_date ?? "—"} — ${plan.end_date ?? "—"}` : undefined,
    ],
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#02c0ce]/8 dark:bg-[#02c0ce]/10 border border-solid border-[#02c0ce]/20">
        <CheckCircle className="h-4 w-4 text-[#02c0ce] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-mono font-semibold text-[#02c0ce]">
            {plan.parcel_id || plan.plan_code || plan.code}
          </p>
          <div className="mt-1 space-y-0.5">
            {rows
              .filter(([, value]) => !!value)
              .map(([label, value]) => (
                <p key={label} className="text-[11.5px] text-slate-600 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500">{label}:</span> {value}
                </p>
              ))}
          </div>
        </div>
      </div>

      {/* Олдсон төлөвлөгөөний ХИЛ — чөлөөлөлтийн хил ҮҮНЭЭС хуулагдана тул
          хэрэглэгч хадгалахаас ӨМНӨ нүдээрээ шалгах ёстой. */}
      <PlanBoundaryPreview plan={plan} height={mapHeight} compareGeometry={compareGeometry} />

      {/* Хилгүй төлөвлөгөөгөөр цааш үргэлжлэх боломжгүй — backend ч мөн 422
          буцаана. Хэрэглэгчид ЭНД (хадгалахаас өмнө) шалтгааныг харуулна. */}
      {!planHasBoundary(plan) && (
        <div className="flex items-start gap-2 rounded-lg bg-[#f1556c]/8 border border-[#f1556c]/20 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-[#f1556c] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#f1556c]">
            Энэ төлөвлөгөөнд хил бүртгэгдээгүй байна. Чөлөөлөлтийн хил нь
            төлөвлөгөөний хилээс хуулагддаг тул үргэлжлүүлэх боломжгүй.
          </p>
        </div>
      )}
    </div>
  );
}
