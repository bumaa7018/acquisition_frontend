"use client";

// Нэгж талбарын «Судалгаа» таб — чөлөөлөгдсөн газрын судалгаа.
//
// Нөхөх олговор олгосны дараа нэгж талбарын үлдэгдэл иргэнээс асууна. Нэгж
// талбар үүсэхэд хоосон бүртгэл автоматаар үүсдэг тул энд зөвхөн бөглөнө;
// дахин хадгалахад орлогдоно. Тоог «+»/«−»-ээр нэг нэгээр өөрчилнө (1-ээс
// хасвал хариултгүй болно); байршлын сонголтыг дахин дарвал арилна.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Eraser, Loader2, Minus, Plus, Save } from "lucide-react";
import { parcelSurveyApi } from "@/lib/api";
import { formatDate, getApiError } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  RELOCATION_LABELS,
  RELOCATION_QUESTION,
  SURVEY_COUNT_MAX,
  SURVEY_COUNT_QUESTIONS,
  isSurveyAnswered,
} from "@/lib/parcel-survey";
import type { ParcelSurvey, ParcelSurveyInput, RelocationType } from "@/types";
import { INP } from "./constants";

const EMPTY_FORM: ParcelSurveyInput = {
  chimney_count: null,
  toilet_count: null,
  cohabitant_count: null,
  relocation_type: "",
  relocation_address: "",
  note: "",
};

function toForm(s: ParcelSurvey | null | undefined): ParcelSurveyInput {
  if (!s) return EMPTY_FORM;
  return {
    chimney_count: s.chimney_count,
    toilet_count: s.toilet_count,
    cohabitant_count: s.cohabitant_count,
    relocation_type: s.relocation_type,
    relocation_address: "",
    note: s.note,
  };
}

function OptionButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 flex-1 rounded-lg border px-3 text-[13px] font-semibold transition-colors disabled:cursor-default
        ${
          active
            ? "border-[#02c0ce] bg-[#02c0ce] text-white"
            : "border-slate-200 bg-white text-slate-600 enabled:hover:border-[#02c0ce] enabled:hover:text-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-300"
        }`}
    >
      {label}
    </button>
  );
}

/** Тоон хариулт — одоогийн тоо ба «−»/«+» товч (хоосон үед «+» нь 1 болгоно). */
function CountStepper({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-default disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Хасах"
        disabled={disabled || value == null}
        onClick={() => onChange(value != null && value > 1 ? value - 1 : null)}
        className={`${base} border-slate-200 bg-white text-slate-600 enabled:hover:border-[#02c0ce] enabled:hover:text-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-300`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        className={`min-w-[3rem] text-center text-[18px] font-bold tabular-nums ${
          value == null ? "text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-white"
        }`}
      >
        {value ?? 0}
      </span>
      <button
        type="button"
        aria-label="Нэмэх"
        disabled={disabled || (value ?? 0) >= SURVEY_COUNT_MAX}
        onClick={() => onChange((value ?? 0) + 1)}
        className={`${base} border-[#02c0ce] bg-[#02c0ce] text-white enabled:hover:border-[#02a3af] enabled:hover:bg-[#02a3af]`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function QuestionRow({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center border-b border-slate-100 dark:border-[#37394d] last:border-0">
      <div>
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{question}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SurveyTab({ parcelId, canEdit }: { parcelId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data: survey, isLoading } = useQuery({
    queryKey: ["parcel-survey", parcelId],
    queryFn: () => parcelSurveyApi.get(parcelId),
    enabled: !!parcelId,
  });

  const [form, setForm] = useState<ParcelSurveyInput>(EMPTY_FORM);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => setForm(toForm(survey)), [survey]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["parcel-survey", parcelId] });
    void queryClient.invalidateQueries({ queryKey: ["parcel-surveys"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => parcelSurveyApi.save(parcelId, form),
    onSuccess: () => {
      toast.success("Судалгаа хадгалагдлаа");
      invalidate();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const clearMutation = useMutation({
    mutationFn: () => parcelSurveyApi.clear(parcelId),
    onSuccess: () => {
      toast.success("Судалгааны хариулт цэвэрлэгдлээ");
      invalidate();
    },
    onError: (err) => toast.error(getApiError(err, "Цэвэрлэхэд алдаа гарлаа")),
  });

  const answered = isSurveyAnswered(survey);

  const busy = saveMutation.isPending || clearMutation.isPending;

  const toggleRelocation = (value: RelocationType) =>
    setForm((f) => ({ ...f, relocation_type: f.relocation_type === value ? "" : value }));

  if (isLoading) {
    return (
      <div className="ap-card p-5 space-y-2 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  }

  if (!answered && !canEdit) {
    return (
      <div className="ap-card flex flex-col items-center justify-center py-16 text-center">
        <ClipboardList className="h-10 w-10 text-slate-300 dark:text-[#37394d] mb-3" />
        <p className="text-[13px] text-slate-400 dark:text-slate-500">
          Чөлөөлөгдсөн газрын судалгаа бөглөгдөөгүй байна
        </p>
      </div>
    );
  }

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <ClipboardList className="h-3.5 w-3.5 text-[#02c0ce]" />
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Чөлөөлөгдсөн газрын судалгаа
        </p>
        {answered && survey ? (
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
            Сүүлд шинэчилсэн: {formatDate(survey.updated_at)}
          </span>
        ) : (
          <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            Бөглөөгүй
          </span>
        )}
      </div>

      <div className="px-5">
        {SURVEY_COUNT_QUESTIONS.map((q) => (
          <QuestionRow key={q.field} title={q.title} question={q.question}>
            <CountStepper
              value={form[q.field]}
              disabled={!canEdit || busy}
              onChange={(v) => setForm((f) => ({ ...f, [q.field]: v }))}
            />
          </QuestionRow>
        ))}

        <QuestionRow title="Шилжин суурьшсан байршил" question={RELOCATION_QUESTION}>
          <div className="flex gap-2">
            {(Object.keys(RELOCATION_LABELS) as RelocationType[]).map((value) => (
              <OptionButton
                key={value}
                label={RELOCATION_LABELS[value]}
                active={form.relocation_type === value}
                disabled={!canEdit || busy}
                onClick={() => toggleRelocation(value)}
              />
            ))}
          </div>
        </QuestionRow>

        <QuestionRow title="Тайлбар" question="Нэмэлт тэмдэглэл">
          <textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            disabled={!canEdit || busy}
            rows={2}
            className={`${INP} h-auto py-2`}
          />
        </QuestionRow>
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-[#37394d]">
          {answered && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmClear(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-500 transition-colors hover:border-red-300 hover:text-red-500 disabled:opacity-60 dark:border-white/[0.08] dark:text-slate-300"
            >
              <Eraser className="h-4 w-4" />
              Цэвэрлэх
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => saveMutation.mutate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#02a3af] disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Хадгалах
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Судалгааны хариултыг цэвэрлэх үү?"
        description="Энэ нэгж талбарын судалгааны бүх хариулт хоосорно."
        confirmLabel="Цэвэрлэх"
        onConfirm={() => {
          setConfirmClear(false);
          clearMutation.mutate();
        }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
