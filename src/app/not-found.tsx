// Frontend хуудас БАЙХГҮЙ (route олдоогүй) үед Next.js энэ компонентыг харуулна.
//
// Өмнө нь ийм тохиолдолд Next-ийн ерөнхий 404 гарч байсан. Харин API-ийн
// алдаанууд (5xx/timeout) хэрэглэгчийг /server-error хуудас руу шиддэг байв —
// одоо тэр нь зөвхөн toast анхааруулга болж, хуудас солигдохоо больсон.
// Иймд алдааны бүтэн хуудас нь ЗӨВХӨН хуудас байхгүй / рендер эвдэрсэн
// (app/error.tsx) үед харагдана.

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#14161c]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#1e1f27]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
          <FileQuestion className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-white">Хуудас олдсонгүй</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          Хаяг буруу байна эсвэл хуудас зөөгдсөн байж магадгүй. Хаягийг шалгаад дахин
          оролдоно уу.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#02c0ce] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90"
          >
            <Home className="h-4 w-4" />
            Нүүр хуудас
          </Link>
        </div>
      </div>
    </div>
  );
}
