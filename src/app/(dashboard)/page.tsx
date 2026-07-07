"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { dashboardApi, landApi, usersApi } from "@/lib/api";
import { isExternalSpecialRole, isFinanceSpecialist, isMika, isProfessionalOrg } from "@/lib/role-utils";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getParcelStatusStyle, PARCEL_STATUS_STYLES } from "@/types";
import {
  Map as MapIcon,
  Layers,
  FileText,
  Banknote,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Send,
  Search,
  X,
  ChevronDown,
  Calendar,
} from "lucide-react";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full animate-pulse bg-slate-100 dark:bg-[#252630]" />
  ),
});

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

/* ── Text highlighter ────────────────────────────────── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#02c0ce]/20 text-[#02c0ce] rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

/* ── Acquisition select ──────────────────────────────── */
function AcquisitionSelect({
  selectedId,
  onSelect,
  onClear,
  className,
}: {
  selectedId: string;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["acq-suggest", debounced],
    queryFn: () => landApi.suggest(debounced),
    enabled: debounced.trim().length > 0,
    staleTime: 30_000,
  });

  const results = data ?? [];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function select(acq: { id: string; acquisition_name: string }) {
    setQuery("");
    setDisplayLabel(acq.acquisition_name);
    onSelect(acq.id, acq.acquisition_name);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    setDisplayLabel("");
    onClear();
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        {selectedId && !open ? (
          <span
            title={displayLabel}
            className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 truncate"
          >
            {displayLabel}
          </span>
        ) : (
          <input
            type="text"
            placeholder="Чөлөөлөлт сонгох…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoFocus={open}
            className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
          />
        )}
        {selectedId ? (
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
            {!debounced.trim() ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Хайх үгээ бичнэ үү…
              </div>
            ) : isFetching ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Хайж байна…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Олдсонгүй
              </div>
            ) : (
              results.map((acq) => (
                <button
                  key={acq.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(acq);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
                >
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    {acq.acquisition_name ? (
                      <Highlight text={acq.acquisition_name} query={query} />
                    ) : (
                      "—"
                    )}
                  </span>
                  {acq.plan_code && (
                    <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {acq.plan_code}
                    </span>
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

/* ── Employee select ─────────────────────────────────── */
function EmployeeSelect({
  selectedId,
  onSelect,
  onClear,
  className,
}: {
  selectedId: string;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["employee-suggest", debounced],
    queryFn: () => usersApi.list({ search: debounced.trim(), page_size: 30 }),
    enabled: open,
    staleTime: 30_000,
  });

  const results = data?.data ?? [];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function select(user: { id: string; first_name: string; last_name: string; position?: string }) {
    const label = `${user.last_name} ${user.first_name}`;
    setQuery("");
    setDisplayLabel(label);
    onSelect(user.id, label);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    setDisplayLabel("");
    onClear();
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        {selectedId && !open ? (
          <span
            title={displayLabel}
            className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 truncate"
          >
            {displayLabel}
          </span>
        ) : (
          <input
            type="text"
            placeholder="Ажилтан хайх…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoFocus={open}
            className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
          />
        )}
        {selectedId ? (
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
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {isFetching ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Хайж байна…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Олдсонгүй
              </div>
            ) : (
              results.map((user) => (
                <button
                  key={user.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(user);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
                >
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 block">
                    <Highlight text={`${user.last_name} ${user.first_name}`} query={query} />
                  </span>
                  {user.position && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {user.position}
                    </span>
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

/* ── Plan select ─────────────────────────────────────── */
function PlanSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["plan-suggest", debounced],
    queryFn: () => landApi.suggest(debounced),
    enabled: debounced.trim().length > 0,
    staleTime: 30_000,
  });

  const plans = Array.from(
    new Map(
      (data ?? [])
        .filter((a) => a.plan_code)
        .map((a) => [a.plan_code, { plan_code: a.plan_code, name: a.acquisition_name ?? "" }]),
    ).values(),
  );

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [value]);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          placeholder="Төлөвлөгөөний код…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
        />
        {value ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setQuery("");
            }}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {!debounced.trim() ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Хайх үгээ бичнэ үү…
              </div>
            ) : isFetching ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Хайж байна…
              </div>
            ) : plans.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">
                Олдсонгүй
              </div>
            ) : (
              plans.map((p) => (
                <button
                  key={p.plan_code}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(p.plan_code);
                    setQuery(p.plan_code);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
                >
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    <Highlight text={p.plan_code} query={query} />
                  </span>
                  {p.name && (
                    <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {p.name}
                    </span>
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

/* ── Year multi-select ───────────────────────────────── */
function YearMultiSelect({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (years: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function toggle(y: string) {
    onChange(value.includes(y) ? value.filter((v) => v !== y) : [...value, y]);
  }

  const label =
    value.length === 0
      ? "Он сонгох…"
      : value.length === 1
        ? `${value[0]} он`
        : `${value.length} он сонгосон`;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 text-left focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 text-[13px] text-slate-800 dark:text-slate-200 truncate">
          {label}
        </span>
        {value.length > 0 ? (
          <span
            role="button"
            aria-label="Clear"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onChange([]);
            }}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-44 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {YEAR_OPTIONS.map((y) => {
              const ys = String(y);
              const checked = value.includes(ys);
              return (
                <button
                  key={y}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggle(ys);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors text-[13px]",
                    checked
                      ? "text-[#02c0ce] font-semibold"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#252630]",
                  )}
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                      checked
                        ? "bg-[#02c0ce] border-[#02c0ce]"
                        : "border-slate-300 dark:border-white/20",
                    )}
                  >
                    {checked && (
                      <svg
                        viewBox="0 0 10 8"
                        className="h-2 w-2 text-white fill-current"
                      >
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────── */
function Skel({ w = "w-12" }: { w?: string }) {
  return (
    <span className={`inline-block ${w} h-[1em] rounded bg-slate-200 dark:bg-white/10 animate-pulse align-middle`} />
  );
}

/* ── Custom horizontal bar ───────────────────────────── */
function HBar({
  label,
  value,
  maxVal,
  color,
  suffix = "",
}: {
  label: string;
  value: number;
  maxVal: number;
  color: string;
  suffix?: string;
}) {
  const pct = Math.max(3, (value / Math.max(maxVal, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 text-right leading-tight truncate"
        style={{ width: 86 }}
      >
        {label}
      </span>
      <div className="flex-1 h-[16px] rounded-sm overflow-hidden bg-slate-100 dark:bg-white/[0.05]">
        <div
          className="h-full rounded-sm transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0 text-right"
        style={{ width: 54 }}
      >
        {value.toLocaleString()}
        {suffix}
      </span>
    </div>
  );
}

const VALUATION_STATUS_LABELS: Record<string, string> = {
  draft: "Ноорог",
  submitted: "Илгээсэн",
  approved: "Баталгаажсан",
  returned: "Буцаагдсан",
  rejected: "Татгалзсан",
};

const VALUATION_TYPE_LABELS: Record<string, string> = {
  asset: "Хөрөнгийн үнэлгээ",
  independent: "Хөндлөнгийн үнэлгээ",
  mika: "МИКА үнэлгээ",
};

const VALUATION_STATUS_COLORS: Record<string, string> = {
  draft: "#64748b",
  submitted: "#f59e0b",
  approved: "#0acf97",
  returned: "#f1556c",
  rejected: "#94a3b8",
};

const VALUATION_TYPE_COLORS = ["#02c0ce", "#777edd", "#0acf97", "#f9bc0b", "#f1556c"];

const EXTERNAL_TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#334155",
  boxShadow: "0 8px 24px rgba(15,23,42,.12)",
};

function moneyShort(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} тэр`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} сая`;
  return value.toLocaleString();
}

function ExternalDashboard() {
  const isFinance = isFinanceSpecialist();
  const isMikaRole = isMika();
  const isProfOrgRole = isProfessionalOrg();
  const roleLabel = isFinance
    ? "Санхүүгийн хяналт"
    : isMikaRole
      ? "МИКА үнэлгээ"
      : "Үнэлгээ оруулах байгууллага";
  const listHref = isProfOrgRole ? "/my_acquisitions" : "/acquisition";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "external"],
    queryFn: () => dashboardApi.get(),
    staleTime: 60_000,
  });

  const acquisitions = data?.acquisitions ?? [];
  const statuses = data?.status_breakdown ?? [];
  const valuationStatuses = data?.valuation_statuses ?? [];
  const valuationTypes = data?.valuation_types ?? [];
  const totalCompensation = data?.total_compensation ?? 0;
  const statusCount = (status: string) =>
    valuationStatuses.find((s) => s.status === status)?.count ?? 0;
  const draftCount = statusCount("draft");
  const returnedCount = statusCount("returned");
  const submittedCount = statusCount("submitted");
  const approvedCount = statusCount("approved");
  const workToEditCount = draftCount + returnedCount;
  const statusTotal = valuationStatuses.reduce((sum, row) => sum + row.count, 0);
  const reviewCompletionPct = statusTotal > 0 ? Math.round((approvedCount / statusTotal) * 100) : 0;
  const actionAcquisitions = isFinance
    ? acquisitions.filter((land) => (land.parcel_count ?? 0) > 0)
    : acquisitions;
  const pageTitle = isFinance ? "Санхүүгийн хяналтын самбар" : "Үнэлгээний ажлын самбар";
  const pageHint = isFinance
    ? "Илгээсэн үнэлгээ, баталгаажуулалт, нөхөх олговорын хяналтын мэдээлэл"
    : "Өөрт хуваарилагдсан үнэлгээний ажил, илгээх явц, буцаагдсан засварын мэдээлэл";
  const queueTitle = isFinance ? "Хянах шаардлагатай чөлөөлөлтүүд" : "Ажиллах чөлөөлөлтүүд";
  const queueEmpty = isFinance ? "Хянах үнэлгээ олдсонгүй" : "Танд ажиллах үнэлгээ олдсонгүй";
  const primaryActionLabel = isFinance ? "Хянах" : "Ажиллах";
  const mainStatusTitle = isFinance ? "Хяналтын төлөв" : "Ажлын төлөв";
  const statusPanelTitle = isFinance ? "Баталгаажуулалтын явц" : "Илгээх явц";
  const compensationLabel = isFinance ? "Хянагдаж буй нөхөх олговор" : "Оруулсан нөхөх олговор";
  const cards = isFinance
    ? [
        { label: "Хянах үнэлгээ", value: submittedCount, icon: Clock3, color: "#f59e0b" },
        { label: "Баталгаажсан", value: approvedCount, icon: CheckCircle2, color: "#0acf97" },
        { label: "Буцаасан", value: returnedCount, icon: RotateCcw, color: "#f1556c" },
        { label: "Үнэлгээ хийх нэгж талбар", value: data?.total_parcels ?? 0, icon: Layers, color: "#777edd" },
      ]
    : [
        { label: "Ажиллах үнэлгээ", value: workToEditCount, icon: FileText, color: "#02c0ce" },
        { label: "Илгээсэн", value: submittedCount, icon: Send, color: "#f9bc0b" },
        { label: "Буцаагдсан", value: returnedCount, icon: RotateCcw, color: "#f1556c" },
        { label: "Баталгаажсан", value: approvedCount, icon: CheckCircle2, color: "#0acf97" },
      ];
  const focusStatuses = isFinance
    ? ["submitted", "approved", "returned"]
    : ["draft", "returned", "submitted", "approved"];
  const valuationStatusChart = focusStatuses.map((status) => ({
    status,
    name: VALUATION_STATUS_LABELS[status] ?? status,
    count: statusCount(status),
    color: VALUATION_STATUS_COLORS[status] ?? "#02c0ce",
  }));
  const valuationTypeChart = valuationTypes.map((type, index) => ({
    name: VALUATION_TYPE_LABELS[type.valuation_type] ?? type.valuation_type,
    count: type.count,
    amount: Math.round(type.amount / 1_000_000),
    color: VALUATION_TYPE_COLORS[index % VALUATION_TYPE_COLORS.length],
  }));
  const parcelStatusChart = statuses.slice(0, 6).map((status) => ({
    name: status.name,
    count: status.count,
    color: getParcelStatusStyle(status.status_id, status.name).color,
  }));
  const hasValuationStatusChart = valuationStatusChart.some((status) => status.count > 0);
  const hasValuationTypeChart = valuationTypeChart.some((type) => type.count > 0 || type.amount > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">{pageTitle}</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {roleLabel} · {pageHint}
          </p>
        </div>
        <Link
          href={listHref}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 dark:border-[#37394d] px-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          Жагсаалт харах
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="ap-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-black tabular-nums text-slate-800 dark:text-white">
                    {isLoading ? <Skel w="w-14" /> : card.value.toLocaleString()}
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: `${card.color}18` }}>
                  <Icon className="h-5 w-5" style={{ color: card.color }} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch">
        <div className="ap-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {isFinance ? "Үнэлгээний хяналтын график" : "Үнэлгээний ажлын график"}
              </p>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                {statusPanelTitle}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 dark:bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
              {statusTotal.toLocaleString()} үнэлгээ
            </span>
          </div>
          {isLoading ? (
            <div className="h-[250px] rounded-lg bg-slate-100 dark:bg-white/[0.05] animate-pulse" />
          ) : !hasValuationStatusChart ? (
            <p className="py-24 text-center text-[13px] text-slate-400">Үнэлгээний төлөв бүртгэгдээгүй</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-center">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={valuationStatusChart.filter((status) => status.count > 0)}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {valuationStatusChart.filter((status) => status.count > 0).map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={EXTERNAL_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {valuationStatusChart.map((status) => (
                  <div key={status.status} className="rounded-lg border border-slate-100 dark:border-[#37394d] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
                        {status.name}
                      </span>
                      <span className="text-lg font-black tabular-nums text-slate-800 dark:text-white">
                        {status.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${statusTotal > 0 ? Math.round((status.count / statusTotal) * 100) : 0}%`,
                          background: status.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ap-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            {compensationLabel}
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-3 mb-4">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Нийт дүн</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-800 dark:text-white">
              {isLoading ? <Skel w="w-20" /> : `${moneyShort(totalCompensation)} ₮`}
            </p>
            {isFinance && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Баталгаажуулалт</span>
                  <span>{reviewCompletionPct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white dark:bg-[#252630] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0acf97]" style={{ width: `${reviewCompletionPct}%` }} />
                </div>
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="h-[160px] rounded-lg bg-slate-100 dark:bg-white/[0.05] animate-pulse" />
          ) : !hasValuationTypeChart ? (
            <p className="py-10 text-center text-[12px] text-slate-400">Мэдээлэл олдсонгүй</p>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valuationTypeChart} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={EXTERNAL_TOOLTIP_STYLE} />
                  <Bar dataKey="amount" name="Дүн (сая ₮)" radius={[5, 5, 0, 0]}>
                    {valuationTypeChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className="ap-card p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {mainStatusTitle}
            </p>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {isLoading ? "…" : `${(data?.total_parcels ?? 0).toLocaleString()} нэгж талбар`}
            </span>
          </div>
          {isLoading ? (
            <div className="h-[220px] rounded-lg bg-slate-100 dark:bg-white/[0.05] animate-pulse" />
          ) : parcelStatusChart.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-slate-400">Мэдээлэл олдсонгүй</p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parcelStatusChart} layout="vertical" margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={128}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={EXTERNAL_TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Нэгж талбар" radius={[0, 6, 6, 0]}>
                    {parcelStatusChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              {queueTitle}
            </p>
            <span className="text-[12px] text-slate-400">
              {isLoading ? "…" : `${acquisitions.length.toLocaleString()} бичлэг`}
            </span>
          </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400">Ачааллаж байна...</div>
        ) : !actionAcquisitions.length ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400">
            {queueEmpty}
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-[#2a2c38]">
            {actionAcquisitions.slice(0, 12).map((land) => (
              <div key={land.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                    {land.acquisition_name || land.plan_code}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {land.plan_code} · {land.parcel_count ?? 0} нэгж талбар
                  </p>
                </div>
                <Link
                  href={`/acquisition/${land.id}`}
                  className="shrink-0 ml-4 inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors"
                >
                  {primaryActionLabel}
                </Link>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [roleReady, setRoleReady] = useState(false);
  const [isProfOrg, setIsProfOrg] = useState(false);
  const [isOtherExternal, setIsOtherExternal] = useState(false);
  useEffect(() => {
    setIsProfOrg(isProfessionalOrg());
    setIsOtherExternal(isExternalSpecialRole() && !isProfessionalOrg());
    setRoleReady(true);
  }, []);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const tickColor  = isDark ? "#8391a2" : "#94a3b8";
  const gridColor  = isDark ? "#37394d" : "#eef2f7";
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 6,
    border: `1px solid ${isDark ? "#37394d" : "#e5e7eb"}`,
    background: isDark ? "#1e1f27" : "#fff",
    color: isDark ? "#aab8c5" : "#4c4c5c",
    boxShadow: "0 4px 20px rgba(0,0,0,.12)",
  };

  /* Input state — хэрэглэгч сонгож буй утга */
  const [inAcqId,        setInAcqId]        = useState("");
  const [inAcqName,      setInAcqName]      = useState("");
  const [inPlanCode,     setInPlanCode]     = useState("");
  const [inYears,        setInYears]        = useState<string[]>([String(CURRENT_YEAR)]);
  const [inGenCatId,     setInGenCatId]     = useState(0);
  const [inSubCatId,     setInSubCatId]     = useState(0);
  const [inEmployeeId,   setInEmployeeId]   = useState("");
  const [inEmployeeName, setInEmployeeName] = useState("");

  const { data: dashGenCats = [] } = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
    enabled: roleReady && !isProfOrg && !isOtherExternal,
  });
  const { data: dashSubCats = [] } = useQuery({
    queryKey: ["acquisition-categories", inGenCatId],
    queryFn: () => landApi.listCategories(inGenCatId),
    enabled: roleReady && !isProfOrg && !isOtherExternal && !!inGenCatId,
    staleTime: Infinity,
  });

  /* Applied filter — хуудас нээгдэхэд одоогийн он автоматаар сонгогдоно */
  const [appliedFilter, setAppliedFilter] = useState({
    acqId: "", acqName: "", planCode: "", years: [String(CURRENT_YEAR)], genCatId: 0, subCatId: 0,
    employeeId: "", employeeName: "",
  });

  const handleView = () => {
    setAppliedFilter({ acqId: inAcqId, acqName: inAcqName, planCode: inPlanCode, years: inYears, genCatId: inGenCatId, subCatId: inSubCatId, employeeId: inEmployeeId, employeeName: inEmployeeName });
  };
  const handleReset = () => {
    setInAcqId(""); setInAcqName(""); setInPlanCode(""); setInYears([String(CURRENT_YEAR)]); setInGenCatId(0); setInSubCatId(0); setInEmployeeId(""); setInEmployeeName("");
    setAppliedFilter({ acqId: "", acqName: "", planCode: "", years: [String(CURRENT_YEAR)], genCatId: 0, subCatId: 0, employeeId: "", employeeName: "" });
  };

  /* ── Dashboard API — mount хийхэд одоогийн оноор, "Харах" дарахад шүүлтүүрээр дуудна ── */
  const { data: dashData, isLoading } = useQuery({
    queryKey: ["dashboard", appliedFilter],
    queryFn: () => dashboardApi.get({
      acquisition_id:     appliedFilter.acqId || undefined,
      plan_code:          appliedFilter.planCode || undefined,
      years:              appliedFilter.years.map(Number).filter(Boolean),
      general_category_id: appliedFilter.genCatId || undefined,
      sub_category_id:    appliedFilter.subCatId || undefined,
      assigned_user_id:   appliedFilter.employeeId || undefined,
    }),
    staleTime: 60_000,
    enabled: roleReady && !isProfOrg && !isOtherExternal,
  });

  /* ── API-аас бэлэн утгуудыг авна — тооцоо frontend-д байхгүй ── */
  const filteredAcqs     = useMemo(() => dashData?.acquisitions ?? [], [dashData?.acquisitions]);
  const parcelStatusList = dashData?.parcel_statuses ?? [];
  const totalParcels     = dashData?.total_parcels   ?? 0;
  const freedParcels     = dashData?.freed_parcels   ?? 0;
  const freedAreaHa      = (dashData?.freed_area_m2  ?? 0) / 10_000;
  const planAreaHa       = (dashData?.plan_area_m2   ?? 0) / 10_000;
  const totalOrders      = dashData?.total_orders    ?? 0;
  const totalCompensation = (dashData?.total_compensation ?? 0) / 1_000_000_000;

  const STATUSES = useMemo(() => (dashData?.status_breakdown ?? []).map((s) => ({
    key:   `ps-${s.status_id}`,
    label: s.name,
    color: getParcelStatusStyle(s.status_id, s.name).color,
    count: s.count,
    area:  Math.round(s.area_m2),
  })), [dashData?.status_breakdown]);

  const TIMELINE = dashData?.timeline ?? [];

  const maxCount = STATUSES.length > 0 ? Math.max(...STATUSES.map((s) => s.count)) : 1;
  const maxArea  = STATUSES.length > 0 ? Math.max(...STATUSES.map((s) => s.area))  : 1;

  /* Map: API дуусахад л шинэчлэгдэх committed state */
  const [mapCommit, setMapCommit] = useState<{
    key: number;
    acqIds: string[] | undefined;
    years: number[] | undefined;
    au1Codes: string[] | undefined;
    au2Codes: string[] | undefined;
    au3Codes: string[] | undefined;
    employeeId: string | undefined;
  } | null>(null);
  const mapCommitKeyRef = useRef(0);
  const prevIsLoadingRef = useRef<boolean | null>(null);

  const commitMap = useCallback(() => {
    const hasF = !!(appliedFilter.acqId || appliedFilter.planCode || appliedFilter.years.length > 0 || appliedFilter.employeeId);
    const acqIds = hasF
      ? (filteredAcqs.length > 0 ? filteredAcqs.map((a) => a.id) : ["__none__"])
      : undefined;

    const years = appliedFilter.years.length > 0 ? appliedFilter.years.map(Number) : undefined;

    const au1Codes = dashData?.filtered_au1_codes?.length ? dashData.filtered_au1_codes : undefined;
    const au2Codes = dashData?.filtered_au2_codes?.length ? dashData.filtered_au2_codes : undefined;
    const au3Codes = dashData?.filtered_au3_codes?.length ? dashData.filtered_au3_codes : undefined;

    const employeeId = appliedFilter.employeeId || undefined;

    mapCommitKeyRef.current += 1;
    setMapCommit({ key: mapCommitKeyRef.current, acqIds, years, au1Codes, au2Codes, au3Codes, employeeId });
  }, [appliedFilter, filteredAcqs, dashData]);

  useEffect(() => {
    const prevLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // Commit when: first render with data (null→false) OR API just finished (true→false)
    if (!isLoading && dashData && (prevLoading === null || prevLoading === true)) {
      commitMap();
    }
  }, [isLoading, dashData, commitMap]);

  /* Filter display label */
  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (appliedFilter.acqName)          parts.push(appliedFilter.acqName);
    if (appliedFilter.planCode)         parts.push(`Төлөвлөгөө: ${appliedFilter.planCode}`);
    if (appliedFilter.years.length > 0) parts.push(`${appliedFilter.years.join(", ")} он`);
    if (appliedFilter.employeeName)     parts.push(`Ажилтан: ${appliedFilter.employeeName}`);
    return parts.length > 0 ? parts.join(" · ") : "Бүх чөлөөлөлт";
  }, [appliedFilter]);

  if (!roleReady) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      </div>
    );
  }
  if (isProfOrg || isOtherExternal) return <ExternalDashboard />;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Filter card ───────────────────────────────── */}
      <div className="ap-card px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Acquisition select */}
          <div className="flex flex-col gap-1 min-w-[220px] flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
              Чөлөөлөлт
            </label>
            <AcquisitionSelect
              selectedId={inAcqId}
              onSelect={(id, label) => { setInAcqId(id); setInAcqName(label); }}
              onClear={() => { setInAcqId(""); setInAcqName(""); }}
            />
          </div>

          {/* Plan code */}
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
              Төлөвлөгөө
            </label>
            <PlanSelect value={inPlanCode} onChange={setInPlanCode} />
          </div>

          {/* Year multi-select */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
              Он
            </label>
            <YearMultiSelect value={inYears} onChange={setInYears} />
          </div>

          {/* Employee select */}
          <div className="flex flex-col gap-1 min-w-[200px] flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
              Хариуцсан ажилтан
            </label>
            <EmployeeSelect
              selectedId={inEmployeeId}
              onSelect={(id, label) => { setInEmployeeId(id); setInEmployeeName(label); }}
              onClear={() => { setInEmployeeId(""); setInEmployeeName(""); }}
            />
          </div>

          {/* General category */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
              Ерөнхий ангилал
            </label>
            <select
              value={inGenCatId}
              onChange={(e) => {
                setInGenCatId(Number(e.target.value));
                setInSubCatId(0);
              }}
              className="h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
            >
              <option value={0}>Бүгд</option>
              {dashGenCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sub category */}
          {!!inGenCatId && (
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-0.5">
                Дэд ангилал
              </label>
              <select
                value={inSubCatId}
                onChange={(e) => setInSubCatId(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-700 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all"
              >
                <option value={0}>Бүгд</option>
                {dashSubCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleView}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#02c0ce" }}
            >
              <Search className="h-3.5 w-3.5" />
              Харах
            </button>
            <button
              onClick={handleReset}
              className="h-9 px-3 rounded-lg text-[13px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Title / active filter ──────────────────────── */}
      <div className="ap-card px-5 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-[3px] rounded-full shrink-0" style={{ background: "#02c0ce" }} />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-snug truncate">
            {filterLabel}
          </p>
        </div>
        <div className="shrink-0 text-right border-l border-slate-100 dark:border-[#37394d] pl-4">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#02c0ce" }}>
            {filteredAcqs.length} чөлөөлөлт
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {isLoading ? "…" : `${totalParcels} нэгж талбар`}
          </p>
        </div>
      </div>

      {/* ── 4 stat cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "ТӨЛӨВЛӨЛТИЙН ХИЛ",
            sub: "нийт талбай",
            value: isLoading ? null : `${planAreaHa.toFixed(1)} га`,
            pct: 100,
            color: "#02c0ce",
            icon: MapIcon,
            bg: "#02c0ce18",
          },
          {
            label: "НЭГЖ ТАЛБАР",
            sub: "нийт тоо",
            value: isLoading ? null : totalParcels,
            pct: 100,
            color: "#777edd",
            icon: Layers,
            bg: "#777edd18",
          },
          {
            label: "НИЙТ ЗАХИРАМЖ",
            sub: "чөлөөлөлтийн тоо",
            value: isLoading ? null : totalOrders,
            pct: 100,
            color: "#f9bc0b",
            icon: FileText,
            bg: "#f9bc0b18",
          },
          {
            label: "НИЙТ НӨХӨХ ОЛГОВОР",
            sub: "тэрбум ₮",
            value: isLoading ? null : `${totalCompensation.toFixed(2)} тэр`,
            pct: 100,
            color: "#0acf97",
            icon: Banknote,
            bg: "#0acf9718",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="ap-card relative overflow-hidden p-5">
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: s.color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-tight">
                    {s.label}
                  </p>
                  <div className="flex items-end gap-1.5 mt-2">
                    <span className="text-[26px] font-black tabular-nums leading-none text-slate-800 dark:text-white">
                      {s.value === null ? <Skel w="w-16" /> : s.value}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{s.sub}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: s.bg }}>
                  <Icon className="h-5 w-5" style={{ color: s.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Freed parcels row ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[
          {
            label: "ЧӨЛӨӨЛӨГДСӨН НЭГЖ ТАЛБАР",
            sub: isLoading ? "…" : `${totalParcels} нийт нэгж талбараас`,
            value: isLoading ? null : freedParcels,
            pct: totalParcels > 0 ? Math.round((freedParcels / totalParcels) * 100) : 0,
            color: "#0acf97",
          },
          {
            label: "ЧӨЛӨӨЛӨГДСӨН ТАЛБАЙ",
            sub: isLoading ? "…" : `${planAreaHa.toFixed(1)} га нийт талбайгаас`,
            value: isLoading ? null : `${freedAreaHa.toFixed(1)} га`,
            pct: planAreaHa > 0 ? Math.round((freedAreaHa / planAreaHa) * 100) : 0,
            color: "#0acf97",
          },
        ].map((s) => (
          <div key={s.label} className="ap-card px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {s.label}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{s.sub}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[32px] font-black tabular-nums leading-none" style={{ color: s.color }}>
                {s.value === null ? <Skel w="w-16" /> : s.value}
              </span>
              <div className="mt-1.5 h-1.5 w-24 rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
              <p className="text-[10px] font-bold mt-0.5" style={{ color: s.color }}>{s.pct}%</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3-column main ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_252px] gap-4 items-start">

        {/* LEFT: bar charts + legend */}
        <div className="flex flex-col gap-4">
          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3.5">
              НЭГЖ ТАЛБАРЫН МЭДЭЭЛЭЛ
            </p>
            {STATUSES.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">—</p>
            ) : (
              <div className="space-y-2.5">
                {STATUSES.map((s) => (
                  <HBar key={s.key} label={s.label} value={s.count} maxVal={maxCount} color={s.color} />
                ))}
              </div>
            )}
          </div>

          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3.5">
              НЭГЖ ТАЛБАРЫН ТАЛБАЙ /М.КВ/
            </p>
            {STATUSES.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">—</p>
            ) : (
              <div className="space-y-2.5">
                {STATUSES.map((s) => (
                  <HBar key={s.key} label={s.label} value={s.area} maxVal={maxArea} color={s.color} suffix=" м²" />
                ))}
              </div>
            )}
          </div>

          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              ТАЙЛБАР
            </p>
            <div className="space-y-2">
              {[...parcelStatusList]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: PARCEL_STATUS_STYLES[s.id]?.color ?? "#64748b" }}
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{s.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* CENTER: map + timeline */}
        <div className="flex flex-col gap-4">
          <div className="ap-card overflow-hidden" style={{ height: 320 }}>
            {(!mapCommit || isLoading) ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-[#252630] animate-pulse">
                <MapIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              </div>
            ) : (
              <MapView
                key={mapCommit.key}
                acquisitionIds={mapCommit.acqIds}
                years={mapCommit.years}
                au1Codes={mapCommit.au1Codes}
                au2Codes={mapCommit.au2Codes}
                au3Codes={mapCommit.au3Codes}
                employeeId={mapCommit.employeeId}
                filterPending={false}
              />
            )}
          </div>

          <div className="ap-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              ЭХЛЭСЭН ОГНООГООР НЭГЖ ТАЛБАР
            </p>
            {TIMELINE.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 py-4 text-center">
                Огноон мэдээлэл байхгүй
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={168}>
                <AreaChart data={TIMELINE} margin={{ top: 10, bottom: 0, left: -10, right: 8 }}>
                  <defs>
                    <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#02c0ce" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#02c0ce" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" name="Нэгж талбар" stroke="#02c0ce" strokeWidth={2} fill="url(#tlGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RIGHT: acquisition list */}
        <div className="ap-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            ЧӨЛӨӨЛӨЛТҮҮД
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : filteredAcqs.length === 0 ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 py-4 text-center">
              Олдсонгүй
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredAcqs.map((acq) => {
                const style = { 1: "#02c0ce", 2: "#f59e0b", 3: "#0acf97", 4: "#f1556c" } as Record<number, string>;
                const dotColor = style[acq.status] ?? "#94a3b8";
                return (
                  <div
                    key={acq.id}
                    className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: dotColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-tight truncate">
                        {acq.acquisition_name || "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {acq.plan_code} · {acq.parcel_count ?? 0} нэгж талбар
                      </p>
                    </div>
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
