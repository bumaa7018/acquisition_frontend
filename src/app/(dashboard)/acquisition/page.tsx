'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { landApi, planApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { STATUS_LABELS } from '@/types'
import type { Plan } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Search, Trash2, Eye, MapPin, ChevronLeft, ChevronRight,
  FileText, Plus, X, Upload, CheckCircle, ArrowLeft, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#0acf97', bg: '#0acf9718' },
  3: { color: '#8391a2', bg: '#8391a218' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}

const PAGE_SIZE = 15

function hasPermission(name: string): boolean {
  const token = authStorage.getAccessToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Array.isArray(payload.permissions) && payload.permissions.includes(name)
  } catch {
    return false
  }
}

// ── Plan combobox ─────────────────────────────────────────────────────────────
function PlanCombobox({ onSelect }: { onSelect: (plan: Plan) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data: plans = [], isFetching } = useQuery({
    queryKey: ['plan-suggest', query],
    queryFn: () => planApi.suggest(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  })

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 gap-1.5 cursor-text focus-within:border-[#02c0ce] focus-within:ring-2 focus-within:ring-[#02c0ce]/15 transition-all"
        onClick={() => setOpen(true)}
      >
        <input
          type="text"
          placeholder="Дугаар эсвэл нэрээр хайх..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 text-[13px] text-slate-800 dark:text-slate-200 bg-transparent outline-none"
          autoFocus
        />
        {isFetching
          ? <span className="h-3.5 w-3.5 rounded-full border-2 border-[#02c0ce] border-t-transparent animate-spin shrink-0" />
          : query
            ? <button onMouseDown={e => { e.preventDefault(); setQuery(''); setOpen(false) }} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        }
      </div>

      {open && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {plans.length === 0 && !isFetching ? (
              <div className="px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500">Олдсонгүй</div>
            ) : plans.map(p => (
              <button
                key={p.plan_code}
                onMouseDown={e => { e.preventDefault(); onSelect(p); setOpen(false) }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors border-b border-slate-50 dark:border-[#252630] last:border-0"
              >
                <span className="text-[12px] font-mono font-semibold text-[#02c0ce] shrink-0">{p.plan_code}</span>
                <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate text-right">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
}

function CreateModal({ onClose }: CreateModalProps) {
  const queryClient = useQueryClient()

  // Step 1: plan select
  const [plan, setPlan] = useState<Plan | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  // Step 2: form fields
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [implementingOrg, setImplementingOrg] = useState('')
  const [reason, setReason] = useState('')
  const [responsibleOrg, setResponsibleOrg] = useState('')
  const [fundingSource, setFundingSource] = useState('')
  const [shpFile, setShpFile] = useState<File | null>(null)

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => landApi.create(fd),
    onSuccess: (acq) => {
      toast.success('Чөлөөлөлт амжилттай бүртгэгдлээ')
      if (acq.aus?.length) {
        const auNames = acq.aus.map(a => a.au3_code).join(', ')
        toast.info(`Огтлолцох баг: ${auNames}`)
      }
      queryClient.invalidateQueries({ queryKey: ['land'] })
      onClose()
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : undefined
      toast.error(msg || 'Бүртгэх үед алдаа гарлаа')
    },
  })

  const handleSubmit = () => {
    if (!plan || !shpFile || !startDate || !projectName.trim()) {
      toast.error('Бүх заавал талбаруудыг бөглөнө үү')
      return
    }
    const fd = new FormData()
    fd.append('plan_code', plan.plan_code)
    fd.append('start_date', startDate)
    fd.append('end_date', endDate)
    fd.append('acquisition_name', projectName)
    fd.append('implementing_org', implementingOrg)
    fd.append('reason', reason)
    fd.append('responsible_org', responsibleOrg)
    fd.append('funding_source', fundingSource)
    fd.append('shapefile', shpFile)
    createMutation.mutate(fd)
  }

  const inputCls = 'h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'
  const labelCls = 'block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1e1f27] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setPlan(null) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-[15px] font-bold text-slate-800 dark:text-white">Газар чөлөөлөлт нэмэх</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {step === 1 ? 'Алхам 1/2 — Төлөвлөгөө хайх' : 'Алхам 2/2 — Мэдээлэл бөглөх'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map(s => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: step >= s ? '#02c0ce' : '#e2e8f0' }}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Газар зохион байгуулалтын төлөвлөгөөний дугаар эсвэл нэрийг бичиж сонгоно уу.
              </p>
              <div>
                <label className={labelCls}>Төлөвлөгөө *</label>
                <PlanCombobox
                  onSelect={p => { setPlan(p); setStep(2) }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Plan info card */}
              {plan && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#02c0ce]/8 dark:bg-[#02c0ce]/10 border border-solid border-[#02c0ce]/20">
                  <CheckCircle className="h-4 w-4 text-[#02c0ce] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#02c0ce]">{plan.plan_code}</p>
                    {plan.name && (
                      <p className="text-[12px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{plan.name}</p>
                    )}
                    {(plan.area_m2 ?? 0) > 0 && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatArea(plan.area_m2 ?? 0)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Form fields */}
              <div>
                <label className={labelCls}>Чөлөөлөлтийн нэр *</label>
                <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Чөлөөлөлтийн нэр оруулна уу" className={inputCls} autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Эхлэх огноо *</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Дуусах огноо</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Хэрэгжүүлэгч байгууллага</label>
                <input value={implementingOrg} onChange={e => setImplementingOrg(e.target.value)} placeholder="Байгууллагын нэр" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Хариуцах байгууллага</label>
                <input value={responsibleOrg} onChange={e => setResponsibleOrg(e.target.value)} placeholder="Байгууллагын нэр" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Санхүүжилтийн эх үүсвэр</label>
                <input value={fundingSource} onChange={e => setFundingSource(e.target.value)} placeholder="Улсын төсөв / Гадаадын зээл..." className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Чөлөөлөх шалтгаан</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Чөлөөлөх шалтгааны тайлбар..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
                />
              </div>

              {/* Shapefile upload */}
              <div>
                <label className={labelCls}>Хил хязгаарын файл (.shp zip) *</label>
                <label className={cn(
                  'flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  shpFile
                    ? 'border-[#02c0ce] bg-[#02c0ce]/5'
                    : 'border-slate-200 dark:border-white/[0.08] hover:border-[#02c0ce]/50 hover:bg-[#02c0ce]/5'
                )}>
                  <input
                    type="file"
                    accept=".zip,.shp"
                    className="hidden"
                    onChange={e => setShpFile(e.target.files?.[0] ?? null)}
                  />
                  {shpFile ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-[#02c0ce]" />
                      <span className="text-[12px] font-medium text-[#02c0ce] truncate max-w-[240px]">{shpFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      <span className="text-[12px] text-slate-400 dark:text-slate-500">Файл сонгоно уу</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            Цуцлах
          </button>
          {step === 1 ? null : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !shpFile || !startDate || !projectName.trim()}
              className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {createMutation.isPending && (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              Бүртгэх
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LandPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const canCreate = hasPermission('acquisition.create')

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
  const HEADERS = ['Төлөвлөгөө', 'Чөлөөлөлтийн нэр', 'Статус', 'Талбай', 'Эхлэх', 'Нэгж талбар', '']

  return (
    <div className="flex flex-col gap-5">

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Газар чөлөөлөлт</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Нийт {total} чөлөөлөлтийн бүртгэл</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Нэмэх
          </button>
        )}
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
              className="h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] pl-9 pr-9 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p className="font-semibold text-[#02c0ce] truncate">{land.plan_code}</p>
                      {land.plan_name
                        ? <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">{land.plan_name}</p>
                        : <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">—</p>
                      }
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {land.acquisition_name
                        ? <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate">{land.acquisition_name}</p>
                        : <p className="text-[13px] text-slate-400 dark:text-slate-500">—</p>
                      }
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
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {land.parcel_count ?? 0}
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
