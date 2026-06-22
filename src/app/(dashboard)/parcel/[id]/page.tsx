"use client";
import { useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { landApi, parcelApi } from "@/lib/api";
import { STATUS_LABELS, RIGHT_TYPE_LABELS, type AU } from "@/types";
import { formatDate, formatArea } from "@/lib/utils";
import {
  ArrowLeft,
  Info,
  FileText,
  Upload,
  Trash2,
  Download,
  MapPin,
  Wallet,
  Paperclip,
  Plus,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import dynamic from "next/dynamic";

const ParcelMap = dynamic(
  () => import("@/components/ParcelMap").then((m) => m.ParcelMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" />
    ),
  },
);

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: "#02c0ce", bg: "#02c0ce18" },
  2: { color: "#f59e0b", bg: "#f59e0b18" },
  3: { color: "#0acf97", bg: "#0acf9718" },
  4: { color: "#f1556c", bg: "#f1556c18" },
};

type Tab = "general" | "documents" | "payment" | "map";

function findAdminUnit(
  aus: AU[] | null | undefined,
  au1Code: string,
  au2Code: string,
  au3Code: string,
) {
  return aus?.find(
    (au) =>
      au.au1_code === au1Code &&
      au.au2_code === au2Code &&
      au.au3_code === au3Code,
  );
}

function formatAdminUnit(name: string | undefined, code: string) {
  return name ? `${name} (${code})` : code;
}

function highlightArea(value: string) {
  return (
    <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
      {value}
    </span>
  );
}

// ─── General tab ──────────────────────────────────────────────────────────────
function GeneralTab({ acqId, parcelId }: { acqId: string; parcelId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["parcel-full", acqId, parcelId],
    queryFn: () => landApi.getParcel(acqId, parcelId),
    enabled: !!acqId,
  });
  const { data: acquisition } = useQuery({
    queryKey: ["land", acqId],
    queryFn: () => landApi.getById(acqId),
    enabled: !!acqId,
  });

  const syncMutation = useMutation({
    mutationFn: () => landApi.syncParcel(acqId, parcelId),
    onSuccess: () => {
      toast.success("Нэгж талбарын мэдээлэл шинэчлэгдлээ");
      queryClient.invalidateQueries({
        queryKey: ["parcel-full", acqId, parcelId],
      });
      queryClient.invalidateQueries({ queryKey: ["land", acqId] });
      window.location.reload();
    },
    onError: () => toast.error("Нэгж талбарын мэдээлэл дуудахад алдаа гарлаа"),
  });

  const handleSync = () => {
    if (!confirm("Нэгж талбарын мэдээлэл дуудах уу?")) return;
    syncMutation.mutate();
  };

  const row = (label: string, value?: React.ReactNode) => (
    <div
      key={label}
      className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0"
    >
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-44">
        {label}
      </span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );

  if (isLoading)
    return (
      <div className="ap-card p-5 animate-pulse space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 rounded bg-slate-100 dark:bg-[#252630]" />
        ))}
      </div>
    );
  if (!data)
    return (
      <div className="ap-card p-10 text-center text-[13px] text-slate-400">
        Мэдээлэл олдсонгүй
      </div>
    );

  const adminUnit = findAdminUnit(
    acquisition?.aus,
    data.au1_code,
    data.au2_code,
    data.au3_code,
  );

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Талбарын мэдээлэл */}
      <div className="ap-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Талбарын мэдээлэл
          </p>
          <button
            onClick={handleSync}
            disabled={!acqId || syncMutation.isPending}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#0acf97]/10 px-3 text-[12px] font-semibold text-[#0acf97] transition-colors hover:bg-[#0acf97]/20 disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#0acf97] border-t-transparent animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Нэгж талбарын мэдээлэл дуудах
          </button>
        </div>
        {row("Дугаар", <span className="font-mono">{data.parcel_id}</span>)}
        {row(
          "Аймаг/Нийслэл",
          formatAdminUnit(adminUnit?.au1_name, data.au1_code),
        )}
        {row("Сум/Дүүрэг", formatAdminUnit(adminUnit?.au2_name, data.au2_code))}
        {row("Баг/Хороо", formatAdminUnit(adminUnit?.au3_name, data.au3_code))}
        {row("Эрхийн төрөл", RIGHT_TYPE_LABELS[data.right_type])}
        {row("Газрын зориулалт", data.landuse)}
        {row(
          "Эрх эхэлсэн",
          data.valid_from ? formatDate(data.valid_from) : undefined,
        )}
        {row(
          "Эрх дуусах",
          data.valid_till ? formatDate(data.valid_till) : undefined,
        )}
        {row("Нийт талбай", formatArea(data.area_m2))}
        {row(
          "Чөлөөлөгдөх талбай",
          highlightArea(formatArea(data.acquisition_area_m2)),
        )}
      </div>

      {/* Эзэмшигч */}
      <div className="ap-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
          Эзэмшигч
        </p>
        {data.detail ? (
          <>
            {row(
              "Овог нэр",
              `${data.detail.holder_last_name ?? ""} ${data.detail.holder_name ?? ""}`.trim(),
            )}
            {row("Регистрийн №", data.detail.holder_register_no)}
            {row("Иргэний үнэмлэх", data.detail.holder_civil_id)}
            {row("Утас", data.detail.holder_phone)}
            {row("И-мэйл", data.detail.holder_email)}
            {row("Эзэмшигчийн төрөл", data.detail.holder_type)}
            <div className="mt-5">
              <div className="h-px w-full bg-[#e2e8f0] dark:bg-[#37394d]" />
              <p className="pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Баримт бичиг
              </p>
            </div>
            {row("Өргөдлийн №", data.detail.app_no)}
            {row("Шийдвэрийн №", data.detail.decision_no)}
            {row(
              "Шийдвэрийн огноо",
              data.detail.decision_date
                ? formatDate(data.detail.decision_date)
                : undefined,
            )}
            {row("Гэрээний №", data.detail.contract_no)}
            {row("Гэрчилгээний №", data.detail.certificate_no)}
          </>
        ) : (
          <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-8">
            Эзэмшигчийн мэдээлэл байхгүй
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────
function DocumentsTab({ parcelId }: { parcelId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["parcel-documents", parcelId],
    queryFn: () => parcelApi.listDocuments(parcelId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => parcelApi.uploadDocument(parcelId, file),
    onSuccess: () => {
      toast.success("Баримт бичиг хавсаргагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-documents", parcelId],
      });
    },
    onError: () => toast.error("Файл хавсаргахад алдаа гарлаа"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => parcelApi.deleteDocument(parcelId, docId),
    onSuccess: () => {
      toast.success("Баримт бичиг устгагдлаа");
      queryClient.invalidateQueries({
        queryKey: ["parcel-documents", parcelId],
      });
    },
    onError: () => toast.error("Устгахад алдаа гарлаа"),
  });

  const formatSize = (b: number) =>
    b < 1024 * 1024
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Баримт бичгүүд
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Дээд хэмжээ 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 10 * 1024 * 1024) {
                toast.error("10MB хэтэрлээ");
                return;
              }
              uploadMutation.mutate(f);
              e.target.value = "";
            }
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
        >
          {uploadMutation.isPending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Нэмэх
        </button>
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]"
            />
          ))}
        </div>
      ) : !docs.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Paperclip className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Баримт бичиг байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  {doc.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={doc.file_url}
                  download={doc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => {
                    if (confirm("Баримт бичиг устгах уу?"))
                      deleteMutation.mutate(doc.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payment tab ──────────────────────────────────────────────────────────────
function PaymentTab({ parcelId }: { parcelId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "MNT",
    paid_at: "",
    note: "",
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["parcel-payments", parcelId],
    queryFn: () => parcelApi.listPayments(parcelId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      parcelApi.addPayment(parcelId, {
        amount: Number(form.amount),
        currency: form.currency,
        paid_at: form.paid_at || undefined,
        note: form.note,
      }),
    onSuccess: () => {
      toast.success("Төлбөр бүртгэгдлээ");
      setForm({ amount: "", currency: "MNT", paid_at: "", note: "" });
      setShowForm(false);
      queryClient.invalidateQueries({
        queryKey: ["parcel-payments", parcelId],
      });
    },
    onError: () => toast.error("Бүртгэхэд алдаа гарлаа"),
  });

  const inp =
    "h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all";

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
              Нийт төлсөн
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {totalPaid.toLocaleString()}{" "}
              <span className="text-[14px] font-medium text-slate-400">₮</span>
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "Болих" : "Төлбөр нэмэх"}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#37394d] grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Дүн</p>
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0"
                className={inp}
              />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Валют</p>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
                className={inp}
              >
                <option value="MNT">MNT</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Огноо</p>
              <input
                type="date"
                value={form.paid_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paid_at: e.target.value }))
                }
                className={inp}
              />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Тайлбар</p>
              <input
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Тайлбар..."
                className={inp}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.amount || addMutation.isPending}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Хадгалах
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">
            Төлбөрийн түүх
          </p>
        </div>
        {isLoading ? (
          <div className="p-5 animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-100 dark:bg-[#252630]"
              />
            ))}
          </div>
        ) : !payments.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Wallet className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Төлбөрийн бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {["#", "Дүн", "Огноо", "Тайлбар", "Бүртгэсэн"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {payments.map((p, i) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
                  >
                    <td className="px-4 py-3 text-[12px] font-mono text-slate-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                      {p.amount.toLocaleString()} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {p.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {p.created_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const acqId = searchParams.get("acq") ?? "";
  const [tab, setTab] = useState<Tab>("general");

  const { data: parcel } = useQuery({
    queryKey: ["parcel-full", acqId, id],
    queryFn: () => landApi.getParcel(acqId, id),
    enabled: !!acqId,
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "general",
      label: "Ерөнхий мэдээлэл",
      icon: <Info className="h-4 w-4" />,
    },
    {
      key: "documents",
      label: "Баримт бичиг",
      icon: <Paperclip className="h-4 w-4" />,
    },
    { key: "payment", label: "Төлбөр", icon: <Wallet className="h-4 w-4" /> },
    { key: "map", label: "Байршил", icon: <MapPin className="h-4 w-4" /> },
  ];

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
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[110px] whitespace-nowrap transition-all select-none
                ${active ? "text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]"}`}
            >
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span
                className={
                  active
                    ? "text-[#02c0ce]"
                    : "text-slate-400 dark:text-slate-500"
                }
              >
                {t.icon}
              </span>
              <span
                className={`text-[11.5px] font-semibold tracking-wide ${active ? "text-[#02c0ce]" : ""}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "general" && <GeneralTab acqId={acqId} parcelId={id} />}
      {tab === "documents" && <DocumentsTab parcelId={id} />}
      {tab === "payment" && <PaymentTab parcelId={id} />}
      {tab === "map" && (
        <div className="ap-card p-5">
          <ParcelMap parcelId={parcel?.parcel_id ?? ""} acquisitionId={acqId} />
        </div>
      )}
    </div>
  );
}
