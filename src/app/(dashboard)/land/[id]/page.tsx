'use client'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { RefreshCw, ArrowLeft, MapPin, Info } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState } from 'react'

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
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
  if (!acq) return <div className="text-center py-20 text-muted-foreground">Олдсонгүй</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/land">
          <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Буцах</Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{acq.plan_code}</h2>
          <p className="text-muted-foreground text-sm">Газар чөлөөлөлтийн дэлгэрэнгүй</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Үндсэн мэдээлэл</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {[
              ['Статус', <Badge key="s" className={STATUS_COLORS[acq.status]}>{STATUS_LABELS[acq.status]}</Badge>],
              ['Талбай', formatArea(acq.area_m2)],
              ['Эхлэх огноо', formatDate(acq.start_date)],
              ['Дуусах огноо', formatDate(acq.end_date)],
              ['Үүсгэсэн', formatDate(acq.created_at)],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Захиргааны нэгж</CardTitle></CardHeader>
          <CardContent>
            {acq.aus?.length ? (
              <div className="space-y-2">
                {acq.aus.map(au => (
                  <div key={au.au3_code} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{au.au3_name}</span>
                    <span className="text-xs text-muted-foreground">({au.au3_code})</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Мэдээлэл алга</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Нэгж талбарууд</CardTitle>
            <CardDescription>{parcels?.total ?? 0} нэгж талбар — мөр дээр дарж дэлгэрэнгүйг харна уу</CardDescription>
          </CardHeader>
          <CardContent>
            {parcelsLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0 border-b">
                    <tr>
                      {['Дугаар', 'Баг', 'Эрхийн төрөл', 'Талбай', 'Давхцал', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parcels?.data.map(p => (
                      <tr
                        key={p.id}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedParcelId === p.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                        onClick={() => setSelectedParcelId(p.id)}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-medium">{p.parcel_id}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{p.au3_code}</td>
                        <td className="px-3 py-2.5">{p.right_type || '—'}</td>
                        <td className="px-3 py-2.5">{formatArea(p.area_m2)}</td>
                        <td className="px-3 py-2.5">{formatArea(p.acquisition_area_m2)}</td>
                        <td className="px-3 py-2.5">
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs gap-1"
                            onClick={e => { e.stopPropagation(); syncMutation.mutate(p.id) }}
                            disabled={syncMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3" />Sync
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-4 w-4" />Дэлгэрэнгүй</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedParcelId ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нэгж талбар сонгоно уу</p>
            ) : detailLoading ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : parcelDetail?.detail ? (
              <div className="space-y-2 text-sm">
                {[
                  ['Эзэмшигч', `${parcelDetail.detail.holder_last_name} ${parcelDetail.detail.holder_name}`],
                  ['Регистр', parcelDetail.detail.holder_register_no],
                  ['Утас', parcelDetail.detail.holder_phone],
                  ['Шийдвэрийн №', parcelDetail.detail.decision_no],
                  ['Шийдвэрийн огноо', formatDate(parcelDetail.detail.decision_date)],
                  ['Гэрчилгээний №', parcelDetail.detail.certificate_no],
                  ['Гэрчилгээний огноо', formatDate(parcelDetail.detail.certificate_date)],
                ].map(([k, v]) => (
                  <div key={String(k)} className="pb-2 border-b last:border-0">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium mt-0.5">{v || '—'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Дэлгэрэнгүй мэдээлэл байхгүй. Sync хийнэ үү.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
