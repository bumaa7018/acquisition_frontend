"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Box, ChevronLeft, ChevronRight, ExternalLink, Loader2, Pause, Play, X } from "lucide-react";
import { dashboardApi, type DashboardData } from "@/lib/api";
import { overviewAt } from "@/lib/chronos-overview";
import { AcquisitionOverviewPanel } from "../acquisition-overview-panel";
import { RIGHT_TYPE_LABELS, type FinanceDashboardData } from "@/types";
import { cn, formatMillion } from "@/lib/utils";
import { AbbrevAmount } from "@/components/ui/amount-hint";
import {
  CHRONOS_NO_COLOR,
  CHRONOS_NOT_STARTED,
  monthKey,
  monthLabel,
  monthRange,
  statsAt,
  statusAt,
  type ChronosParcel,
  type ChronosStatus,
} from "@/lib/chronos";
import { DEFAULT_BASEMAP_MAX_ZOOM, DEFAULT_BASEMAP_URLS, getBasemapSetting, isBasemapActive } from "../basemap-config";
import { ChronosRenderer, DARK_MAP_MAX_ZOOM, DARK_MAP_TILES, type ChronosBasemap } from "./chronos-renderer";
import { chronosBody as body, chronosDisplay as display, chronosMono as mono } from "@/lib/chronos-fonts";


/** ▶ тоглуулахад нэг сарын хугацаа. */
const STEP_MS = 1400;

/** Одоогийн суурь зургийн tile хаяг — xyz тохиргоо байвал түүнийг, үгүй бол үндсэн. */
function basemapTiles(): { urls: string[]; maxZoom: number } {
  const setting = getBasemapSetting();
  if (isBasemapActive(setting) && setting?.type === "xyz" && setting.url) {
    return { urls: [setting.url], maxZoom: setting.max_zoom || DEFAULT_BASEMAP_MAX_ZOOM };
  }
  return { urls: [...DEFAULT_BASEMAP_URLS], maxZoom: DEFAULT_BASEMAP_MAX_ZOOM };
}

/** Сонгосон сарын байдлаарх төлөвийн badge — бүртгэлийн өнгөөр. */
function statusTone(p: ChronosParcel, asOfKey: string, statuses: Map<number, ChronosStatus>): { label: string; bg: string; fg: string } {
  const id = statusAt(p.events, asOfKey);
  const st = id === null ? undefined : statuses.get(id);
  if (!st) return { label: "Чөлөөлөгдөөгүй", bg: "var(--ch-planned-bg)", fg: "var(--ch-planned-text)" };
  const color = st.color || CHRONOS_NO_COLOR;
  return { label: st.name, bg: `${color}2e`, fg: color };
}

const ha = (m2: number) => (m2 / 10_000).toLocaleString("mn-MN", { maximumFractionDigits: 2 });
const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 100) / total) : 0);

/**
 * «Он цагийн зураг» — нэгж талбарын явцыг САРААР дүрслэх бүтэн дэлгэцийн изометр
 * харагдац. Сонгосон сарын байдлаар: өнгө = явцын төлөв, өндөр = явц (ахих
 * тусам намхан «хашаа»), чөлөөлсөн = тасархай контур; төлөв нь өөрчлөгдсөн нэгж
 * талбар газраас дээш босно. Баруун талын статистик сонгосон сараар шинэчлэгдэнэ.
 *
 * acquisitionIds — undefined бол бүх чөлөөлөлт, [] бол өгөгдөлгүй.
 */
export function ChronosView({
  acquisitionIds,
  onClose,
  baseData,
  baseFinance,
  title,
  subtitle,
}: {
  acquisitionIds?: string[];
  onClose: () => void;
  /** Газрын зургийн бүтэн дэлгэцийн хураангуйн өгөгдөл (ангилал, байршил, хариуцагч…). */
  baseData?: DashboardData;
  baseFinance?: FinanceDashboardData | null;
  title?: string;
  subtitle?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ChronosRenderer | null>(null);
  const [mountNode, setMountNode] = useState<Element | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const none = acquisitionIds !== undefined && acquisitionIds.length === 0;
  const { data, isLoading, error } = useQuery({
    queryKey: ["chronos", acquisitionIds ?? "all"],
    queryFn: () => dashboardApi.chronos(acquisitionIds),
    enabled: !none,
    staleTime: 60_000,
  });

  const months = useMemo(() => monthRange(data?.months ?? []), [data?.months]);
  const counts = useMemo(() => new Map((data?.months ?? []).map((m) => [m.month, m.count])), [data?.months]);
  const maxCount = useMemo(() => Math.max(1, ...Array.from(counts.values())), [counts]);
  const parcels = useMemo(() => data?.parcels ?? [], [data?.parcels]);
  const statuses = useMemo(() => data?.statuses ?? [], [data?.statuses]);
  const statusById = useMemo(() => new Map(statuses.map((st) => [st.id, st])), [statuses]);
  const ordered = useMemo(() => [...parcels].sort((a, b) => a.parcel_id.localeCompare(b.parcel_id)), [parcels]);

  const [asOf, setAsOf] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [basemap, setBasemap] = useState<ChronosBasemap>("dark");
  const [selected, setSelected] = useState<string | null>(null);

  const asOfKey = months[asOf] ?? "";
  // Сонгосон сарын байдлаарх статистик — цагийн голтой хамт шинэчлэгдэнэ.
  const stats = useMemo(() => statsAt(parcels, statuses, asOfKey), [parcels, statuses, asOfKey]);
  // Зүүн талын статистик — бүтэн дэлгэцийн хураангуйтай ижил, сонгосон сарын байдлаар.
  const overview = useMemo(
    () => overviewAt(baseData, baseFinance, data ?? { statuses: [], parcels: [], months: [], truncated: false }, asOfKey),
    [baseData, baseFinance, data, asOfKey],
  );
  const legend = useMemo(
    () => [...statuses].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [statuses],
  );
  const selectedParcel = useMemo(() => parcels.find((p) => p.id === selected) ?? null, [parcels, selected]);

  // Бүтэн дэлгэцийн (газрын зураг) горимд зөвхөн тэр элемент харагддаг.
  useEffect(() => {
    setMountNode(document.fullscreenElement ?? document.body);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  // Renderer — canvas бэлэн болмогц нэг удаа.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = new ChronosRenderer(canvas, reducedMotion);
    rendererRef.current = r;
    const resize = () => r.resize(wrap.clientWidth, wrap.clientHeight, window.devicePixelRatio || 1);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
  }, [mountNode, reducedMotion]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setData(parcels, months, statuses);
    // Анх нээхэд хамгийн сүүлийн сар (бүх чөлөөлсөн харагдана).
    setAsOf(Math.max(0, months.length - 1));
  }, [parcels, months, statuses, mountNode, reducedMotion]);

  useEffect(() => rendererRef.current?.setAsOf(asOf), [asOf, parcels, mountNode, reducedMotion]);
  useEffect(() => {
    const { urls, maxZoom } = basemap === "dark" ? { urls: DARK_MAP_TILES, maxZoom: DARK_MAP_MAX_ZOOM } : basemapTiles();
    rendererRef.current?.setBasemap(basemap, urls, maxZoom);
  }, [basemap, mountNode, reducedMotion]);
  useEffect(() => rendererRef.current?.setSelected(selected), [selected, mountNode, reducedMotion]);

  // ▶ — 1.4 сек тутам дараагийн сар, төгсгөлд эхэнд буцна.
  useEffect(() => {
    if (!playing || months.length < 2) return;
    const id = window.setInterval(() => setAsOf((i) => (i + 1) % months.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, months.length]);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!ordered.length) return;
      const i = selected ? ordered.findIndex((p) => p.id === selected) : -1;
      const next = ordered[(i + dir + ordered.length) % ordered.length];
      setSelected(next.id);
      rendererRef.current?.focus(next.id);
    },
    [ordered, selected],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " " && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  // Газрын зураг: чирж зөөх, дугуйгаар томруулах, дарж сонгох.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hoverAt = useRef<[number, number] | null>(null);
  const hoverRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(hoverRaf.current), []);
  const local = (e: React.PointerEvent | React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const r = rendererRef.current;
    if (!r) return;
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      if (drag.current.moved) {
        r.panBy(dx, dy);
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
      }
      return;
    }
    // Hover hit-test — кадр тутамд НЭГ л удаа (бүх нэгж талбарыг давтдаг).
    const [x, y] = local(e);
    hoverAt.current = [x, y];
    if (hoverRaf.current) return;
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = 0;
      const rr = rendererRef.current;
      if (!rr || !hoverAt.current) return;
      const id = rr.hitTest(hoverAt.current[0], hoverAt.current[1]);
      rr.setHover(id);
      if (canvasRef.current) canvasRef.current.style.cursor = id ? "pointer" : "grab";
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const [x, y] = local(e);
      const id = rendererRef.current?.hitTest(x, y) ?? null;
      setSelected(id);
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    const [x, y] = local(e);
    rendererRef.current?.zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
  };

  // Цагийн гол — дарж эсвэл чирж (scrub) сар сонгоно.
  const railRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Сонгосон сар үргэлж харагдана (тоглуулах, гараар шилжих үед хэвтээ гүйлгэнэ).
  useEffect(() => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-month="${asOf}"]`);
    if (!box || !el) return;
    const left = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? "auto" : "smooth" });
  }, [asOf, months.length, reducedMotion]);
  const scrubbing = useRef(false);
  const monthAt = (clientX: number) => {
    const rail = railRef.current;
    if (!rail || !months.length) return 0;
    const rect = rail.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width - 1);
    return Math.min(months.length - 1, Math.floor((x / rect.width) * months.length));
  };
  const onRailDown = (e: React.PointerEvent) => {
    scrubbing.current = true;
    setPlaying(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setAsOf(monthAt(e.clientX));
  };
  const onRailMove = (e: React.PointerEvent) => {
    if (!scrubbing.current) return;
    const i = monthAt(e.clientX);
    setAsOf((cur) => (cur === i ? cur : i));
  };
  const onRailUp = () => (scrubbing.current = false);
  const onRailKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") setAsOf((i) => Math.min(months.length - 1, i + 1));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setAsOf((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setAsOf(0);
    else if (e.key === "End") setAsOf(months.length - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };


  if (!mountNode) return null;
  const panelText = { color: "var(--ch-sub)" } as const;
  const weak = { color: "var(--ch-weak)" } as const;
  return createPortal(
    <div className={cn("ch-root", body.className)} role="dialog" aria-label="Он цагийн зураг — цаг хугацааны зураг">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => rendererRef.current?.setHover(null)}
          onWheel={onWheel}
        />
      </div>

      {/* Дээд — утсан дээр дараалан стэклэнэ */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex max-h-[calc(100%-176px)] flex-col gap-3 overflow-y-auto p-4 md:block md:max-h-none md:overflow-visible md:p-0">
        {/* Төв дээд — сонгосон сар (суурь зураг дээр уншигдах сүүдэртэй) */}
        <div className="pointer-events-none hidden text-center md:absolute md:left-1/2 md:top-6 md:block md:-translate-x-1/2"
          style={{ textShadow: "0 2px 12px rgba(7,9,13,.85), 0 0 2px rgba(7,9,13,.9)" }}>
          <div key={asOfKey} className={cn(display.className, "ch-big-number ch-slide-in")}>
            {asOfKey ? monthLabel(asOfKey) : "[ ]"}
          </div>
          <p className="mt-2 text-[13px]" style={panelText}>
            {stats.released.toLocaleString()} нэгж талбар чөлөөлөгдсөн · энэ сард {stats.changedThisMonth} өөрчлөлт
            {data?.truncated && " · эхний 5000 нэгж талбар"}
          </p>
        </div>
      </div>

      {/* Зүүн тал — газрын зургийн бүтэн дэлгэцийн статистиктай ИЖИЛ самбар, сонгосон сарын байдлаар */}
      {showStats && data && parcels.length > 0 && (
        <div className="dark pointer-events-auto absolute bottom-[176px] left-6 top-6 hidden w-[400px] md:block">
          <AcquisitionOverviewPanel
            embedded
            data={overview.data}
            finance={overview.finance}
            title={title || (overview.data.acquisitions.length === 1 ? overview.data.acquisitions[0].acquisition_name : `Нийт ${overview.data.acquisitions.length} чөлөөлөлт`)}
            subtitle={[subtitle, monthLabel(asOfKey)].filter(Boolean).join(" · ")}
            onClose={() => setShowStats(false)}
          />
        </div>
      )}

      {/* Баруун багана — Он цагийн зураг · Live · сонгосон нэгж талбар · төлөвийн тайлбар (доор) */}
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-col gap-3 md:bottom-[176px] md:left-auto md:right-6 md:top-6 md:w-[340px]">
        {/* Он цагийн зураг · Live */}
        <section className="ch-panel pointer-events-auto shrink-0" aria-label="Он цагийн зураг">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5" style={{ color: "var(--ch-accent)" }} aria-hidden />
            <span className={cn(display.className, "text-[17px]")}>Он цагийн зураг</span>
            <span className={cn(mono.className, "rounded-md border px-1.5 py-0.5 text-[10px]")}
              style={{ borderColor: "var(--ch-panel-border)", color: "var(--ch-sub)" }}>Live</span>
            <button type="button" aria-label="Хаах" onClick={onClose} className="ch-icon-button ml-auto h-9 w-9">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-4 text-[12px]" style={panelText}>Суурь</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="ch-chip" aria-pressed={basemap === "dark"} onClick={() => setBasemap("dark")}>Хар газрын зураг</button>
            <button type="button" className="ch-chip" aria-pressed={basemap === "imagery"} onClick={() => setBasemap("imagery")}>Суурь зураг</button>
          </div>
          <button type="button" className="ch-chip mt-3 inline-flex items-center gap-1.5" aria-pressed={showStats} onClick={() => setShowStats((v) => !v)}>
            <BarChart3 className="h-4 w-4" /> Статистик
          </button>
        </section>

        {/* Сонгосон нэгж талбар */}
        <section className="ch-panel pointer-events-auto hidden min-h-0 shrink overflow-y-auto md:block" aria-label="Сонгосон нэгж талбар">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px]" style={panelText}>Сонгосон нэгж талбар</span>
            <div className="flex gap-1.5">
              <button type="button" aria-label="Өмнөх нэгж талбар" className="ch-icon-button h-9 w-9" disabled={!ordered.length} onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Дараагийн нэгж талбар" className="ch-icon-button h-9 w-9" disabled={!ordered.length} onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {selectedParcel ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn(mono.className, "break-all text-[24px] font-semibold leading-none")}>{selectedParcel.parcel_id}</span>
                {(() => {
                  const tone = statusTone(selectedParcel, asOfKey, statusById);
                  return <span className="rounded-md px-2 py-0.5 text-[12px] font-medium" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>;
                })()}
              </div>
              <p className="mt-1 break-words text-[12px]" style={weak}>{selectedParcel.acquisition_name || "[ ]"}</p>
              <dl className="mt-3 space-y-1 text-[12px]">
                {([
                  ["Эзэмшигч", selectedParcel.holder_name],
                  ["Зориулалт", selectedParcel.landuse_name],
                  ["Эрхийн төрөл", RIGHT_TYPE_LABELS[selectedParcel.right_type] ?? ""],
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex items-start gap-2">
                    <dt className="w-[92px] shrink-0" style={weak}>{label}</dt>
                    <dd className="min-w-0 flex-1 break-words">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              {/* Нөхөх олговрын 3 үндсэн дүн */}
              <div className="mt-3 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]" style={weak}>
                  <span className="uppercase tracking-wider">Нөхөх олговор</span>
                  <span className={cn(mono.className, "text-[13px] font-semibold")} style={{ color: "var(--ch-text)" }}>
                    <AbbrevAmount value={selectedParcel.comp_land + selectedParcel.comp_real_state + selectedParcel.comp_property}>
                      {formatMillion(selectedParcel.comp_land + selectedParcel.comp_real_state + selectedParcel.comp_property)}
                    </AbbrevAmount>
                  </span>
                </div>
                <ul className="space-y-1 text-[12px]">
                  {([
                    ["#0acf97", "Газар", selectedParcel.comp_land],
                    ["#0f9ed5", "Үл хөдлөх хөрөнгө", selectedParcel.comp_real_state],
                    ["#f9bc0b", "Эд хөрөнгө", selectedParcel.comp_property],
                  ] as const).map(([color, label, value]) => (
                    <li key={label} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="min-w-0 flex-1" style={panelText}>{label}</span>
                      <span className={cn(mono.className, "shrink-0")}><AbbrevAmount value={value}>{formatMillion(value)}</AbbrevAmount></span>
                    </li>
                  ))}
                </ul>
              </div>
              <ol className="mt-3 max-h-[20vh] overflow-y-auto pr-1">
                {selectedParcel.events.map((ev, i) => {
                  const future = monthKey(ev.date) > asOfKey;
                  return (
                    <li key={i} className="grid grid-cols-[84px_14px_1fr] gap-2 text-[12px]" style={{ opacity: future ? 0.4 : 1 }}>
                      <span className={mono.className} style={panelText}>{ev.date.slice(0, 10).replaceAll("-", ".")}</span>
                      <span className="relative flex justify-center">
                        <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: statusById.get(ev.status_id)?.color || CHRONOS_NO_COLOR }} />
                        {i < selectedParcel.events.length - 1 && (
                          <span className="absolute top-4 h-[calc(100%-4px)] w-px" style={{ background: "var(--ch-panel-border)" }} />
                        )}
                      </span>
                      <span className="break-words pb-2.5">{ev.name || "[ ]"}</span>
                    </li>
                  );
                })}
              </ol>
              <Link href={`/parcel/${selectedParcel.id}?acq=${selectedParcel.acquisition_id}`} target="_blank"
                className="ch-cta mt-1 inline-flex w-full items-center justify-center gap-1.5">
                Дэлгэрэнгүй <ExternalLink className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <p className="mt-2 text-[12px]" style={weak}>Газрын зураг дээрх нэгж талбарыг дарж сонгоно уу.</p>
          )}
        </section>

        {/* Төлөвийн өнгөний тайлбар — баруун доор */}
        {legend.length > 0 && (
          <section className="ch-panel pointer-events-auto mt-auto hidden shrink-0 !p-3.5 md:block" aria-label="Төлөвийн тайлбар">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px]" style={panelText}>Өнгө = явцын төлөв · өндөр = явц (ахих тусам намхан)</span>
              {/* Луужин — хойд зүг шар (изометрт баруун-дээш 60°) */}
              <svg aria-label="Хойд зүг" className="h-8 w-8 shrink-0" viewBox="-24 -24 48 48">
                <circle r="22" fill="none" stroke="#222A35" />
                <g transform="rotate(60)">
                  <path d="M0 -16 L5 0 L-5 0 Z" fill="#F2A541" />
                  <path d="M0 16 L5 0 L-5 0 Z" fill="#6B7480" />
                </g>
              </svg>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {legend.map((st) => (
                <li key={st.id} className="flex items-center gap-2 text-[11px]" style={panelText}>
                  <span className="inline-block h-2.5 w-4 shrink-0 rounded-sm"
                    style={st.is_released ? { border: `1.5px dashed ${st.color || CHRONOS_NO_COLOR}` } : { background: st.color || CHRONOS_NO_COLOR }} />
                  <span className="min-w-0 break-words">{st.name}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-[11px]" style={weak}>
                <span className="inline-block h-2.5 w-4 shrink-0 rounded-sm" style={{ background: CHRONOS_NOT_STARTED }} /> Чөлөөлөгдөөгүй (түүх эхлээгүй)
              </li>
            </ul>
          </section>
        )}
      </div>

      {(isLoading || error || none || (data && parcels.length === 0)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px]" style={panelText}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Ачаалж байна…</span>
          ) : error ? (
            "Мэдээлэл ачаалахад алдаа гарлаа"
          ) : (
            "Геометртэй нэгж талбар алга"
          )}
        </div>
      )}

      {/* Доод — цагийн гол (дарж эсвэл чирж сар сонгоно) */}
      <section className="ch-panel absolute inset-x-4 bottom-4 flex items-end gap-4 md:inset-x-6 md:bottom-6">
        <button type="button" aria-label={playing ? "Зогсоох" : "Тоглуулах"} onClick={() => setPlaying((v) => !v)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--ch-accent)", color: "#1a1206" }}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex justify-between gap-3 text-[12px]" style={panelText}>
            <span>Сар бүрийн явцын өөрчлөлт</span>
            <span className="hidden sm:inline">Дарж эсвэл чирж сарыг сонгоно уу</span>
          </div>
          <div ref={scrollRef} className="overflow-x-auto pb-1">
            <div
              ref={railRef}
              role="slider"
              tabIndex={0}
              aria-label="Сар сонгох"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, months.length - 1)}
              aria-valuenow={asOf}
              aria-valuetext={asOfKey ? monthLabel(asOfKey) : ""}
              onPointerDown={onRailDown}
              onPointerMove={onRailMove}
              onPointerUp={onRailUp}
              onPointerCancel={onRailUp}
              onKeyDown={onRailKey}
              className="relative flex cursor-pointer touch-none select-none items-end gap-[3px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#F2A541]/50"
              // Сар бүр шошготой багтахаар — олон сар бол хэвтээ гүйлгэнэ.
              style={{ minWidth: months.length * 46 }}
            >
              {months.map((m, i) => {
                const n = counts.get(m) ?? 0;
                const isSel = i === asOf;
                const past = i < asOf;
                const yearStart = m.endsWith("-01") || i === 0;
                return (
                  <div key={m} data-month={i} title={`${monthLabel(m)} — ${n} нэгж талбарын өөрчлөлт`}
                    className="flex min-w-[43px] flex-1 flex-col items-stretch">
                    {/* Тухайн сарын өөрчлөлт орсон нэгж талбарын тоо */}
                    <span className={cn(mono.className, "mb-0.5 block text-center text-[11px] leading-none")}
                      style={{ color: isSel ? "var(--ch-accent-text)" : n ? "var(--ch-sub)" : "var(--ch-disabled)" }}>
                      {n}
                    </span>
                    <span className="ch-bar block rounded-t-[3px]"
                      style={{
                        height: 8 + Math.round((40 * n) / maxCount),
                        background: isSel ? "var(--ch-accent)" : past ? "var(--ch-ramp-1)" : "#1B2430",
                        transform: isSel ? "scaleY(1.06)" : undefined,
                        transformOrigin: "bottom",
                      }} />
                    <span className="ch-bar mt-0.5 block h-[2px]" style={{ background: i <= asOf ? "var(--ch-accent)" : "transparent" }} />
                    {/* Сар — оны эхэнд он ч бичнэ */}
                    <span className={cn(mono.className, "mt-1 block whitespace-nowrap text-center text-[12px] leading-tight")}
                      style={{ color: isSel ? "var(--ch-accent-text)" : "var(--ch-weak)", fontWeight: isSel ? 600 : 400 }}>
                      {m.slice(5)}
                    </span>
                    <span className={cn(mono.className, "block h-3.5 whitespace-nowrap text-center text-[10px] leading-tight")}
                      style={{ color: isSel ? "var(--ch-accent-text)" : "var(--ch-disabled)", visibility: yearStart || isSel ? "visible" : "hidden" }}>
                      {m.slice(0, 4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>,
    mountNode,
  );
}
