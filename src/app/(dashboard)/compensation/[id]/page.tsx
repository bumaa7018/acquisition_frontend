"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Printer, Building2, MapPin, Phone, Hash, Calendar, CreditCard,
  FileText, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

type CompStatus = "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<CompStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:  { label: "Хүлээгдэж буй", color: "#f9bc0b", bg: "#f9bc0b1a", icon: Clock },
  approved: { label: "Батлагдсан",    color: "#0acf97", bg: "#0acf971a", icon: CheckCircle2 },
  rejected: { label: "Татгалзсан",    color: "#f1556c", bg: "#f1556c1a", icon: AlertCircle },
};

const COMP_TYPE_LABELS: Record<string, string> = {
  cash:       "Мөнгөн дүнгээр",
  land_grant: "Газраар дүйцүүлэх",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  parcel: "Нэгж талбар",
  asset:  "Хөрөнгө",
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n)) + "₮";
}

export default function CompensationDetailPage({ params }: { params: { id: string } }) {
  const { data: comp, isLoading, isError } = useQuery({
    queryKey: ["global-compensation", params.id],
    queryFn: () => landApi.getGlobalCompensation(params.id),
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-slate-100 dark:bg-[#252630]" />
        <div className="ap-card h-96" />
      </div>
    );
  }

  if (isError || !comp) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="h-8 w-8 text-slate-300" />
        <p className="text-[13px] text-slate-400">Нөхөн төлбөр олдсонгүй</p>
        <Link href="/compensation" className="text-[13px] text-[#02c0ce] hover:underline">
          Буцах
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[comp.status as CompStatus] ?? STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;
  const holderName = [comp.holder_last_name, comp.holder_name].filter(Boolean).join(" ") || "—";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .comp-doc { box-shadow: none !important; border-left-color: #02c0ce !important; }
        }
      `}</style>

      <div className="flex flex-col gap-5">
        {/* Actions bar */}
        <div className="no-print flex items-center justify-between">
          <Link
            href="/compensation"
            className="flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Жагсаалт руу буцах
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Хэвлэх
          </button>
        </div>

        <div className="comp-doc ap-card overflow-hidden" style={{ borderLeft: "4px solid #02c0ce" }}>
          {/* Header */}
          <div className="px-10 py-8 border-b border-slate-100 dark:border-[#37394d]">
            <div className="flex items-start justify-between gap-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: "#02c0ce" }}>
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-slate-800 dark:text-white leading-tight">
                    {comp.acquisition_name || "Газар чөлөөлөлт"}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    Нөхөн төлбөрийн бүртгэл
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">НӨХӨН ТӨЛБӨР</p>
                <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5 font-mono">
                  {comp.parcel_id || comp.id.slice(0, 8).toUpperCase()}
                </p>
                <div className="mt-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {sc.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta + recipient */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-10 py-8 border-b border-slate-100 dark:border-[#37394d] bg-slate-50/40 dark:bg-[#1a1d20]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
                Нөхөн төлбөрийн мэдээлэл
              </p>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { icon: Hash,     label: "Нэгж талбарын №", value: comp.parcel_id || "—" },
                  { icon: FileText, label: "Төрөл",           value: TARGET_TYPE_LABELS[comp.target_type] ?? comp.target_type },
                  { icon: CreditCard, label: "Олгох хэлбэр", value: COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type },
                  { icon: Calendar,  label: "Огноо",          value: comp.compensation_date ? formatDate(comp.compensation_date) : "—" },
                ] as { icon: React.ElementType; label: string; value: string }[]).map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {label}
                    </p>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
                Газар эзэмшигч
              </p>
              {comp.holder_name || comp.holder_last_name ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: "#02c0ce" }}>
                    {(comp.holder_name || comp.holder_last_name)[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{holderName}</p>
                    {comp.holder_register_no && (
                      <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <CreditCard className="h-3 w-3 shrink-0" />
                        РД: {comp.holder_register_no}
                      </p>
                    )}
                    {comp.holder_phone && (
                      <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {comp.holder_phone}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-slate-400">Мэдээлэл байхгүй</p>
              )}
            </div>
          </div>

          {/* Amount section */}
          <div className="px-10 py-8 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Дүн
            </p>
            <div className="max-w-xs space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Хамрах хувь</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{comp.coverage_percent}%</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-[#37394d]" />
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-slate-800 dark:text-white">Нөхөн төлбөрийн дүн</span>
                <span className="text-[20px] font-black tabular-nums" style={{ color: "#02c0ce" }}>
                  {fmtMoney(comp.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Grant detail */}
          {comp.grant && (
            <div className="px-10 py-8 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
                Газрын нөхөн олговрын дэлгэрэнгүй
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {([
                  ["Дүн",                   fmtMoney(comp.grant.amount)],
                  ["Олгосон огноо",         comp.grant.grant_date ? formatDate(comp.grant.grant_date) : "—"],
                  ["Талбай",                `${comp.grant.land_area_m2.toLocaleString()} м²`],
                  ["Газрын үнэ",            `${comp.grant.land_price.toLocaleString()}₮/м²`],
                  ["Байршил",               comp.grant.land_location || "—"],
                  ["Зориулалт",             comp.grant.land_purpose || "—"],
                  ["Ашиглалтын төрөл",      comp.grant.land_use_type || "—"],
                  ["Нэгж талбарын дугаар",  comp.grant.parcel_number || "—"],
                  ["Тогтоолын дугаар",      comp.grant.decree_number || "—"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valuation report */}
          {comp.valuation_report_url && (
            <div className="px-10 py-6 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Үнэлгээний тайлан
              </p>
              <a
                href={comp.valuation_report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-[#02c0ce] hover:underline"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {comp.valuation_report_name || "Үнэлгээний тайлан"}
              </a>
            </div>
          )}

          {/* Review note */}
          {comp.review_note && (
            <div className="px-10 py-6 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                {comp.status === "rejected" ? "Татгалзсан шалтгаан" : "Тайлбар"}
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{comp.review_note}</p>
            </div>
          )}

          {/* Note */}
          {comp.note && (
            <div className="px-10 py-6 border-b border-slate-100 dark:border-[#37394d]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Тэмдэглэл</p>
              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{comp.note}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-10 py-4 border-t border-slate-100 dark:border-[#37394d] flex items-center justify-between" style={{ background: "#02c0ce08" }}>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span>Үүсгэсэн: {comp.created_by || "—"}</span>
              <span>{formatDate(comp.created_at)}</span>
            </div>
            {comp.reviewed_by && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                <span>— {comp.reviewed_by}</span>
                {comp.reviewed_at && <span>{formatDate(comp.reviewed_at)}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
