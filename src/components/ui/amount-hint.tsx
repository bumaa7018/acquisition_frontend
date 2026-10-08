"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { cn, formatMoneyExact } from "@/lib/utils";

/**
 * Тоймлосон мөнгөн дүнгийн («1.3 тэрбум₮», «15.2 сая») ард тавих «?» товч —
 * дарахад бүтэн дүнг (1,312,456,000₮) харуулна. Мөр/картын click-ийг
 * өдөөхгүй (stopPropagation); гадна дарах эсвэл Esc-ээр хаагдана.
 */
export function AmountHint({ value, className }: { value: number | null | undefined; className?: string }) {
  // Хариуг body руу portal-аар, товчны байрлалаас fixed байрлалд гаргана —
  // карт/хүснэгтийн overflow-hidden болон хөрш картын z-index-д тасрахгүй.
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    // Гүйлгэх/хэмжээ өөрчлөхөд байрлал хуучирна — хаана.
    const close = () => setPos(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open || !btnRef.current) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    // Дээд талд зай багатай бол доор нь.
    const below = r.top < 48;
    // Дэлгэцийн захад ойр бол хажуу тийш гарахгүйгээр хавчина.
    const x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90);
    setPos({ x, y: below ? r.bottom + 6 : r.top - 6, below });
  };

  const exact = formatMoneyExact(value);
  return (
    <span className={cn("inline-flex align-middle", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Бүтэн дүн: ${exact}`}
        aria-expanded={open}
        title="Бүтэн дүнг харах"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggle();
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-[#02c0ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#02c0ce]/40 dark:text-slate-500"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {pos &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            style={{
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%, ${pos.below ? "0" : "-100%"})`,
            }}
            className="fixed z-[1000] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-slate-800 shadow-lg dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-100"
          >
            {exact}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** Тоймлосон дүн + «?» — `<AbbrevAmount value={v}>{formatBillion(v)}</AbbrevAmount>`. */
export function AbbrevAmount({
  value,
  children,
  className,
}: {
  value: number | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{children}</span>
      <AmountHint value={value} />
    </span>
  );
}
