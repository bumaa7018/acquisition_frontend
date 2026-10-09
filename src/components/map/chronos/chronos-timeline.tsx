"use client";
import { useEffect, useRef, useState } from "react";
import { History, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/chronos";

/** ▶ тоглуулахад нэг сарын хугацаа. */
const STEP_MS = 1400;

/**
 * «Цаг хугацааны өөрчлөлт» — сар бүрийн явцын өөрчлөлтийн тоо (багана), дарж,
 * чирж эсвэл гулсуураар сар сонгоно. value = null бол одоогийн байдал (сүүлийн
 * сар). Дашбоардын тоо, «Он цагийн зураг» хоёулаа энэ сонголтоор шинэчлэгдэнэ.
 */
export function ChronosTimeline({
  months,
  counts,
  value,
  onChange,
  loading,
  variant = "card",
}: {
  months: string[];
  counts: Map<string, number>;
  value: number | null;
  onChange: (index: number | null) => void;
  loading?: boolean;
  /** card — дашбоардын карт; overlay — газрын зургийн бүтэн дэлгэц дээр (харанхуй). */
  variant?: "card" | "overlay";
}) {
  const [playing, setPlaying] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const max = Math.max(1, ...months.map((m) => counts.get(m) ?? 0));
  const active = value ?? months.length - 1;
  const valueRef = useRef(value);
  valueRef.current = value;

  // ▶ — сонгоогүй бол эхнээс; төгсгөлд эхэнд буцна. Unmount үед цэвэрлэнэ.
  useEffect(() => {
    if (!playing || months.length < 2) return;
    const id = window.setInterval(() => {
      const cur = valueRef.current;
      onChange(cur === null || cur >= months.length - 1 ? 0 : cur + 1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, months.length, onChange]);

  // Сонгосон сар үргэлж харагдана.
  useEffect(() => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-month="${active}"]`);
    if (!box || !el) return;
    box.scrollTo({ left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2), behavior: "smooth" });
  }, [active, months.length]);

  const monthAt = (clientX: number) => {
    const rail = railRef.current;
    if (!rail || !months.length) return 0;
    const rect = rail.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width - 1);
    return Math.min(months.length - 1, Math.floor((x / rect.width) * months.length));
  };

  const dark = variant === "overlay";
  const muted = dark ? "text-[#8E97A3]" : "text-slate-400 dark:text-slate-500";
  return (
    <div className={cn(
      "flex w-full min-w-0 flex-col gap-3",
      dark ? "rounded-xl border border-[#222A35] bg-[rgba(18,22,28,.88)] p-3 text-[#ECE6D9] backdrop-blur" : "",
    )}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", dark ? "" : "text-slate-700 dark:text-slate-200")}>
          <History className="h-4 w-4 text-[#F2A541]" /> Цаг хугацааны өөрчлөлт
        </p>
        <div className="flex items-center gap-3">
          {value !== null && months[value] && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F2A541]/15 px-2.5 py-1 text-[12px] font-semibold text-[#c77a12] dark:text-[#FFD9A0]">
              {monthLabel(months[value])} байдлаар
              <button type="button" aria-label="Одоогийн байдал руу буцах" title="Одоогийн байдал" onClick={() => { setPlaying(false); onChange(null); }}
                className="rounded-full p-0.5 hover:bg-[#F2A541]/20">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {months.length > 1 && (
            <input type="range" min={0} max={months.length - 1} value={active} aria-label="Сар сонгох"
              onChange={(e) => { setPlaying(false); onChange(Number(e.target.value)); }}
              className="h-1.5 w-32 cursor-pointer accent-[#F2A541] sm:w-44" />
          )}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <button type="button" aria-label={playing ? "Зогсоох" : "Тоглуулах"} onClick={() => setPlaying((v) => !v)}
          disabled={months.length < 2}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F2A541] text-[#1a1206] shadow-sm transition-transform hover:scale-105 disabled:opacity-40">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto pb-1">
          {loading ? (
            <div className={cn("flex h-[74px] items-center text-[12px]", muted)}>Ачаалж байна…</div>
          ) : (
            <div
              ref={railRef}
              role="slider"
              tabIndex={0}
              aria-label="Сар сонгох"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, months.length - 1)}
              aria-valuenow={active}
              aria-valuetext={months[active] ? monthLabel(months[active]) : ""}
              onPointerDown={(e) => {
                scrubbing.current = true;
                setPlaying(false);
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                onChange(monthAt(e.clientX));
              }}
              onPointerMove={(e) => {
                if (!scrubbing.current) return;
                const i = monthAt(e.clientX);
                if (i !== valueRef.current) onChange(i);
              }}
              onPointerUp={() => (scrubbing.current = false)}
              onPointerCancel={() => (scrubbing.current = false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") onChange(Math.min(months.length - 1, active + 1));
                else if (e.key === "ArrowLeft") onChange(Math.max(0, active - 1));
                else if (e.key === "Home") onChange(0);
                else if (e.key === "End") onChange(months.length - 1);
                else return;
                e.preventDefault();
              }}
              className="flex cursor-pointer touch-none select-none items-end gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#F2A541]/50"
              style={{ minWidth: months.length * 50 }}
            >
              {months.map((m, i) => {
                const n = counts.get(m) ?? 0;
                const isSel = value !== null && i === value;
                const past = i <= active;
                return (
                  <div key={m} data-month={i} title={`${monthLabel(m)} — ${n} өөрчлөлт`} className="flex min-w-[46px] flex-1 flex-col items-stretch">
                    <span className={cn("mb-0.5 block text-center text-[11px] font-semibold tabular-nums leading-none",
                      isSel ? "text-[#c77a12] dark:text-[#FFD9A0]" : n ? (dark ? "text-[#A7AFBA]" : "text-slate-600 dark:text-slate-300") : muted)}>
                      {n}
                    </span>
                    <span className="block rounded-t-[3px] transition-[height,background-color] duration-300"
                      style={{
                        height: 6 + Math.round((36 * n) / max),
                        background: isSel ? "#F2A541" : past ? "#3E9C8F" : dark ? "#1B2430" : "rgba(148,163,184,.35)",
                      }} />
                    <span className={cn("mt-1 block whitespace-nowrap text-center text-[11px] tabular-nums",
                      isSel ? "font-semibold text-[#c77a12] dark:text-[#FFD9A0]" : muted)}>
                      {monthLabel(m)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
