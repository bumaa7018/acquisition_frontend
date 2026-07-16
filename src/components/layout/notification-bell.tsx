"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, FileText, Grid2x2, Receipt, UserPlus } from "lucide-react";
import { notificationApi } from "@/lib/api";
import { subscribeNotifications, notificationLink } from "@/lib/notifications-sse";
import type { AppNotification } from "@/types";

const LIST_KEY = ["notifications"];
const COUNT_KEY = ["notifications-unread-count"];

// Мэдэгдлийн төрөл → икон
function typeIcon(type: string) {
  if (type.startsWith("compensation")) return Receipt;
  if (type.startsWith("valuation") || type === "parcel_status") return Grid2x2;
  if (type === "assignee_added" || type === "org_assigned") return UserPlus;
  return FileText;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "саяхан";
  if (min < 60) return `${min} мин`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} цаг`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN");
}

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: COUNT_KEY,
    queryFn: notificationApi.unreadCount,
    // SSE үндсэн суваг тул refetch нь зөвхөн аюулгүйн давхарга
    refetchInterval: 120_000,
    staleTime: 30_000,
  });

  const { data: list, isLoading } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => notificationApi.list({ page: 1, page_size: 15 }),
    enabled: open, // жагсаалтыг зөвхөн цэс нээгдэхэд татна
    staleTime: 15_000,
  });

  // Бодит цагийн стрийм: шинэ мэдэгдэл ирэхэд toast + кэш шинэчлэлт.
  // Стрийм (дахин) холбогдох бүрд count/list-ийг нөхөж татна — ингэснээр
  // холболт тасарсан цонхонд ирсэн мэдэгдэл ч refresh шаардалгүй харагдана.
  useEffect(() => {
    const unsubscribe = subscribeNotifications({
      onConnect: () => {
        queryClient.invalidateQueries({ queryKey: COUNT_KEY });
        queryClient.invalidateQueries({ queryKey: LIST_KEY });
      },
      onNotification: (n: AppNotification) => {
        queryClient.invalidateQueries({ queryKey: COUNT_KEY });
        queryClient.invalidateQueries({ queryKey: LIST_KEY });
        toast.info(n.title, {
          description: n.body,
          action: notificationLink(n)
            ? { label: "Харах", onClick: () => openNotification(n) }
            : undefined,
        });
      },
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Гадна дарахад цэс хаагдана
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };

  const openNotification = (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) {
      notificationApi.markRead(n.id).then(refresh).catch(() => {});
    }
    const link = notificationLink(n);
    if (link) router.push(link);
  };

  const markAll = () => {
    notificationApi.markAllRead().then(refresh).catch(() => {});
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Мэдэгдэл"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630] transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-[340px] rounded-xl bg-white dark:bg-[#1e1f27] border border-solid border-slate-200 dark:border-[#37394d] overflow-hidden z-50"
          style={{ boxShadow: "0 0 35px 0 rgba(154,161,171,.2)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-solid border-slate-100 dark:border-[#37394d] dark:bg-[#252630]">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              Мэдэгдэл
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-[11px] text-[#02c0ce] hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Бүгдийг уншсан
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-6 text-center text-[12px] text-slate-400">
                Уншиж байна...
              </div>
            )}
            {!isLoading && (!list || list.items.length === 0) && (
              <div className="px-4 py-8 text-center text-[12px] text-slate-400">
                Мэдэгдэл алга байна
              </div>
            )}
            {list?.items.map((n) => {
              const Icon = typeIcon(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left border-b border-solid border-slate-50 dark:border-[#2a2b36] transition-colors hover:bg-slate-50 dark:hover:bg-[#252630] ${
                    n.is_read ? "opacity-70" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      n.is_read
                        ? "bg-slate-100 text-slate-400 dark:bg-[#252630] dark:text-slate-500"
                        : "bg-[#02c0ce]/10 text-[#02c0ce]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                      {timeAgo(n.created_at)}
                      {n.actor_name ? ` · ${n.actor_name}` : ""}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#02c0ce]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
