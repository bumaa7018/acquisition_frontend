"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  previewHeight?: number;
  existingImageUrl?: string;
}

export function DroneImagePicker({ file, onChange, disabled, previewHeight = 405, existingImageUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    onChange(picked);
    e.target.value = "";
  }

  function remove() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const displaySrc = previewSrc ?? (!file ? existingImageUrl : undefined);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={choose}
        className="hidden"
      />

      {displaySrc ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-[#252630]" style={{ height: previewHeight }}>
          <img
            src={displaySrc}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
          {!disabled && (
            previewSrc ? (
              <button
                type="button"
                onClick={remove}
                className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/75 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/75 transition-colors"
              >
                <ImagePlus className="h-3.5 w-3.5" /> Солих
              </button>
            )
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-white/[0.15] text-slate-400 dark:text-slate-500 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors disabled:opacity-50"
          style={{ height: previewHeight }}
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-[13px] font-medium">Зураг оруулах</span>
        </button>
      )}
    </div>
  );
}
