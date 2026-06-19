import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

export default function MapPage() {
  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Газрын зураг</h2>
        <p className="text-muted-foreground text-sm">GeoServer WMS давхаргууд — давхарга дарж нэмэх/хасах, газрын зургаас мэдээлэл харах</p>
      </div>
      <div className="flex-1 min-h-0 rounded-lg border overflow-hidden shadow-sm" style={{ minHeight: '65vh' }}>
        <MapView />
      </div>
    </div>
  )
}
