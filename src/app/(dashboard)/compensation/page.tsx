"use client";
import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Download,
  Eye,
  Printer,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INVOICES,
  STATUS_CONFIG,
  invoiceTotal,
  fmtMoney,
  type InvoiceStatus,
} from "./mock-data";

const PAGE_SIZE = 8;

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = INVOICES.filter((inv) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      inv.number.toLowerCase().includes(q) ||
      inv.client.name.toLowerCase().includes(q);
    const matchS = filter === "all" || inv.status === filter;
    return matchQ && matchS;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    all: INVOICES.length,
    paid: INVOICES.filter((i) => i.status === "paid").length,
    pending: INVOICES.filter((i) => i.status === "pending").length,
    overdue: INVOICES.filter((i) => i.status === "overdue").length,
    paidAmt: INVOICES.filter((i) => i.status === "paid").reduce(
      (s, i) => s + invoiceTotal(i),
      0,
    ),
    pendAmt: INVOICES.filter((i) => i.status === "pending").reduce(
      (s, i) => s + invoiceTotal(i),
      0,
    ),
  };

  const FILTER_TABS = [
    ["all", "Бүгд"],
    ["paid", STATUS_CONFIG.paid.label],
    ["pending", STATUS_CONFIG.pending.label],
    ["overdue", STATUS_CONFIG.overdue.label],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            Нөхөн төлбөрийн нэхэмжлэл
          </h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            Газар чөлөөлтийн нэхэмжлэлийн бүртгэл
          </p>
        </div>
        <Link
          href="/compensation/create"
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Шинээр нэмэх
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Нийт нэхэмжлэл",
            value: stats.all,
            icon: FileText,
            color: "#02c0ce",
          },
          {
            label: "Төлөгдсөн",
            value: stats.paid,
            sub: fmtMoney(stats.paidAmt),
            icon: CheckCircle2,
            color: "#0acf97",
          },
          {
            label: "Хүлээгдэж буй",
            value: stats.pending,
            sub: fmtMoney(stats.pendAmt),
            icon: Clock,
            color: "#f9bc0b",
          },
          {
            label: "Хугацаа хэтэрсэн",
            value: stats.overdue,
            icon: AlertCircle,
            color: "#f1556c",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="ap-card px-5 py-4 flex items-center gap-4"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${color}18` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium leading-tight">
                {label}
              </p>
              <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-white leading-tight mt-0.5">
                {value}
              </p>
              {sub && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight truncate">
                  {sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="ap-card overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Нэхэмжлэл, иргэн хайх..."
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] pl-9 pr-9 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#252630] p-1">
            {FILTER_TABS.map(([s, label]) => (
              <button
                key={s}
                onClick={() => {
                  setFilter(s);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap",
                  filter === s
                    ? "bg-[#02c0ce] text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-white/[0.06]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 h-9 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                {[
                  "Нэхэмжлэлийн №",
                  "Иргэн",
                  "Огноо",
                  "Дуусах огноо",
                  "Дүн",
                  "Төлөв",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-[13px] text-slate-400 dark:text-slate-500"
                  >
                    Нэхэмжлэл олдсонгүй
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const sc = STATUS_CONFIG[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/compensation/${inv.id}`}
                          className="font-semibold text-[#02c0ce] hover:underline underline-offset-2"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">
                            {inv.client.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {inv.parcelId}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-400">
                        {inv.date}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-400">
                        {inv.due}
                      </td>
                      <td className="px-5 py-3.5 font-semibold tabular-nums text-slate-800 dark:text-white">
                        {fmtMoney(invoiceTotal(inv))}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ color: sc.color, background: sc.bg }}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Link href={`/compensation/${inv.id}`}>
                            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0acf97]/10 text-[#0acf97] hover:bg-[#0acf97]/20 transition-colors">
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-[#37394d]">
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {filtered.length === 0
              ? "Бичлэг олдсонгүй"
              : `Нийт ${filtered.length} бичлэгийн ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)}-г харуулж байна`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium border transition-colors",
                  page === p
                    ? "bg-[#02c0ce] text-white border-[#02c0ce]"
                    : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce]",
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
