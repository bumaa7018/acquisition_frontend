"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, Link2 } from "lucide-react";
import { decisionDraftApi, parcelApi } from "@/lib/api";
import { getApiError, formatArea } from "@/lib/utils";
import type { DecisionDraftFundingLink } from "@/types";

// parcel_status.id = 5 → "Чөлөөлсөн"
const PARCEL_STATUS_RELEASED = 5;

/**
 * Нэгж талбарыг захирамжид холбох модал.
 *
 * Зөвхөн "Чөлөөлсөн" (status = 5) төлөвтэй нэгж талбар л хайлтад орно —
 * backend мөн адил шалгадаг (domain.ErrParcelNotReleased). Аль хэдийн өөр
 * захирамжид холбогдсон талбарыг backend татгалзана.
 */
export function LinkParcelDialog({
  draftId,
  fundingSources,
  onClose,
  onLinked,
}: {
  draftId: string;
  /** Захирамжид нэмэгдсэн санхүүгийн эх үүсвэрүүд — нэгж талбар бүрт сонгоно */
  fundingSources: DecisionDraftFundingLink[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  // Ганц эх үүсвэртэй бол урьдчилан сонгоно (нэмэлт алхам үүсгэхгүй)
  const [fundingLinkId, setFundingLinkId] = useState(
    fundingSources.length === 1 ? fundingSources[0].id : "",
  );

  // GET /parcels-ийн `status` параметр нь ЧӨЛӨӨЛӨЛТИЙН төлөвийг шүүдэг тул
  // нэгж талбарын төлөвийг (status_id) энд шүүнэ.
  const { data, isFetching } = useQuery({
    queryKey: ["link-parcel-search", query],
    queryFn: () =>
      parcelApi
        .list({
          page: 1,
          page_size: 50,
          parcel_id: query,
          status_id: PARCEL_STATUS_RELEASED,
          unlinked_only: true,
        })
        .then((r) => r.data ?? []),
    enabled: query.trim().length > 0,
  });

  const link = useMutation({
    mutationFn: (parcelUuid: string) =>
      decisionDraftApi.linkParcel(draftId, parcelUuid, fundingLinkId),
    onSuccess: () => {
      toast.success("Нэгж талбар холбогдлоо");
      onLinked();
    },
    onError: (err) => toast.error(getApiError(err, "Холбоход алдаа гарлаа")),
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] pl-8 pr-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">
              Нэгж талбар холбох
            </h2>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
              Зөвхөн &quot;Чөлөөлсөн&quot; төлөвтэй нэгж талбар холбогдоно
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <label className="block text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Санхүүгийн эх үүсвэр *
          </label>
          <select
            value={fundingLinkId}
            onChange={(e) => setFundingLinkId(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
          >
            <option value="">— Сонгох —</option>
            {fundingSources.map((f) => (
              <option key={f.id} value={f.id}>
                {f.organization_name} — {f.source_type}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
            Сонгосон эх үүсвэрээр нэгж талбар холбогдоно. Дараа нь солих боломжтой.
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setQuery(term.trim())}
                placeholder="Нэгж талбарын дугаараар хайх"
                className={inp}
              />
            </div>
            <button
              onClick={() => setQuery(term.trim())}
              className="h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02a3af] transition-colors"
            >
              Хайх
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto border-t border-slate-100 dark:border-[#37394d]">
          {!query ? (
            <p className="py-12 text-center text-[13px] text-slate-400 dark:text-slate-500">
              Нэгж талбарын дугаараа оруулаад хайна уу
            </p>
          ) : isFetching ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />
              ))}
            </div>
          ) : !data?.length ? (
            <p className="py-12 text-center text-[13px] text-slate-400 dark:text-slate-500">
              Чөлөөлсөн төлөвтэй нэгж талбар олдсонгүй
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["Дугаар", "Чөлөөлөлт", "Талбай", "Зориулалт", ""].map((h) => (
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
                {data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                      {p.parcel_id}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-slate-600 dark:text-slate-300 truncate">
                        {p.acquisition_name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatArea(p.area_m2)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {p.landuse || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => link.mutate(p.id)}
                        disabled={link.isPending || !fundingLinkId}
                        title={!fundingLinkId ? "Эхлээд санхүүгийн эх үүсвэрээ сонгоно уу" : undefined}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        <Link2 className="h-3 w-3" /> Холбох
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
