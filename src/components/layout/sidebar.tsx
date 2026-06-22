"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import { authApi } from "@/lib/api";
import {
  LayoutDashboard,
  Map,
  FileText,
  Users,
  Shield,
  LogOut,
  ChevronDown,
  Receipt,
  Layers,
  User,
  Grid2x2,
} from "lucide-react";

const NAV_MAIN = [
  { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/acquisition", label: "Газар чөлөөлөлт", icon: FileText },
  { href: "/parcel", label: "Нэгж талбар", icon: Grid2x2 },
  { href: "/map", label: "Газрын зураг", icon: Map },
  { href: "/compensation", label: "Нөхөх төлбөр", icon: Receipt },
];

const NAV_ADMIN = [
  { href: "/users", label: "Хэрэглэгчид", icon: Users },
  { href: "/roles", label: "Эрх & Роль", icon: Shield },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <div className="relative">
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#02c0ce]" />
      )}
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
          active
            ? "bg-[#02c0ce]/10 text-[#02c0ce] dark:bg-[#02c0ce]/10 dark:text-[#02c0ce]"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-[#97aac1] dark:hover:bg-[#252630] dark:hover:text-[#e2eeff]",
        )}
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        <span className="flex-1">{label}</span>
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] =
    useState<ReturnType<typeof authStorage.getUser>>(null);
  useEffect(() => {
    setUser(authStorage.getUser());
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    authStorage.clear();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : null;

  const fullName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    : "Хэрэглэгч";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-white dark:bg-[#1e1f27] border-r border-slate-200/80 dark:border-[#37394d]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[85px] border-b border-slate-100 dark:border-[#37394d] shrink-0">
        <div className="relative h-8 w-8 shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rotate-45 rounded-[6px] bg-[#02c0ce]" />
          <Layers className="relative z-10 h-4 w-4 text-white" />
        </div>
        <span className="text-[15px] font-bold text-slate-800 dark:text-white tracking-tight">
          Газрын Систем
        </span>
      </div>

      {/* User profile */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-[#37394d] dark:bg-[#252630] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#02c0ce] text-white text-[12px] font-bold select-none">
            {initials ?? <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 dark:text-white truncate leading-tight">
              {fullName || "Админ"}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-[#97aac1] truncate leading-tight mt-0.5">
              {user?.email ?? "имэйл"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-[#8391a2]">
            Үндсэн цэс
          </p>
          <nav className="space-y-0.5">
            {NAV_MAIN.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </nav>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-[#8391a2]">
            Удирдлага
          </p>
          <nav className="space-y-0.5">
            {NAV_ADMIN.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
