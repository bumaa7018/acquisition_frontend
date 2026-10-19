"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CopyX, ListX, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavTarget, notifyNavStart, subscribe } from "@/lib/blocking-loader-state";
import {
  PAGE_TABS_MAX,
  loadPageTabs,
  nextTabExpiry,
  pruneExpiredTabs,
  savePageTabs,
  type PageTab,
} from "@/lib/page-tabs";
import { resolveNavItem } from "./sidebar";

const HOME = resolveNavItem("/")!;
/** Root layout-ийн metadata-тай ижил. */
const APP_TITLE = "Газрын Мэдээллийн Систем";

/**
 * Цэсээр нээсэн хуудсуудын таб мөр.
 *
 * URL нь ҮНЭНИЙ ЭХ СУРВАЛЖ: хаяг өөрчлөгдөх бүрд харгалзах таб нээгдэж/
 * шинэчлэгдэнэ (цэс, холбоос, browser-ийн back/forward аль нь ч хамаагүй),
 * таб дарахад тухайн табын сүүлийн зам руу шилжинэ. Хяналтын самбар (`/`)
 * үргэлж эхэнд, хаагдахгүй.
 *
 * Цэс/таб дарахад таб ШУУД нээгдэж идэвхжинэ (`getNavTarget`), хуудас
 * ачаалагдах хооронд контентын хэсэгт loader гарна (`ContentLoader`).
 * Таб дээр баруун товч дарахад "Хаах / Бусдыг хаах / Бүгдийг хаах" цэс гарна.
 */
export function PageTabs() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const [tabs, setTabs] = useState<PageTab[]>([]);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const navTarget = useSyncExternalStore(subscribe, getNavTarget, () => null);

  const fullPath = search ? `${pathname}?${search}` : pathname;
  const currentKey = resolveNavItem(pathname)?.href ?? pathname;
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Таб солигдсон бол шинэ таб БОЛОН орхисон табын цаг дахин эхэлнэ —
    // удаан харж байсан табаас гармагц шууд хаагдахаас сэргийлнэ.
    const prevKey = prevKeyRef.current;
    const switched = prevKey !== currentKey;
    prevKeyRef.current = currentKey;
    const now = Date.now();

    let next = loadPageTabs().map((t) =>
      switched && t.key === prevKey ? { ...t, lastActiveAt: now } : t,
    );
    if (currentKey !== HOME.href) {
      const label = resolveNavItem(pathname)?.label ?? "Хуудас";
      next = next.some((t) => t.key === currentKey)
        ? next.map((t) =>
            t.key === currentKey
              ? { ...t, path: fullPath, lastActiveAt: switched ? now : t.lastActiveAt }
              : t,
          )
        : [...next, { key: currentKey, path: fullPath, label, lastActiveAt: now }];
    }
    next = pruneExpiredTabs(next, currentKey, now);
    while (next.length > PAGE_TABS_MAX) {
      const oldest = next.findIndex((t) => t.key !== currentKey);
      next = next.filter((_, i) => i !== oldest);
    }
    savePageTabs(next);
    setTabs(next);
  }, [currentKey, pathname, fullPath]);

  // Хуудас бүрт өөрийн гарчиг. Бүгд ижил гарчигтай байхад browser-ийн
  // history (chrome://history, back товчны жагсаалт) дээр бүх зам нэг л
  // бичлэг мэт нийлж харагддаг байв.
  useEffect(() => {
    const label = resolveNavItem(pathname)?.label;
    document.title = label ? `${label} | ${APP_TITLE}` : APP_TITLE;
  }, [pathname]);

  // Хугацаа нь дуусах дараагийн табыг яг тэр мөчид хаана (идэвхтэйг биш).
  useEffect(() => {
    const expiresAt = nextTabExpiry(tabs, currentKey);
    if (expiresAt == null) return;
    const timer = window.setTimeout(() => {
      const next = pruneExpiredTabs(loadPageTabs(), currentKey);
      savePageTabs(next);
      setTabs(next);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [tabs, currentKey]);

  const open = (path: string) => {
    if (path === fullPath) return;
    // notifyNavEnd нь зөвхөн pathname солигдоход ажилладаг — query-гаар л
    // ялгаатай шилжилтэд loader асаавал наалдана.
    if (path.split("?")[0] !== pathname) notifyNavStart(undefined, path);
    router.push(path);
  };

  const close = (key: string) => {
    const idx = tabs.findIndex((t) => t.key === key);
    const next = tabs.filter((t) => t.key !== key);
    savePageTabs(next);
    setTabs(next);
    if (key === currentKey) {
      const target = next[idx - 1] ?? next[idx];
      open(target?.path ?? HOME.href);
    }
  };

  /** `keepKey`-ээс бусад бүх табыг хаана (`null` бол бүгдийг) — хяналтын самбар үлдэнэ. */
  const closeAllExcept = (keepKey: string | null) => {
    const next = tabs.filter((t) => t.key === keepKey);
    savePageTabs(next);
    setTabs(next);
    if (currentKey !== keepKey && currentKey !== HOME.href) {
      open(next[0]?.path ?? HOME.href);
    }
  };

  // Цэсийн гаднах дарах, Esc, гүйлгэх, цонхны хэмжээ солих үед цэс хаагдана.
  useEffect(() => {
    if (!menu) return;
    const dismiss = () => setMenu(null);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) dismiss();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("blur", dismiss);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("blur", dismiss);
    };
  }, [menu]);

  // Ачаалж буй хуудасны таб — хадгалагдаагүй байсан ч шууд харуулна.
  // Хадгалалт нь pathname солигдсоны дараа (дээрх effect) хийгдэнэ.
  const pendingNav = navTarget ? resolveNavItem(navTarget.split("?")[0]) : null;
  const pendingKey = navTarget ? pendingNav?.href ?? navTarget.split("?")[0] : null;
  const activeKey = pendingKey ?? currentKey;

  const items: Omit<PageTab, "lastActiveAt">[] = [
    { key: HOME.href, path: HOME.href, label: HOME.label },
    ...tabs,
  ];
  if (pendingKey && navTarget && !items.some((t) => t.key === pendingKey)) {
    items.push({ key: pendingKey, path: navTarget, label: pendingNav?.label ?? "Хуудас" });
  }

  const menuTab = menu ? items.find((t) => t.key === menu.key) : undefined;
  const menuClosable = !!menuTab && menuTab.key !== HOME.href && menuTab.key !== pendingKey;
  const hasOthers = !!menuTab && tabs.some((t) => t.key !== menuTab.key);

  return (
    <div className="flex h-11 shrink-0 items-end border-b border-slate-200/80 bg-white px-3 dark:border-[#37394d] dark:bg-[#1e1f27]">
      <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
        {items.map((tab) => {
          const Icon = resolveNavItem(tab.key)?.icon;
          const active = tab.key === activeKey;
          const loading = active && pendingKey !== null;
          // Ачаалж буй табыг хаавал шилжилт дуусмагц дахин нээгдэнэ — хаах товч нуугдана.
          const closable = tab.key !== HOME.href && !loading;
          return (
            <div
              key={tab.key}
              role="tab"
              aria-selected={active}
              title={tab.label}
              onClick={() => open(tab.path)}
              // Дунд товчоор дарахад хаана (browser-ийн табтай адил).
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ key: tab.key, x: e.clientX, y: e.clientY });
              }}
              onAuxClick={(e) => {
                if (e.button === 1 && closable) {
                  e.preventDefault();
                  close(tab.key);
                }
              }}
              className={cn(
                "group flex h-9 max-w-[220px] shrink-0 cursor-pointer select-none items-center gap-2 rounded-t-lg px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#02c0ce] text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-[#97aac1] dark:hover:bg-[#252630] dark:hover:text-[#e2eeff]",
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                Icon && <Icon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{tab.label}</span>
              {closable && (
                <button
                  type="button"
                  aria-label={`${tab.label} хаах`}
                  onClick={(e) => {
                    e.stopPropagation();
                    close(tab.key);
                  }}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                    active ? "hover:bg-white/20" : "hover:bg-slate-200 dark:hover:bg-[#37394d]",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {tabs.length > 0 && (
        <button
          type="button"
          title="Бүх табыг хаах"
          aria-label="Бүх табыг хаах"
          onClick={() => closeAllExcept(null)}
          className="mb-1 ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-[#97aac1] dark:hover:bg-[#252630] dark:hover:text-[#e2eeff]"
        >
          <ListX className="h-4 w-4" />
        </button>
      )}
      {menu && menuTab && (
        <div
          ref={menuRef}
          role="menu"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            left: Math.min(menu.x, window.innerWidth - 212),
            top: Math.min(menu.y, window.innerHeight - 132),
          }}
          className="fixed z-50 w-[200px] rounded-lg border border-slate-200 bg-white p-1 text-[13px] shadow-lg dark:border-[#37394d] dark:bg-[#252630]"
        >
          {(
            [
              { label: "Хаах", icon: X, enabled: menuClosable, run: () => close(menuTab.key) },
              {
                label: "Бусдыг хаах",
                icon: CopyX,
                enabled: hasOthers,
                run: () => closeAllExcept(menuTab.key === HOME.href ? null : menuTab.key),
              },
              { label: "Бүгдийг хаах", icon: ListX, enabled: tabs.length > 0, run: () => closeAllExcept(null) },
            ] as const
          ).map(({ label, icon: Icon, enabled, run }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              disabled={!enabled}
              onClick={() => {
                setMenu(null);
                run();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-[#e2eeff] dark:hover:bg-[#37394d]"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
