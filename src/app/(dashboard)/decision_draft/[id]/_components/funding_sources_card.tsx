"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Plus, Search, X, Wallet } from "lucide-react";
import { decisionDraftApi, fundingSourceOptionApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DecisionDraftFundingLink, FundingSourceOption } from "@/types";

function normalizeFundingText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function fundingSourceLabel(fs: FundingSourceOption | DecisionDraftFundingLink): string {
  if (normalizeFundingText(fs.organization_name) === normalizeFundingText(fs.source_type)) {
    return fs.organization_name || fs.source_type;
  }
  return [fs.organization_name, fs.source_type].filter(Boolean).join(" — ");
}

function parseFundingSourceInput(value: string): { organization_name: string; source_type: string } {
  const text = value.trim().replace(/\s+/g, " ");
  const [organizationName, ...sourceTypeParts] = text.split(/\s*—\s*|\s+-\s+/);
  const sourceType = sourceTypeParts.join(" — ").trim();

  if (organizationName?.trim() && sourceType) {
    return {
      organization_name: organizationName.trim(),
      source_type: sourceType,
    };
  }

  return {
    organization_name: text,
    source_type: text,
  };
}

/**
 * Захирамжийн санхүүгийн эх үүсвэр — төслийг үүсгэсний ДАРАА энд олноор нэмнэ.
 * Баталгаажсан захирамжид нэмэх/хасах боломжгүй (backend мөн шалгана).
 */
export function FundingSourcesCard({
  draftId,
  items,
  editable,
  onChanged,
}: {
  draftId: string;
  items: DecisionDraftFundingLink[];
  editable: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<DecisionDraftFundingLink | null>(null);

  const { data: options = [], isLoading: optionsLoading } = useQuery({
    queryKey: ["funding-source-options"],
    queryFn: () => fundingSourceOptionApi.list(),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const text = sourceText.trim();
      const amount = Number(amountText.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("invalid amount");
      }
      const normalizedText = normalizeFundingText(text);
      const matched = options.find(
        (fs) => normalizeFundingText(fundingSourceLabel(fs)) === normalizedText,
      );
      let fundingSourceId = matched?.id;
      let createdSource: FundingSourceOption | null = null;

      if (!fundingSourceId) {
        const parsed = parseFundingSourceInput(text);
        const created = await fundingSourceOptionApi.create({
          organization_name: parsed.organization_name,
          source_type: parsed.source_type,
          currency: "MNT",
        });
        if (!created) throw new Error("empty response");
        createdSource = created;
        fundingSourceId = created.id;
      }

      if (items.some((i) => i.funding_source_id === fundingSourceId)) {
        throw new Error("already added");
      }

      const links = await decisionDraftApi.addFundingSource(draftId, fundingSourceId, amount);
      return { links, createdSource };
    },
    onSuccess: ({ createdSource }) => {
      toast.success("Санхүүгийн эх үүсвэр захирамжийн төсөлтэй холбогдлоо");
      if (createdSource) {
        queryClient.setQueryData<FundingSourceOption[]>(["funding-source-options"], (current) => {
          const list = current ?? [];
          return list.some((fs) => fs.id === createdSource.id) ? list : [createdSource, ...list];
        });
      }
      setSourceText("");
      setAmountText("");
      setShowOptions(false);
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["funding-source-options"] });
      queryClient.invalidateQueries({ queryKey: ["decision-drafts"] });
      onChanged();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "already added") {
        toast.error("Энэ санхүүгийн эх үүсвэр аль хэдийн нэмэгдсэн байна");
        return;
      }
      if (err instanceof Error && err.message === "invalid amount") {
        toast.error("Мөнгөн дүнгээ зөв оруулна уу");
        return;
      }
      toast.error(getApiError(err, "Нэмэхэд алдаа гарлаа"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (linkId: string) => decisionDraftApi.removeFundingSource(draftId, linkId),
    onSuccess: () => {
      toast.success("Санхүүгийн эх үүсвэр хасагдлаа");
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["decision-drafts"] });
      onChanged();
    },
    onError: (err) => toast.error(getApiError(err, "Хасахад алдаа гарлаа")),
  });

  const inp =
    "h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  // funding_source хүснэгтийн бүх мөрийг сонголтод харуулна. Аль хэдийн энэ
  // захирамжид нэмэгдсэн мөрийг нуухгүй, зөвхөн дахин холбохоос хамгаална.
  const added = new Set(items.map((i) => i.funding_source_id));
  const sourceTextTrimmed = sourceText.trim();
  const amount = Number(amountText.replace(/,/g, ""));
  const amountValid = amountText.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  const matchedOption = options.find(
    (fs) => normalizeFundingText(fundingSourceLabel(fs)) === normalizeFundingText(sourceTextTrimmed),
  );
  const alreadyAddedOption = matchedOption ? added.has(matchedOption.id) : false;
  const selectedOption = matchedOption && !alreadyAddedOption ? matchedOption : undefined;
  const canCreateFromText = !!sourceTextTrimmed && !matchedOption;
  const filteredOptions = options
    .filter((fs) => {
      if (!sourceTextTrimmed) return true;
      const normalizedQuery = normalizeFundingText(sourceTextTrimmed);
      return normalizeFundingText(
        [fundingSourceLabel(fs), fs.acquisition_name, fs.plan_code].filter(Boolean).join(" "),
      ).includes(normalizedQuery);
    });

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Санхүүгийн эх үүсвэр
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
            {items.length > 0 ? `${items.length} эх үүсвэр` : "Олон эх үүсвэр нэмж болно"}
          </p>
        </div>
        {editable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02a3af] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Эх үүсвэр нэмэх
          </button>
        )}
      </div>

      {editable && adding && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/60 dark:bg-[#1a1d20]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                funding_source хүснэгтээс сонгох
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={sourceText}
                  onFocus={() => setShowOptions(true)}
                  onChange={(e) => {
                    setSourceText(e.target.value);
                    setShowOptions(true);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      sourceTextTrimmed &&
                      !alreadyAddedOption &&
                      !optionsLoading &&
                      !addMutation.isPending
                    ) {
                      addMutation.mutate();
                    }
                  }}
                  placeholder="Жишээ: Нийслэлийн төсөв — Улсын төсөв"
                  className={`${inp} w-full pl-8 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowOptions((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#252630] dark:hover:text-slate-200"
                  title="Сонголтын жагсаалт нээх"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showOptions && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-[#37394d] dark:bg-[#1e1f27]">
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-400 dark:border-[#37394d] dark:text-slate-500">
                      funding_source-оос ирсэн сонголтууд
                    </div>
                    {optionsLoading ? (
                      <div className="px-3 py-3 text-[12px] text-slate-400">Уншиж байна...</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto py-1">
                        {canCreateFromText && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShowOptions(false);
                              addMutation.mutate();
                            }}
                            className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-[#02c0ce]/10 dark:border-[#37394d] dark:hover:bg-[#02c0ce]/10"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#02c0ce] bg-[#02c0ce]/10 text-[#02c0ce]">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold text-[#02c0ce]">
                                Шинээр бүртгээд холбох
                              </span>
                              <span className="block truncate text-[12px] text-slate-600 dark:text-slate-300">
                                {sourceTextTrimmed}
                              </span>
                            </span>
                          </button>
                        )}

                        {filteredOptions.length > 0 ? (
                          filteredOptions.map((fs) => {
                            const label = fundingSourceLabel(fs);
                            const isSelected =
                              normalizeFundingText(label) === normalizeFundingText(sourceTextTrimmed);
                            const isAdded = added.has(fs.id);
                            return (
                              <button
                                key={fs.id}
                                type="button"
                                disabled={isAdded}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  if (isAdded) return;
                                  setSourceText(label);
                                  setShowOptions(false);
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#252630]"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 text-[#02c0ce] dark:border-[#37394d]">
                                  {(isSelected || isAdded) && <Check className="h-3.5 w-3.5" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                      {label}
                                    </span>
                                    {isAdded && (
                                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#252630] dark:text-slate-400">
                                        Нэмэгдсэн
                                      </span>
                                    )}
                                  </span>
                                  {(fs.acquisition_name || fs.plan_code) && (
                                    <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                                      {fs.acquisition_name || fs.plan_code}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })
                        ) : alreadyAddedOption ? (
                          <div className="px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
                            Энэ эх үүсвэр аль хэдийн нэмэгдсэн байна.
                          </div>
                        ) : !canCreateFromText ? (
                          <div className="px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
                            Таарах сонголт алга. Талбар дээр шинэ утгаа шууд бичнэ.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">
                {sourceTextTrimmed
                  ? alreadyAddedOption
                    ? "Энэ эх үүсвэр аль хэдийн нэмэгдсэн байна."
                    : selectedOption
                    ? "Сонгосон мөрийг захирамжийн төсөлтэй холбоно."
                    : "Сонголтоос гадуур утга тул funding_source-д шинээр бүртгээд холбоно."
                  : "Жагсаалтаас сонгох эсвэл талбар дээр шууд бичнэ."}
              </p>
            </div>

            <div className="w-full min-w-0 xl:w-52">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Мөнгөн дүн
              </p>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    sourceTextTrimmed &&
                    amountValid &&
                    !alreadyAddedOption &&
                    !optionsLoading &&
                    !addMutation.isPending
                  ) {
                    addMutation.mutate();
                  }
                }}
                placeholder="0"
                className={`${inp} w-full tabular-nums`}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:mt-5">
              <button
                onClick={() => addMutation.mutate()}
                disabled={
                  !sourceTextTrimmed || !amountValid || alreadyAddedOption || optionsLoading || addMutation.isPending
                }
                className="h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02a3af] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {optionsLoading
                  ? "Уншиж байна..."
                  : addMutation.isPending
                    ? "Нэмж байна..."
                    : alreadyAddedOption
                      ? "Нэмэгдсэн"
                    : selectedOption
                      ? "Холбох"
                      : "Бүртгээд холбох"}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setSourceText("");
                  setAmountText("");
                  setShowOptions(false);
                }}
                className="h-9 px-4 rounded-lg border border-slate-200 dark:border-[#37394d] text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#252630] transition-colors"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Wallet className="h-9 w-9 text-slate-300 dark:text-[#37394d] mb-2.5" />
          <p className="text-[13px]">Санхүүгийн эх үүсвэр нэмэгдээгүй байна</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                {["Байгууллага", "Төрөл", "Дүн", "Чөлөөлөлт", "Тайлбар", ""].map((h) => (
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
              {items.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                    {f.organization_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {f.source_type || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {f.amount != null
                      ? `${Number(f.amount).toLocaleString()} ${f.currency || "MNT"}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-slate-500 dark:text-slate-400 truncate">
                      {f.acquisition_name || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-slate-500 dark:text-slate-400 truncate">
                      {f.note || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable && (
                      <button
                        onClick={() => setRemoveTarget(f)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-400/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-400/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap"
                      >
                        <X className="h-3 w-3" /> Хасах
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Санхүүгийн эх үүсвэрийг хасах уу?"
        description={removeTarget?.organization_name}
        confirmLabel="Хасах"
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
