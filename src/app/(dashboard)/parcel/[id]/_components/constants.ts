export const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: "#02c0ce", bg: "#02c0ce18" },
  2: { color: "#f59e0b", bg: "#f59e0b18" },
  3: { color: "#0acf97", bg: "#0acf9718" },
  4: { color: "#f1556c", bg: "#f1556c18" },
};

export type Tab = "general" | "realEstate" | "documents" | "payment" | "map" | "print";

export const ASSET_TYPE_LABELS: Record<string, string> = {
  real_state: "Үл хөдлөх хөрөнгө",
  property: "Эд хөрөнгө",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  parcel: "Нэгж талбарын нөхөн төлбөр",
  asset: "Хөрөнгийн нөхөн төлбөр",
};

export const COMP_TYPE_LABELS: Record<string, string> = {
  cash: "Мөнгөн дүн",
  land_grant: "Газрын нөхөн олговор",
};

export const INP =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";
