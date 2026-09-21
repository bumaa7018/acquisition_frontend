"use client";

// Үнэлгээний ХАРАГДАЦЫН нийтлэг хэсгүүд.
//
// Excel оруулах цонх (valuation_excel_import.tsx) ба "Нөхөх олговор" таб
// (real_estate_tab.tsx) ХОЁУЛАА эдгээрийг ашиглана — ингэснээр оруулахаас өмнөх
// урьдчилан харах ба оруулсны дараах харагдац ЯГ ИЖИЛ болно (нэг эх сурвалж).
//
// Дүрэм:
//  • хүснэгт бүр = нэг карт (VSection), гарчигтай, баруун талд нь дүн/үйлдэл;
//  • хүснэгт бүрийн ДООД талд тухайн хэсгийн ТАЙЛБАР (VNote / VNoteInput).

import { useEffect, useState, type ReactNode } from "react";
import { Download, Eye, FileText, ImageOff, Pencil, type LucideIcon } from "lucide-react";
import {
  VALUATION_SECTION_DEFAULTS,
  VALUATION_SECTION_LABELS,
  type ValuationSectionKey,
} from "@/lib/valuation-import";

export const V_TONES: Record<string, string> = {
  slate: "border-l-slate-200 dark:border-l-slate-500/40",
  emerald: "border-l-emerald-200 dark:border-l-emerald-500/40",
  sky: "border-l-sky-200 dark:border-l-sky-500/40",
  amber: "border-l-amber-200 dark:border-l-amber-500/40",
};

/** Хүснэгтийн толгойн нүдний ангилал (th). */
export const V_TH =
  "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400";
/** Хүснэгтийн мөрийн нүд (td). */
export const V_TD = "px-3 py-2 text-slate-700 dark:text-slate-200";
/** Тоон нүд (баруун талд, tabular). */
export const V_TD_NUM = "px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200";
/** Хүснэгтийн толгой мөр (tr). */
export const V_THEAD_TR =
  "border-b border-slate-100 bg-slate-50/60 dark:border-[#37394d] dark:bg-[#1a1d20]";
export const V_TBODY = "divide-y divide-slate-100 dark:divide-[#37394d]";
export const V_TFOOT_TR =
  "border-t-2 border-slate-200 bg-slate-50/70 dark:border-[#37394d] dark:bg-[#1a1d20]";

/** Хүснэгтийн карт: толгой (дүрс + гарчиг + баруун талын мэдээлэл) + агуулга. */
export function VSection({
  icon: Icon,
  title,
  tone = "slate",
  right,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof V_TONES;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#1e1f27] ${V_TONES[tone]}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-[#37394d] dark:bg-[#1a1d20]">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-white">
            {title}
          </p>
        </div>
        {right && <div className="shrink-0 text-[12px]">{right}</div>}
      </div>
      {children}
    </div>
  );
}

/** Хүснэгтийн доорх бичвэр мөр (нэмэлт тоон мэдээлэл, тэмдэглэл). */
export function VFootNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500 dark:border-[#37394d]">
      {children}
    </div>
  );
}

/**
 * ТАЙЛБАР — хадгалагдсан утгыг харуулж, эрхтэй үед байрандаа засна
 * ("Нөхөх олговор" таб дээр хүснэгт бүрийн доор).
 */
export function VNote({
  sectionKey,
  value,
  canEdit,
  saving,
  onSave,
  label,
}: {
  sectionKey: ValuationSectionKey;
  value: string;
  canEdit: boolean;
  saving: boolean;
  onSave: (note: string) => void;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!canEdit && !value) return null;

  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-[#37394d]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Тайлбар{label ? ` — ${label}` : ""}
        </p>
        {canEdit && !editing && (
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#02c0ce] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            {value ? "Засах" : "Тайлбар нэмэх"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Үнэлгээний үндэслэл, тайлбарыг бичнэ үү…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-[#02c0ce] dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setDraft(value);
              }}
              disabled={saving}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
            >
              Болих
            </button>
            <button
              onClick={() => {
                onSave(draft.trim());
                setEditing(false);
              }}
              disabled={saving || draft === value}
              className="inline-flex h-8 items-center rounded-lg bg-[#02c0ce] px-4 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
            >
              Хадгалах
            </button>
          </div>
        </div>
      ) : value ? (
        <p
          className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-slate-600 dark:text-slate-300"
          data-section={sectionKey}
        >
          {value}
        </p>
      ) : (
        <p className="mt-1 text-[12px] text-slate-400">Тайлбар оруулаагүй байна</p>
      )}
    </div>
  );
}

/** ТАЙЛБАР — Excel оруулахын өмнө шууд засагдах хувилбар (урьдчилан харах цонх). */
export function VNoteInput({
  sectionKey,
  value,
  onChange,
  disabled,
  withLabel,
}: {
  sectionKey: ValuationSectionKey;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  withLabel?: boolean;
}) {
  return (
    <div className="border-t border-slate-100 px-4 py-3 dark:border-[#37394d]">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Тайлбар{withLabel ? ` — ${VALUATION_SECTION_LABELS[sectionKey]}` : ""}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={value ? 3 : 2}
        placeholder="Excel-д тайлбар байхгүй — шаардлагатай бол энд бичнэ үү"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-[#02c0ce] disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200"
      />
    </div>
  );
}

// ── Хүснэгтүүд ──────────────────────────────────────────────────────────────
//
// ЭДГЭЭР нь Excel оруулах цонх БОЛОН "Нөхөх олговор" табын ЦОРЫН ГАНЦ хүснэгтийн
// эх сурвалж. Хоёр дэлгэц ижил бүтэц, ижил багана, ижил дүрстэй байхын тулд
// хүснэгтийн бүтэц энд л бичигдэнэ; дэлгэц бүр зөвхөн ӨГӨГДЛӨӨ буулгаж өгнө.

const nf = new Intl.NumberFormat("mn-MN");
export function vMoney(v: number | null | undefined) {
  return v == null ? "—" : `${nf.format(Math.round(v))}₮`;
}
export function vNum(v: number | null | undefined) {
  return v == null ? "—" : nf.format(v);
}

/** Хэсгийн гарчиг/шошго — Excel-ээс ирсэн утга, эс бөгөөс загварын стандарт. */
export function sectionHeading(
  key: ValuationSectionKey,
  meta?: { no?: string; label?: string; title?: string } | null,
): { title: string; label: string } {
  const d = VALUATION_SECTION_DEFAULTS[key];
  const no = meta?.no || d.no;
  const title = meta?.title || VALUATION_SECTION_LABELS[key];
  return { title: no ? `${no} ${title}` : title, label: meta?.label || d.label };
}

/** Картын баруун талын хэсэг: "Хүснэгт-N" шошго + нэмэлт (дүн, тоо ш.м). */
export function VHeadRight({ label, extra }: { label?: string; extra?: ReactNode }) {
  if (!label && !extra) return null;
  return (
    <span className="flex items-center gap-2">
      {label && <span className="text-slate-400">{label}</span>}
      {extra}
    </span>
  );
}

/** Файлын нэрээс өргөтгөл ("PDF", "DOCX", "XLSX"). */
export function vFileExt(name?: string): string {
  const ext = (name ?? "").split(".").pop() ?? "";
  return ext && ext.length <= 5 ? ext.toUpperCase() : "ФАЙЛ";
}

/**
 * Хавсаргасан файлын чип — нэр, ӨРГӨТГӨЛ, татах дүрстэй. Дарахад шинэ цонхонд
 * нээгдэнэ. Үнэлгээний файлууд (тайлан, эх Excel, зураг) БҮХ дэлгэцэд ижил
 * харагдана.
 */
export function VFileChip({
  label,
  name,
  href,
  tone = "sky",
}: {
  label: string;
  name?: string;
  href?: string;
  tone?: "sky" | "emerald" | "slate";
}) {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "slate"
        ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
        : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300";
  if (!href) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-400 dark:border-white/[0.08]">
        <FileText className="h-3.5 w-3.5" />
        {label}: хавсаргаагүй
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={name || label}
      className={`inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${palette}`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="shrink-0">{label}</span>
      <span className="rounded bg-white/70 px-1 text-[10px] font-bold dark:bg-black/20">
        {vFileExt(name)}
      </span>
      {name && <span className="min-w-0 max-w-[180px] truncate font-normal opacity-80">{name}</span>}
      <Download className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

/** Түлхүүр → утга хэлбэрийн хүснэгт (Газрын эрх зүйн байдал). */
export function VKeyValueTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="w-full text-[12px]">
      <tbody className={V_TBODY}>
        {rows.map(([label, value], i) => (
          <tr key={i}>
            <td className={`${V_TD} w-[52%] text-slate-500`}>{label}</td>
            <td className={`${V_TD} font-medium`}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Газрын үнэлгээ (Хүснэгт-3): үзүүлэлт | хэмжих нэгж | дүн. */
export function VLandValuationTable({
  areaCell,
  priceCell,
  total,
}: {
  areaCell: ReactNode;
  priceCell: ReactNode;
  total: number;
}) {
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className={V_THEAD_TR}>
          <th className={V_TH}>Үзүүлэлт</th>
          <th className={V_TH}>Хэмжих нэгж</th>
          <th className={`${V_TH} text-right`}>Дүн</th>
        </tr>
      </thead>
      <tbody className={V_TBODY}>
        <tr>
          <td className={V_TD}>Чөлөөлөлтөнд өртсөн газрын хэмжээ</td>
          <td className={`${V_TD} text-slate-500`}>м²</td>
          <td className={V_TD_NUM}>{areaCell}</td>
        </tr>
        <tr>
          <td className={V_TD}>Газрын 1 м² талбайн суурь үнэ</td>
          <td className={`${V_TD} text-slate-500`}>Төгрөг</td>
          <td className={V_TD_NUM}>{priceCell}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr className={V_TFOOT_TR}>
          <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">Газрын үнэлгээ</td>
          <td />
          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
            {vMoney(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export interface VAssetRow {
  id: string;
  seq: number | null;
  name: string;
  kind: "real_state" | "property" | null;
  unit: string;
  qty: number | null;
  total: number | null;
  description?: string;
  badge?: ReactNode;
}

const KIND_TEXT: Record<string, string> = {
  real_state: "Үл хөдлөх хөрөнгө",
  property: "Эд хөрөнгө",
};

/** Үнэлж буй хөрөнгүүдийн танилцуулга (Хүснэгт-1). */
export function VAssetsTable({
  rows,
  activeId,
  onRowClick,
  renderKind,
  renderQty,
  renderActions,
  emptyText = "Хөрөнгө бүртгэгдээгүй",
}: {
  rows: VAssetRow[];
  activeId?: string | null;
  onRowClick?: (row: VAssetRow) => void;
  renderKind?: (row: VAssetRow, index: number) => ReactNode;
  renderQty?: (row: VAssetRow, index: number) => ReactNode;
  renderActions?: (row: VAssetRow, index: number) => ReactNode;
  emptyText?: string;
}) {
  const withActions = !!renderActions;
  const extraCols = withActions ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className={V_THEAD_TR}>
            <th className={`${V_TH} w-8`}>№</th>
            <th className={V_TH}>Үнэлж буй хөрөнгийн нэр</th>
            <th className={V_TH}>Төрөл</th>
            <th className={V_TH}>Хэмжих нэгж</th>
            <th className={`${V_TH} text-right`}>Хүчин чадал</th>
            <th className={V_TH}>Тодорхойлолт</th>
            {withActions && <th className={`${V_TH} w-8`} />}
          </tr>
        </thead>
        <tbody className={V_TBODY}>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? "cursor-pointer" : ""} ${
                activeId === row.id
                  ? "bg-[#02c0ce]/5"
                  : row.kind == null
                    ? "bg-red-50/40 dark:bg-red-500/5"
                    : onRowClick
                      ? "hover:bg-slate-50/60 dark:hover:bg-[#252630]/50"
                      : ""
              }`}
            >
              <td className={`${V_TD} text-slate-400`}>{row.seq ?? i + 1}</td>
              <td className={`${V_TD} font-medium`}>{row.name}</td>
              <td className={`${V_TD} text-slate-500`}>
                {renderKind ? renderKind(row, i) : (row.kind && KIND_TEXT[row.kind]) || "—"}
              </td>
              <td className={`${V_TD} text-slate-500`}>{row.unit || "—"}</td>
              <td className={`${V_TD_NUM} text-slate-500`}>
                {renderQty ? renderQty(row, i) : vNum(row.qty)}
              </td>
              <td className={`${V_TD} max-w-[220px] truncate text-slate-400`} title={row.description}>
                {row.description || "—"}
                {row.badge}
              </td>
              {withActions && <td className={`${V_TD} text-right`}>{renderActions?.(row, i)}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6 + extraCols} className="px-3 py-6 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Багана (барилга) тус бүрийн ЗАСАХ товч — Хүснэгт-4/5 нь мөр биш БАГАНААР
 * барилгаа илэрхийлдэг тул засах үйлдэл толгой дээр байрлана (бусад хүснэгтэд
 * сүүлийн баганад байдагтай ижил утгатай).
 */
function VColumnEditButton({ id, onEdit }: { id: string; onEdit: (id: string) => void }) {
  return (
    <button
      type="button"
      title="Засах"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(id);
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-[#02c0ce] dark:hover:bg-[#252630]"
    >
      <Pencil className="h-3 w-3" />
    </button>
  );
}

/** Барилгын тодорхойлолт (Хүснэгт-4) — барилга бүр багана. */
export function VBuildingSpecTable({
  columns,
  activeId,
  onSelect,
  onEdit,
}: {
  columns: { id?: string; name: string; items: { label: string; value: string }[] }[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Багана (барилга) тус бүрийг засах — толгой дээрх харандаа товч. */
  onEdit?: (id: string) => void;
}) {
  const labels: string[] = [];
  for (const c of columns) for (const it of c.items) if (!labels.includes(it.label)) labels.push(it.label);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[12px]">
        <thead>
          <tr className={V_THEAD_TR}>
            <th className={V_TH}>Барилгын үзүүлэлт</th>
            {columns.map((c, i) => (
              <th
                key={i}
                onClick={c.id && onSelect ? () => onSelect(c.id!) : undefined}
                className={`${V_TH} ${c.id && onSelect ? "cursor-pointer hover:text-[#02c0ce]" : ""} ${
                  c.id && activeId === c.id ? "text-[#02c0ce]" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.name}
                  {c.id && onEdit && <VColumnEditButton id={c.id} onEdit={onEdit} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={V_TBODY}>
          {labels.map((label) => (
            <tr key={label}>
              <td className={`${V_TD} text-slate-500`}>{label}</td>
              {columns.map((c, i) => (
                <td key={i} className={V_TD}>
                  {c.items.find((x) => x.label === label)?.value || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface VCostApproachItem {
  label: string;
  group: string;
  unit: string;
  value: number | null;
  raw?: string;
}

/** Барилгын өртгийн хандлага (Хүснэгт-5) — барилга бүр багана, бүлэг нь rowspan. */
export function VBuildingCostTable({
  columns,
  activeId,
  onSelect,
  onEdit,
}: {
  columns: { id?: string; name: string; items: VCostApproachItem[] }[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Багана (барилга) тус бүрийг засах — толгой дээрх харандаа товч. */
  onEdit?: (id: string) => void;
}) {
  const rowDefs: { label: string; unit: string; group: string }[] = [];
  const seen = new Set<string>();
  for (const c of columns)
    for (const it of c.items)
      if (!seen.has(it.label)) {
        seen.add(it.label);
        rowDefs.push({ label: it.label, unit: it.unit, group: it.group });
      }
  // Бүлэг (Итгэлцүүр г.м) — зэргэлдээ мөрүүдийг нэгтгэж rowspan болгоно
  const span = new Map<number, number>();
  for (let i = 0; i < rowDefs.length; ) {
    const g = rowDefs[i].group;
    if (g) {
      let j = i;
      while (j + 1 < rowDefs.length && rowDefs[j + 1].group === g) j++;
      span.set(i, j - i + 1);
      i = j + 1;
    } else i++;
  }
  const valOf = (items: VCostApproachItem[], label: string) => {
    const it = items.find((x) => x.label === label);
    if (!it) return "—";
    if (it.value != null) return vNum(it.value);
    return it.raw || "—";
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[12px]">
        <thead>
          <tr className={V_THEAD_TR}>
            <th colSpan={2} className={V_TH}>
              Үзүүлэлт
            </th>
            <th className={V_TH}>Хэмжих нэгж</th>
            {columns.map((c, i) => (
              <th
                key={i}
                onClick={c.id && onSelect ? () => onSelect(c.id!) : undefined}
                className={`${V_TH} text-right ${c.id && onSelect ? "cursor-pointer hover:text-[#02c0ce]" : ""} ${
                  c.id && activeId === c.id ? "text-[#02c0ce]" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.name}
                  {c.id && onEdit && <VColumnEditButton id={c.id} onEdit={onEdit} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={V_TBODY}>
          {rowDefs.map((rd, i) => {
            const strong = /нөхөн орлуулах/i.test(rd.label);
            return (
              <tr key={rd.label}>
                {rd.group ? (
                  <>
                    {span.has(i) && (
                      <td
                        rowSpan={span.get(i)}
                        className={`${V_TD} border-r border-slate-100 align-top font-medium text-slate-600 dark:border-[#37394d] dark:text-slate-300`}
                      >
                        {rd.group}
                      </td>
                    )}
                    <td className={`${V_TD} ${strong ? "font-semibold" : ""}`}>{rd.label}</td>
                  </>
                ) : (
                  <td colSpan={2} className={`${V_TD} ${strong ? "font-semibold" : ""}`}>
                    {rd.label}
                  </td>
                )}
                <td className={`${V_TD} text-slate-500`}>{rd.unit}</td>
                {columns.map((c, ci) => (
                  <td key={ci} className={`${V_TD_NUM} ${strong ? "font-bold" : "font-medium"}`}>
                    {valOf(c.items, rd.label)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface VCostRow {
  id: string;
  name: string;
  unit: string;
  qty: number | null;
  unitPrice: number | null;
  total: number | null;
}

/** Бусад эд хөрөнгө / зардлын хүснэгт (Хүснэгт-6 … 9). */
export function VCostTable({
  rows,
  activeId,
  onRowClick,
  renderQty,
  renderUnitPrice,
  renderTotal,
  renderActions,
  emptyText = "Мөр бүртгэгдээгүй",
}: {
  rows: VCostRow[];
  activeId?: string | null;
  onRowClick?: (row: VCostRow) => void;
  renderQty?: (row: VCostRow, index: number) => ReactNode;
  renderUnitPrice?: (row: VCostRow, index: number) => ReactNode;
  renderTotal?: (row: VCostRow, index: number) => ReactNode;
  renderActions?: (row: VCostRow, index: number) => ReactNode;
  emptyText?: string;
}) {
  const withActions = !!renderActions;
  const extraCols = withActions ? 1 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className={V_THEAD_TR}>
            <th className={`${V_TH} w-8`}>№</th>
            <th className={V_TH}>Нэр</th>
            <th className={V_TH}>Хэмжих нэгж</th>
            <th className={`${V_TH} text-right`}>Тоо хэмжээ</th>
            <th className={`${V_TH} text-right`}>Нэгж үнэ</th>
            <th className={`${V_TH} text-right`}>Нийт үнэ</th>
            {withActions && <th className={`${V_TH} w-8`} />}
          </tr>
        </thead>
        <tbody className={V_TBODY}>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? "cursor-pointer" : ""} ${
                activeId === row.id
                  ? "bg-[#02c0ce]/5"
                  : onRowClick
                    ? "hover:bg-slate-50/60 dark:hover:bg-[#252630]/50"
                    : ""
              }`}
            >
              <td className={`${V_TD} text-slate-400`}>{i + 1}</td>
              <td className={V_TD}>{row.name}</td>
              <td className={`${V_TD} text-slate-500`}>{row.unit || "—"}</td>
              <td className={`${V_TD_NUM} text-slate-500`}>
                {renderQty ? renderQty(row, i) : vNum(row.qty)}
              </td>
              <td className={`${V_TD_NUM} text-slate-500`}>
                {renderUnitPrice ? renderUnitPrice(row, i) : vMoney(row.unitPrice)}
              </td>
              <td className={`${V_TD_NUM} font-semibold`}>
                {renderTotal ? renderTotal(row, i) : vMoney(row.total)}
              </td>
              {withActions && <td className={`${V_TD} text-right`}>{renderActions?.(row, i)}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6 + extraCols} className="px-3 py-5 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className={V_TFOOT_TR}>
              <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-slate-500">
                Нийт
              </td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                {vMoney(rows.reduce((sum, r) => sum + (r.total ?? 0), 0))}
              </td>
              {extraCols > 0 && <td colSpan={extraCols} />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Хураангуй нэгтгэл (Хүснэгт-10). */
export function VSummaryTable({
  rows,
  total,
}: {
  rows: { label: string; value: number }[];
  total: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className={V_THEAD_TR}>
            <th className={`${V_TH} w-8`}>Д/д</th>
            <th className={V_TH}>Хөрөнгийн үнэлгээний зүйлс</th>
            <th className={`${V_TH} text-right`}>Хөрөнгийн үнэлгээ</th>
          </tr>
        </thead>
        <tbody className={V_TBODY}>
          {rows.map((r, i) => (
            <tr key={r.label}>
              <td className={`${V_TD} text-slate-400`}>{i + 1}</td>
              <td className={V_TD}>{r.label}</td>
              <td className={`${V_TD_NUM} font-medium`}>{vMoney(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={V_TFOOT_TR}>
            <td />
            <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">
              Нөхөн олговрын нийт дүн
            </td>
            <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#02c0ce]">
              {vMoney(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Зардлын хүснэгтүүд (3.6–3.9). Зардал нь DB-д "эд хөрөнгө" болж хадгалагддаг ба
// Excel дээр тусдаа хүснэгт байдаг тул хоёр дэлгэцэд НЭГ ижил дүрмээр ангилна.
export const V_COST_GROUPS: {
  key: ValuationSectionKey;
  title: string;
  match: RegExp;
}[] = [
  { key: "temporary_cost", title: "Түр суурьшуулах зардал", match: /түр\s*суур/i },
  {
    key: "clearance_cost",
    title: "Газар чөлөөлөх зардал",
    match: /чөлөөлөх\s*зардал|газар\s*чөлөөлөх/i,
  },
  {
    key: "lost_income",
    title: "Орлогын алдагдсан боломж",
    match: /орлогын\s*алдагдсан|оаб/i,
  },
];

/** Бичвэрээс зардлын хүснэгтийн түлхүүрийг олно (олдохгүй бол null). */
export function costGroupKey(text: string): ValuationSectionKey | null {
  return V_COST_GROUPS.find((g) => g.match.test(text))?.key ?? null;
}
