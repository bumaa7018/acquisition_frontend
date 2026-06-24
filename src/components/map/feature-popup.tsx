"use client";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  v_acquisition_boundary: "Чөлөөлөлтийн хил",
  v_acquisition_plan: "Чөлөөлөлтийн төлөвлөгөө",
  parcel: "Нэгж талбар",
  building: "Барилгын хил",
  v_parcel_acquisition: "Давхцал",
};

const SKIP_KEYS = new Set(["geom", "geometry", "wkb_geometry", "bbox"]);

export default function FeaturePopup({
  layer,
  properties,
  position,
  onClose,
}: FeaturePopupProps) {
  const entries = Object.entries(properties).filter(
    ([k]) => !SKIP_KEYS.has(k) && properties[k] != null,
  );

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{ left: position.x + 12, top: position.y - 12, maxWidth: 280 }}
    >
      <Card className="shadow-xl border-border/80">
        <CardHeader className="py-2.5 px-4 border-b flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            {LAYER_LABELS[layer] ?? layer}
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 -mr-1"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="px-4 py-2 max-h-64 overflow-y-auto">
          <dl className="space-y-1.5 text-xs">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 font-medium w-28 truncate">
                  {key}
                </dt>
                <dd className="font-medium truncate">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
