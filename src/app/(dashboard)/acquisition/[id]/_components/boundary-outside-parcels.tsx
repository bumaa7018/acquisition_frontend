"use client";
import { AlertTriangle } from "lucide-react";
import type { PreviewGeometry } from "@/components/map/geometry-preview-map";
import type { BoundaryOutsideParcel } from "@/types";

/** Шинэ хилээс ГАРАХ нэгж талбар. */
const OUTSIDE_PARCEL_COLOR = "#f1556c";
/** Шинэ хилээс гарах «Чөлөөлсөн» нэгж талбар — тусад нь ялгана. */
const OUTSIDE_RELEASED_COLOR = "#6658dd";

const colorOf = (p: BoundaryOutsideParcel) =>
  p.released ? OUTSIDE_RELEASED_COLOR : OUTSIDE_PARCEL_COLOR;

/**
 * Шинэ хилээс гарах нэгж талбаруудыг газрын зураг дээр дугаартай нь өнгөөр
 * ялгаж зурах геометрүүд. Файлаар ба төлөвлөгөөгөөр хил солих хоёр замд ижил.
 */
export function outsideParcelGeometries(outside: BoundaryOutsideParcel[]): PreviewGeometry[] {
  return outside.map((p) => ({
    wkt: p.geometry_wkt,
    color: colorOf(p),
    label: p.released ? "Хилээс гарах «Чөлөөлсөн» нэгж талбар" : "Хилээс гарах нэгж талбар",
    filled: true,
    width: 2,
    text: p.parcel_id,
  }));
}

/**
 * Хил СОЛИХ үеийн анхааруулга: шинэ хилтэй давхцахгүй болох нэгж талбарууд.
 * Хадгалахад тэдгээрийн нөлөөлөлд өртсөн талбай 0 болно; устгагдахгүй.
 */
export function OutsideParcelsNotice({ outside }: { outside: BoundaryOutsideParcel[] }) {
  if (outside.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-400/40 dark:bg-amber-400/10">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
          <span className="font-semibold">{outside.length}</span> нэгж талбар шинэ
          хилтэй давхцахгүй болно. Хадгалахад тэдгээрийн нөлөөлөлд өртсөн талбай{" "}
          <span className="font-semibold">0</span> болно — нэгж талбар
          устгагдахгүй.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {outside.map((p) => (
          <span
            key={p.parcel_id}
            title={p.status_name || undefined}
            className="inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 font-mono text-[11px] dark:bg-[#1e1f27]"
            style={{ borderColor: colorOf(p), color: colorOf(p) }}
          >
            {p.parcel_id}
            {p.released && <span className="font-sans font-semibold">· Чөлөөлсөн</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
