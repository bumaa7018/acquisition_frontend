"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { authStorage } from "@/lib/auth";
import { isExternalSpecialRole, isProfessionalOrg } from "@/lib/role-utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BlockingLoaderProvider } from "@/lib/blocking-loader";
import { NavigationEvents } from "@/components/layout/navigation-events";

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
