'use client'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { STATUS_LABELS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { RefreshCw, ArrowLeft, MapPin, Info } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState } from 'react'

const STATUS_CFG: Record<number, { color: string; bg: string }> = {
  1: { color: '#02c0ce', bg: '#02c0ce18' },
  2: { color: '#0acf97', bg: '#0acf9718' },
  3: { color: '#8391a2', bg: '#8391a218' },
  4: { color: '#f1556c', bg: '#f1556c18' },
}

export default function LandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)

  const { data: acq, isLoading } = useQuery({
    queryKey: ['land', id],
    queryFn: () => landApi.getById(id),
  })

  const { data: parcels, isLoading: parcelsLoading } = useQuery({
    queryKey: ['land-parcels', id],
    queryFn: () => landApi.getParcels(id, { page: 1, page_size: 100 }),
    enabled: !!id,
  })

  const { data: parcelDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['parcel-detail', id, selectedParcelId],
    queryFn: () => landApi.getParcel(id, selectedParcelId!),
    enabled: !!selectedParcelId,
  })

  const syncMutation = useMutation({
    mutationFn: (parcelId: string) => landApi.syncParcel(id, parcelId),
    onSuccess: () => {
      toast.success('Мэдээлэл амжилттай шинэчлэгдлээ')
      queryClient.invalidateQueries({ queryKey: ['land-parcels', id] })
    },
    onError: () => toast.error('Синхрончлоход алдаа гарлаа'),
  })

  if (isLoading) return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-100 dark:bg-[#252630]" />
      <div className="h-48 w-full rounded-lg bg-slate-100 dark:bg-[#252630]" />
    </div>
  )
  if (!acq) return (
    <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">Олдсонгүй</div>
  )

  const sc = STATUS_CFG[acq.status] ?? STATUS_CFG[1]

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/acquisition"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-[#37394d] bg-white dark:bg-[#1e1f27] px-3 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#02c0ce] hover:text-[#02c0ce] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Буцах
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">{acq.plan_code}</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Газар чөлөөлөлтийн дэлгэрэнгүй</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Main info */}
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">Үндсэн мэдээлэл</p>
          <div className="space-y-0">
            {([
              ['Статус', (
                <span
                  key="status-badge"
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ color: sc.color, background: sc.bg }}
                >
                  {STATUS_LABELS[acq.status] ?? 'Тодорхойгүй'}
                </span>
              )],
              ['Талбай', formatArea(acq.area_m2)],
              ['Эхлэх огноо', formatDate(acq.start_date)],
              ['Дуусах огноо', formatDate(acq.end_date)],
              ['Үүсгэсэн', formatDate(acq.created_at)],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0">
                <span className="text-[12px] text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin units */}
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4">Захиргааны нэгж</p>
          {acq.aus?.length ? (
            <div className="space-y-2">
              {acq.aus.map(au => (
                <div key={au.au3_code} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-[#252630]">
                  <MapPin className="h-4 w-4 text-[#02c0ce] shrink-0" />
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{au.au3_name}</span>
                  <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 font-mono">{au.au3_code}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500">Мэдээлэл алга</p>
          )}
        </div>
      </div>

      {/* Parcels + detail */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Parcels table */}
        <div className="ap-card overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Нэгж талбарууд</p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">{parcels?.total ?? 0} нэгж талбар — мөр дээр дарж дэлгэрэнгүйг харна уу</p>
          </div>
          {parcelsLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 dark:bg-[#252630]" />)}
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0">
                  <tr className="border-b border-slate-100 dark:border-[#37394d] bg-slate-50/80 dark:bg-[#1a1d20]">
                    {['Дугаар', 'Баг', 'Эрхийн төрөл', 'Талбай', 'Давхцал', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-[#37394d]">
                  {parcels?.data.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedParcelId(p.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedParcelId === p.id
                          ? 'bg-[#02c0ce]/5 border-l-2 border-l-[#02c0ce]'
                          : 'hover:bg-slate-50/60 dark:hover:bg-[#252630]'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{p.parcel_id}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{p.au3_code}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.right_type || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatArea(p.area_m2)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatArea(p.acquisition_area_m2)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={e => { e.stopPropagation(); syncMutation.mutate(p.id) }}
                          disabled={syncMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#0acf97]/10 text-[#0acf97] hover:bg-[#0acf97]/20 px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Sync
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="ap-card p-5">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-white mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-[#02c0ce]" />
            Дэлгэрэнгүй
          </p>
          {!selectedParcelId ? (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-10">Нэгж талбар сонгоно уу</p>
          ) : detailLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(6)].map((_, i) => <div key={i} className="h-9 rounded bg-slate-100 dark:bg-[#252630]" />)}
            </div>
          ) : parcelDetail?.detail ? (
            <div className="space-y-0">
              {([
                ['Эзэмшигч', `${parcelDetail.detail.holder_last_name} ${parcelDetail.detail.holder_name}`],
                ['Регистр', parcelDetail.detail.holder_register_no],
                ['Утас', parcelDetail.detail.holder_phone],
                ['Шийдвэрийн №', parcelDetail.detail.decision_no],
                ['Шийдвэрийн огноо', formatDate(parcelDetail.detail.decision_date)],
                ['Гэрчилгээний №', parcelDetail.detail.certificate_no],
                ['Гэрчилгээний огноо', formatDate(parcelDetail.detail.certificate_date)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="py-2.5 border-b border-slate-100 dark:border-[#37394d] last:border-0">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{k}</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center py-10">Дэлгэрэнгүй мэдээлэл байхгүй. Sync хийнэ үү.</p>
          )}
        </div>
      </div>
    </div>
  )
}
