"use client";
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathParamsContext,
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { cn } from "@/lib/utils";
import { loadPageTabs, subscribePageTabs } from "@/lib/page-tabs";
import { getNavTarget, setWarmCheck, subscribe } from "@/lib/blocking-loader-state";
import { resolveNavItem } from "./sidebar";

/** Замд харгалзах табын түлхүүр — `PageTabs`-тай ижил дүрэм. */
export function pageTabKey(pathname: string): string {
  return resolveNavItem(pathname)?.href ?? pathname;
}

type Snapshot = {
  layout: React.ContextType<typeof LayoutRouterContext>;
  pathname: React.ContextType<typeof PathnameContext>;
  search: React.ContextType<typeof SearchParamsContext>;
  params: React.ContextType<typeof PathParamsContext>;
};

/**
 * Нээлттэй таб бүрийн хуудсыг MOUNT-тай нь үлдээнэ (Chrome-ийн таб шиг) —
 * таб руу буцахад шүүлт, гүйлгэлт, газрын зураг, оруулсан өгөгдөл яг хэвээрээ.
 *
 * App Router нь layout-ийн `children`-д ЗӨВХӨН одоогийн хуудсыг (context-оор)
 * өгдөг тул таб бүрт тухайн таб идэвхтэй байх үеийн router context-уудыг
 * хадгалж ("хөлдөөж"), идэвхгүй табыг тэр context дотор нуугдмал зурна.
 * Ингэснээр нуугдсан хуудасны `usePathname`/`useParams` өөрчлөгдөхгүй.
 *
 * Таб хаагдмагц (эсвэл хугацаа нь дуусахад) хуудас нь unmount болно.
 *
 * Нээлттэй таб руу (орхисон замаар нь) шилжихэд router-ийг хүлээлгүй ШУУД
 * харуулж, шилжилтийн loader-ийг алгасна (`setWarmCheck`).
 */
export function KeepAliveTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey = pageTabKey(pathname);

  const live: Snapshot = {
    layout: useContext(LayoutRouterContext),
    pathname: useContext(PathnameContext),
    search: useContext(SearchParamsContext),
    params: useContext(PathParamsContext),
  };
  const snapshots = useRef(new Map<string, Snapshot>());
  snapshots.current.set(activeKey, live);

  const isWarm = (path: string) => {
    const snap = snapshots.current.get(pageTabKey(path.split("?")[0]));
    return !!snap && snapPath(snap) === path;
  };
  // Модулийн түвшинд нэг л KeepAliveTabs байдаг — хамгийн сүүлийн map-ыг харна.
  setWarmCheck(isWarm);
  useEffect(() => () => setWarmCheck(() => false), []);

  const navTarget = useSyncExternalStore(subscribe, getNavTarget, () => null);
  const shownKey =
    navTarget && isWarm(navTarget) ? pageTabKey(navTarget.split("?")[0]) : activeKey;

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => readOpenKeys());
  useEffect(() => subscribePageTabs(() => setOpenKeys(readOpenKeys())), []);

  for (const key of Array.from(snapshots.current.keys())) {
    if (key !== activeKey && !openKeys.has(key)) snapshots.current.delete(key);
  }

  return (
    <>
      {Array.from(snapshots.current, ([key, snap]) => {
        const active = key === shownKey;
        return (
          <div
            key={key}
            aria-hidden={!active}
            // display:none биш — газрын зураг г.м. хэмжээгээ алдаж, гүйлгэлт
            // тэглэгдэхгүйн тулд нуугдсан таб байрандаа хэмжээтэйгээ үлдэнэ.
            className={cn(
              "absolute inset-0 overflow-y-auto bg-background p-6",
              !active && "pointer-events-none invisible",
            )}
          >
            <LayoutRouterContext.Provider value={snap.layout}>
              <PathnameContext.Provider value={snap.pathname}>
                <SearchParamsContext.Provider value={snap.search}>
                  <PathParamsContext.Provider value={snap.params}>
                    {children}
                  </PathParamsContext.Provider>
                </SearchParamsContext.Provider>
              </PathnameContext.Provider>
            </LayoutRouterContext.Provider>
          </div>
        );
      })}
    </>
  );
}

function snapPath(snap: Snapshot): string {
  const search = snap.search?.toString();
  return search ? `${snap.pathname}?${search}` : snap.pathname ?? "";
}

function readOpenKeys(): Set<string> {
  return new Set([pageTabKey("/"), ...loadPageTabs().map((t) => t.key)]);
}
