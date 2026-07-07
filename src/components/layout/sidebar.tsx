"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { isExternalSpecialRole, hasPermission, isProfessionalOrg } from "@/lib/role-utils";
import {
  LayoutDashboard,
  Map,
  FileText,
  Users,
  Shield,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Layers,
  User,
  Grid2x2,
  BarChart3,
  Settings,
  ClipboardList,
  SlidersHorizontal,
  GitBranch,
  FolderOpen,
  Calculator,
} from "lucide-react";
import { notifyNavStart } from "@/lib/blocking-loader-state";

const NAV_MAIN = [
  { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/acquisition", label: "Газар чөлөөлөлт", icon: FileText },
  { href: "/report", label: "Тайлан", icon: BarChart3 },
  { href: "/map", label: "Газрын зураг", icon: Map },
  { href: "/parcel", label: "Нэгж талбарын түүх", icon: Grid2x2 },
  { href: "/compensation", label: "Нөхөх олговорын түүх", icon: Receipt },
];

const NAV_ADMIN = [
  { href: "/users", label: "Хэрэглэгчид", icon: Users },
  { href: "/roles", label: "Эрх & Роль", icon: Shield },
];

const NAV_CONFIG = [
  {
    href: "/acquisition_category",
    label: "Чөлөөлөлтийн ангилал",
    icon: FolderOpen,
  },
  {
    href: "/acquisition_progress_status",
    label: "Чөлөөлөлтийн явцын статус",
    icon: ClipboardList,
  },
  {
    href: "/parcel_status",
    label: "Нэгж талбарын статус",
    icon: Grid2x2,
  },
  {
    href: "/document_type",
    label: "Баримт бичгийн төрөл",
    icon: FileText,
  },
  {
    href: "/parcel_workflow",
    label: "Нэгж ажлын урсгал",
    icon: GitBranch,
  },
  {
    href: "/acquisition_workflow",
    label: "Чөлөөлөлтийн ажлын урсгал",
    icon: SlidersHorizontal,
  },
  {
    href: "/asset_spec_type",
    label: "Байгааламжийн чанарын төрөл",
    icon: Layers,
  },
  {
    href: "/asset_calc_type",
    label: "Байгааламжийн тооцооллын төрөл",
    icon: Calculator,
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  indent = false,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  indent?: boolean;
}) {
  return (
    <div className="relative">
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#02c0ce]" />
      )}
      <Link
        href={href}
        title={collapsed ? label : undefined}
        onClick={notifyNavStart}
        className={cn(
          "flex items-center rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
          collapsed ? "justify-center" : "gap-3",
          indent && !collapsed && "pl-6",
          active
            ? "bg-[#02c0ce]/10 text-[#02c0ce] dark:bg-[#02c0ce]/10 dark:text-[#02c0ce]"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-[#97aac1] dark:hover:bg-[#252630] dark:hover:text-[#e2eeff]",
        )}
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        {!collapsed && <span className="flex-1">{label}</span>}
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] =
    useState<ReturnType<typeof authStorage.getUser>>(null);
  // Role-г localStorage-оос уншдаг тул зөвхөн mount хийсний дараа тодорхой болно.
  // ready=false үед буруу menu-г зурахгүйн тулд skeleton харуулна (FOUC-с сэргийлнэ).
  const [ready, setReady] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isProfOrg, setIsProfOrg] = useState(false);
  const [canViewConfig, setCanViewConfig] = useState(false);

  const allAdminHrefs = [...NAV_ADMIN, ...NAV_CONFIG].map((i) => i.href);
  const [adminOpen, setAdminOpen] = useState(
    allAdminHrefs.some((href) => pathname.startsWith(href)),
  );
  const [configOpen, setConfigOpen] = useState(
    NAV_CONFIG.some((item) => pathname.startsWith(item.href)),
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setUser(authStorage.getUser());
    setIsExternal(isExternalSpecialRole());
    setIsProfOrg(isProfessionalOrg());
    setCanViewConfig(hasPermission("admin:read"));
    setReady(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col bg-white dark:bg-[#1e1f27] border-r border-slate-200/80 dark:border-[#37394d] transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-11 top-[24px] z-10 flex h-10 w-10 items-center justify-center bg-transparent"
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5 text-slate-500 dark:text-[#97aac1]" />
        ) : (
          <ChevronLeft className="h-5 w-5 text-slate-500 dark:text-[#97aac1]" />
        )}
      </button>

      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-[85px] border-b border-slate-100 dark:border-[#37394d] shrink-0 overflow-hidden transition-all duration-300",
          collapsed ? "justify-center px-0" : "gap-3 px-5",
        )}
      >
        <div className="relative h-8 w-8 shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rotate-45 rounded-[6px] bg-[#02c0ce]" />
          <Layers className="relative z-10 h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-bold text-slate-800 dark:text-white tracking-tight whitespace-nowrap">
            Газрын Систем
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        {/* Role тодрох хүртэл skeleton — буруу menu анивчихаас сэргийлнэ */}
        {!ready && (
          <nav className="space-y-1.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-lg bg-slate-100 dark:bg-[#252630] animate-pulse"
              />
            ))}
          </nav>
        )}

        {/* Main nav — external special roles see dashboard and acquisition menu */}
        {ready && (
          <div>
            <nav className="space-y-0.5">
              {(isExternal
                ? isProfOrg
                  ? [
                      { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
                      { href: "/my_acquisitions", label: "Газар чөлөөлөлт", icon: FileText },
                    ]
                  : NAV_MAIN.filter((item) => item.href === "/" || item.href === "/acquisition")
                : NAV_MAIN
              ).map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </div>
        )}

        {/* Удирдлага dropdown — hidden for external special roles */}
        {ready && !isExternal && (
          <div>
            <button
              onClick={() => setAdminOpen((v) => !v)}
              className={cn(
                "flex w-full items-center mb-1 gap-1 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-[#252630] py-2",
                collapsed ? "justify-center px-3 py-2.5" : "px-3",
              )}
            >
              <Settings className="h-[17px] w-[17px] shrink-0 text-slate-400 dark:text-[#8391a2]" />
              {!collapsed && (
                <>
                  <p className="flex-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-[#8391a2]">
                    Удирдлага
                  </p>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-slate-400 dark:text-[#8391a2] transition-transform duration-200",
                      adminOpen ? "rotate-180" : "rotate-0",
                    )}
                  />
                </>
              )}
            </button>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                adminOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <nav className="space-y-0.5">
                  {NAV_ADMIN.map((item) => (
                    <NavItem
                      key={item.href}
                      {...item}
                      active={isActive(item.href)}
                      collapsed={collapsed}
                    />
                  ))}
                </nav>

                {/* Тохиргоо nested dropdown — admin:read эрхтэй хэрэглэгчид л харагдана */}
                {canViewConfig && (
                  <div className="mt-0.5">
                    <button
                      onClick={() => setConfigOpen((v) => !v)}
                      title={collapsed ? "Тохиргоо" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg py-2 transition-colors hover:bg-slate-50 dark:hover:bg-[#252630]",
                        collapsed ? "justify-center px-3" : "px-3",
                      )}
                    >
                      <SlidersHorizontal className="h-[17px] w-[17px] shrink-0 text-slate-400 dark:text-[#8391a2]" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-[13px] font-medium text-slate-500 dark:text-[#97aac1]">
                            Тохиргоо
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 text-slate-400 dark:text-[#8391a2] transition-transform duration-200",
                              configOpen ? "rotate-180" : "rotate-0",
                            )}
                          />
                        </>
                      )}
                    </button>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200",
                        configOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <nav className="space-y-0.5">
                          {NAV_CONFIG.map((item) => (
                            <NavItem
                              key={item.href}
                              {...item}
                              active={isActive(item.href)}
                              collapsed={collapsed}
                              indent
                            />
                          ))}
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
