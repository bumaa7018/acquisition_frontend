"use client";
import type { DocumentType } from "@/types";

/**
 * Шилжилтэд ЗААВАЛ байх хавсралтын төрлийг сонгох жагсаалт (үсгийн
 * дарааллаар эрэмбэлсэн төрлүүдийг дамжуулна).
 */
export function DocumentTypeChecklist({
  types,
  value,
  onChange,
  disabled,
}: {
  types: DocumentType[];
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  if (types.length === 0) {
    return <p className="text-[12px] text-slate-400 dark:text-slate-500">Хавсралтын төрөл бүртгэгдээгүй байна</p>;
  }
  return (
    <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-white/[0.08]">
      {types.map((t) => (
        <label
          key={t.id}
          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#252630]"
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-[#02c0ce]"
            checked={value.includes(t.id)}
            disabled={disabled}
            onChange={() => toggle(t.id)}
          />
          <span>{t.name}</span>
        </label>
      ))}
    </div>
  );
}
