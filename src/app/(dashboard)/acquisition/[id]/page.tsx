'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { STATUS_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import {
  ArrowLeft, MapPin, Info, RefreshCw, FileText, Upload,
  Trash2, Download, ChevronRight, Clock,
  Pencil, Save, X, LayoutList, Paperclip, Activity, Map,
  Building2, ReceiptText, ChevronDown, ChevronUp, Plus,
} from 'lucide-react'
import type { Compensation } from '@/types'
import { toast } from 'sonner'
import Link from 'next/link'
import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'

const AcquisitionMap = dynamic(
  () => import('@/components/AcquisitionMap').then(m => m.AcquisitionMap),
  { ssr: false, loading: () => <div className="h-[480px] rounded-xl bg-slate-100 dark:bg-[#252630] animate-pulse" /> },
)

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#f59e0b', bg: '#f59e0b18' },
  3: { color: '#0acf97', bg: '#0acf9718' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}


function hasPermission(name: string): boolean {
  const token = authStorage.getAccessToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Array.isArray(payload.permissions) && payload.permissions.includes(name)
  } catch { return false }
}

type Tab = 'general' | 'attachments' | 'progress' | 'parcels' | 'buildings' | 'compensation' | 'map'

const ASSET_TYPE_LABELS: Record<string, string> = {
  parcel: 'Нэгж талбар',
  building: 'Барилга',
  property: 'Эд хөрөнгө',
}
const COMP_TYPE_LABELS: Record<string, string> = {
  cash: 'Мөнгөн дүн',
  land_grant: 'Газрын нөхөн олговор',
}

// ─── General tab ─────────────────────────────────────────────────────────────
function GeneralTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { data: acq } = useQuery({ queryKey: ['land', id], queryFn: () => landApi.getById(id) })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    acquisition_name: '', implementing_org: '', reason: '',
    responsible_org: '', funding_source: '', start_date: '', end_date: '',
  })

  useEffect(() => {
    if (acq) setForm({
      acquisition_name: acq.acquisition_name ?? '',
      implementing_org: acq.implementing_org ?? '',
      reason: acq.reason ?? '',
      responsible_org: acq.responsible_org ?? '',
      funding_source: acq.funding_source ?? '',
      start_date: acq.start_date ?? '',
      end_date: acq.end_date ?? '',
    })
  }, [acq])

  const saveMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      // Огноо — зөвхөн утгатай бол илгээх
      if (form.start_date) fd.append('start_date', form.start_date)
      if (form.end_date) fd.append('end_date', form.end_date)
      else if (acq?.end_date) fd.append('clear_end_date', 'true')
      // Төслийн талбарууд — хоосон ч үргэлж илгээх (Цэвэрлэх боломж)
      fd.append('acquisition_name',     form.acquisition_name)
      fd.append('implementing_org', form.implementing_org)
      fd.append('reason',           form.reason)
      fd.append('responsible_org',  form.responsible_org)
      fd.append('funding_source',   form.funding_source)
      return landApi.update(id, fd)
    },
    onSuccess: () => {
      toast.success('Хадгалагдлаа')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['land', id] })
    },
    onError: () => toast.error('Хадгалахад алдаа гарлаа'),
  })

  if (!acq) return null
  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1]
  const inp = 'h-9 w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'
  const resetForm = () => setForm({
    acquisition_name: acq.acquisition_name ?? '', implementing_org: acq.implementing_org ?? '',
    reason: acq.reason ?? '', responsible_org: acq.responsible_org ?? '',
    funding_source: acq.funding_source ?? '', start_date: acq.start_date ?? '', end_date: acq.end_date ?? '',
  })

  const row = (label: string, value: React.ReactNode, last = false) => (
    <div key={label} className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-slate-100 dark:border-[#37394d]'}`}>
      <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">{label}</span>
      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{value || '—'}</span>
    </div>
  )

  return (
    <div className="ap-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Мэдээлэл</p>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            {!editing
              ? <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold transition-colors hover:text-[#02c0ce]"
                  style={{ color: '#64748b', border: '1px solid #e2e8f0' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#02c0ce'; (e.currentTarget as HTMLButtonElement).style.background = '#02c0ce14' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.background = '' }}>
                  <Pencil className="h-3.5 w-3.5" /> Засах
                </button>
              : <>
                  <button onClick={() => { setEditing(false); resetForm() }}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors">
                    <X className="h-3.5 w-3.5" /> Болих
                  </button>
                  <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold bg-[#02c0ce] text-white hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors">
                    {saveMutation.isPending
                      ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      : <Save className="h-3.5 w-3.5" />}
                    Хадгалах
                  </button>
                </>
            }
          </div>
        )}
      </div>

      {/* Two columns separated by vertical line */}
      <div className="grid md:grid-cols-2">
        {/* Left — Үндсэн мэдээлэл */}
        <div className="px-5 py-4" style={{ borderRight: '1px solid #e2e8f0' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Үндсэн мэдээлэл</p>
          {row('Төлөвлөгөөний дугаар', acq.plan_code)}
          {row('Төлөвлөгөөний нэр', acq.plan_name)}
          {row('Статус', <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: sc.color, background: sc.bg }}>{STATUS_LABELS[acq.status] ?? 'Тодорхойгүй'}</span>)}
          {row('Талбай', formatArea(acq.area_m2))}
          {row('Үүсгэсэн', formatDate(acq.created_at))}
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">Эхлэх огноо</span>
            {editing
              ? <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all" />
              : <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{formatDate(acq.start_date)}</span>
            }
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">Дуусах огноо</span>
            {editing
              ? <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-2 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] transition-all" />
              : <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{acq.end_date ? formatDate(acq.end_date) : '—'}</span>
            }
          </div>
        </div>

        {/* Right — Төслийн мэдээлэл */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Төслийн мэдээлэл</p>
          {([
            ['Төслийн нэр',               'acquisition_name', 'Нэр оруулна уу'],
            ['Хэрэгжүүлэгч байгууллага', 'implementing_org', 'Байгууллагын нэр'],
            ['Хариуцах байгууллага',      'responsible_org',  'Байгууллагын нэр'],
            ['Санхүүжилтийн эх үүсвэр',  'funding_source',   'Улсын төсөв...'],
          ] as [string, keyof typeof form, string][]).map(([label, key, ph]) => (
            <div key={key} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-[#37394d]">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40">{label}</span>
              {editing
                ? <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all" />
                : <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{(form[key] as string) || '—'}</span>
              }
            </div>
          ))}
          <div className="py-2.5">
            <div className="flex items-start gap-3">
              <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0 w-40 pt-1">Чөлөөлөх шалтгаан</span>
              {editing
                ? <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Тайлбар..." className="flex-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none" />
                : <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 flex-1">{form.reason || '—'}</span>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Attachments tab ──────────────────────────────────────────────────────────
function AttachmentsTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['acq-documents', id],
    queryFn: () => landApi.listDocuments(id),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => landApi.uploadDocument(id, file),
    onSuccess: () => {
      toast.success('Баримт бичиг хавсаргагдлаа')
      queryClient.invalidateQueries({ queryKey: ['acq-documents', id] })
    },
    onError: () => toast.error('Файл хавсаргахад алдаа гарлаа'),
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => landApi.deleteDocument(id, docId),
    onSuccess: () => {
      toast.success('Баримт бичиг устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['acq-documents', id] })
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Файлын хэмжээ 10MB-аас хэтрэхгүй байх ёстой'); return }
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="ap-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div>
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Баримт бичгүүд</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Дээд хэмжээ 10MB</p>
        </div>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
            <button onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors">
              {uploadMutation.isPending
                ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <Upload className="h-4 w-4" />}
              Нэмэх
            </button>
          </>
        )}
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-[#252630]" />)}
        </div>
      ) : !docs.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Paperclip className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Баримт бичиг байхгүй</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <a href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canEdit && (
                  <button onClick={() => { if (confirm('Баримт бичиг устгах уу?')) deleteMutation.mutate(doc.id) }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Advance status modal ─────────────────────────────────────────────────────
function AdvanceModal({
  id, availableStatuses, onClose,
}: { id: string; availableStatuses: { id: number; label: string }[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<number | ''>(availableStatuses[0]?.id ?? '')
  const sel = 'w-full h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'

  const advanceMutation = useMutation({
    mutationFn: () => landApi.advanceStatus(id, selectedStatus as number, note),
    onSuccess: () => {
      toast.success('Явц шинэчлэгдлээ')
      queryClient.invalidateQueries({ queryKey: ['land', id] })
      queryClient.invalidateQueries({ queryKey: ['progress', id] })
      queryClient.invalidateQueries({ queryKey: ['available-statuses', id] })
      onClose()
    },
    onError: () => toast.error('Явц шинэчлэхэд алдаа гарлаа'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e1f27] shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[15px] font-bold text-slate-800 dark:text-white">Явц солих</p>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Шилжүүлэх төлөв</p>
            <select value={selectedStatus} onChange={e => setSelectedStatus(Number(e.target.value))} className={sel}>
              {availableStatuses.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-1.5">Тайлбар <span className="text-slate-300 dark:text-slate-600">(заавал биш)</span></p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Шилжүүлэх шалтгаан..."
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors">
              Болих
            </button>
            <button
              onClick={() => advanceMutation.mutate()}
              disabled={!selectedStatus || advanceMutation.isPending}
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 disabled:opacity-50 transition-colors">
              {advanceMutation.isPending
                ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <ChevronRight className="h-4 w-4" />}
              Шилжүүлэх
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Progress tab ─────────────────────────────────────────────────────────────
function ProgressTab({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [showModal, setShowModal] = useState(false)

  const { data: acq } = useQuery({ queryKey: ['land', id], queryFn: () => landApi.getById(id) })
  const { data: progress = [], isLoading } = useQuery({
    queryKey: ['progress', id],
    queryFn: () => landApi.getProgress(id),
  })
  const { data: availableStatuses = [] } = useQuery({
    queryKey: ['available-statuses', id],
    queryFn: () => landApi.getAvailableStatuses(id),
    enabled: canEdit,
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Status card */}
      <div className="ap-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">Одоогийн төлөв</p>
            {acq && (
              <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold"
                style={{ color: STATUS_CFG[acq.status]?.color, background: STATUS_CFG[acq.status]?.bg }}>
                {STATUS_LABELS[acq.status]}
              </span>
            )}
          </div>
          {canEdit && availableStatuses.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#02c0ce] text-white text-[13px] font-semibold hover:bg-[#02c0ce]/90 transition-colors">
              <ChevronRight className="h-4 w-4" /> Явц солих
            </button>
          )}
          {canEdit && availableStatuses.length === 0 && acq && (
            <p className="text-[12px] text-slate-400 dark:text-slate-500">Эцсийн шатанд хүрсэн</p>
          )}
        </div>
      </div>

      {showModal && (
        <AdvanceModal id={id} availableStatuses={availableStatuses} onClose={() => setShowModal(false)} />
      )}

      {/* Progress table */}
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Явцын түүх</p>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : !progress.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <Clock className="h-7 w-7 mb-2 opacity-30" />
            <p className="text-[13px]">Явцын бичлэг байхгүй</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {['#', 'Өмнөх төлөв', 'Шинэ төлөв', 'Тайлбар', 'Хэрэглэгч', 'Огноо'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {progress.map((p, i) => {
                  const from = STATUS_CFG[p.from_status] ?? STATUS_CFG[1]
                  const to   = STATUS_CFG[p.to_status]   ?? STATUS_CFG[1]
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                      <td className="px-4 py-3 text-[12px] font-mono text-slate-400 dark:text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: from.color, background: from.bg }}>
                          {STATUS_LABELS[p.from_status] ?? p.from_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: to.color, background: to.bg }}>
                          {STATUS_LABELS[p.to_status] ?? p.to_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{p.note || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.changed_by}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(p.changed_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const RIGHT_TYPE_OPTIONS = [
  { value: 1, label: 'Ашиглах' },
  { value: 2, label: 'Эзэмших' },
  { value: 3, label: 'Өмчлөх' },
]

// ─── Parcels tab ──────────────────────────────────────────────────────────────
function ParcelsTab({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState({ parcel_id: '', right_type: 0, landuse: '' })
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null)
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null)

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ['land-parcels', id, filter],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 100, ...filter }),
  })

  const { data: allComps = [] } = useQuery({
    queryKey: ['compensations', id],
    queryFn: () => landApi.listCompensations(id),
    enabled: !!id,
  })

  const syncMutation = useMutation({
    mutationFn: (parcelId: string) => landApi.syncParcel(id, parcelId),
    onSuccess: () => {
      toast.success('Синхрончлогдлоо')
      queryClient.invalidateQueries({ queryKey: ['land-parcels', id] })
      window.location.reload()
    },
    onError: () => toast.error('Синхрончлоход алдаа гарлаа'),
  })

  const compensationMutation = useMutation({
    mutationFn: ({ parcelId, paid }: { parcelId: string; paid: boolean }) =>
      landApi.setParcelCompensation(id, parcelId, paid),
    onSuccess: () => {
      toast.success('Нөхөн төлбөрийн төлөв шинэчлэгдлээ')
      queryClient.invalidateQueries({ queryKey: ['land-parcels', id] })
    },
    onError: () => toast.error('Нөхөн төлбөр шинэчлэхэд алдаа гарлаа'),
  })

  const compsByParcel = allComps.reduce<Record<string, Compensation[]>>((acc, c) => {
    ;(acc[c.parcel_id || ''] ??= []).push(c)
    return acc
  }, {})

  const inp = 'h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'

  return (
    <>
      <div className="ap-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Нэгж талбарууд</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{parcels?.total ?? 0} нэгж талбар</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Дугаараар хайх"
                value={filter.parcel_id}
                onChange={e => setFilter(f => ({ ...f, parcel_id: e.target.value }))}
                className={`${inp} w-40`}
              />
              <select
                value={filter.right_type}
                onChange={e => setFilter(f => ({ ...f, right_type: e.target.value ? Number(e.target.value) : 0 }))}
                className={`${inp} w-36`}
              >
                <option value="">Эрхийн төрөл</option>
                {RIGHT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Газрын зориулалт"
                value={filter.landuse}
                onChange={e => setFilter(f => ({ ...f, landuse: e.target.value }))}
                className={`${inp} w-40`}
              />
              {(filter.parcel_id || filter.right_type !== 0 || filter.landuse) && (
                <button
                  onClick={() => setFilter({ parcel_id: '', right_type: 0, landuse: '' })}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] border border-slate-200 dark:border-white/[0.08] transition-colors">
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>
        </div>

        {parcelsLoading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0">
                <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                  {['', 'Дугаар', 'Баг', 'Эрхийн төрөл', 'Газрын зориулалт', 'Талбай', 'Давхцал', 'Нөхөн төлбөр', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parcels?.data.map(p => {
                  const comps = compsByParcel[p.parcel_id] ?? []
                  const isOpen = expandedParcel === p.id
                  const cashAmt = comps.filter(c => c.compensation_type === 'cash').reduce((s, c) => s + c.amount, 0)

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-[#37394d] transition-colors ${isOpen ? 'bg-slate-50/80 dark:bg-[#1a1d20]' : 'hover:bg-slate-50/60 dark:hover:bg-[#252630]'}`}
                      >
                        {/* Expand toggle */}
                        <td className="pl-3 pr-1 py-2.5 w-8">
                          {comps.length > 0 && (
                            <button
                              onClick={() => setExpandedParcel(isOpen ? null : p.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-[#37394d] hover:text-[#02c0ce] transition-colors"
                            >
                              {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{p.parcel_id}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{p.au3_code}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{RIGHT_TYPE_OPTIONS.find(o => o.value === p.right_type)?.label || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.landuse || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatArea(p.area_m2)}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatArea(p.acquisition_area_m2)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => compensationMutation.mutate({ parcelId: p.id, paid: !p.compensation_paid })}
                              disabled={compensationMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                              style={p.compensation_paid
                                ? { color: '#0acf97', background: '#0acf9718' }
                                : { color: '#94a3b8', background: '#f1f5f9' }}>
                              {p.compensation_paid ? '✓ Төлсөн' : 'Төлөөгүй'}
                            </button>
                            {cashAmt > 0 && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {cashAmt.toLocaleString()}₮
                              </span>
                            )}
                            {comps.length > 0 && (
                              <span className="text-[10px] text-slate-400">{comps.length} бүртгэл</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/parcel/${p.id}?acq=${id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20 px-2.5 py-1 text-[11px] font-medium transition-colors">
                              <Info className="h-3 w-3" /> Дэлгэрэнгүй
                            </Link>
                            <button
                              onClick={() => { if (confirm('Нэгж талбарын мэдээлэл дуудах уу?')) syncMutation.mutate(p.id) }}
                              disabled={syncMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#0acf97]/10 text-[#0acf97] hover:bg-[#0acf97]/20 px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 transition-colors">
                              <RefreshCw className="h-3 w-3" /> Sync
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Compensation sub-row ─────────────────────── */}
                      {isOpen && comps.length > 0 && (
                        <tr key={`${p.id}-comp`} className="bg-slate-50/50 dark:bg-[#181a22]">
                          <td colSpan={9} className="px-0 py-0">
                            <div className="border-b border-slate-200 dark:border-[#37394d]">
                              {/* Sub-header */}
                              <div className="flex items-center gap-2 px-8 py-2 border-b border-slate-100 dark:border-[#37394d]">
                                <ReceiptText className="h-3.5 w-3.5 text-[#02c0ce]" />
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#02c0ce]">
                                  Нөхөн төлбөрийн дэлгэрэнгүй
                                </p>
                              </div>

                              {/* Comp rows */}
                              {comps.map(comp => (
                                <div key={comp.id}>
                                  <div className="flex items-center gap-3 px-8 py-2.5 border-b border-slate-100/60 dark:border-[#2a2c38] last:border-0">
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                                      <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                                        {ASSET_TYPE_LABELS[comp.asset_type] ?? comp.asset_type}
                                      </span>
                                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${comp.compensation_type === 'cash' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400'}`}>
                                        {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}
                                      </span>
                                      <span className="text-[12px] text-slate-500 tabular-nums">{comp.coverage_percent}%</span>
                                      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                        {comp.amount.toLocaleString()}₮
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        {comp.compensation_date ? formatDate(comp.compensation_date) : '—'}
                                      </span>
                                    </div>
                                    {comp.grant && (
                                      <button
                                        onClick={() => setExpandedGrant(expandedGrant === comp.id ? null : comp.id)}
                                        className="flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-2 py-1 text-[11px] font-medium transition-colors shrink-0"
                                      >
                                        Газар {expandedGrant === comp.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </button>
                                    )}
                                  </div>
                                  {expandedGrant === comp.id && comp.grant && (
                                    <div className="px-8 py-3 bg-sky-50/60 dark:bg-sky-900/15 border-b border-sky-100 dark:border-sky-800/30">
                                      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2">
                                        {([
                                          ['Дүн', `${comp.grant.amount.toLocaleString()}₮`],
                                          ['Олгосон огноо', comp.grant.grant_date ? formatDate(comp.grant.grant_date) : '—'],
                                          ['Талбай', formatArea(comp.grant.land_area_m2)],
                                          ['Газрын үнэ', `${comp.grant.land_price.toLocaleString()}₮/м²`],
                                          ['Байршил', comp.grant.land_location || '—'],
                                          ['Зориулалт', comp.grant.land_purpose || '—'],
                                          ['Ашиглалтын төрөл', comp.grant.land_use_type || '—'],
                                          ['НТ дугаар', comp.grant.parcel_number || '—'],
                                          ['Тогтоолын дугаар', comp.grant.decree_number || '—'],
                                        ] as [string, string][]).map(([label, value]) => (
                                          <div key={label}>
                                            <p className="text-[10px] text-sky-500">{label}</p>
                                            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{value}</p>
                                          </div>
                                        ))}
                                      </div>
                                      {comp.grant.note && (
                                        <div className="mt-2 pt-2 border-t border-sky-100 dark:border-sky-800/30">
                                          <p className="text-[10px] text-sky-500">Тайлбар</p>
                                          <p className="text-[12px] text-slate-600 dark:text-slate-300">{comp.grant.note}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Parcel compensation totals */}
                              {comps.length > 1 && (
                                <div className="flex items-center gap-6 px-8 py-2 bg-slate-100/60 dark:bg-[#1a1d20]">
                                  {comps.filter(c => c.compensation_type === 'cash').reduce((s, c) => s + c.amount, 0) > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-slate-400">Мөнгөн дүн нийт:</span>
                                      <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        {comps.filter(c => c.compensation_type === 'cash').reduce((s, c) => s + c.amount, 0).toLocaleString()}₮
                                      </span>
                                    </div>
                                  )}
                                  {comps.filter(c => c.compensation_type === 'land_grant').reduce((s, c) => s + c.amount, 0) > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-slate-400">Газрын олговор нийт:</span>
                                      <span className="text-[12px] font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                                        {comps.filter(c => c.compensation_type === 'land_grant').reduce((s, c) => s + c.amount, 0).toLocaleString()}₮
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Buildings tab ────────────────────────────────────────────────────────────
function BuildingsTab({ id }: { id: string }) {
  const [filter, setFilter] = useState({ parcel_id: '' })

  const { data: buildings, isLoading } = useQuery({
    queryKey: ['land-buildings', id, filter],
    queryFn: () => landApi.getBuildings(id, { page: 1, page_size: 100, ...filter }),
  })

  const inp = 'h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f27] px-3 text-[12px] text-slate-800 dark:text-slate-200 outline-none focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all'

  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Барилгын мэдээлэл</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{buildings?.total ?? 0} барилга</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Нэгж талбарын дугаар"
              value={filter.parcel_id}
              onChange={e => setFilter({ parcel_id: e.target.value })}
              className={`${inp} w-48`}
            />
            {filter.parcel_id && (
              <button
                onClick={() => setFilter({ parcel_id: '' })}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-400 hover:bg-slate-100 dark:hover:bg-[#252630] border border-slate-200 dark:border-white/[0.08] transition-colors">
                Цэвэрлэх
              </button>
            )}
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
        </div>
      ) : !buildings?.data.length ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
          <Building2 className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Барилгын мэдээлэл байхгүй</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0">
              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                {['Дугаар', 'Нэгж талбар', 'Төрөл', 'Давхар', 'Талбай', 'Эзэмшигч', 'Хаяг', 'Огноо'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
              {buildings.data.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{b.building_number || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{b.parcel_id}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.building_type || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 tabular-nums">{b.floor_count || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatArea(b.area_m2)}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.owner_name || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 min-w-[180px]">{b.address || b.notes || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(b.updated_at || b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Compensation tab ─────────────────────────────────────────────────────────
function GrantPanel({ grant }: { grant: NonNullable<Compensation['grant']> }) {
  return (
    <div className="mb-3 mx-5 rounded-xl bg-sky-50/70 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-2">Газрын нөхөн олговрын дэлгэрэнгүй</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
        {([
          ['Дүн', `${grant.amount.toLocaleString()}₮`],
          ['Олгосон огноо', grant.grant_date ? formatDate(grant.grant_date) : '—'],
          ['Талбай', formatArea(grant.land_area_m2)],
          ['Газрын үнэ', `${grant.land_price.toLocaleString()}₮/м²`],
          ['Байршил', grant.land_location || '—'],
          ['Зориулалт', grant.land_purpose || '—'],
          ['Ашиглалтын төрөл', grant.land_use_type || '—'],
          ['НТ дугаар', grant.parcel_number || '—'],
          ['Тогтоолын дугаар', grant.decree_number || '—'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] text-sky-500">{label}</p>
            <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{value}</p>
          </div>
        ))}
      </div>
      {grant.note && (
        <div className="mt-2 pt-2 border-t border-sky-100 dark:border-sky-800/30">
          <p className="text-[10px] text-sky-500">Тайлбар</p>
          <p className="text-[12px] text-slate-600 dark:text-slate-300">{grant.note}</p>
        </div>
      )}
    </div>
  )
}

function CompensationTab({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [expandedParcels, setExpandedParcels] = useState<Set<string>>(new Set())
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null)

  const { data: parcelsResult, isLoading: parcelsLoading } = useQuery({
    queryKey: ['land-parcels', id, { page: 1, page_size: 1000 }],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 1000 }),
    enabled: !!id,
  })
  const { data: allComps = [], isLoading: compsLoading } = useQuery({
    queryKey: ['compensations', id],
    queryFn: () => landApi.listCompensations(id),
    enabled: !!id,
  })
  const { data: buildingsResult } = useQuery({
    queryKey: ['land-buildings', id, { page: 1, page_size: 1000 }],
    queryFn: () => landApi.getBuildings(id, { page: 1, page_size: 1000 }),
    enabled: !!id,
  })

  const parcels = parcelsResult?.data ?? []
  const allBuildings = buildingsResult?.data ?? []

  const compsByParcel = allComps.reduce<Record<string, Compensation[]>>((acc, c) => {
    const k = c.parcel_id || ''
    ;(acc[k] ??= []).push(c)
    return acc
  }, {})
  const buildingsByParcel = allBuildings.reduce<Record<string, typeof allBuildings>>((acc, b) => {
    ;(acc[b.parcel_id] ??= []).push(b)
    return acc
  }, {})

  const toggleParcel = (pid: string) =>
    setExpandedParcels(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })

  const deleteMutation = useMutation({
    mutationFn: (compId: string) => landApi.deleteCompensation(id, compId),
    onSuccess: () => {
      toast.success('Нөхөн төлбөр устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['compensations', id] })
    },
    onError: () => toast.error('Устгахад алдаа гарлаа'),
  })

  const activeParcels = parcels.filter(
    p => (compsByParcel[p.parcel_id]?.length ?? 0) > 0 || (buildingsByParcel[p.parcel_id]?.length ?? 0) > 0,
  )
  const cashTotal = allComps.filter(c => c.compensation_type === 'cash').reduce((s, c) => s + c.amount, 0)
  const landGrantTotal = allComps.filter(c => c.compensation_type === 'land_grant').reduce((s, c) => s + c.amount, 0)
  const isLoading = parcelsLoading || compsLoading

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          ['Нийт бүртгэл', allComps.length, '#02c0ce'],
          ['Мөнгөн дүн', cashTotal > 0 ? `${cashTotal.toLocaleString()}₮` : '—', '#0acf97'],
          ['Газрын олговор', allComps.filter(c => c.compensation_type === 'land_grant').length, '#6366f1'],
          ['Барилга', allComps.filter(c => c.asset_type === 'building').length, '#f59e0b'],
        ] as [string, string | number, string][]).map(([label, value, color]) => (
          <div key={label} className="ap-card px-5 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
              <ReceiptText className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium truncate">{label}</p>
              <p className="text-[18px] font-bold tabular-nums text-slate-800 dark:text-white truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="ap-card h-16 animate-pulse bg-slate-100 dark:bg-[#252630]" />
          ))}
        </div>
      ) : activeParcels.length === 0 ? (
        <div className="ap-card flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <ReceiptText className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-[13px]">Нөхөн төлбөрийн бүртгэл байхгүй</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeParcels.map(parcel => {
            const comps = compsByParcel[parcel.parcel_id] ?? []
            const buildings = buildingsByParcel[parcel.parcel_id] ?? []
            const isOpen = expandedParcels.has(parcel.id)
            const parcelCash = comps.filter(c => c.compensation_type === 'cash').reduce((s, c) => s + c.amount, 0)
            const parcelGrant = comps.filter(c => c.compensation_type === 'land_grant').reduce((s, c) => s + c.amount, 0)

            return (
              <div key={parcel.id} className="ap-card overflow-hidden">
                {/* Parcel header accordion */}
                <button
                  onClick={() => toggleParcel(parcel.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-[#252630] transition-colors text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#02c0ce]/10">
                    <MapPin className="h-4 w-4 text-[#02c0ce]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-[13px] font-semibold text-slate-800 dark:text-white">{parcel.parcel_id}</span>
                      <span className="text-[11px] text-slate-400">{parcel.au3_code}</span>
                      {comps.length > 0 && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <ReceiptText className="h-3 w-3" />{comps.length} нөхөн төлбөр
                        </span>
                      )}
                      {buildings.length > 0 && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{buildings.length} барилга
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {parcelCash > 0 && (
                        <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">{parcelCash.toLocaleString()}₮</span>
                      )}
                      {parcelGrant > 0 && (
                        <span className="text-[12px] font-semibold text-sky-600 dark:text-sky-400">{parcelGrant.toLocaleString()}₮ (газар)</span>
                      )}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${parcel.compensation_paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400'}`}>
                        {parcel.compensation_paid ? '✓ Төлсөн' : 'Төлөөгүй'}
                      </span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-[#37394d]">

                    {/* ── Compensations ─────────────────────────────── */}
                    {comps.length > 0 && (
                      <>
                        <div className="px-5 py-2 bg-slate-50/80 dark:bg-[#1a1d20] flex items-center gap-2">
                          <ReceiptText className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Нөхөн төлбөр</p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-[#37394d]">
                          {comps.map(comp => (
                            <div key={comp.id}>
                              <div className="flex items-center gap-3 px-5 py-3">
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                    {ASSET_TYPE_LABELS[comp.asset_type] ?? comp.asset_type}
                                  </span>
                                  <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${comp.compensation_type === 'cash' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400'}`}>
                                    {COMP_TYPE_LABELS[comp.compensation_type] ?? comp.compensation_type}
                                  </span>
                                  <span className="text-[13px] text-slate-500 dark:text-slate-400 tabular-nums">{comp.coverage_percent}%</span>
                                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{comp.amount.toLocaleString()}₮</span>
                                  <span className="text-[12px] text-slate-400">{comp.compensation_date ? formatDate(comp.compensation_date) : '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {comp.grant && (
                                    <button
                                      onClick={() => setExpandedGrant(expandedGrant === comp.id ? null : comp.id)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                                      title="Газрын олговрын дэлгэрэнгүй"
                                    >
                                      {expandedGrant === comp.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { if (confirm('Нөхөн төлбөр устгах уу?')) deleteMutation.mutate(comp.id) }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {expandedGrant === comp.id && comp.grant && (
                                <GrantPanel grant={comp.grant} />
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── Buildings ──────────────────────────────────── */}
                    {buildings.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-[#37394d]">
                        <div className="px-5 py-2 bg-slate-50/80 dark:bg-[#1a1d20] flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Барилга</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/50 dark:bg-[#1a1d20]">
                                {['Дугаар', 'Төрөл', 'Давхар', 'Талбай', 'Эзэмшигч', 'Хаяг'].map(h => (
                                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                              {buildings.map(b => (
                                <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                                  <td className="px-4 py-2.5 font-mono font-medium text-slate-700 dark:text-slate-200">{b.building_number || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.building_type || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-500 tabular-nums">{b.floor_count || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatArea(b.area_m2)}</td>
                                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{b.owner_name || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-500 min-w-[160px]">{b.address || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Grand totals */}
      {allComps.length > 0 && (
        <div className="ap-card px-5 divide-y divide-slate-100 dark:divide-[#37394d]">
          {cashTotal > 0 && (
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Нийт мөнгөн дүн</span>
              <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{cashTotal.toLocaleString()}₮</span>
            </div>
          )}
          {landGrantTotal > 0 && (
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-slate-500 dark:text-slate-400">Нийт газрын нөхөн олговор</span>
              <span className="text-[15px] font-bold text-sky-600 dark:text-sky-400 tabular-nums">{landGrantTotal.toLocaleString()}₮</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) ?? 'general'
  const [tab, setTab] = useState<Tab>(initialTab)
  const canEdit = hasPermission('acquisition.create')

  const { data: acq, isLoading } = useQuery({
    queryKey: ['land', id],
    queryFn: () => landApi.getById(id),
  })


  if (isLoading) return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
      <div className="h-12 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
      <div className="h-64 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
    </div>
  )
  if (!acq) return <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">Олдсонгүй</div>

  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1]

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'general',      label: 'Ерөнхий мэдээлэл', icon: <LayoutList className="h-4 w-4" /> },
    { key: 'attachments',  label: 'Хавсралт',          icon: <Paperclip className="h-4 w-4" /> },
    { key: 'progress',     label: 'Явц',               icon: <Activity className="h-4 w-4" /> },
    { key: 'parcels',      label: 'Нэгж талбарууд',   icon: <MapPin className="h-4 w-4" /> },
    { key: 'buildings',    label: 'Барилга',           icon: <Building2 className="h-4 w-4" /> },
    { key: 'compensation', label: 'Нөхөн төлбөр',     icon: <ReceiptText className="h-4 w-4" /> },
    { key: 'map',          label: 'Байршил',            icon: <Map className="h-4 w-4" /> },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/acquisition"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Буцах
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{acq.acquisition_name || acq.plan_code}</h1>
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: sc.color, background: sc.bg }}>
              {STATUS_LABELS[acq.status] ?? 'Тодорхойгүй'}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{acq.plan_code}{acq.plan_name ? ` · ${acq.plan_name}` : ''}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="ap-card flex items-stretch overflow-x-auto divide-x divide-slate-100 dark:divide-[#37394d]">
        {TABS.map((t, i) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-6 py-3.5 min-w-[100px] whitespace-nowrap transition-all select-none
                ${active
                  ? 'text-[#02c0ce] bg-[#02c0ce]/5 dark:bg-[#02c0ce]/10'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630]'
                }`}
            >
              {/* active indicator — top border */}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-0.5 rounded-b-full bg-[#02c0ce]" />
              )}
              <span className={`transition-colors ${active ? 'text-[#02c0ce]' : 'text-slate-400 dark:text-slate-500'}`}>
                {t.icon}
              </span>
              <span className={`text-[11.5px] font-semibold tracking-wide transition-colors ${active ? 'text-[#02c0ce]' : ''}`}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'general'      && <GeneralTab      id={id} canEdit={canEdit} />}
      {tab === 'attachments'  && <AttachmentsTab  id={id} canEdit={canEdit} />}
      {tab === 'progress'     && <ProgressTab     id={id} canEdit={canEdit} />}
      {tab === 'parcels'      && <ParcelsTab      id={id} />}
      {tab === 'buildings'    && <BuildingsTab    id={id} />}
      {tab === 'compensation' && <CompensationTab id={id} />}
      {tab === 'map'          && (
        <div className="ap-card p-5">
          <AcquisitionMap acquisitionId={id} aus={acq.aus} />
        </div>
      )}
    </div>
  )
}
