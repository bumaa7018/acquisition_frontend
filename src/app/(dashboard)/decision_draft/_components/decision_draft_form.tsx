"use client";
import { useState } from "react";
import type { DecisionOption, DecisionDraft } from "@/types";

// Үүсгэх/засварлах формын утга.
//   · Захирамжийн дугаар/огноо энд БАЙХГҮЙ — "Явц нэмэх" үед бөглөнө.
//   · Санхүүгийн эх үүсвэр энд БАЙХГҮЙ — төслийг үүсгэсний дараа дэлгэрэнгүй
//     хэсгээс олноор нь нэмнэ.
export type DecisionDraftFormValue = {
  proposal_no: string;
  location: string;
  duration_year: string;
  work_type_id: number;
  budget_id: number;
};

type Props = {
  initial?: DecisionDraft;
  workTypes: DecisionOption[];
  budgets: DecisionOption[];
  submitLabel: string;
  isPending: boolean;
  onSubmit: (value: DecisionDraftFormValue) => void;
  onCancel: () => void;
};

function toFormValue(d?: DecisionDraft): DecisionDraftFormValue {
  return {
    proposal_no: d?.proposal_no ?? "",
    location: d?.location ?? "",
    duration_year: d?.duration_year ? String(d.duration_year) : "",
    work_type_id: d?.work_type_id ?? 0,
    budget_id: d?.budget_id ?? 0,
  };
}

export function DecisionDraftForm({
  initial,
  workTypes,
  budgets,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<DecisionDraftFormValue>(() => toFormValue(initial));

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
  const lbl = "text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 block";

  // Бүх талбарыг бөглүүлнэ (шаардлага: "Шинээр үүсгэхэд бүх мэдээллийг бөглүүлнэ")
  const isValid =
    form.proposal_no.trim() !== "" &&
    form.location.trim() !== "" &&
    form.duration_year.trim() !== "" &&
    form.work_type_id !== 0 &&
    form.budget_id !== 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className={lbl}>Саналын хуудасны дугаар *</label>
          <input
            value={form.proposal_no}
            onChange={(e) => setForm((f) => ({ ...f, proposal_no: e.target.value }))}
            placeholder="жишээ: СХ-2026/001"
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Байршил *</label>
          <input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="жишээ: БЗД, 5-р хороо"
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Хугацаа (он) *</label>
          <input
            type="number"
            value={form.duration_year}
            onChange={(e) => setForm((f) => ({ ...f, duration_year: e.target.value }))}
            placeholder="жишээ: 2026"
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>Ажлын төрөл *</label>
          <select
            value={form.work_type_id}
            onChange={(e) => setForm((f) => ({ ...f, work_type_id: Number(e.target.value) }))}
            className={inp}
          >
            <option value={0}>— Сонгох —</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Төсөв *</label>
          <select
            value={form.budget_id}
            onChange={(e) => setForm((f) => ({ ...f, budget_id: Number(e.target.value) }))}
            className={inp}
          >
            <option value={0}>— Сонгох —</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={isPending || !isValid}
          className="rounded-lg bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] disabled:opacity-60 transition-colors"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors"
        >
          Болих
        </button>
      </div>
    </div>
  );
}
