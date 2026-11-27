"use client";

// "Ажлын зураг" — нэгж талбарын хээрийн ажлын зургууд.
// Жижиг зургаар (thumb) харуулж, дарахад бүтэн дэлгэцийн carousel нээгдэнэ.
// Засах эрхтэй үед зураг бүрийг устгах боломжтой (thumb дээр болон carousel дотор).

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type WorkPhotoDoc = {
  id: string;
  name?: string;
  file_url: string;
  file_type?: string;
};

export function isImageDoc(doc: { name?: string; file_type?: string }): boolean {
  return (doc.file_type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(doc.name ?? "");
}

export function WorkPhotoGallery({
  docs,
  canRemove,
  onRemove,
}: {
  docs: WorkPhotoDoc[];
  canRemove: boolean;
  /** Устгах — амжилттай болбол resolve, алдаа гарвал reject (toast-ийг дуудагч өгнө). */
  onRemove: (docId: string) => Promise<unknown>;
}) {
  const [viewer, setViewer] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Устгасны дараа жагсаалт богиносоход carousel-ийн индексийг хүрээнд нь барина.
  useEffect(() => {
    if (viewer === null) return;
    if (docs.length === 0) setViewer(null);
    else if (viewer > docs.length - 1) setViewer(docs.length - 1);
  }, [docs.length, viewer]);

  const confirmDoc = docs.find((d) => d.id === confirmId);

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      await onRemove(id);
    } catch {
      /* дуудагч тал алдааг мэдэгдэнэ */
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#37394d]">
        <Camera className="h-4 w-4 text-slate-400" />
        <p className="text-[12px] font-semibold text-slate-700 dark:text-white">Ажлын зураг</p>
        <span className="ml-auto text-[11px] tabular-nums text-slate-400">{docs.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {docs.map((doc, i) => (
          <div key={doc.id} className="group relative h-20">
            <button
              type="button"
              onClick={() => setViewer(i)}
              title={doc.name}
              className="block h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#02c0ce] dark:border-white/[0.08] dark:bg-[#252630]"
            >
              <Thumb doc={doc} />
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => setConfirmId(doc.id)}
                disabled={removingId === doc.id}
                aria-label="Зураг устгах"
                title="Устгах"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-rose-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-100"
              >
                {removingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        ))}
      </div>

      {viewer !== null && docs[viewer] && (
        <Carousel
          docs={docs}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
          canRemove={canRemove}
          removingId={removingId}
          onAskRemove={setConfirmId}
        />
      )}

      {confirmId &&
        createPortal(
          <div className="relative z-[70]">
            <ConfirmDialog
              open
              title="Ажлын зургийг устгах уу?"
              description={confirmDoc?.name ? `"${confirmDoc.name}" нэгж талбарын баримт бичгээс устгагдана.` : undefined}
              confirmLabel="Устгах"
              onConfirm={() => {
                const id = confirmId;
                setConfirmId(null);
                void remove(id);
              }}
              onClose={() => setConfirmId(null)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function Thumb({ doc }: { doc: WorkPhotoDoc }) {
  if (!isImageDoc(doc)) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
        <FileText className="h-5 w-5" />
        <span className="px-1 text-[10px]">PDF</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- /api/files (cookie-гоор эрх шалгана)
    <img
      src={doc.file_url}
      alt={doc.name ?? "Ажлын зураг"}
      loading="lazy"
      className="h-full w-full object-cover transition-transform group-hover:scale-105"
    />
  );
}

function Carousel({
  docs,
  index,
  onIndex,
  onClose,
  canRemove,
  removingId,
  onAskRemove,
}: {
  docs: WorkPhotoDoc[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  canRemove: boolean;
  removingId: string | null;
  onAskRemove: (id: string) => void;
}) {
  const n = docs.length;
  const doc = docs[index];
  const prev = useCallback(() => onIndex((index - 1 + n) % n), [index, n, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % n), [index, n, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && n > 1) prev();
      else if (e.key === "ArrowRight" && n > 1) next();
    };
    window.addEventListener("keydown", onKey);
    // Арын хуудас гүйлгэгдэхээс сэргийлнэ.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, prev, next, n]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ажлын зураг"
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      onClick={onClose}
    >
      {/* Дээд мөр: нэр, тоолуур, үйлдэл */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="shrink-0 text-[13px] tabular-nums text-white/70">
          {index + 1} / {n}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px]" title={doc.name}>
          {doc.name}
        </span>
        <a
          href={doc.file_url}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Шинэ цонхонд нээх"
          title="Шинэ цонхонд нээх"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {canRemove && (
          <button
            type="button"
            onClick={() => onAskRemove(doc.id)}
            disabled={removingId === doc.id}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-rose-600 disabled:opacity-60"
            aria-label="Устгах"
            title="Устгах"
          >
            {removingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Хаах"
          title="Хаах (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Үндсэн зураг */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
        {isImageDoc(doc) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={doc.id}
            src={doc.file_url}
            alt={doc.name ?? "Ажлын зураг"}
            className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-3 rounded-xl bg-white/5 px-10 py-8 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="h-12 w-12 text-white/60" />
            <p className="max-w-xs truncate text-[13px]">{doc.name}</p>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#02c0ce] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#02c0ce]/90"
            >
              <ExternalLink className="h-3.5 w-3.5" /> PDF нээх
            </a>
          </div>
        )}
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), prev())}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Өмнөх"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), next())}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Дараах"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Доод мөр: thumb-ууд */}
      {n > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {docs.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Зураг ${i + 1}`}
              className={cn(
                "group h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-white/5 transition-opacity",
                i === index ? "border-[#02c0ce] opacity-100" : "border-transparent opacity-50 hover:opacity-90",
              )}
            >
              <Thumb doc={d} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
