"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";

const TABS = [
  { href: "/drone/acquisitions", label: "Tile давхарга", icon: Layers },
];

export function DroneNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const acq = searchParams.get("acq");
  const suffix = acq ? `?acq=${encodeURIComponent(acq)}` : "";

  return (
    <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={`${t.href}${suffix}`}
            className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[100px] whitespace-nowrap transition-all select-none
              ${
                active
                  ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"
              }`}
          >
            {active && (
              <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
            )}
            <Icon
              className={`h-4 w-4 transition-colors ${active ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span
              className={`text-[11.5px] font-semibold tracking-wide transition-colors ${active ? "text-[#02c0ce]" : ""}`}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
