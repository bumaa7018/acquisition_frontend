"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { decisionDraftApi, fundingSourceOptionApi, landApi, parcelApi } from "@/lib/api";
import { formatArea, getApiError } from "@/lib/utils";
import { useDepartmentGeneralCategory } from "@/hooks/use-department-category";
import { useParcelStatusNamesWithRule } from "@/lib/use-parcel-status-rules";
import type { DecisionDraft, DecisionOption, FundingSourceOption, GlobalParcel } from "@/types";
import {
  DecisionDraftFields,
  emptyDecisionDraftForm,
  isDecisionDraftFormValid,
  type DecisionDraftFormValue,
} from "./decision_draft_form";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

function fundingSourceLabel(fs: FundingSourceOption): string {
  const org = fs.organization_name?.trim() ?? "";
  const type = fs.source_type?.trim() ?? "";
  if (!type || org.toLocaleLowerCase() === type.toLocaleLowerCase()) return org || type;
  return `${org} — ${type}`;
}

/**
 * Захирамжид холбогдох нэгж талбарын БҮХ хуудсыг татна.
 *
 * Төлөвийг НЭРЭЭР биш, «Нэгж талбарын статус» тохиргооны «Захирамжид
 * холбогдоно» (parcel_status.is_released) тэмдгээр шүүнэ — backend нь
 * холбоход мөн энэ тэмдгийг шалгадаг (domain.ErrParcelNotReleased).
 */
async function listAllParcels(params: { general_category_id?: number }) {
  const out: GlobalParcel[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await parcelApi.list({
      ...params,
      released_only: true,
      unlinked_only: true,
      page,
      page_size: PAGE_SIZE,
      sort: "parcel_id",
      order: "asc",
    });
    out.push(...(res.data ?? []));
    if (page >= (res.total_pages ?? 1)) break;
  }
  return out;
}

/**
 * Захирамжийн төсөл ҮҮСГЭХ попап.
 *
 * Төслийн мэдээллийн хамт «Захирамжид холбогдоно» тэмдэгтэй (Нэгж талбарын
 * статус тохиргоо) төлөвтэй, ямар ч захирамжид холбогдоогүй нэгж талбаруудыг
 * жагсааж, checkbox-оор сонгосныг үүсгэхдээ ХАМТ
 * холбоно. Нэгж талбар холбоход санхүүгийн эх үүсвэр заавал шаардлагатай
 * (backend дүрэм) тул нэг эх үүсвэр + дүн сонгуулж, сонгосон бүх талбарыг тэр
 * эх үүсвэрээр холбоно — бусдыг дараа нь дэлгэрэнгүйгээс нэмнэ.
 *
 * Ерөнхий ангиллаар шүүнэ; хэрэглэгчийн хэлтэст холбогдсон ангилал анх
 * автоматаар сонгогдоно (хяналтын самбартай ижил).
 */
export function CreateDecisionDraftDialog({
  workTypes,
  budgets,
  onClose,
  onCreated,
}: {
  workTypes: DecisionOption[];
  budgets: DecisionOption[];
  onClose: () => void;
  onCreated: (draft: DecisionDraft) => void;
}) {
  const [form, setForm] = useState<DecisionDraftFormValue>(emptyDecisionDraftForm);
  const [fundingSourceId, setFundingSourceId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [genCat, setGenCat] = useState(0);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Хэлтсийн ангилал — нэг удаа анхдагчаар сонгоно.
  const deptCat = useDepartmentGeneralCategory();
  const [deptApplied, setDeptApplied] = useState(false);
  useEffect(() => {
    if (deptApplied || !deptCat.ready) return;
    if (deptCat.categoryId) setGenCat(deptCat.categoryId);
    setDeptApplied(true);
  }, [deptApplied, deptCat.ready, deptCat.categoryId]);

  const { data: genCats = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
  });
  // «Захирамжид холбогдоно» тэмдэгтэй төлөвүүдийн нэр — тайлбарт л харуулна.
  const releasedNames = useParcelStatusNamesWithRule("is_released", []);
  const { data: fundingOptions = [], isLoading: fundingLoading } = useQuery({
    queryKey: ["funding-source-options"],
    queryFn: () => fundingSourceOptionApi.list(),
  });

  const parcelsQuery = useQuery({
    queryKey: ["decision-create-parcels", genCat],
    queryFn: () => listAllParcels({ general_category_id: genCat || undefined }),
    enabled: deptApplied,
  });
  const parcels = useMemo(() => parcelsQuery.data ?? [], [parcelsQuery.data]);

  // Шүүлт солигдоход жагсаалтад байхгүй болсон сонголтыг хасна.
  useEffect(() => {
    setSelected((cur) => {
      const ids = new Set(parcels.map((p) => p.id));
      const next = new Set(Array.from(cur).filter((id) => ids.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [parcels]);

  const visible = useMemo(() => {
    const q = term.trim().toLocaleLowerCase();
    if (!q) return parcels;
    return parcels.filter(
      (p) =>
        p.parcel_id.toLocaleLowerCase().includes(q) ||
        (p.acquisition_name ?? "").toLocaleLowerCase().includes(q),
    );
  }, [parcels, term]);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });

  const amount = Number(amountText.replace(/,/g, ""));
  const amountValid = amountText.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  const needsFunding = selected.size > 0;
  const fundingValid = !needsFunding || (!!fundingSourceId && amountValid);
  const canSubmit = isDecisionDraftFormValid(form) && fundingValid && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    let draft: DecisionDraft | undefined;
    try {
      draft = await decisionDraftApi.create({
        proposal_no: form.proposal_no.trim(),
        location: form.location.trim(),
        duration_year: form.duration_year ? Number(form.duration_year) : null,
        work_type_id: form.work_type_id || null,
        budget_id: form.budget_id || null,
      });
    } catch (err) {
      toast.error(getApiError(err, "Үүсгэхэд алдаа гарлаа"));
      setSaving(false);
      return;
    }
    if (!draft) {
      toast.error("Үүсгэхэд алдаа гарлаа");
      setSaving(false);
      return;
    }

    // Нэгж талбар холбох — эх үүсвэр нэмж, сонгосон бүх талбарыг тэр холбоосоор.
    const chosen = parcels.filter((p) => selected.has(p.id));
    const failed: string[] = [];
    if (chosen.length > 0) {
      try {
        const links = await decisionDraftApi.addFundingSource(draft.id, fundingSourceId, amount);
        const link = (links ?? []).find((l) => l.funding_source_id === fundingSourceId);
        if (!link) throw new Error("funding link missing");
        // Дараалан — нэг алдаа бусдыг зогсоохгүй.
        for (const p of chosen) {
          try {
            await decisionDraftApi.linkParcel(draft.id, p.id, link.id);
          } catch {
            failed.push(p.parcel_id);
          }
        }
      } catch (err) {
        toast.error(
          getApiError(err, "Санхүүгийн эх үүсвэр нэмж чадсангүй — нэгж талбарыг дэлгэрэнгүйгээс холбоно уу"),
        );
        setSaving(false);
        onCreated(draft);
        return;
      }
    }

    const linked = chosen.length - failed.length;
    if (failed.length > 0) {
      toast.warning(
        `Захирамжийн төсөл үүслээ. ${linked} нэгж талбар холбогдож, ${failed.length} холбогдсонгүй: ${failed.join(", ")}`,
        { duration: 15000 },
      );
    } else {
      toast.success(
        chosen.length > 0
          ? `Захирамжийн төсөл үүсч, ${linked} нэгж талбар холбогдлоо`
          : "Захирамжийн төсөл үүслээ",
      );
    }
    setSaving(false);
    onCreated(draft);
  }

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const lbl = "text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block";
  const section = "text-[13px] font-semibold text-slate-700 dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-white/[0.06] dark:bg-[#1e1f27]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#37394d]">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-white">
              Шинэ захирамжийн төсөл
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
              Захирамжийн дугаар болон огноог &quot;Явц нэмэх&quot; үед бөглөнө.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-40 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* 1. Төслийн мэдээлэл */}
          <DecisionDraftFields value={form} onChange={setForm} workTypes={workTypes} budgets={budgets} />

          {/* 2. Санхүүгийн эх үүсвэр — нэгж талбар сонгосон үед заавал */}
          <div>
            <p className={section}>Санхүүгийн эх үүсвэр{needsFunding ? " *" : ""}</p>
            <p className="mb-3 mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
              Сонгосон нэгж талбарууд энэ эх үүсвэрээр холбогдоно. Бусад эх үүсвэрийг
              дараа нь дэлгэрэнгүйгээс нэмнэ.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <label className={lbl}>Эх үүсвэр</label>
                <select
                  value={fundingSourceId}
                  onChange={(e) => setFundingSourceId(e.target.value)}
                  className={inp}
                  disabled={fundingLoading}
                >
                  <option value="">{fundingLoading ? "Уншиж байна…" : "— Сонгох —"}</option>
                  {fundingOptions.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fundingSourceLabel(fs)}
                      {fs.acquisition_name ? ` (${fs.acquisition_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Мөнгөн дүн</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  placeholder="0"
                  className={`${inp} tabular-nums`}
                />
              </div>
            </div>
          </div>

          {/* 3. Нэгж талбар */}
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className={section}>Нэгж талбар</p>
                <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                  {releasedNames.length > 0
                    ? `${releasedNames.map((n) => `«${n}»`).join(", ")} төлөвтэй, захирамжид холбогдоогүй нэгж талбарууд`
                    : "«Захирамжид холбогдоно» тэмдэгтэй төлөвтэй, захирамжид холбогдоогүй нэгж талбарууд"}
                </p>
              </div>
              <span className="rounded-md bg-[#02c0ce]/10 px-2 py-1 text-[12px] font-semibold text-[#02c0ce]">
                {selected.size} сонгосон
              </span>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <select value={genCat} onChange={(e) => setGenCat(Number(e.target.value))} className={inp}>
                <option value={0}>Бүх ерөнхий ангилал</option>
                {genCats
                  .filter((c) => c.parent_id == null)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Нэгж талбарын дугаар, чөлөөлөлтийн нэрээр хайх"
                  className={`${inp} pl-8`}
                />
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-100 dark:border-[#37394d]">
              {parcelsQuery.isLoading || !deptApplied ? (
                <div className="animate-pulse space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-9 rounded bg-slate-100 dark:bg-[#252630]" />
                  ))}
                </div>
              ) : parcelsQuery.isError ? (
                <p className="p-4 text-[12px] text-[#f1556c]">
                  {getApiError(parcelsQuery.error, "Нэгж талбарыг татаж чадсангүй")}
                </p>
              ) : visible.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
                  Нэгж талбар олдсонгүй
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-[#37394d] dark:bg-[#1a1d20]">
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Бүгдийг сонгох"
                          className="h-4 w-4 accent-[#02c0ce]"
                        />
                      </th>
                      {["Дугаар", "Чөлөөлөлт", "Нөлөөлөлд өртсөн талбай", "Зориулалт"].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                    {visible.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`cursor-pointer transition-colors ${
                          selected.has(p.id)
                            ? "bg-[#02c0ce]/[0.07]"
                            : "hover:bg-slate-50/60 dark:hover:bg-[#252630]"
                        }`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                            className="h-4 w-4 accent-[#02c0ce]"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                          {p.parcel_id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          <p className="max-w-[340px] whitespace-normal break-words">{p.acquisition_name || "—"}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">
                          {formatArea(p.acquisition_area_m2 || p.area_m2)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{p.landuse || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-[#37394d]">
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {needsFunding && !fundingValid
              ? "Нэгж талбар холбоход санхүүгийн эх үүсвэр ба дүн шаардлагатай."
              : !isDecisionDraftFormValid(form)
                ? "Төслийн бүх талбарыг бөглөнө үү."
                : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-40 dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-300"
            >
              Болих
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#02a3af] disabled:opacity-60"
            >
              {saving
                ? "Үүсгэж байна…"
                : selected.size > 0
                  ? `Үүсгэж ${selected.size} нэгж талбар холбох`
                  : "Үүсгэх"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
