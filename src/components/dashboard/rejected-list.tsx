"use client";
import { AlertCircle } from "lucide-react";

interface RejectedParcel {
  id: string;
  parcel_id: string;
  holder_name?: string;
  area_m2: number;
  status_name: string;
  note?: string;
}

interface Props {
  parcels: RejectedParcel[];
}

export function RejectedList({ parcels }: Props) {
  if (parcels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-slate-400">
        <AlertCircle className="h-6 w-6 mb-1.5 opacity-30" />
        <p className="text-[12px]">Татгалзсан нэгж талбар байхгүй</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-[#37394d]">
      {parcels.map((p) => (
        <div key={p.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  {p.holder_name || p.parcel_id}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{p.parcel_id}</span>
                <span className="text-[11px] text-slate-400">{p.area_m2.toLocaleString()} м²</span>
              </div>
              {p.note && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                  {p.note}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
