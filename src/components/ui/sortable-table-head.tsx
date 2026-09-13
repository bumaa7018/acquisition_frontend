"use client";

// Хүснэгтийн БАГАНААР эрэмбэлэх толгой.
//
// Жагсаалтууд нь СЕРВЕР ДЭЭР хуудаслагддаг тул эрэмбийг browser дээр хийж
// болохгүй — тэгвэл зөвхөн ХАРАГДАЖ БУЙ хуудас дотроо эрэмбэлэгдэж, "хамгийн
// том талбай" гэх мэт асуултад буруу хариу өгнө. Иймд энэ компонент нь
// зөвхөн ТӨЛӨВ (аль багана, ямар чиглэл) хөтөлж, эцэг хуудас түүнийгээ
// backend-ийн `sort` / `order` параметрээр дамжуулна.

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";
export type SortState = { by: string; dir: SortDir };

/** Багана дээр дарахад: өсөх → буурах → эрэмбэгүй (үндсэн байдал). */
export function nextSortState(
  current: SortState | null,
  key: string,
): SortState | null {
  if (!current || current.by !== key) return { by: key, dir: "asc" };
  if (current.dir === "asc") return { by: key, dir: "desc" };
  return null;
}

/**
 * Хүснэгтийн нэг баганын тодорхойлолт.
 * `key` байхгүй бол тухайн багана эрэмбэлэгдэхгүй (үйлдлийн багана г.м.).
 */
export type SortColumn = {
  label: string;
  key?: string;
  className?: string;
};

const TH_BASE =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap";

export function SortableHeaderRow({
  columns,
  sort,
  onSort,
  thClassName = TH_BASE,
  className,
}: {
  columns: SortColumn[];
  sort: SortState | null;
  onSort: (key: string) => void;
  /** Багананы үндсэн класс (хуудас бүр өөрийн padding-тай тул дарж бичиж болно). */
  thClassName?: string;
  className?: string;
}) {
  return (
    <tr className={className}>
      {columns.map((col, i) => {
        const cls = `${thClassName}${col.className ? ` ${col.className}` : ""}`;
        if (!col.key) {
          return (
            <th key={i} className={cls}>
              {col.label}
            </th>
          );
        }
        const active = sort?.by === col.key;
        const Icon = !active
          ? ChevronsUpDown
          : sort.dir === "asc"
            ? ChevronUp
            : ChevronDown;
        return (
          <th
            key={i}
            className={cls}
            aria-sort={
              active
                ? sort.dir === "asc"
                  ? "ascending"
                  : "descending"
                : "none"
            }
          >
            <button
              type="button"
              onClick={() => onSort(col.key!)}
              title={
                active
                  ? sort.dir === "asc"
                    ? "Буурахаар эрэмбэлэх"
                    : "Эрэмбийг цуцлах"
                  : "Өсөхөөр эрэмбэлэх"
              }
              className={`group inline-flex max-w-full items-center gap-1 text-left uppercase tracking-wider transition-colors hover:text-slate-600 dark:hover:text-slate-300 ${
                active ? "text-[#02c0ce] dark:text-[#02c0ce]" : ""
              }`}
            >
              <span className="truncate">{col.label}</span>
              <Icon
                className={`h-3 w-3 shrink-0 transition-opacity ${
                  active ? "opacity-100" : "opacity-30 group-hover:opacity-70"
                }`}
              />
            </button>
          </th>
        );
      })}
    </tr>
  );
}
