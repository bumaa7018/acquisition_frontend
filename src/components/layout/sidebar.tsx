"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import { authApi } from "@/lib/api";
import {
  isExternalSpecialRole,
  hasPermission,
  isProfessionalOrg,
  canViewUsers,
  canViewRoles,
  canViewHr,
  canViewSettings,
  canViewDecisionDrafts,
  isSeniorSpecialist,
  isFinanceSpecialist,
  canImportLegacyData,
} from "@/lib/role-utils";
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
  Building,
  User,
  Grid2x2,
  BarChart3,
  Settings,
  ClipboardList,
  SlidersHorizontal,
  GitBranch,
  FolderOpen,
  Calculator,
  History,
  IdCard,
  UserCog,
  Building2,
  Landmark,
  Network,
  BadgeCheck,
  Gavel,
  Hammer,
  Wallet,
  FileUp,
} from "lucide-react";
import { notifyNavStart } from "@/lib/blocking-loader-state";

const NAV_MAIN = [
  { href: "/", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/acquisition", label: "Газар чөлөөлөлт", icon: FileText },
  { href: "/report", label: "Тайлан", icon: BarChart3 },
  { href: "/map", label: "Газрын зураг", icon: Map },
  { href: "/parcel", label: "Нэгж талбар", icon: Grid2x2 },
  { href: "/decision_draft", label: "Захирамжийн төсөл", icon: Gavel },
  { href: "/compensation", label: "Нөхөх олговорын түүх", icon: Receipt },
  // Хуучин мэдээллийн импорт — ЗӨВХӨН админ (proxy ба импортын үйлчилгээ
  // backend-ээр дахин шалгана).
  { href: "/legacy_import", label: "Хуучин мэдээлэл оруулах", icon: FileUp },
];

// Хэрэглэгч/ролийн цэс нь эрхээр шүүгдэнэ (доорх canViewUsers/canViewRoles).
const NAV_ADMIN = [
  { href: "/users", label: "Хэрэглэгчид", icon: Users },
  { href: "/roles", label: "Эрх & Роль", icon: Shield },
];

const NAV_AUDIT = [
  { href: "/audit_logs", label: "Үйлдлийн лог", icon: History },
];


// Тохиргоо — ижил төрлийн цэсийг бүлэглэнэ (sidebar-т бүлгийн гарчигтай).
const NAV_CONFIG_GROUPS = [
  {
    label: "Ерөнхий",
    items: [{ href: "/document_type", label: "Хавсралтын төрөл", icon: FileText }],
  },
  {
    label: "Чөлөөлөлт",
    items: [
      { href: "/acquisition_category", label: "Чөлөөлөлтийн ангилал", icon: FolderOpen },
      { href: "/acquisition_progress_status", label: "Чөлөөлөлтийн явцын статус", icon: ClipboardList },
      { href: "/acquisition_workflow", label: "Чөлөөлөлтийн урсгал", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Нэгж талбар",
    items: [
      { href: "/parcel_status", label: "Нэгж талбарын статус", icon: Grid2x2 },
      { href: "/parcel_workflow", label: "Нэгж талбарын урсгал", icon: GitBranch },
    ],
  },
  {
    label: "Үнэлгээ",
    items: [
      { href: "/asset_spec_type", label: "Байгууламжийн чанарын төрөл", icon: Layers },
      { href: "/asset_calc_type", label: "Байгууламжийн тооцооллын төрөл", icon: Calculator },
    ],
  },
  {
    label: "Захирамжийн төсөл",
    items: [
      { href: "/decision_work_type", label: "Ажлын төрөл", icon: Hammer },
      { href: "/decision_budget", label: "Төсөв", icon: Wallet },
      { href: "/decision_review_unit", label: "Төсөл хянах нэгж", icon: Building },
    ],
  },
];

const NAV_CONFIG = NAV_CONFIG_GROUPS.flatMap((g) => g.items);

const NAV_HR = [
  { href: "/person", label: "Иргэн, хуулийн этгээд", icon: IdCard },
  { href: "/employee", label: "Ажилтан", icon: UserCog },
  { href: "/organization", label: "Байгууллага", icon: Building2 },
  { href: "/valuation_org", label: "Үнэлгээний байгууллага", icon: Landmark },
  { href: "/department", label: "Алба, хэлтэс", icon: Network },
  { href: "/position", label: "Албан тушаал", icon: BadgeCheck },
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
      {/*
        prefetch={false} — Next-ийн <Link> нь харагдах талбарт орсон даруйдаа
        зорилтот замын RSC payload-ыг татдаг. Хажуугийн цэс 30 орчим холбоостой
        тул хуудас ачаалах бүрд 30 нэмэлт хүсэлт үүсдэг байв. Browser нь нэг
        origin дээр HTTP/1.1-ээр ЗӨВХӨН 6 холболт зэрэг барьдаг (урд нь
        reverse proxy байхгүй, Next standalone нь HTTP/2 дэмждэггүй) ба
        мэдэгдлийн SSE нэгийг нь БАЙНГА эзэлдэг. Иймд тэр prefetch-ууд жинхэнэ
        API дуудлагыг дараалалд оруулж "уншиж гацах" мэдрэмж төрүүлдэг байлаа.
        Цэс дарахад шилжилт хэвийн ажиллана — зөвхөн урьдчилсан татах нь
        унтарна.
      */}
      <Link
        prefetch={false}
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
  const [isFinance, setIsFinance] = useState(false);
  const [canViewConfig, setCanViewConfig] = useState(false);
  const [canViewHrNav, setCanViewHrNav] = useState(false);
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [adminNav, setAdminNav] = useState<typeof NAV_ADMIN>([]);
  // Захирамжийн төсөл — decision:read эрхтэй ажилтанд л харагдана.
  const [mainNav, setMainNav] = useState<typeof NAV_MAIN>(
    NAV_MAIN.filter((item) => item.href !== "/decision_draft" && item.href !== "/legacy_import"),
  );

  const allAdminHrefs = [...NAV_ADMIN, ...NAV_AUDIT, ...NAV_CONFIG, ...NAV_HR].map((i) => i.href);
  const [adminOpen, setAdminOpen] = useState(
    allAdminHrefs.some((href) => pathname.startsWith(href)),
  );
  const [configOpen, setConfigOpen] = useState(
    NAV_CONFIG.some((item) => pathname.startsWith(item.href)),
  );
  const [hrOpen, setHrOpen] = useState(
    NAV_HR.some((item) => pathname.startsWith(item.href)),
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setUser(authStorage.getUser());
    setIsExternal(isExternalSpecialRole());
    setIsProfOrg(isProfessionalOrg());
    setIsFinance(isFinanceSpecialist());
    setCanViewConfig(canViewSettings());
    setCanViewHrNav(canViewHr());
    setCanViewAudit(hasPermission("audit:read"));
    // Хэрэглэгч/роль цэс — эрхтэй хэрэглэгчид л харагдана. Эрхгүй хэрэглэгч
    // цэсээр орж 403 toast-той хоосон хуудас харахаас сэргийлнэ.
    setAdminNav(
      NAV_ADMIN.filter((item) =>
        item.href === "/users" ? canViewUsers() : canViewRoles(),
      ),
    );
    // Захирамжийн төсөл нь тусдаа decision:* эрхтэй — эрхгүй ажилтанд цэс
    // харуулбал 403-той хоосон хуудас нээгдэнэ.
    const showDecision = canViewDecisionDrafts();
    // Тайлан нь БҮХ чөлөөлөлтийг хуваарилалт үл харгалзан нэгтгэдэг тул
    // backend дээр ахлах мэргэжилтнээр хязгаарлагдсан — цэсийг мөн тэгш байлгана.
    const showReport = isSeniorSpecialist();
    const showImport = canImportLegacyData();
    setMainNav(
      NAV_MAIN.filter(
        (item) =>
          (item.href !== "/decision_draft" || showDecision) &&
          (item.href !== "/report" || showReport) &&
          (item.href !== "/legacy_import" || showImport),
      ),
    );
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
          collapsed ? "justify-center px-0" : "gap-3 px-4",
        )}
      >
        {/* Цагаан дэвсгэр — dark горимд лого (хар хөх) харагдана */}
        <div className="h-10 w-10 shrink-0 rounded-lg bg-white p-0.5">
          <Image src="/logo.png" alt="Лого" width={40} height={40} priority className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          // Урт нэр — 2 мөрөнд. Nunito Sans 12px bold-оор эхний мөр ≈145px,
          // текстэд үлдэх зай ≈155px (w-60 − px-4 − лого 40 − gap-3).
          <span className="min-w-0 whitespace-nowrap text-[12px] font-bold leading-snug text-slate-800 dark:text-white tracking-tight">
            Нийслэлийн газар зохион
            <br />
            байгуулалтын алба
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
                  : NAV_MAIN.filter(
                      (item) =>
                        item.href === "/" ||
                        item.href === "/acquisition" ||
                        // Санхүүгийн мэргэжилтэн — "Нэгж талбар" жагсаалтыг мөн
                        // харна (доторх агуулга дотоод ажилтных ЯГ ИЖИЛ;
                        // backend нь compensation:read-ээр уншуулна).
                        (item.href === "/parcel" && isFinance),
                    )
                : mainNav
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

        {/* Удирдлага dropdown — гадаад ролиудад, мөн дотор нь харах юмгүй
            (эрхгүй) хэрэглэгчид харагдахгүй */}
        {ready && !isExternal && (adminNav.length > 0 || canViewAudit || canViewConfig || canViewHrNav) && (
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
                  {adminNav.map((item) => (
                    <NavItem
                      key={item.href}
                      {...item}
                      active={isActive(item.href)}
                      collapsed={collapsed}
                    />
                  ))}
                  {canViewAudit &&
                    NAV_AUDIT.map((item) => (
                      <NavItem
                        key={item.href}
                        {...item}
                        active={isActive(item.href)}
                        collapsed={collapsed}
                      />
                    ))}
                </nav>

                {canViewHrNav && (
                  <div className="mt-0.5">
                    <button
                      onClick={() => setHrOpen((v) => !v)}
                      title={collapsed ? "Хүний нөөц" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg py-2 transition-colors hover:bg-slate-50 dark:hover:bg-[#252630]",
                        collapsed ? "justify-center px-3" : "px-3",
                      )}
                    >
                      <UserCog className="h-[17px] w-[17px] shrink-0 text-slate-400 dark:text-[#8391a2]" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-[13px] font-medium text-slate-500 dark:text-[#97aac1]">
                            Хүний нөөц
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 text-slate-400 dark:text-[#8391a2] transition-transform duration-200",
                              hrOpen ? "rotate-180" : "rotate-0",
                            )}
                          />
                        </>
                      )}
                    </button>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200",
                        hrOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <nav className="space-y-0.5">
                          {NAV_HR.map((item) => (
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

                {/* Тохиргоо nested dropdown — системийн тохиргоо харах эрхтэй хэрэглэгчид */}
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
                          {NAV_CONFIG_GROUPS.map((group) => (
                            <div key={group.label} className="pt-1.5 first:pt-0.5">
                              {!collapsed && (
                                <p className="pb-0.5 pl-6 pr-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400/80 dark:text-[#6c7a8d]">
                                  {group.label}
                                </p>
                              )}
                              {group.items.map((item) => (
                                <NavItem
                                  key={item.href}
                                  {...item}
                                  active={isActive(item.href)}
                                  collapsed={collapsed}
                                  indent
                                />
                              ))}
                            </div>
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
