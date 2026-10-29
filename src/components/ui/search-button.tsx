"use client";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Шүүлтийн мөрийн "Хайх" товч — бүх хуудсанд ижил өнгө, хэмжээтэй байх
 * стандарт. Ард нь `<RefreshButton />` байрлана.
 */
export function SearchButton({
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90 disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <Search className="h-3.5 w-3.5" />
      Хайх
    </button>
  );
}
