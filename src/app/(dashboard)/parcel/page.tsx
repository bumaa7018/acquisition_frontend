'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parcelApi, landApi } from '@/lib/api'
import { STATUS_LABELS, RIGHT_TYPE_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { Search, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#f59e0b', bg: '#f59e0b18' },
  3: { color: '#0acf97', bg: '#0acf9718' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}

// ─── Highlight matching text ──────────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#02c0ce]/20 text-[#02c0ce] rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  )
}

// ─── Searchable acquisition select ───────────────────────────────────────────
function AcquisitionSelect({
  selectedId,
  onSelect,
  onClear,
  className,
}: {
  selectedId: string
  onSelect: (id: string, label: string) => void
  onClear: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['acq-list-all'],
    queryFn: () => landApi.list({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const acquisitions = data?.data ?? []

  // Сонгосон acquisition-ийн харуулах нэр
  const selected = acquisitions.find(a => a.id === selectedId)
  const displayLabel = selected?.acquisition_name ?? ''

  const filtered = query.trim()
    ? acquisitions.filter(acq => {
        const q = query.trim().toLowerCase()
        return (
          (acq.acquisition_name ?? '').toLowerCase().includes(q) ||
          (acq.plan_code ?? '').toLowerCase().includes(q)
        )
      })
    : acquisitions

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(acq: { id: string; acquisition_name: string }) {
    setQuery('')
    onSelect(acq.id, acq.acquisition_name)
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setQuery('')
    onClear()
    setOpen(false)
  }

  const hasValue = !!selectedId

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        {hasValue && !open ? (
          <span title={displayLabel} className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 truncate">{displayLabel}</span>
        ) : (
          <input
            type="text"
            placeholder="Чөлөөлөлтийн нэр"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            autoFocus={open}
            className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
          />
        )}
        {hasValue
          ? <button onClick={clear} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="h-3.5 w-3.5" /></button>
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        }
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">Олдсонгүй</div>
            ) : filtered.map(acq => (
              <button
                key={acq.id}
                onMouseDown={e => { e.preventDefault(); select(acq) }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
              >
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {acq.acquisition_name
                    ? <Highlight text={acq.acquisition_name} query={query} />
                    : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Searchable plan select ───────────────────────────────────────────────────
function PlanSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['acq-list-all'],
    queryFn: () => landApi.list({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  // Distinct plan codes from acquisitions
  const plans = Array.from(
    new Map(
      (data?.data ?? [])
        .filter(a => a.plan_code)
        .map(a => [a.plan_code, { plan_code: a.plan_code, name: a.plan_name ?? '' }])
    ).values()
  )

  const filtered = query.trim()
    ? plans.filter(p =>
        p.plan_code.toLowerCase().includes(query.trim().toLowerCase()) ||
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : plans

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (!value) setQuery('')
  }, [value])

  function select(p: { plan_code: string; name: string }) {
    setQuery(p.plan_code)
    onChange(p.plan_code)
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          placeholder="Төлөвлөгөөний дугаар"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
        />
        {query
          ? <button onClick={clear} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="h-3.5 w-3.5" /></button>
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        }
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-80 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">Олдсонгүй</div>
            ) : filtered.map(p => (
              <button
                key={p.plan_code}
                onMouseDown={e => { e.preventDefault(); select(p) }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
              >
                <span className="text-[13px] text-slate-700 dark:text-slate-200">
                  <Highlight text={p.plan_code} query={query} />
                </span>
                {p.name && (
                  <>
                    <span className="text-[12px] text-slate-300 dark:text-slate-600 mx-1.5">|</span>
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      <Highlight text={p.name} query={query} />
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const EMPTY = { parcel_id: '', acquisition_id: '', plan_code: '', right_type: 0, landuse: '', status: 0 }

export default function ParcelListPage() {
  const [draft, setDraft] = useState(EMPTY)
  const [filter, setFilter] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [searchTick, setSearchTick] = useState(0)
  const PAGE_SIZE = 20

  function applySearch() {
    setFilter({ ...draft })
    setPage(1)
    setSearchTick(t => t + 1)
  }

  function clearAll() {
    setDraft(EMPTY)
    setFilter(EMPTY)
    setPage(1)
    setSearchTick(t => t + 1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['global-parcels', filter, page, searchTick],
    queryFn: () => parcelApi.list({
      page, page_size: PAGE_SIZE,
      parcel_id: filter.parcel_id || undefined,
      acquisition_id: filter.acquisition_id || undefined,
      plan_code: filter.plan_code || undefined,
      right_type: filter.right_type || undefined,
      landuse: filter.landuse || undefined,
      status: filter.status || undefined,
    }),
  })

  const inp = 'h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'
  const hasFilter = draft.parcel_id || draft.acquisition_id || draft.plan_code || draft.right_type !== 0 || draft.landuse || draft.status !== 0

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
          {/* Parcel ID */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text" placeholder="Талбарын дугаар"
              value={draft.parcel_id}
              onChange={e => setDraft(f => ({ ...f, parcel_id: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              className={`${inp} pl-8 w-40`}
            />
          </div>

          {/* Plan select combobox */}
          <PlanSelect
            value={draft.plan_code}
            onChange={code => setDraft(f => ({ ...f, plan_code: code }))}
            className="w-52"
          />

          {/* Acquisition searchable select */}
          <AcquisitionSelect
            selectedId={draft.acquisition_id}
            onSelect={(id) => setDraft(f => ({ ...f, acquisition_id: id }))}
            onClear={() => setDraft(f => ({ ...f, acquisition_id: '' }))}
            className="w-56"
          />

          <select
            value={draft.right_type}
            onChange={e => setDraft(f => ({ ...f, right_type: e.target.value ? Number(e.target.value) : 0 }))}
            className={`${inp} w-36`}
          >
            <option value={0}>Эрхийн төрөл</option>
            <option value={1}>Ашиглах</option>
            <option value={2}>Эзэмших</option>
            <option value={3}>Өмчлөх</option>
          </select>
          <input
            type="text" placeholder="Газрын зориулалт"
            value={draft.landuse}
            onChange={e => setDraft(f => ({ ...f, landuse: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
            className={`${inp} w-40`}
          />
          <select
            value={draft.status}
            onChange={e => setDraft(f => ({ ...f, status: e.target.value ? Number(e.target.value) : 0 }))}
            className={`${inp} w-44`}
          >
            <option value={0}>Чөлөөлөлтийн төлөв</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Search button */}
          <button
            onClick={applySearch}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Хайх
          </button>

          {hasFilter && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 h-9 px-3 rounded-lg border border-rose-300 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-400/10 text-[12px] font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-400/20 hover:border-rose-400 dark:hover:border-rose-400/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
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
                  {['Дугаар', 'Чөлөөлөлт', 'Огноо', 'Чөлөөлөлтийн төлөв', 'Эрхийн төрөл', 'Газрын зориулалт', 'Талбай', 'Нөхөн төлбөр', ''].map(h => (
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
                        <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{p.acquisition_name || '—'}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{p.plan_code}</p>
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
