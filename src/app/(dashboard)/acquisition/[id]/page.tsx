"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { ConfirmDialog, type PendingConfirm } from "./_components/confirm-dialog";
import { STATUS_CFG, hasPermission } from "./_components/shared";
import { GeneralTab } from "./_components/general-tab";
import { AttachmentsTab } from "./_components/attachments-tab";
import { ProgressTab } from "./_components/progress-tab";
import { AssigneesTab } from "./_components/assignees-tab";
import { ParcelsTab } from "./_components/parcels-tab";
import { FinancingTab } from "./_components/financing-tab";
import { STATUS_LABELS, ACQ_STATUS } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import {
  canAccessAcquisition,
  isExternalSpecialRole,
  isProfessionalOrg,
} from "@/lib/role-utils";
import {
  ArrowLeft,
  MapPin,
  RefreshCw,
  X,
  LayoutList,
  Paperclip,
  Activity,
  Map,
  FileDown,
  Calculator,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const AcquisitionMap = dynamic(
  () => import("@/components/map/acquisition-map").then((m) => m.AcquisitionMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

type Tab =
  | "general"
  | "attachments"
  | "progress"
  | "parcels"
  | "assignees"
  | "map"
  | "financing";

// ─── Main page ────────────────────────────────────────────────────────────────
async function generateReport(acqId: string) {
  const { authStorage } = await import("@/lib/auth");
  const token = authStorage.getAccessToken();

  const res = await fetch(`/api/report/acquisition/${acqId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Report generation failed");

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, ""))
    : "2010_тайлан.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam as Tab) ?? "general";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tabKey, setTabKey] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const isExternal = isExternalSpecialRole();
  const isProfOrg = isProfessionalOrg();

  function handleTabClick(key: Tab) {
    setTab(key);
    setTabKey((k) => k + 1);
  }
  const canEditBase = hasPermission("acquisition.create");

  const { data: acq, isLoading, error } = useQuery({
    queryKey: ["land", id],
    queryFn: () => landApi.getById(id),
    retry: (failCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return failCount < 2;
    },
  });

  const { data: accessParcels, isLoading: accessParcelsLoading } = useQuery({
    queryKey: ["land-parcels-access", id],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 1000 }),
    enabled: isExternal && isProfOrg && !!acq,
  });

  if (isLoading || accessParcelsLoading)
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
        <div className="h-12 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
        <div className="h-64 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
      </div>
    );

  const errStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  if (errStatus === 403)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтэд ажиллах эрх танд олгогдоогүй байна.
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
            Ахлах мэргэжилтэнтэй холбогдоно уу.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  if (!acq)
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
        Олдсонгүй
      </div>
    );

  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1];
  const canAccessCurrentAcquisition = canAccessAcquisition(
    acq.professional_org_id,
    accessParcels?.data,
  );

  if (!canAccessCurrentAcquisition)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
          <Users className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Хандах эрх байхгүй
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">
            Энэ чөлөөлөлтөд таны байгууллага холбогдоогүй байна.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const isAcqLocked = acq?.status === ACQ_STATUS.CONFIRMED;

  // Баталгаажсан чөлөөлөлтийн дэлгэрэнгүйд гадаад байгуулгуудын хандалтыг хаана
  if (isExternal && isAcqLocked)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-700 dark:text-white">
            Дэлгэрэнгүй мэдээлэл хаалттай
          </p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Энэ чөлөөлөлт <strong className="text-slate-600 dark:text-slate-300">Баталгаажсан</strong> төлөвтэй тул зөвхөн систем администратор харах боломжтой.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Жагсаалт руу буцах
        </Link>
      </div>
    );

  const canEdit = canEditBase && !isAcqLocked;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general",
      label: "Ерөнхий мэдээлэл",
      icon: <LayoutList className="h-4 w-4" />,
    },
    {
      key: "attachments",
      label: "Хавсралт",
      icon: <Paperclip className="h-4 w-4" />,
    },
    {
      key: "parcels",
      label: "Нэгж талбарууд",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: "financing",
      label: "Санхүүжилт",
      icon: <Calculator className="h-4 w-4" />,
    },
    { key: "progress", label: "Явц", icon: <Activity className="h-4 w-4" /> },
    {
      key: "assignees",
      label: "Ажилтнууд",
      icon: <Users className="h-4 w-4" />,
    },
    { key: "map", label: "Байршил", icon: <Map className="h-4 w-4" /> },
  ];
  const visibleTabs = isExternal
    ? TABS.filter((item) => item.key === "general" || item.key === "parcels")
    : TABS;
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : "general";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/acquisition"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {acq.acquisition_name || acq.plan_code}
            </h1>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: sc.color, background: sc.bg }}
            >
              {STATUS_LABELS[acq.status] ?? "Тодорхойгүй"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {acq.plan_code}
            {acq.plan_name ? ` · ${acq.plan_name}` : ""}
          </p>
        </div>
        {!isExternal && (
          <button
            disabled={reportLoading}
            onClick={async () => {
              setReportLoading(true);
              try {
                await generateReport(id);
              } catch {
                toast.error("Тайлан үүсгэхэд алдаа гарлаа");
              } finally {
                setReportLoading(false);
              }
            }}
            className="flex shrink-0 items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-50 transition-colors"
          >
            {reportLoading ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Тайлан татах
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[100px] whitespace-nowrap transition-all select-none
                ${
                  active
                    ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"
                }`}
            >
              {/* active indicator — top border */}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span
                className={`transition-colors ${active ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}`}
              >
                {t.icon}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-wide transition-colors ${active ? "text-[#02c0ce]" : ""}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content — key changes on every click (incl. re-click) → remount → fresh fetch */}
      {isAcqLocked && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3">
          <span className="text-amber-500 shrink-0">🔒</span>
          <p className="text-[13px] text-amber-700 dark:text-amber-400 font-medium">
            Энэ чөлөөлөлт <strong>Баталгаажсан</strong> төлөвтэй байгаа тул ямар нэгэн засвар хийх боломжгүй.
          </p>
        </div>
      )}
      {activeTab === "general" && <GeneralTab key={tabKey} id={id} canEdit={canEdit && !isExternal} />}
      {activeTab === "attachments" && <AttachmentsTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "progress" && <ProgressTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "parcels" && (
        <ParcelsTab
          key={tabKey}
          id={id}
          acquisitionProfOrgId={acq.professional_org_id}
          isAcqLocked={isAcqLocked}
        />
      )}
      {activeTab === "assignees" && <AssigneesTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "financing" && <FinancingTab key={tabKey} id={id} canEdit={canEdit} />}
      {activeTab === "map" && (
        <div key={tabKey} className="ap-card p-5">
          <AcquisitionMap acquisitionId={id} aus={acq.aus} />
        </div>
      )}
    </div>
  );
}
