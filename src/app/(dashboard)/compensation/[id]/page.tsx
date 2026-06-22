"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Download,
  Building2,
  MapPin,
  Phone,
  Hash,
  Calendar,
  CreditCard,
} from "lucide-react";
import {
  INVOICES,
  STATUS_CONFIG,
  ISSUER,
  invoiceTotal,
  fmtMoney,
} from "../mock-data";
import { cn } from "@/lib/utils";

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inv = INVOICES.find((i) => i.id === params.id);
  if (!inv) notFound();

  const sc = STATUS_CONFIG[inv.status];
  const subtotal = invoiceTotal(inv);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-doc { box-shadow: none !important; border-left-color: #02c0ce !important; }
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:border-slate-300 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Хэвлэх
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors">
              <Download className="h-4 w-4" />
              PDF татах
            </button>
          </div>
        </div>

        {/* Invoice document — left accent stripe is the aesthetic signature */}
        <div
          className="invoice-doc ap-card overflow-hidden"
          style={{ borderLeft: "4px solid #02c0ce" }}
        >
          {/* Document header */}
          <div className="px-10 py-8 border-b border-slate-100">
            <div className="flex items-start justify-between gap-8">
              {/* Issuer identity */}
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white text-xl font-black"
                  style={{ background: "#02c0ce" }}
                >
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-slate-800 leading-tight">
                    {ISSUER.name}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {ISSUER.address}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    {ISSUER.phone}
                  </p>
                </div>
              </div>

              {/* Invoice number + status */}
              <div className="text-right shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  НЭХЭМЖЛЭЛ
                </p>
                <p className="text-2xl font-black text-slate-800 mt-0.5 tabular-nums">
                  {inv.number}
                </p>
                <div className="mt-2">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    {sc.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta + recipient row */}
          <div className="grid grid-cols-2 gap-8 px-10 py-8 border-b border-slate-100 bg-slate-50/40">
            {/* Document metadata */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
                Нэхэмжлэлийн мэдээлэл
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Hash, label: "Нэгж талбарын №", value: inv.parcelId },
                  {
                    icon: CreditCard,
                    label: "Нэхэмжлэлийн №",
                    value: inv.number,
                  },
                  { icon: Calendar, label: "Гаргасан огноо", value: inv.date },
                  { icon: Calendar, label: "Дуусах огноо", value: inv.due },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {label}
                    </p>
                    <p className="text-[13px] font-semibold text-slate-700 mt-0.5 tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
                Нэхэмжлэл хүлээн авагч
              </p>
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ background: "#02c0ce" }}
                >
                  {inv.client.name[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{inv.client.name}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {inv.client.address}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {inv.client.phone}
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <CreditCard className="h-3 w-3 shrink-0" />
                    РД: {inv.client.register}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="px-10 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Нэхэмжлэлийн зүйлс
            </p>
            <div className="rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      "#",
                      "Тайлбар",
                      "Нэгж",
                      "Тоо хэмжээ",
                      "Нэгжийн үнэ",
                      "Нийт",
                    ].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400",
                          h === "Нийт" && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {inv.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3.5 text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {item.description}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {item.unit}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-700">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-700">
                        {fmtMoney(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-slate-800 text-right">
                        {fmtMoney(item.qty * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes + Totals */}
          <div className="grid grid-cols-2 gap-8 px-10 pb-8 items-start">
            {/* Notes */}
            <div>
              {inv.notes && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                    Тэмдэглэл
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    {inv.notes}
                  </p>
                </>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Дэд нийт</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {fmtMoney(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">НӨАТ (10%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {fmtMoney(vat)}
                </span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-slate-800">
                  Нийт дүн
                </span>
                <span
                  className="text-[20px] font-black tabular-nums"
                  style={{ color: "#02c0ce" }}
                >
                  {fmtMoney(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Document footer */}
          <div
            className="px-10 py-4 border-t border-slate-100 flex items-center justify-between"
            style={{ background: "#02c0ce08" }}
          >
            <p className="text-[11px] text-slate-400">
              Энэхүү баримт бичиг нь автоматаар үүссэн бөгөөд гарын үсэг
              шаардахгүй.
            </p>
            <p className="text-[11px] font-semibold text-[#02c0ce] tabular-nums">
              {inv.number}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
