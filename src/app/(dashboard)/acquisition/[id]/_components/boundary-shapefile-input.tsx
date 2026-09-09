"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, FileUp, Loader2, X } from "lucide-react";
import { landApi } from "@/lib/api";
import { formatArea, getApiError } from "@/lib/utils";
import type { BoundaryPreview } from "@/types";

const GeometryPreviewMap = dynamic(() => import("@/components/map/geometry-preview-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] w-full animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
  ),
});

/** Гараас оруулсан ШИНЭ хилийн өнгө (төлөвлөгөөнийхөөс ялгаатай). */
const NEW_BOUNDARY_COLOR = "#02c0ce";

export type BoundaryFileSelection = {
  file: File;
  preview: BoundaryPreview;
};

/**
 * Чөлөөлөлтийн хилийг ГАРААС (.shp) оруулах хэсэг — зөвхөн ЗАСВАРЛАХ горимд.
 *
 * Урсгал: файл сонгомогц backend руу ХАДГАЛАЛГҮЙ шалгуулна
 * (`/boundary-preview`) — тэндээс хилийн WKT ба төлөвлөгөөний хилээс хэдэн
 * хувиар зөрснийг авч, газрын зураг дээр одоогийн хилтэй зэрэгцүүлж
 * харуулна. Хил солих нь БУЦААХ БОЛОМЖГҮЙ тул хэрэглэгч хадгалахаас өмнө
 * зөрүүг тоогоор ба нүдээрээ хардаг байх ёстой.
 *
 * Файлыг browser дээр задлахгүй: shapefile-ийн бүтэц/проекцийн шалгалт ба
 * талбайн UTM тооцоо серверт байгаа тул давхардуулбал дэлгэц дээрх тоо
 * серверийн шийдвэрээс зөрөх эрсдэлтэй.
 */
export function BoundaryShapefileInput({
  acquisitionId,
  currentGeometryWKT,
  selection,
  onChange,
  disabled,
}: {
  acquisitionId: string;
  /** Одоогийн хил — шинэтэй зэрэгцүүлж харуулахад. */
  currentGeometryWKT?: string;
  selection: BoundaryFileSelection | null;
  onChange: (selection: BoundaryFileSelection | null) => void;
  /** Төлөвлөгөөгөөр хил солихыг сонгосон үед хаагдана (хоёр зам зэрэг явахгүй). */
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: (file: File) =>
      landApi.previewBoundary(acquisitionId, file).then((preview) => ({ file, preview })),
    onSuccess: (result) => {
      setError(null);
      if (!result.preview) {
        setError("Хилийн файлыг шалгаж чадсангүй");
        return;
      }
      onChange({ file: result.file, preview: result.preview });
    },
    onError: (err) => {
      onChange(null);
      setError(getApiError(err, "Хилийн файлыг уншиж чадсангүй"));
    },
  });

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Ижил файлыг дахин сонгоход ч onChange ажиллахын тулд утгыг цэвэрлэнэ.
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".shp")) {
      onChange(null);
      setError("Зөвхөн ESRI Shapefile-ийн .shp файл оруулна (.zip/.dbf биш).");
      return;
    }
    setError(null);
    previewMutation.mutate(file);
  }

  function clear() {
    setError(null);
    onChange(null);
  }

  const preview = selection?.preview;
  const busy = previewMutation.isPending;

  return (
    <div className="space-y-2">
      <input
        ref={fileInput}
        type="file"
        accept=".shp"
        className="hidden"
        onChange={pick}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-50 dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-300"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          {busy ? "Шалгаж байна…" : selection ? "Өөр файл сонгох" : ".shp файл сонгох"}
        </button>
        {selection && (
          <>
            <span className="truncate text-[12px] text-slate-500 dark:text-slate-400" title={selection.file.name}>
              {selection.file.name}
            </span>
            <button
              type="button"
              onClick={clear}
              title="Файлыг болих"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#252630]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {disabled && (
        <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
          Төлөвлөгөөний дугаараар хил солихыг сонгосон байна. Гараас хил
          оруулах бол дээрх хайлтыг цэвэрлэнэ үү.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#f1556c]/20 bg-[#f1556c]/8 px-3 py-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f1556c]" />
          <p className="text-[12px] text-[#f1556c]">{error}</p>
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <div
            className={`rounded-xl border p-3 ${
              preview.accepted
                ? "border-[#02c0ce]/20 bg-[#02c0ce]/8 dark:bg-[#02c0ce]/10"
                : "border-[#f1556c]/25 bg-[#f1556c]/8"
            }`}
          >
            <div className="flex items-start gap-2">
              {preview.accepted ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#02c0ce]" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f1556c]" />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500">Файлын хилийн талбай:</span>{" "}
                  <span className="font-semibold">{formatArea(preview.area_m2)}</span>
                </p>
                {preview.reference_area_m2 > 0 && (
                  <>
                    <p className="text-[11.5px] text-slate-600 dark:text-slate-400">
                      <span className="text-slate-400 dark:text-slate-500">
                        Төлөвлөгөөний хилийн талбай:
                      </span>{" "}
                      <span className="font-semibold">{formatArea(preview.reference_area_m2)}</span>
                    </p>
                    <p
                      className={`text-[12px] font-semibold ${
                        preview.accepted ? "text-[#02c0ce]" : "text-[#f1556c]"
                      }`}
                    >
                      Талбайн зөрүү: {preview.deviation_percent.toFixed(1)}% (зөвшөөрөх дээд
                      хэмжээ {preview.max_deviation_percent.toFixed(0)}%)
                    </p>
                  </>
                )}
                {preview.reference_area_m2 <= 0 && (
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                    Төлөвлөгөөний хил байхгүй тул талбайн зөрүү шалгагдсангүй.
                  </p>
                )}
              </div>
            </div>
            {!preview.accepted && (
              <p className="mt-2 text-[12px] leading-relaxed text-[#f1556c]">
                Зөрүү нь {preview.max_deviation_percent.toFixed(0)}%-иас бага байх
                шаардлагатай тул энэ файлаар хил солих боломжгүй. Хилийн файл,
                проекц (WGS84) зөв эсэхийг шалгана уу.
              </p>
            )}
          </div>

          {/* Шинэ хил (тод) ба одоогийн хил (тасархай) — нүдээр харьцуулна. */}
          <GeometryPreviewMap
            height={220}
            geometries={[
              {
                wkt: currentGeometryWKT,
                color: "#f59e0b",
                label: "Одоогийн хил",
                dashed: true,
              },
              {
                wkt: preview.geometry_wkt,
                color: NEW_BOUNDARY_COLOR,
                label: "Файлын шинэ хил",
                filled: true,
              },
            ]}
            emptyText="Файлын хилийг зураг дээр харуулах боломжгүй"
          />
        </div>
      )}
    </div>
  );
}
