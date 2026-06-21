'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parcelApi } from '@/lib/api'
import { STATUS_LABELS, RIGHT_TYPE_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import Link from 'next/link'

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#f59e0b', bg: '#f59e0b18' },
  3: { color: '#0acf97', bg: '#0acf9718' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}

export default function ParcelListPage() {
  const [filter, setFilter] = useState({
    parcel_id: '', acquisition_name: '', right_type: 0, landuse: '', status: 0,
  })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const { data, isLoading } = useQuery({
    queryKey: ['global-parcels', filter, page],
    queryFn: () => parcelApi.list({
      page, page_size: PAGE_SIZE,
      parcel_id: filter.parcel_id || undefined,
      acquisition_name: filter.acquisition_name || undefined,
      right_type: filter.right_type || undefined,
      landuse: filter.landuse || undefined,
      status: filter.status || undefined,
    }),
  })

  const inp = 'h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'
  const hasFilter = filter.parcel_id || filter.acquisition_name || filter.right_type !== 0 || filter.landuse || filter.status !== 0

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Нэгж талбар</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Бүх чөлөөлөлтийн нэгж талбаруудын жагсаалт
          </p>
        </div>
        <div className="text-[13px] text-slate-400 dark:text-slate-500">
          Нийт: <span className="font-semibold text-slate-700 dark:text-slate-200">{data?.total ?? 0}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="ap-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text" placeholder="Талбарын дугаар"
              value={filter.parcel_id}
              onChange={e => { setFilter(f => ({ ...f, parcel_id: e.target.value })); setPage(1) }}
              className={`${inp} pl-8 w-40`}
            />
          </div>
          <input
            type="text" placeholder="Чөлөөлөлтийн нэр"
            value={filter.acquisition_name}
            onChange={e => { setFilter(f => ({ ...f, acquisition_name: e.target.value })); setPage(1) }}
            className={`${inp} w-44`}
          />
          <select
            value={filter.right_type}
            onChange={e => { setFilter(f => ({ ...f, right_type: e.target.value ? Number(e.target.value) : 0 })); setPage(1) }}
            className={`${inp} w-36`}
          >
            <option value={0}>Эрхийн төрөл</option>
            <option value={1}>Ашиглах</option>
            <option value={2}>Эзэмших</option>
            <option value={3}>Өмчлөх</option>
          </select>
          <input
            type="text" placeholder="Газрын зориулалт"
            value={filter.landuse}
            onChange={e => { setFilter(f => ({ ...f, landuse: e.target.value })); setPage(1) }}
            className={`${inp} w-40`}
          />
          <select
            value={filter.status}
            onChange={e => { setFilter(f => ({ ...f, status: e.target.value ? Number(e.target.value) : 0 })); setPage(1) }}
            className={`${inp} w-44`}
          >
            <option value={0}>Чөлөөлөлтийн төлөв</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => { setFilter({ parcel_id: '', acquisition_name: '', right_type: 0, landuse: '', status: 0 }); setPage(1) }}
              className="flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors">
              <X className="h-3.5 w-3.5" /> Арилгах
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="ap-card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <p className="text-[13px]">Нэгж талбар олдсонгүй</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {['Дугаар', 'Чөлөөлөлтийн нэр', 'Огноо', 'Чөлөөлөлтийн төлөв', 'Эрхийн төрөл', 'Газрын зориулалт', 'Талбай', 'Нөхөн төлбөр', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {data.data.map(p => {
                  const sc = STATUS_CFG[p.acquisition_status] ?? STATUS_CFG[1]
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{p.parcel_id}</td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{p.acquisition_name || p.plan_code}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{p.plan_code}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {p.start_date ? formatDate(p.start_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: sc.color, background: sc.bg }}>
                          {STATUS_LABELS[p.acquisition_status] ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {RIGHT_TYPE_LABELS[p.right_type] || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.landuse || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatArea(p.area_m2)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={p.compensation_paid
                            ? { color: '#0acf97', background: '#0acf9718' }
                            : { color: '#94a3b8', background: '#f1f5f9' }}>
                          {p.compensation_paid ? '✓ Төлсөн' : 'Төлөөгүй'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/parcel/${p.id}?acq=${p.acquisition_id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap">
                          Дэлгэрэнгүй
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-[#37394d]">
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} / {data.total}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors">
                Өмнөх
              </button>
              <span className="text-[12px] text-slate-500 px-2">{page} / {data.total_pages}</span>
              <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 dark:border-[#37394d] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors">
                Дараах
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
