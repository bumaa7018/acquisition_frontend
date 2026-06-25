"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { X, ChevronDown } from "lucide-react";
import { Highlight } from "./highlight";

export function PlanSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["acq-list-all"],
    queryFn: () => landApi.list({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  });

  const plans = Array.from(
    new Map(
      (data?.data ?? [])
        .filter((a) => a.plan_code)
        .map((a) => [
          a.plan_code,
          { plan_code: a.plan_code, name: a.plan_name ?? "" },
        ]),
    ).values(),
  );

  const filtered = query.trim()
    ? plans.filter(
        (p) =>
          p.plan_code.toLowerCase().includes(query.trim().toLowerCase()) ||
          p.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : plans;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  function select(p: { plan_code: string; name: string }) {
    setQuery(p.plan_code);
    onChange(p.plan_code);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    onChange("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          placeholder="Төлөвлөгөөний дугаар"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
        />
        {query ? (
          <button
            onClick={clear}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Олдсонгүй
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.plan_code}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(p);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
                >
                  <span className="text-[13px] text-slate-700 dark:text-slate-200">
                    <Highlight text={p.plan_code} query={query} />
                  </span>
                  {p.name && (
                    <>
                      <span className="text-[12px] text-slate-300 dark:text-slate-600 mx-1.5">
                        |
                      </span>
                      <span className="text-[12px] text-slate-500 dark:text-slate-400">
                        <Highlight text={p.name} query={query} />
                      </span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
