"use client";
import { REJECTED_PARCELS } from "./mock-data";
import { AlertCircle } from "lucide-react";

export function RejectedList() {
  return (
    <div className="flex flex-col divide-y divide-slate-100">
      {REJECTED_PARCELS.map((p) => (
        <div key={p.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-slate-800">
                  {p.name}
                </span>
                <span className="text-[11px] text-slate-400">{p.area} м²</span>
              </div>
              <p
                className="text-[11px] font-medium mt-0.5"
                style={{ color: "var(--clr-accent)" }}
              >
                {p.valuation !== "Үнэлгээ" ? `₮${p.valuation}` : p.valuation}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                {p.reason}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
