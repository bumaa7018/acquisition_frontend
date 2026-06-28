"use client";
import React, { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { RIGHT_TYPE_LABELS } from "@/types";
import { ArrowLeft, Info, Paperclip, Wallet, MapPin, Building2, Printer, Activity } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { type Tab } from "./_components/constants";
import { GeneralTab } from "./_components/general_tab";
import { ProgressTab } from "./_components/progress_tab";
import { RealEstateTab } from "./_components/real_estate_tab";
import { DocumentsTab } from "./_components/documents_tab";
import { PaymentTab } from "./_components/payment_tab";
import { PrintTemplatesTab } from "./_components/print_templates_tab";
import { canAccessParcel, isExternalSpecialRole } from "@/lib/role-utils";
import { Users } from "lucide-react";

const ParcelMap = dynamic(
  () => import("@/components/ParcelMap").then((m) => m.ParcelMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const acqId = searchParams.get("acq") ?? "";
  const [tab, setTab] = useState<Tab>("general");
  const [tabKey, setTabKey] = useState(0);
  const isExternal = isExternalSpecialRole();

  function handleTabClick(key: Tab) {
    setTab(key);
    setTabKey((k) => k + 1);
  }

  const { data: parcel } = useQuery({
    queryKey: ["parcel-full", acqId, id],
    queryFn: () => landApi.getParcel(acqId, id),
    enabled: !!acqId,
  });
  const { data: acquisition } = useQuery({
    queryKey: ["land", acqId],
    queryFn: () => landApi.getById(acqId),
    enabled: !!acqId,
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "Ерөнхий мэдээлэл", icon: <Info className="h-4 w-4" /> },
    { key: "progress", label: "Явц", icon: <Activity className="h-4 w-4" /> },
    { key: "realEstate", label: "Нөхөх олговор", icon: <Building2 className="h-4 w-4" /> },
    { key: "documents", label: "Баримт бичиг", icon: <Paperclip className="h-4 w-4" /> },
    { key: "payment", label: "Санхүүжилт", icon: <Wallet className="h-4 w-4" /> },
    { key: "map", label: "Байршил", icon: <MapPin className="h-4 w-4" /> },
    { key: "print", label: "Эх хэвлэл", icon: <Printer className="h-4 w-4" /> },
  ];
  const visibleTabs = isExternal
    ? TABS.filter((item) => item.key === "general" || item.key === "realEstate")
    : TABS;
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : "general";

  if (
    isExternal &&
    parcel &&
    acquisition &&
    !canAccessParcel(
      parcel.status_name,
      acquisition.professional_org_id,
      parcel.independent_org_id,
    )
  ) {
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
            Энэ нэгж талбар таны байгууллагад нээлттэй биш байна.
          </p>
        </div>
        <Link
          href={`/acquisition/${acqId}`}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] px-4 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Чөлөөлөлт рүү буцах
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/parcel"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white font-mono">
              {parcel?.parcel_id ?? id}
            </h1>
          </div>
          {acqId && parcel && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
              {RIGHT_TYPE_LABELS[parcel.right_type] ?? "—"} · {parcel.au3_code}
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[110px] whitespace-nowrap transition-all select-none
                ${active ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"}`}
            >
              {active && <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />}
              <span className={active ? "text-[#02c0ce]" : "text-slate-400 dark:text-slate-500"}>{t.icon}</span>
              <span className={`text-[11.5px] font-semibold tracking-wide ${active ? "text-[#02c0ce]" : ""}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content — key changes on every click (incl. re-click) → remount → fresh fetch */}
      {activeTab === "general" && <GeneralTab key={tabKey} acqId={acqId} parcelId={id} />}
      {activeTab === "progress" && <ProgressTab key={tabKey} acqId={acqId} parcelId={id} />}
      {activeTab === "realEstate" && <RealEstateTab key={tabKey} acqId={acqId} parcelId={id} parcelCode={parcel?.parcel_id ?? ""} />}
      {activeTab === "documents" && <DocumentsTab key={tabKey} parcelId={id} />}
      {activeTab === "payment" && <PaymentTab key={tabKey} parcelId={id} acqId={acqId} parcelCode={parcel?.parcel_id ?? ""} />}
      {activeTab === "print" && <PrintTemplatesTab key={tabKey} parcel={parcel} />}
      {activeTab === "map" && (
        <div key={tabKey} className="ap-card p-5">
          <ParcelMap parcelId={parcel?.parcel_id ?? ""} acquisitionId={acqId} />
        </div>
      )}
    </div>
  );
}
