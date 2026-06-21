'use client'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import { STATUS_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import {
  ArrowLeft, MapPin, Info, RefreshCw, FileText, Upload,
  Trash2, Download, ChevronRight, Clock,
  Pencil, Save, X, LayoutList, Paperclip, Activity, Map,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
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

type Tab = 'general' | 'attachments' | 'progress' | 'parcels' | 'map'

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

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ['land-parcels', id, filter],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 100, ...filter }),
  })

  const syncMutation = useMutation({
    mutationFn: (parcelId: string) => landApi.syncParcel(id, parcelId),
    onSuccess: () => {
      toast.success('Синхрончлогдлоо')
      queryClient.invalidateQueries({ queryKey: ['land-parcels', id] })
      queryClient.invalidateQueries({ queryKey: ['parcel-detail'] })
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
            {/* Filter row */}
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
                  {['Дугаар', 'Баг', 'Эрхийн төрөл', 'Газрын зориулалт', 'Талбай', 'Давхцал', 'Нөхөн төлбөр', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                {parcels?.data.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{p.parcel_id}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{p.au3_code}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{RIGHT_TYPE_OPTIONS.find(o => o.value === p.right_type)?.label || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.landuse || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatArea(p.area_m2)}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatArea(p.acquisition_area_m2)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => compensationMutation.mutate({ parcelId: p.id, paid: !p.compensation_paid })}
                        disabled={compensationMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                        style={p.compensation_paid
                          ? { color: '#0acf97', background: '#0acf9718' }
                          : { color: '#94a3b8', background: '#f1f5f9' }}>
                        {p.compensation_paid ? '✓ Төлсөн' : 'Төлөөгүй'}
                      </button>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('general')
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
    { key: 'general',     label: 'Ерөнхий мэдээлэл', icon: <LayoutList className="h-4 w-4" /> },
    { key: 'attachments', label: 'Хавсралт',           icon: <Paperclip className="h-4 w-4" /> },
    { key: 'progress',    label: 'Явц',                icon: <Activity className="h-4 w-4" /> },
    { key: 'parcels',     label: 'Нэгж талбарууд',    icon: <MapPin className="h-4 w-4" /> },
    { key: 'map',         label: 'Байршил',             icon: <Map className="h-4 w-4" /> },
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
      {tab === 'general'     && <GeneralTab     id={id} canEdit={canEdit} />}
      {tab === 'attachments' && <AttachmentsTab id={id} canEdit={canEdit} />}
      {tab === 'progress'    && <ProgressTab    id={id} canEdit={canEdit} />}
      {tab === 'parcels'     && <ParcelsTab     id={id} />}
      {tab === 'map'         && (
        <div className="ap-card p-5">
          <AcquisitionMap acquisitionId={id} aus={acq.aus} />
        </div>
      )}
    </div>
  )
}
