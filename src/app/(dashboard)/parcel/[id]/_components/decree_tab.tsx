"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { decisionDraftApi } from "@/lib/api";
import {
  DECISION_DRAFT_STATUS_LABELS,
  DECISION_DRAFT_STATUS_STYLES,
  DECISION_DRAFT_STATUS_DRAFT,
} from "@/types";
import { formatDate } from "@/lib/utils";
import { notifyNavStart } from "@/lib/blocking-loader-state";
import { Gavel } from "lucide-react";

// Нэгж талбарын "Захирамж" таб — тухайн талбар холбогдсон бүх захирамжийг
// төлөвтэй нь харуулна. Хасагдсан холбоос түүхээр үлдэнэ.
export function DecreeTab({ parcelId }: { parcelId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["parcel-decision-drafts", parcelId],
    queryFn: () => decisionDraftApi.listByParcel(parcelId),
  });

  if (isLoading) {
    return (
      <div className="ap-card p-5 space-y-2 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="ap-card flex flex-col items-center justify-center py-16 text-center">
        <Gavel className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
        <p className="text-[13px] text-slate-400 dark:text-slate-500">
          Энэ нэгж талбар захирамжтай холбогдоогүй байна
        </p>
      </div>
    );
  }

  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Холбогдсон захирамж
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
              {[
                "Саналын хуудас",
                "Захирамжийн дугаар",
                "Огноо",
                "Байршил",
                "Хугацаа (он)",
                "Ажлын төрөл",
                "Төсөв",
                "Төлөв",
                "Одоогийн явц",
                "Холбоос",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
            {data.map((d) => {
              const removed = !!d.removed_at;
              const status = d.decision_status ?? DECISION_DRAFT_STATUS_DRAFT;
              const sc = DECISION_DRAFT_STATUS_STYLES[status] ?? DECISION_DRAFT_STATUS_STYLES[DECISION_DRAFT_STATUS_DRAFT];
              return (
                <tr
                  key={d.id}
                  className={`transition-colors ${
                    removed
                      ? "opacity-50 bg-slate-50/50 dark:bg-[#1a1d20]"
                      : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                    {d.proposal_no || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {d.decree_number || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {d.decision_date ? formatDate(d.decision_date) : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[160px] text-slate-600 dark:text-slate-300 truncate">
                    {d.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                    {d.duration_year ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.work_type_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.budget_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                      style={{ color: sc.color, background: sc.bg }}
                    >
                      {DECISION_DRAFT_STATUS_LABELS[status] ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-slate-700 dark:text-slate-200 font-medium truncate">
                      {d.current_progress_type_name || "Төсөл"}
                    </p>
                    {(d.current_progress_recipient || d.current_progress_date) && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {d.current_progress_recipient || "—"}
                        {d.current_progress_date ? ` · ${formatDate(d.current_progress_date)}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {removed ? (
                      <>
                        <span className="rounded-full bg-slate-200 dark:bg-[#37394d] px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Хасагдсан
                        </span>
                        <span className="block text-[11px] mt-0.5">{formatDate(d.removed_at!)}</span>
                      </>
                    ) : (
                      formatDate(d.linked_at)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/decision_draft/${d.decision_draft_id}`}
                      onClick={notifyNavStart}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap"
                    >
                      Дэлгэрэнгүй
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
