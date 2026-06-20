'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { STATUS_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Search, Trash2, Eye, MapPin, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#0acf97', bg: '#0acf9718' },
  3: { color: '#8391a2', bg: '#8391a218' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}

const PAGE_SIZE = 15

export default function LandPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['land', page, search],
    queryFn: () => landApi.list({ page, page_size: PAGE_SIZE, plan_code: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => landApi.delete(id),
    onSuccess: () => {
      toast.success('Чөлөөлөлт устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['land'] })
    },
    onError: () => toast.error('Устгах боломжгүй (зөвхөн NEW статустай)'),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const HEADERS = ['Төлөвлөгөөний дугаар', 'Статус', 'Талбай', 'Эхлэх', 'Дуусах', 'Нэгж талбар', '']

  return (
    <div className="flex flex-col gap-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Газар чөлөөлөлт</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Нийт {total} чөлөөлөлтийн бүртгэл</p>
        </div>
      </div>

      <div className="ap-card overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Төлөвлөгөөний дугаараар хайх..."
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] pl-9 pr-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                {HEADERS.map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {HEADERS.map(h => (
                      <td key={h} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-slate-100 dark:bg-[#252630]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-slate-400 dark:text-slate-500">
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    Бичлэг олдсонгүй
                  </td>
                </tr>
              ) : data.data.map(land => {
                const sc = STATUS_CFG[land.status] ?? STATUS_CFG[1]
                return (
                  <tr key={land.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#02c0ce]">{land.plan_code}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{land.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ color: sc.color, background: sc.bg }}
                      >
                        {STATUS_LABELS[land.status] ?? 'Тодорхойгүй'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{formatArea(land.area_m2)}</td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-400">{formatDate(land.start_date)}</td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-600 dark:text-slate-400">{formatDate(land.end_date)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {land.parcels?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/acquisition/${land.id}`}>
                          <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                        <button
                          onClick={() => { if (confirm('Устгах уу?')) deleteMutation.mutate(land.id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-[#37394d]">
          <p className="text-[12px] text-slate-400 dark:text-slate-500">
            {total === 0
              ? 'Бичлэг олдсонгүй'
              : `Нийт ${total} бичлэгийн ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}-г харуулж байна`
            }
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium border transition-colors',
                  page === p
                    ? 'bg-[#02c0ce] text-white border-[#02c0ce]'
                    : 'border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce]'
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-[#02c0ce] hover:text-[#02c0ce] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
