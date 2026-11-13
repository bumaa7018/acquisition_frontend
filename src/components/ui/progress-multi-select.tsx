"use client";

// Гүйцэтгэлийн ХУВИАР шүүх олон сонголттой цэс — YearMultiSelect-тэй ижил
// харагдац/ажиллагаатай. Сонгосон хүрээнүүд OR-оор нийлнэ.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Percent, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Хүрээнүүд (хоёр тал багтана). Түлхүүр нь backend-ийн `progress` параметр. */
export const PROGRESS_RANGES = [
  { key: "0-20", label: "0–20%" },
  { key: "21-50", label: "21–50%" },
  { key: "51-80", label: "51–80%" },
  { key: "81-100", label: "81–100%" },
] as const;

const ORDER: string[] = PROGRESS_RANGES.map((r) => r.key);

function rangesLabel(value: string[]): string {
  if (value.length <= 2) {
    return value
      .map((k) => PROGRESS_RANGES.find((r) => r.key === k)?.label ?? k)
      .join(", ");
  }
  return `${value.length} хүрээ`;
}

export function ProgressMultiSelect({
  value,
  onChange,
  placeholder = "Бүх гүйцэтгэл",
  className,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (key: string) => {
    onChange(
      value.includes(key)
        ? value.filter((k) => k !== key)
        : [...value, key].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
    );
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-all",
          open ? "border-[#02c0ce] ring-2 ring-[#02c0ce]/15" : "border-slate-200 dark:border-white/[0.08]",
          "bg-white dark:bg-[#1e1f27]",
        )}
      >
        <Percent className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span
          className={cn(
            "flex-1 truncate text-left",
            value.length === 0 ? "text-slate-400" : "text-slate-700 dark:text-white",
          )}
        >
          {value.length === 0 ? placeholder : rangesLabel(value)}
        </span>
        {value.length > 0 ? (
          <span
            role="button"
            tabIndex={-1}
            title="Цэвэрлэх"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="shrink-0"
          >
            <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-40 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/[0.08] dark:bg-[#252630]">
          {PROGRESS_RANGES.map((r) => {
            const checked = value.includes(r.key);
            return (
              <li
                key={r.key}
                onClick={() => toggle(r.key)}
                className="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-slate-50 dark:hover:bg-[#1e1f27]"
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                    checked ? "border-[#02c0ce] bg-[#02c0ce]" : "border-slate-300 dark:border-white/[0.2]",
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className={checked ? "font-semibold text-[#02c0ce]" : "text-slate-700 dark:text-slate-200"}>
                  {r.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
