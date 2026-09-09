"use client";

// Урьдчилан мэдэгдэх хуудсыг иргэнд хүргүүлэх — ХОЁР сувгаар
// (төлөвлөгөөний 2.4.2.2 имэйл, 2.8.5 E-Mongolia).
//
// "Эзэмшигч" таб дээр ЗӨВХӨН НЭГ ТОВЧ харагдана. Дарахад:
//   • дээд талд "Шинээр илгээх" — суваг сонгох (Имэйл / Е-Монголиа), хүлээн
//     авагч, мэдэгдэх хуудсын PDF-ийн ХАРАГДАЦ, "Илгээх"
//   • доор нь илгээсэн ТҮҮХ (хоёр суваг хамт, шинэ нь эхэнд)
//
// PDF нь "Эх хэвлэл"-ийн ИЖИЛ загвараас (@/lib/template-values) сервер талд
// үүсдэг тул суваг хоёуланд ЯГ ижил баримт явна.
//
// E-Mongolia-ийн гадаад холболт одоогоор МОК: түүхэд "Мокоор бүртгэсэн" гэж
// харагдана — иргэнд хүрсэн гэж эндүүрэхгүйн тулд.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Mail,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { landApi, parcelApi } from "@/lib/api";
import { authHeaders, buildDocxTemplateValues } from "@/lib/template-values";
import { getApiError } from "@/lib/utils";
import type { LandAcquisition, ParcelFull } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Channel = "email" | "emongolia";

/** Түүхийн НЭГ мөр — хоёр сувгийг нэг хэлбэрт нэгтгэнэ. */
type HistoryItem = {
  id: string;
  channel: Channel;
  recipient: string;
  sentAt: string;
  status: "sent" | "mocked" | "failed";
  fileURL: string;
  note?: string;
};

/** Мэдэгдэх хуудсын PDF-ийг сервер талд үүсгэнэ (загвартай ижил агуулга). */
async function buildNoticePdfFile(
  parcel: ParcelFull,
  acquisition: LandAcquisition | undefined,
) {
  const res = await fetch("/api/templates/medegdeh-huudas/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ values: buildDocxTemplateValues(parcel, acquisition) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "PDF файл үүсгэхэд алдаа гарлаа");
  }
  const blob = await res.blob();
  return new File([blob], `medegdeh_huudas_${parcel.parcel_id || "template"}.pdf`, {
    type: "application/pdf",
  });
}

function formatSentAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NoticeSection({
  parcelId,
  parcel,
  canSend,
}: {
  parcelId: string;
  parcel: ParcelFull;
  canSend: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Загварын утгуудад чөлөөлөлтийн мэдээлэл (хуваарилагдсан ажилтан, au нэр)
  // хэрэгтэй. Түүх ба чөлөөлөлтийг цонх нээгдсэн үед л уншина.
  const [acqQuery, emailQuery, emongoliaQuery] = useQueries({
    queries: [
      {
        queryKey: ["land", parcel.acquisition_id],
        queryFn: () => landApi.getById(parcel.acquisition_id),
        enabled: !!parcel.acquisition_id,
      },
      {
        queryKey: ["parcel-notice-emails", parcelId],
        queryFn: () => parcelApi.listNoticeEmails(parcelId),
        enabled: !!parcelId,
      },
      {
        queryKey: ["parcel-emongolia-notices", parcelId],
        queryFn: () => parcelApi.listEMongoliaNotices(parcelId),
        enabled: !!parcelId,
      },
    ],
  });

  const acquisition = acqQuery.data;
  const historyLoading = emailQuery.isLoading || emongoliaQuery.isLoading;

  // Хоёр сувгийн түүхийг нэгтгээд огноогоор эрэмбэлнэ (шинэ нь эхэнд).
  const history = useMemo<HistoryItem[]>(() => {
    const emails: HistoryItem[] = (emailQuery.data ?? []).map((h) => ({
      id: h.id,
      channel: "email",
      recipient: h.to_email,
      sentAt: h.sent_at,
      status: h.status,
      fileURL: h.file_url,
      note: h.error_message,
    }));
    const emongolia: HistoryItem[] = (emongoliaQuery.data ?? []).map((h) => ({
      id: h.id,
      channel: "emongolia",
      recipient: [h.register_no, h.recipient_name].filter(Boolean).join(" · "),
      sentAt: h.sent_at,
      status: h.status,
      fileURL: h.file_url,
      note: h.error_message || h.external_ref,
    }));
    return [...emails, ...emongolia].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [emailQuery.data, emongoliaQuery.data]);

  const sentCount = history.filter((h) => h.status !== "failed").length;

  // ── Хүлээн авагчийн санал (эзэмшигчийн бүртгэлээс) ────────────────────────
  const emailSuggestions = useMemo(() => {
    const list = [
      ...(parcel.holders ?? []).map((h) => h.email),
      parcel.detail?.holder_email,
    ]
      .map((e) => (e ?? "").trim())
      .filter((e) => EMAIL_RE.test(e));
    return Array.from(new Set(list));
  }, [parcel.holders, parcel.detail?.holder_email]);

  const registerSuggestions = useMemo(() => {
    const list = [
      ...(parcel.holders ?? []).map((h) => ({
        register: (h.register_no ?? "").trim(),
        name: [h.last_name, h.name].filter(Boolean).join(" ").trim(),
      })),
      {
        register: (parcel.detail?.holder_register_no ?? "").trim(),
        name: [parcel.detail?.holder_last_name, parcel.detail?.holder_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
      },
    ].filter((r) => r.register.length > 0);
    const seen = new Set<string>();
    return list.filter((r) => (seen.has(r.register) ? false : seen.add(r.register)));
  }, [parcel.holders, parcel.detail]);

  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [registerNo, setRegisterNo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [fieldError, setFieldError] = useState(false);

  // ── Мэдэгдэх хуудсын PDF (цонх нээгдэхэд НЭГ УДАА үүсгэж харуулна) ────────
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfURL, setPdfURL] = useState<string>("");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const buildPreview = useCallback(async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const file = await buildNoticePdfFile(parcel, acquisition);
      setPdfFile(file);
      setPdfURL((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF үүсгэхэд алдаа гарлаа");
    } finally {
      setPdfLoading(false);
    }
  }, [parcel, acquisition]);

  useEffect(() => {
    if (!open) return;
    void buildPreview();
  }, [open, buildPreview]);

  // Blob URL-ийг цонх хаагдахад чөлөөлнө (санах ой үлдэхгүй).
  useEffect(() => {
    if (open) return;
    setPdfFile(null);
    setPdfError(null);
    setPdfURL((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, [open]);

  const openModal = () => {
    setChannel("email");
    setEmail(emailSuggestions[0] ?? "");
    setRegisterNo(registerSuggestions[0]?.register ?? "");
    setRecipientName(registerSuggestions[0]?.name ?? "");
    setFieldError(false);
    setOpen(true);
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!pdfFile) throw new Error("Мэдэгдэх хуудас бэлэн болоогүй байна");
      if (channel === "email") {
        return parcelApi.sendNoticeEmail(parcelId, email.trim(), pdfFile);
      }
      return parcelApi.sendEMongoliaNotice(
        parcelId,
        registerNo.trim(),
        recipientName.trim(),
        pdfFile,
      );
    },
    onSuccess: (res) => {
      const mocked = (res as { status?: string })?.status === "mocked";
      toast.success(
        channel === "email"
          ? `Мэдэгдэх хуудас ${email} хаяг руу илгээгдлээ`
          : mocked
            ? "E-Mongolia (мок): мэдэгдэл бүртгэгдлээ — гадаад холболт хийгдээгүй"
            : "E-Mongolia-руу мэдэгдэл илгээгдлээ",
      );
      void queryClient.invalidateQueries({ queryKey: ["parcel-notice-emails", parcelId] });
      void queryClient.invalidateQueries({ queryKey: ["parcel-emongolia-notices", parcelId] });
      setOpen(false);
    },
    onError: (err) => {
      toast.error(getApiError(err, err instanceof Error ? err.message : "Илгээхэд алдаа гарлаа"));
      // Амжилтгүй оролдлого ч түүхэд бүртгэгддэг тул шинэчилнэ.
      void queryClient.invalidateQueries({ queryKey: ["parcel-notice-emails", parcelId] });
      void queryClient.invalidateQueries({ queryKey: ["parcel-emongolia-notices", parcelId] });
    },
  });

  const handleSubmit = () => {
    if (channel === "email") {
      if (!EMAIL_RE.test(email.trim())) {
        setFieldError(true);
        toast.error("Имэйл хаягийг зөв оруулна уу");
        return;
      }
    } else if (!registerNo.trim()) {
      setFieldError(true);
      toast.error("Регистрийн дугаарыг оруулна уу");
      return;
    }
    sendMutation.mutate();
  };

  const busy = sendMutation.isPending;
  const inputCls = (invalid: boolean) =>
    `h-9 w-full rounded-lg border px-3 text-[13px] outline-none transition-all dark:bg-[#1e1f27] dark:text-slate-200 ${
      invalid
        ? "border-red-400 bg-red-50/30 focus:ring-red-400/20"
        : "border-slate-200 bg-white focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08]"
    }`;

  return (
    <>
      {/* "Эзэмшигч" таб дээр — ЗӨВХӨН товч */}
      {canSend && (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#02c0ce]/10 px-3 text-[12px] font-semibold text-[#02c0ce] transition-colors hover:bg-[#02c0ce]/20"
        >
          <Send className="h-3.5 w-3.5" />
          Мэдэгдэх хуудас илгээх
          {sentCount > 0 && (
            <span className="rounded-full bg-[#0acf97]/15 px-1.5 text-[10.5px] font-semibold text-[#0acf97]">
              {sentCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-white/[0.06] dark:bg-[#1e1f27]">
            {/* Толгой */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#02c0ce]/10">
                  <Send className="h-4 w-4 text-[#02c0ce]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold leading-tight text-slate-800 dark:text-white">
                    Мэдэгдэх хуудас илгээх
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                    Нэгж талбар: {parcel.parcel_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* ── ШИНЭЭР ИЛГЭЭХ ────────────────────────────────────────── */}
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Шинээр илгээх
              </p>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-[#191b22]">
                {/* Сувгийн сонголт */}
                <div className="mb-3 flex gap-1.5">
                  {([
                    { key: "email" as Channel, label: "Имэйл", Icon: Mail },
                    { key: "emongolia" as Channel, label: "Е-Монголиа", Icon: Smartphone },
                  ]).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setChannel(key);
                        setFieldError(false);
                      }}
                      className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                        channel === key
                          ? "bg-[#02c0ce]/15 text-[#02c0ce]"
                          : "bg-white text-slate-500 hover:bg-slate-200 dark:bg-[#252630] dark:text-slate-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {channel === "email" ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Хүлээн авах имэйл <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError(false);
                      }}
                      placeholder="example@email.mn"
                      className={inputCls(fieldError)}
                    />
                    {emailSuggestions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Бүртгэлээс:</span>
                        {emailSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setEmail(s);
                              setFieldError(false);
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors ${
                              email.trim() === s
                                ? "bg-[#02c0ce]/15 text-[#02c0ce]"
                                : "bg-white text-slate-500 hover:bg-slate-200 dark:bg-[#252630] dark:text-slate-400"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                        Эзэмшигчийн бүртгэл дээр имэйл байхгүй — хаягийг гараар оруулна уу.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Регистрийн дугаар <span className="text-red-400">*</span>
                        </label>
                        <input
                          value={registerNo}
                          onChange={(e) => {
                            setRegisterNo(e.target.value);
                            setFieldError(false);
                          }}
                          placeholder="АА00112233"
                          className={inputCls(fieldError)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Хүлээн авагчийн нэр
                        </label>
                        <input
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Овог нэр"
                          className={inputCls(false)}
                        />
                      </div>
                    </div>
                    {registerSuggestions.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Бүртгэлээс:</span>
                        {registerSuggestions.map((s) => (
                          <button
                            key={s.register}
                            type="button"
                            onClick={() => {
                              setRegisterNo(s.register);
                              setRecipientName(s.name);
                              setFieldError(false);
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors ${
                              registerNo.trim() === s.register
                                ? "bg-[#02c0ce]/15 text-[#02c0ce]"
                                : "bg-white text-slate-500 hover:bg-slate-200 dark:bg-[#252630] dark:text-slate-400"
                            }`}
                          >
                            {s.register}
                            {s.name ? ` · ${s.name}` : ""}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Эзэмшигчийн бүртгэл дээр регистрийн дугаар байхгүй — эхлээд
                        &quot;Мэдээлэл дуудах&quot;-аар эзэмшигчийн мэдээллийг татна уу.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      E-Mongolia-ийн гадаад холболт хийгдээгүй тул илгээлт одоогоор
                      <span className="font-semibold"> мокоор </span>
                      бүртгэгдэнэ (иргэнд хүрэхгүй).
                    </p>
                  </div>
                )}
              </div>

              {/* ── МЭДЭГДЭХ ХУУДАС (PDF харагдац) ───────────────────────── */}
              <div className="mt-4 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[#02c0ce]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Илгээх мэдэгдэх хуудас
                </p>
                {pdfFile && (
                  <a
                    href={pdfURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[11.5px] font-semibold text-[#02c0ce] hover:underline"
                  >
                    Шинэ цонхонд нээх
                  </a>
                )}
              </div>
              <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-[#37394d] dark:bg-[#191b22]">
                {pdfLoading ? (
                  <div className="flex h-64 items-center justify-center gap-2 text-[12.5px] text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Мэдэгдэх хуудсыг үүсгэж байна…
                  </div>
                ) : pdfError ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
                    <p className="text-[12.5px] text-red-500">{pdfError}</p>
                    <button
                      type="button"
                      onClick={() => void buildPreview()}
                      className="h-8 rounded-lg bg-slate-100 px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-[#252630] dark:text-slate-300"
                    >
                      Дахин үүсгэх
                    </button>
                  </div>
                ) : (
                  <iframe
                    src={pdfURL}
                    title="Урьдчилан мэдэгдэх хуудас"
                    className="h-[420px] w-full"
                  />
                )}
              </div>

              {/* ── ИЛГЭЭСЭН ТҮҮХ ─────────────────────────────────────────── */}
              <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Илгээсэн түүх
              </p>
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-[13px] text-slate-400 dark:border-[#37394d] dark:text-slate-500">
                  Мэдэгдэх хуудас илгээгээгүй байна.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => {
                    const failed = item.status === "failed";
                    const mocked = item.status === "mocked";
                    return (
                      <div
                        key={`${item.channel}-${item.id}`}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-white/[0.06] dark:bg-[#191b22]"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            failed
                              ? "bg-red-500/15 text-red-500"
                              : mocked
                                ? "bg-amber-500/15 text-amber-500"
                                : "bg-[#0acf97]/15 text-[#0acf97]"
                          }`}
                        >
                          {failed ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : mocked ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          )}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            item.channel === "email"
                              ? "bg-slate-200/70 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                              : "bg-[#02c0ce]/12 text-[#02c0ce]"
                          }`}
                        >
                          {item.channel === "email" ? "Имэйл" : "Е-Монголиа"}
                        </span>
                        <span className="min-w-0 truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                          {item.recipient}
                        </span>
                        <span className="text-[11.5px] text-slate-400 dark:text-slate-500">
                          {formatSentAt(item.sentAt)}
                        </span>
                        {failed ? (
                          <span className="ml-auto shrink-0 text-[11px] font-medium text-red-500" title={item.note}>
                            Илгээгдсэнгүй
                          </span>
                        ) : (
                          <span className="ml-auto flex shrink-0 items-center gap-2">
                            {mocked && (
                              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400" title={item.note}>
                                Мокоор бүртгэсэн
                              </span>
                            )}
                            {item.fileURL && (
                              <a
                                href={item.fileURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11.5px] font-semibold text-[#02c0ce] hover:underline"
                              >
                                Илгээсэн файл
                              </a>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Хөл — илгээх */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-9 rounded-xl px-4 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
              >
                Болих
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy || pdfLoading || !pdfFile}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#02c0ce] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {busy
                  ? "Илгээж байна..."
                  : channel === "email"
                    ? "Имэйлээр илгээх"
                    : "Е-Монголиагаар илгээх"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
