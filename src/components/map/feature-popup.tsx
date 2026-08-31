"use client";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatArea, formatDate } from "@/lib/utils";

interface FeaturePopupProps {
  layer: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
  onClose: () => void;
}

const LAYER_LABELS: Record<string, string> = {
  au1: "Аймаг/Нийслэл",
  au2: "Сум/Дүүрэг",
  au3: "Баг/Хороо",
  v_acquisition_plan: "Төлөвлөгөөний хил",
  v_plan_acquisition: "Үндсэн төлөвлөлтийн хил",
  v_acquisition_boundary: "Чөлөөлөх бүсийн хил",
  parcel: "Нэгж талбар",
  building: "Барилгын хил",
  v_parcel_acquisition: "Давхцал",
};

/**
 * Давхарга бүрд харуулах ЧУХАЛ талбарууд ба тэдгээрийн монгол нэр.
 *
 * ЯАГААД allowlist: GeoServer нь view-ийн БҮХ баганыг буцаадаг (дотоод id,
 * geometry, assignee жагсаалт ...). Түүнийг хэвээр нь жагсаавал утгагүй
 * техник талбарууд гарч, чухал мэдээлэл нь дунд нь алдагддаг байв.
 *
 * Жагсаалтад ороогүй давхаргад техник талбараас бусад нь хэвээр харагдана.
 */
const FIELDS: Record<string, [key: string, label: string][]> = {
  au1: [
    ["code", "Код"],
    ["name", "Нэр"],
    ["area_m2", "Талбай"],
  ],
  au2: [
    ["code", "Код"],
    ["name", "Нэр"],
    ["au1_code", "Аймаг/Нийслэлийн код"],
    ["area_m2", "Талбай"],
  ],
  au3: [
    ["code", "Код"],
    ["name", "Нэр"],
    ["au2_code", "Сум/Дүүргийн код"],
    ["area_m2", "Талбай"],
  ],
  v_acquisition_plan: [
    ["plan_code", "Төлөвлөгөөний дугаар"],
    ["plan_area_m2", "Төлөвлөгөөний талбай"],
    ["status", "Төлөв"],
  ],
  v_plan_acquisition: [
    ["acquisition_name", "Чөлөөлөлтийн нэр"],
    ["plan_code", "Төлөвлөгөөний дугаар"],
    ["area_m2", "Талбай"],
    ["status", "Төлөв"],
  ],
  v_acquisition_boundary: [
    ["plan_code", "Төлөвлөгөөний дугаар"],
    ["area_m2", "Талбай"],
    ["start_date", "Эхлэх"],
    ["end_date", "Дуусах"],
  ],
  parcel: [
    ["parcel_id", "Нэгж талбарын дугаар"],
    ["area_m2", "Талбай"],
    ["acquisition_area_m2", "Чөлөөлөх талбай"],
  ],
  building: [
    ["parcel_id", "Нэгж талбарын дугаар"],
    ["area_m2", "Талбай"],
  ],
};

// Хэзээ ч харуулахгүй техник талбарууд (жагсаалтгүй давхаргад)
const SKIP_KEYS = new Set([
  "geom",
  "geometry",
  "wkb_geometry",
  "bbox",
  "id",
  "acquisition_id",
  "assignee_user_ids",
]);

const AREA_KEYS = new Set(["area_m2", "acquisition_area_m2", "plan_area_m2", "remaining_area_m2"]);
const DATE_KEYS = new Set(["start_date", "end_date", "valid_from", "valid_till", "approved_date"]);

const ACQ_STATUS_LABELS: Record<string, string> = {
  "1": "Шинэ",
  "2": "Хээрийн судалгаа",
  "3": "Баталгаажсан",
  "4": "Цуцлагдсан",
};

function render(layer: string, key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (AREA_KEYS.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? formatArea(n) : String(value);
  }
  if (DATE_KEYS.has(key)) return formatDate(String(value));
  // Чөлөөлөлтийн давхаргууд дээрх `status` нь ЧӨЛӨӨЛӨЛТИЙН төлөв.
  if (key === "status" && layer.startsWith("v_")) {
    return ACQ_STATUS_LABELS[String(value)] ?? String(value);
  }
  return String(value);
}

export default function FeaturePopup({
  layer,
  properties,
  position,
  onClose,
}: FeaturePopupProps) {
  const spec = FIELDS[layer];
  const entries: [string, string][] = spec
    ? spec
        .filter(([k]) => properties[k] != null && properties[k] !== "")
        .map(([k, label]) => [label, render(layer, k, properties[k])])
    : Object.entries(properties)
        .filter(([k, v]) => !SKIP_KEYS.has(k) && v != null && v !== "")
        .map(([k, v]) => [k, render(layer, k, v)]);

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{ left: position.x + 12, top: position.y - 12, maxWidth: 300 }}
    >
      <Card className="shadow-xl border-border/80">
        <CardHeader className="py-2.5 px-4 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">{LAYER_LABELS[layer] ?? layer}</CardTitle>
          <Button size="icon" variant="ghost" className="h-6 w-6 -mr-1" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="px-4 py-2 max-h-64 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Мэдээлэл байхгүй</p>
          ) : (
            <dl className="space-y-1.5 text-xs">
              {entries.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0 font-medium w-32 truncate">
                    {label}
                  </dt>
                  <dd className="font-medium min-w-0 flex-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
