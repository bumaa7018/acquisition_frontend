import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-[#252630]" />
  ),
})

export default function MapPage() {
  return (
    <div className="flex flex-col h-full gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Газрын зураг</h1>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
          GeoServer WMS давхаргууд — давхарга дарж нэмэх/хасах, газрын зургаас мэдээлэл харах
        </p>
      </div>
      <div
        className="ap-card flex-1 min-h-0 overflow-hidden"
        style={{ minHeight: '65vh' }}
      >
        <MapView />
      </div>
    </div>
  )
}
