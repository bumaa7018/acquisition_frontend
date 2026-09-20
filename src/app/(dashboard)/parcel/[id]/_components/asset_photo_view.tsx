"use client";

// Хөрөнгийн ЗУРАГ харах — дэлгэрэнгүй самбарт зургуудыг ШУУД харуулна.
//
// Зураг нь серверт нэг PDF болж хадгалагддаг (asset_photo_upload.tsx нь олон
// зургийг JPEG болгон шигтгэж PDF үүсгэдэг). Тиймээс энд PDF-ийг татаад дотор
// нь шигтгэсэн JPEG-үүдийг буцаан задалж, энгийн <img>-ээр харуулна:
//   • PDF үзэгч (iframe) нь жижиг самбарт таарамжгүй, заримдаа огт харагддаггүй,
//   • харин зураг шууд харагдвал "оруулсан зургаа хараад" батлах боломжтой.
// Задлах боломжгүй (жишээ нь гараас PDF хавсаргасан) тохиолдолд PDF-ийг өөрийг
// нь iframe-ээр үзүүлнэ.

import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, Loader2, Lock, X } from "lucide-react";
import { logger } from "@/lib/logger";
import { extractPdfJpegs } from "@/lib/pdf-images";

/** PDF доторх зургуудыг задалж blob URL болгоно (дараалал нь хуудасны дараалал). */
async function extractJpegUrls(bytes: ArrayBuffer): Promise<string[]> {
  const images = await extractPdfJpegs(bytes);
  return images.map((img) =>
    URL.createObjectURL(new Blob([img as unknown as BlobPart], { type: "image/jpeg" })),
  );
}

export function AssetPhotoView({ url, name }: { url?: string; name?: string }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Хандах эрхгүй / нэвтрэлт дууссан — PDF-ийг iframe-ээр үзүүлбэл алдааны JSON
  // харагддаг тул ТУСГАЙ мессеж гаргана.
  const [denied, setDenied] = useState<"forbidden" | "unauthorized" | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];
    setPhotos([]);
    setFailed(false);
    setDenied(null);
    setViewer(null);
    if (!url) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 401 || res.status === 403) {
          // Файлын эрхийг backend объект тус бүрээр шалгадаг (чөлөөлөлтийн
          // хуваарилалт / байгууллагын гишүүнчлэл). Хэрэглэгчид шалтгааныг
          // ойлгомжтой хэлнэ — түүхий JSON харуулахгүй.
          if (!cancelled) setDenied(res.status === 401 ? "unauthorized" : "forbidden");
          logger.warn("asset photo access denied", { status: res.status, url });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const urls = await extractJpegUrls(await res.arrayBuffer());
        if (cancelled) {
          urls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        created = urls;
        setPhotos(urls);
        setFailed(urls.length === 0);
      } catch (err) {
        // Задлаж чадаагүй бол PDF-ийг өөрийг нь харуулна (алдаа биш, нөөц зам).
        logger.warn("asset photo extract failed", { error: String(err) });
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url]);

  if (!url) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 bg-slate-50 text-[11px] text-slate-400 dark:bg-[#1a1d20]">
        <Camera className="h-5 w-5 opacity-60" />
        Зураг оруулаагүй байна
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center bg-slate-50 dark:bg-[#1a1d20]">
        <Loader2 className="h-5 w-5 animate-spin text-[#02c0ce]" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-1.5 bg-slate-50 px-4 text-center dark:bg-[#1a1d20]">
        <Lock className="h-5 w-5 text-slate-300" />
        <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          {denied === "unauthorized" ? "Нэвтрэлт дууссан байна" : "Зураг харах эрх алга"}
        </p>
        <p className="text-[11px] leading-snug text-slate-400">
          {denied === "unauthorized"
            ? "Дахин нэвтэрч орно уу."
            : "Энэ чөлөөлөлтөд хуваарилагдсан ажилтан, ахлах/админ эсвэл үнэлгээ хийсэн байгууллага харах эрхтэй."}
        </p>
      </div>
    );
  }

  // Нөөц зам — PDF-ийг шууд үзүүлнэ
  if (failed || photos.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-[#1a1d20]">
        <iframe src={url} title={name || "Хөрөнгийн зураг"} className="h-48 w-full" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#02c0ce] hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Шинэ цонхонд нээх
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-50 dark:bg-[#1a1d20]">
        {/* Эхний зураг — том, дарахад бүтэн хэмжээгээр нээгдэнэ */}
        <button
          type="button"
          onClick={() => setViewer(0)}
          className="block h-44 w-full overflow-hidden"
          title="Томруулж харах"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt={name || "Зураг"} className="h-full w-full object-cover" />
        </button>
        {photos.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-2 py-2">
            {photos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setViewer(i)}
                className="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200 hover:border-[#02c0ce] dark:border-white/[0.08]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Зураг ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between px-3 pb-2 text-[11px] text-slate-400">
          <span>{photos.length} зураг</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#02c0ce] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> PDF нээх
          </a>
        </div>
      </div>

      {/* Бүтэн дэлгэцийн үзэгч */}
      {viewer != null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewer(null);
          }}
        >
          <button
            onClick={() => setViewer(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            title="Хаах"
          >
            <X className="h-4 w-4" />
          </button>
          {photos.length > 1 && (
            <button
              onClick={() => setViewer((v) => ((v ?? 0) - 1 + photos.length) % photos.length)}
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Өмнөх"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[viewer]}
            alt={`${name || "Зураг"} ${viewer + 1}`}
            className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
          {photos.length > 1 && (
            <button
              onClick={() => setViewer((v) => ((v ?? 0) + 1) % photos.length)}
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Дараах"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          <span className="absolute bottom-4 text-[12px] font-semibold text-white/80">
            {viewer + 1} / {photos.length}
          </span>
        </div>
      )}
    </>
  );
}
