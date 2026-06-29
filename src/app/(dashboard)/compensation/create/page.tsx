"use client";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";

export default function CompensationCreateRedirectPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/compensation"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Нөхөн төлбөр нэмэх</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Нэгж талбарын дэлгэрэнгүй хэсгээс нэмнэ</p>
        </div>
      </div>

      <div className="ap-card px-6 py-8 flex flex-col items-center gap-4 max-w-lg">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#02c0ce]/10">
          <Info className="h-6 w-6 text-[#02c0ce]" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-white">
            Нөхөн төлбөр нэгж талбарт холбоотой
          </p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Нөхөн төлбөрийг нэгж талбарын дэлгэрэнгүй хуудасны
            <strong className="text-slate-700 dark:text-slate-200"> &ldquo;Нөхөн олговор&rdquo;</strong> таб дээрээс нэмнэ.
            Эхлээд олборлолтыг сонгоод, нэгж талбараа нэвтэрнэ үү.
          </p>
        </div>
        <Link
          href="/acquisition"
          className="inline-flex items-center gap-2 rounded-xl bg-[#02c0ce] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#02a3af] transition-colors"
        >
          Олборлолт руу очих
        </Link>
        <Link href="/compensation" className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
          Буцах
        </Link>
      </div>
    </div>
  );
}
