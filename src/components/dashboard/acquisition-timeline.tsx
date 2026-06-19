'use client'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area,
} from 'recharts'
import { TIMELINE } from './mock-data'

export function AcquisitionTimeline() {
  let sum = 0
  const data = TIMELINE.map(d => { sum += d.count; return { ...d, cumulative: sum } })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 36 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#4680ff" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4680ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }}
          angle={-40} textAnchor="end" interval={0}
          axisLine={{ stroke: '#e2e8f0' }} tickLine={false}
        />
        <YAxis yAxisId="l" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 55]} />
        <YAxis yAxisId="r" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          labelStyle={{ color: '#64748b', fontWeight: 600 }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Bar yAxisId="l" dataKey="count" fill="#4680ff" radius={[4, 4, 0, 0]} barSize={12} name="Нэгж талбар" />
        <Area yAxisId="r" type="monotone" dataKey="cumulative" stroke="#2ca87f" strokeWidth={2} fill="url(#areaGrad)" dot={false} name="Нийт" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
