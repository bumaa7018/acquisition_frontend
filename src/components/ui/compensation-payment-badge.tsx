import type { CompensationPaymentInfo } from "@/types";

/**
 * Нөхөх олговрын олголтын гүйцэтгэл — «Нөхөх олговор олгосон баримт»-аас
 * (60% / 40% / бүрэн). Нийт хувь ба шат бүрийн олгосон огноо.
 */
export function CompensationPaymentBadge({ info }: { info: CompensationPaymentInfo }) {
  const percent = info.compensation_paid_percent ?? 0;
  if (percent === 0) {
    return <span className="text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">0%</span>;
  }
  const stages: { label: string; at?: string | null }[] = info.compensation_paid_full
    ? [{ label: "Бүрэн (100%)", at: info.compensation_paid_full_at }]
    : [
        ...(info.compensation_paid_60 ? [{ label: "60%", at: info.compensation_paid_60_at }] : []),
        ...(info.compensation_paid_40 ? [{ label: "40%", at: info.compensation_paid_40_at }] : []),
      ];
  const done = percent >= 100;
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
          done
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400"
        }`}
      >
        {done ? "Бүрэн олгосон" : `${percent}% олгосон`}
      </span>
      {stages.map((s) => (
        <span key={s.label} className="whitespace-nowrap text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
          {s.label}: {s.at ?? "—"}
        </span>
      ))}
    </div>
  );
}
