'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parcelApi, planApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { RIGHT_TYPE_LABELS } from '@/types'
import type { GlobalParcel, Plan } from '@/types'
import {
  Search, Download, X, ChevronLeft, ChevronRight,
  ChevronDown, FileSpreadsheet, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

const COMP_TYPE_LABELS: Record<string, string> = {
  '': 'Нөхөн төлбөр (бүгд)',
  cash: 'Мөнгөн',
  land_grant: 'Газраар',
}

// ── Plan combobox ──────────────────────────────────────────────────────────────
function PlanCombobox({ value, onSelect, onClear }: {
  value: string
  onSelect: (p: Plan) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  const { data: plans = [], isFetching } = useQuery({
    queryKey: ['plan-suggest', query],
    queryFn: () => planApi.suggest(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  })

  useEffect(() => {
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all">
        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <input
          className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
          placeholder="Төлөвлөгөөний нэр / код..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {(query || isFetching) && (
          <button onClick={() => { setQuery(''); onClear(); setOpen(false) }}>
            {isFetching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              : <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />}
          </button>
        )}
      </div>
      {open && plans.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#252630] shadow-lg">
          {plans.map(p => (
            <li key={p.plan_code}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1e1f27] text-[13px]"
              onMouseDown={() => { onSelect(p); setQuery(p.name || p.plan_code); setOpen(false) }}>
              <span className="font-mono text-[#02c0ce] text-[11px]">{p.plan_code}</span>
              <span className="text-slate-600 dark:text-slate-300 truncate">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Progress modal ─────────────────────────────────────────────────────────────
function ProgressModal({ open, progress, total, status, onClose }: {
  open: boolean
  progress: number
  total: number
  status: 'idle' | 'fetching' | 'generating' | 'done' | 'error'
  onClose: () => void
}) {
  if (!open) return null
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e1f27] rounded-2xl shadow-2xl w-[420px] p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#02c0ce]/10">
            <FileSpreadsheet className="h-5 w-5 text-[#02c0ce]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800 dark:text-white">Тайлан үүсгэж байна</p>
            <p className="text-[12px] text-slate-400">
              {status === 'fetching' && `Мэдээлэл татаж байна... ${progress}/${total}`}
              {status === 'generating' && 'Excel файл үүсгэж байна...'}
              {status === 'done' && 'Татаж авлаа!'}
              {status === 'error' && 'Алдаа гарлаа'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px] text-slate-500">
            <span>
              {status === 'generating'
                ? 'Excel боловсруулж байна...'
                : `${progress} / ${total} чөлөөлөлт`}
            </span>
            <span className="font-medium text-[#02c0ce]">
              {status === 'generating' ? '' : `${pct}%`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                status === 'error' ? 'bg-red-500' : 'bg-[#02c0ce]',
                status === 'generating' && 'animate-pulse w-full',
              )}
              style={{ width: status === 'generating' ? '100%' : `${pct}%` }}
            />
          </div>
        </div>

        {(status === 'done' || status === 'error') && (
          <button
            onClick={onClose}
            className="self-end px-4 py-2 rounded-lg bg-[#02c0ce] text-white text-[13px] font-medium hover:bg-[#00a8b5] transition-colors"
          >
            Хаах
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ReportPage() {
  // Input state — хэрэглэгч бичиж буй утга
  const [inPlanCode, setInPlanCode] = useState('')
  const [inAcqName, setInAcqName]   = useState('')
  const [inAcqYear, setInAcqYear]   = useState('')
  const [inAu3Code, setInAu3Code]   = useState('')
  const [inCompType, setInCompType] = useState('')

  // Query state — "Хайх" дарахад л шинэчлэгдэнэ, API руу илгээнэ
  const [page, setPage] = useState(1)
  const [planCode, setPlanCode] = useState('')
  const [acqName, setAcqName]   = useState('')
  const [acqYear, setAcqYear]   = useState('')
  const [au3Code, setAu3Code]   = useState('')
  const [compType, setCompType] = useState('')

  const [dlOpen, setDlOpen] = useState(false)
  const [dlProgress, setDlProgress] = useState(0)
  const [dlTotal, setDlTotal] = useState(0)
  const [dlStatus, setDlStatus] = useState<'idle' | 'fetching' | 'generating' | 'done' | 'error'>('idle')

  const hasActiveFilter = !!(planCode || acqName || acqYear || au3Code || compType)
  const hasPendingChange = (
    inPlanCode !== planCode || inAcqName !== acqName ||
    inAcqYear !== acqYear   || inAu3Code !== au3Code ||
    inCompType !== compType
  )

  const filter = {
    plan_code: planCode || undefined,
    acquisition_name: acqName || undefined,
    au3_code: au3Code || undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report-parcel-list', filter],
    queryFn: () => parcelApi.list(filter),
    staleTime: 30_000,
  })

  const parcels: GlobalParcel[] = data?.data ?? []
  const totalPages = data?.total_pages ?? 1
  const total = data?.total ?? 0

  // Client-side year filter
  const filtered = acqYear
    ? parcels.filter(p => (p.start_date ?? '').slice(0, 4) === acqYear)
    : parcels

  const handleSearch = () => {
    setPlanCode(inPlanCode)
    setAcqName(inAcqName)
    setAcqYear(inAcqYear)
    setAu3Code(inAu3Code)
    setCompType(inCompType)
    setPage(1)
  }

  const handleReset = () => {
    setInPlanCode(''); setInAcqName(''); setInAcqYear('')
    setInAu3Code(''); setInCompType('')
    setPlanCode(''); setAcqName(''); setAcqYear('')
    setAu3Code(''); setCompType(''); setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // ── Download — query state ашиглана ───────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setDlOpen(true)
    setDlStatus('fetching')
    setDlProgress(0)
    setDlTotal(0)

    const token = authStorage.getAccessToken() ?? ''
    const params = new URLSearchParams()
    if (planCode) params.set('plan_code', planCode)
    if (acqName)  params.set('acquisition_name', acqName)
    if (acqYear)  params.set('year', acqYear)
    if (au3Code)  params.set('au3_code', au3Code)
    if (compType) params.set('compensation_type', compType)
    if (token)    params.set('token', token)

    try {
      const es = new EventSource(`/api/report/download?${params.toString()}`)

      es.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'total') {
          setDlTotal(msg.total)
        } else if (msg.type === 'progress') {
          setDlProgress(msg.current)
        } else if (msg.type === 'generating') {
          setDlStatus('generating')
        } else if (msg.type === 'done') {
          es.close()
          setDlStatus('done')
          const bytes = Uint8Array.from(atob(msg.base64), c => c.charCodeAt(0))
          const blob  = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          const url   = URL.createObjectURL(blob)
          const a     = document.createElement('a')
          a.href = url; a.download = msg.filename ?? 'тайлан.xlsx'; a.click()
          URL.revokeObjectURL(url)
        } else if (msg.type === 'error') {
          es.close()
          setDlStatus('error')
          toast.error(msg.message ?? 'Тайлан үүсгэхэд алдаа гарлаа')
        }
      }

      es.onerror = () => {
        es.close(); setDlStatus('error'); toast.error('Холболт тасарлаа')
      }
    } catch {
      setDlStatus('error')
    }
  }, [planCode, acqName, acqYear, au3Code, compType])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#37394d] shrink-0">
        <div>
          <h1 className="text-[17px] font-bold text-slate-800 dark:text-white">Тайлан</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Бүх чөлөөлөлтийн нэгж талбаруудын мэдээлэл</p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-medium hover:bg-[#00a8b5] transition-colors shadow-sm"
        >
          <Download className="h-4 w-4" />
          Тайлан татах
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-[#37394d] shrink-0">
        <div className="flex flex-wrap gap-2">
          {/* Plan search */}
          <div className="w-64">
            <PlanCombobox
              value={inPlanCode}
              onSelect={p => setInPlanCode(p.plan_code)}
              onClear={() => setInPlanCode('')}
            />
          </div>

          {/* Acquisition name */}
          <div className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all w-56">
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-white placeholder:text-slate-400 outline-none"
              placeholder="Чөлөөлөлтийн нэр..."
              value={inAcqName}
              onChange={e => setInAcqName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {inAcqName && <button onClick={() => setInAcqName('')}><X className="h-3.5 w-3.5 text-slate-400" /></button>}
          </div>

          {/* Year */}
          <div className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all w-32">
            <input
              className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-white placeholder:text-slate-400 outline-none"
              placeholder="Он (2024)..."
              value={inAcqYear}
              maxLength={4}
              onChange={e => setInAcqYear(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
            />
            {inAcqYear && <button onClick={() => setInAcqYear('')}><X className="h-3.5 w-3.5 text-slate-400" /></button>}
          </div>

          {/* Compensation type */}
          <div className="relative">
            <select
              value={inCompType}
              onChange={e => setInCompType(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] pl-3 pr-8 text-[13px] text-slate-700 dark:text-white outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            >
              {Object.entries(COMP_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Хайх товч */}
          <button
            onClick={handleSearch}
            className={cn(
              'flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium transition-colors',
              hasPendingChange
                ? 'bg-[#02c0ce] text-white hover:bg-[#00a8b5]'
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1]',
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Хайх
          </button>

          {/* Цэвэрлэх */}
          {(hasActiveFilter || inPlanCode || inAcqName || inAcqYear || inAu3Code || inCompType) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[13px] text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-xl border border-slate-200 dark:border-[#37394d] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#252630] border-b border-slate-200 dark:border-[#37394d]">
                <th className="px-3 py-3 text-left font-semibold text-slate-500 dark:text-[#97aac1] w-10">№</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 dark:text-[#97aac1]">Нэгж талбарын дугаар</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 dark:text-[#97aac1]">Чөлөөлөлтийн нэр</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 dark:text-[#97aac1]">Төлөвлөгөө</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-500 dark:text-[#97aac1]">Талбай (м²)</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-500 dark:text-[#97aac1]">Чөлөөлөх (м²)</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 dark:text-[#97aac1]">Эрхийн төрөл</th>
                <th className="px-3 py-3 text-center font-semibold text-slate-500 dark:text-[#97aac1]">Нөхөн төлбөр</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#37394d]">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 bg-slate-100 dark:bg-white/[0.06] rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Мэдээлэл олдсонгүй
                  </td>
                </tr>
              ) : filtered.map((p, idx) => {
                const rowNum = (page - 1) * PAGE_SIZE + idx + 1
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 text-slate-400 tabular-nums">{rowNum}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-slate-700 dark:text-slate-200">{p.parcel_id}</td>
                    <td className="px-3 py-3">
                      <p className="text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{p.acquisition_name}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-[11px] text-[#02c0ce] bg-[#02c0ce]/10 px-2 py-0.5 rounded">
                        {p.plan_code}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.area_m2?.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.acquisition_area_m2?.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {RIGHT_TYPE_LABELS[p.right_type] ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {p.compensation_paid
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[11px] font-medium">Төлөгдсөн</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-medium">Хүлээгдэж байна</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-[#37394d] shrink-0">
        <p className="text-[12px] text-slate-400">
          Нийт <span className="font-semibold text-slate-600 dark:text-white">{total}</span> нэгж талбар
        </p>
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 text-[13px] text-slate-600 dark:text-slate-300">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ProgressModal
        open={dlOpen}
        progress={dlProgress}
        total={dlTotal}
        status={dlStatus}
        onClose={() => { setDlOpen(false); setDlStatus('idle') }}
      />
    </div>
  )
}
