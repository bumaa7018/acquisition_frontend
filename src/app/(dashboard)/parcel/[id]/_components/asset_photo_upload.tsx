"use client";

// Хөрөнгийн зураг оруулах: олон зургийг browser дээр НЭГ PDF болгож нэгтгээд
// (pdf-lib, dynamic import) серверт хадгална. PDF нь тухайн хөрөнгийн мэдээлэлд хавсрагдаж,
// "Зураг харах" холбоосоор нээгдэнэ. RBAC нь эцэг компонентоос (canEdit) удирдагдана.

import { useRef, useState } from "react";
import { Camera, ImagePlus, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

// Олон зургийг нэг PDF болгох. Формат жигдрүүлэхийн тулд бүх зургийг canvas-аар
// JPEG болгож (том зургийг 1600px хүртэл багасгаж), pdf-lib-ээр хуудас болгон нэмнэ.
async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const MAX = 1600;
  for (const file of files) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
    }
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.85));
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return doc.save();
}

export interface AssetPhotoAsset {
  id: string;
  asset_name: string;
  photo_pdf_url?: string;
}

export function AssetPhotoUpload({
  acqId,
  asset,
  canEdit,
  uploadFn,
  onDone,
}: {
  acqId: string;
  asset: AssetPhotoAsset;
  canEdit: boolean;
  uploadFn: (a: string, id: string, file: File) => Promise<{ photo_pdf_url: string; photo_pdf_name: string } | undefined>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPhotos([]);
  };

  const addFiles = (files: FileList | null) => {
    const imgs = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) setPhotos((prev) => [...prev, ...imgs]);
  };

  const submit = async () => {
    if (!photos.length) return;
    setBusy(true);
    try {
      const bytes = await imagesToPdf(photos);
      const pdf = new File([bytes as unknown as BlobPart], `zurag-${asset.asset_name || asset.id}.pdf`, { type: "application/pdf" });
      await uploadFn(acqId, asset.id, pdf);
      toast.success("Зураг хадгалагдлаа");
      onDone();
      setBusy(false);
      setOpen(false);
      setPhotos([]);
      return;
    } catch (err) {
      toast.error(getApiError(err, "Зураг хадгалахад алдаа гарлаа"));
      setBusy(false);
    }
  };

  return (
    <>
      {asset.photo_pdf_url && (
        <a
          href={asset.photo_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Зураг (PDF) харах"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
        >
          <FileText className="h-3.5 w-3.5" />
        </a>
      )}
      {canEdit && (
        <button
          onClick={() => setOpen(true)}
          title={asset.photo_pdf_url ? "Зураг солих" : "Зураг оруулах"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630]"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1e1f27]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#02c0ce]" />
                <div>
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                    {asset.photo_pdf_url ? "Зураг солих" : "Хөрөнгийн зураг"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {asset.asset_name || "Хөрөнгө"} · олон зураг сонгож PDF болгон хадгална
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#252630]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {asset.photo_pdf_url && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                  <span>Одоо байгаа зураг шинээр сонгосон зургаар солигдоно.</span>
                  <a
                    href={asset.photo_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2"
                  >
                    <FileText className="h-3 w-3" />
                    Одоогийн зураг
                  </a>
                </div>
              )}
              <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center text-slate-400 hover:bg-slate-50 dark:border-white/[0.12] dark:hover:bg-white/[0.02]">
                <ImagePlus className="h-8 w-8 opacity-50" />
                <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">Зураг сонгох (олноор)</p>
                <p className="text-[11px]">Дарж эсвэл чирж оруулна уу</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((file, idx) => (
                    <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
              <span className="text-[11px] text-slate-400">{photos.length} зураг</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={close}
                  disabled={busy}
                  className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-[#252630]"
                >
                  Болих
                </button>
                <button
                  onClick={submit}
                  disabled={busy || photos.length === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white hover:bg-[#02c0ce]/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  PDF болгож хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
