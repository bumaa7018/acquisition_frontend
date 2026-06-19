'use client'
import dynamic from 'next/dynamic'
import { Map, Layers, FileText, TrendingUp, Award, Users } from 'lucide-react'
import { ParcelBarChart }      from '@/components/dashboard/parcel-bar-chart'
import { AcquisitionTimeline } from '@/components/dashboard/acquisition-timeline'
import { ProgressGauge }       from '@/components/dashboard/progress-gauge'
import { RejectedList }        from '@/components/dashboard/rejected-list'
import { STATS, STATUSES }     from '@/components/dashboard/mock-data'

const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400 text-sm rounded-xl">
      Газрын зураг ачааллаж байна…
    </div>
  ),
})

/* ── Stat card — typographic hierarchy, no color fill ── */
function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent: string
}) {
  return (
    <div className="ap-card px-5 py-4 flex items-center gap-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${accent}18` }}
      >
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium leading-tight">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-800 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Section card wrapper ── */
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ap-card flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
    </div>
  )
}

/* ── Status dot + row ── */
function StatusRow({ label, count, area, color }: { label: string; count: number; area: number; color: string }) {
  const pct = Math.round((count / STATS.totalParcels) * 100)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 text-[12px] text-slate-600">{label}</span>
      <span className="text-[12px] font-semibold text-slate-800 tabular-nums w-8 text-right">{count}</span>
      <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">

      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Хяналтын самбар</h1>
        <p className="text-[12px] text-slate-500 mt-0.5">
          СХД 5-р хороо — Гэр хорооллын орон сууцжуулах дахин төлөвлөлтийн ажил
        </p>
      </div>

      {/* ── Row 1: Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Төлөвлөлтийн талбай"     value={`${STATS.planArea} га`}          icon={Map}        accent="#4680ff" />
        <StatCard label="Нэгж талбар"              value={STATS.totalParcels}               icon={Layers}     accent="#2ca87f" />
        <StatCard label="Нийт захирамж"            value={STATS.totalOrders}                icon={FileText}   accent="#e58a00" />
        <StatCard label="Чөлөөлсөн талбар"         value={STATS.freedParcels}               icon={TrendingUp} accent="#4680ff" />
        <StatCard label="Чөлөөлсөн га"             value={`${STATS.freedArea} га`} sub="нийт" icon={Award}  accent="#2ca87f" />
        <StatCard label="Нөхөх олговрын дүн"       value={`${STATS.totalCompensation}T`}    icon={Users}      accent="#a855f7" sub="тэрбум төгрөг" />
      </div>

      {/* ── Row 2: Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* Timeline chart */}
        <div className="xl:col-span-8">
          <Card title="Нөхөх олговортойгоор чөлөөлсөн нэгж талбар"
            action={
              <div className="flex gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded bg-[#4680ff]" />Талбар</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-[#2ca87f]" />Нийт</span>
              </div>
            }
          >
            <AcquisitionTimeline />
          </Card>
        </div>

        {/* Progress gauge */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <Card title="Газар чөлөөлтийн явц">
            <ProgressGauge value={STATS.progress} />
          </Card>
        </div>
      </div>

      {/* ── Row 3: Bar charts + Map + Rejected ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* Parcel count bar */}
        <div className="xl:col-span-3">
          <Card title="Нэгж талбарын мэдээлэл">
            <ParcelBarChart mode="count" />
          </Card>
        </div>

        {/* Status breakdown table */}
        <div className="xl:col-span-3">
          <Card title="Талбайн хэмжээ /м²/">
            <div className="mt-1">
              {[...STATUSES].sort((a, b) => b.area - a.area).map(s => (
                <StatusRow key={s.key} label={s.label} count={s.count} area={s.area} color={s.color} />
              ))}
            </div>
          </Card>
        </div>

        {/* Map */}
        <div className="xl:col-span-3">
          <Card title="Газрын зураг">
            <div style={{ height: 280 }}>
              <MapView />
            </div>
          </Card>
        </div>

        {/* Rejected list */}
        <div className="xl:col-span-3">
          <Card title="Татгалзсан нэгж талбарууд">
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              <RejectedList />
            </div>
          </Card>
        </div>
      </div>

    </div>
  )
}
