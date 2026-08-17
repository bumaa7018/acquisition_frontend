"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { authStorage } from "@/lib/auth";
import {
  canViewHr,
  canViewRoles,
  canViewSettings,
  canViewUsers,
  hasPermission,
  isExternalSpecialRole,
  isProfessionalOrg,
  isSeniorSpecialist,
} from "@/lib/role-utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BlockingLoaderProvider } from "@/lib/blocking-loader";
import { NavigationEvents } from "@/components/layout/navigation-events";

/**
 * Хуудасны түвшний эрхийн бодлого.
 *
 * Урьд нь хажуугийн цэс л эрхээр шүүгддэг байсан тул хаяг мөрөөр шууд орвол
 * (жишээ нь `/employee`, `/report`) хуудас нээгдэж, зөвхөн API-ийн 403-аар
 * зогсдог байв. Тохиргооны/лавлахын GET-үүд backend дээр эрх шаарддаггүй тул
 * зарим хуудас БҮРЭН нээлттэй байсан.
 *
 * ЖИЧ: энэ бол ХЭРЭГЛЭГЧИЙН ТУСГАЛ (defense-in-depth) — жинхэнэ хамгаалалт нь
 * backend дээр. Дүрмүүд нь Sidebar-ийн харагдах дүрэмтэй ЯГ ижил функцуудыг
 * ашигладаг тул хоёр газар зөрөх боломжгүй.
 */
const ROUTE_GUARDS: { match: (p: string) => boolean; allow: () => boolean }[] = [
  { match: (p) => p.startsWith("/users"), allow: canViewUsers },
  { match: (p) => p.startsWith("/roles"), allow: canViewRoles },
  { match: (p) => p.startsWith("/audit_logs"), allow: () => hasPermission("audit:read") },
  // Тайлан нь БҮХ чөлөөлөлтийг нэгтгэдэг тул backend дээр ахлах мэргэжилтнээр
  // хязгаарлагдсан (`/report/download`, `/report/summary`) — UI мөн тэгнэ.
  { match: (p) => p.startsWith("/report"), allow: isSeniorSpecialist },
  {
    match: (p) =>
      ["/person", "/employee", "/organization", "/valuation_org", "/department", "/position"].some(
        (r) => p.startsWith(r),
      ),
    allow: canViewHr,
  },
  {
    match: (p) =>
      [
        "/acquisition_category",
        "/acquisition_progress_status",
        "/acquisition_workflow",
        "/parcel_status",
        "/parcel_workflow",
        "/document_type",
        "/asset_spec_type",
        "/asset_calc_type",
        "/decision_work_type",
        "/decision_budget",
      ].some((r) => p.startsWith(r)),
    allow: canViewSettings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!authStorage.getAccessToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (!authStorage.getAccessToken()) return;
    if (!isExternalSpecialRole()) return;
    const profOrgAllowed =
      isProfessionalOrg() &&
      (pathname === "/" ||
        pathname === "/my_acquisitions" ||
        pathname.startsWith("/acquisition") ||
        /^\/parcel\/[^/]+$/.test(pathname));
    const otherExternalAllowed =
      !isProfessionalOrg() &&
      (pathname === "/" ||
        pathname.startsWith("/acquisition") ||
        /^\/parcel\/[^/]+$/.test(pathname));
    if (!profOrgAllowed && !otherExternalAllowed) {
      router.replace(isProfessionalOrg() ? "/my_acquisitions" : "/acquisition");
    }
  }, [pathname, router]);

  // Дотоод хэрэглэгчийн хуудасны эрх — цэсэнд харагдахгүй хуудсыг хаягаар
  // шууд нээхээс сэргийлнэ.
  useEffect(() => {
    if (!authStorage.getAccessToken()) return;
    if (isExternalSpecialRole()) return; // дээрх шалгуураар аль хэдийн хумигдсан
    const guard = ROUTE_GUARDS.find((g) => g.match(pathname));
    if (guard && !guard.allow()) router.replace("/");
  }, [pathname, router]);

  return (
    <BlockingLoaderProvider>
      <NavigationEvents />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>
    </BlockingLoaderProvider>
  );
}
