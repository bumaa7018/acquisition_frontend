'use client'

interface Props { value: number }

export function ProgressGauge({ value }: Props) {
  const r = 64, cx = 90, cy = 80
  const startAngle = Math.PI
  const filled     = (value / 100) * Math.PI

  const pt = (angle: number, radius = r) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  })

  const bg0 = pt(startAngle)
  const bg1 = pt(startAngle + Math.PI - 0.001)
  const fg1 = pt(startAngle + filled)
  const arc = (s: typeof bg0, e: typeof bg0, large: boolean, stroke: string, w: number) =>
    <path d={`M${s.x} ${s.y} A${r} ${r} 0 ${large ? 1 : 0} 1 ${e.x} ${e.y}`}
      stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="round" />

  const color = value >= 80 ? '#0acf97' : value >= 50 ? '#f9bc0b' : '#f1556c'

  return (
    <div className="flex flex-col items-center py-2">
      <svg width="180" height="105" viewBox="0 0 180 105">
        {arc(bg0, bg1, true,  '#e2e8f0', 12)}
        {value > 0 && arc(bg0, fg1, filled > Math.PI / 2, color, 12)}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color}
          fontSize={34} fontWeight={800} fontFamily="Inter, sans-serif">
          {value}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={12}>%</text>
        <text x={20}  y={cy + 22} textAnchor="middle" fill="#cbd5e1" fontSize={10}>0%</text>
        <text x={160} y={cy + 22} textAnchor="middle" fill="#cbd5e1" fontSize={10}>100%</text>
      </svg>
      <p className="text-xs text-slate-400 -mt-1">Шинэчлэгдсэн: 4 мин өмнө</p>
    </div>
  )
}
