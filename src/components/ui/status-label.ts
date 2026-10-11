import { createElement, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { statusLabelVars } from "@/lib/status-colors";

/**
 * Нэгж талбарын төлөвийн шошго — товч БИШ, зөвхөн төлөв харуулна.
 *
 *     <StatusLabel color={status.color} name={status.name} />
 *
 * Өнгө нь бүртгэлийн ГАНЦ hex (`parcel_status.color`); дэвсгэр, хүрээ, текст,
 * цэгийн цагирагийг theme бүрт тооцоолно (lib/status-colors.ts,
 * status-label.css). Нэрийг өгөгдлийн сангийнх ХЭВЭЭР харуулна; урт бол
 * таслагдаж, бүтэн нэр `title`-д. Цэг нь чимэглэл (aria-hidden) — утгыг
 * текст илэрхийлнэ.
 *
 * JSX-гүй (createElement) — `node:test` (strip-types) JSX хөрвүүлдэггүй тул
 * тестээс шууд рендерлэнэ (tests/status-label.test.mjs).
 */
export function StatusLabel({ color, name, className }: { color?: string | null; name: string; className?: string }) {
  return createElement(
    "span",
    { className: cn("status-label", className), style: statusLabelVars(color) as CSSProperties, title: name },
    createElement("span", { className: "status-label__dot", "aria-hidden": "true" }),
    createElement("span", { className: "status-label__text" }, name),
  );
}

/** Зөвхөн цэг (тоо, талбайн жагсаалт) — шошгоны цэгтэй ижил өнгө, цагираг. */
export function StatusDot({ color, className }: { color?: string | null; className?: string }) {
  return createElement("span", {
    className: cn("status-dot", className),
    style: statusLabelVars(color) as CSSProperties,
    "aria-hidden": "true",
  });
}
