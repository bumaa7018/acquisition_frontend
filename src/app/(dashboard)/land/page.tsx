'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { landApi } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import { formatDate, formatArea } from '@/lib/utils'
import { Search, Trash2, Eye, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function LandPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const pageSize = 15
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['land', page, search],
    queryFn: () => landApi.list({ page, page_size: pageSize, plan_code: search || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => landApi.delete(id),
    onSuccess: () => {
      toast.success('Чөлөөлөлт устгагдлаа')
      queryClient.invalidateQueries({ queryKey: ['land'] })
    },
    onError: () => toast.error('Устгах боломжгүй (зөвхөн NEW статустай)'),
  })

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Газар чөлөөлөлт</h2>
        <p className="text-muted-foreground">Нийт {data?.total ?? 0} чөлөөлөлт</p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Төлөвлөгөөний дугаараар хайх..."
              className="pl-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {['Төлөвлөгөөний дугаар', 'Статус', 'Талбай', 'Эхлэх', 'Дуусах', 'Нэгж талбар', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data?.data.map(land => (
                      <tr key={land.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{land.plan_code}</p>
                          <p className="text-xs text-muted-foreground font-mono">{land.id.slice(0, 8)}…</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_COLORS[land.status]}>{STATUS_LABELS[land.status]}</Badge>
                        </td>
                        <td className="px-4 py-3">{formatArea(land.area_m2)}</td>
                        <td className="px-4 py-3">{formatDate(land.start_date)}</td>
                        <td className="px-4 py-3">{formatDate(land.end_date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />{land.parcels?.length ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link href={`/land/${land.id}`}>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { if (confirm('Устгах уу?')) deleteMutation.mutate(land.id) }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data?.total ?? 0)} / {data?.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">{page} / {totalPages}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
