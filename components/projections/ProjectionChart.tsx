'use client'

import { useState } from 'react'
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { formatNumber } from '@/lib/dataUtils'
import { SkeletonChart } from '@/components/shared/Skeleton'
import type { ActualsVsProjectedPoint } from '@/lib/projectionUtils'

interface ProjectionChartProps {
  points: ActualsVsProjectedPoint[] | null
  loading: boolean
  onBarClick?: (month: string) => void
}

export function ProjectionChart({ points, loading, onBarClick }: ProjectionChartProps) {
  const [selected, setSelected] = useState<string | null>(null)

  if (loading || !points) return <SkeletonChart height={320} />

  const chartData = points.map((p) => ({
    ...p,
    bar: p.isPast ? p.actualFiles : p.projectedFiles,
  }))

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-ink">Projected vs Actuals</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
          onClick={(e) => {
            const label = e?.activeLabel as string | undefined
            if (!label) return
            setSelected(label)
            onBarClick?.(chartData.find((d) => d.label === label)?.month ?? '')
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatNumber(v)} />
          <Tooltip formatter={(v: number) => formatNumber(v)} />
          <Bar dataKey="bar" name="Files" radius={[4, 4, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isPast ? '#3b82f6' : '#93c5fd'} fillOpacity={d.isPast ? 1 : 0.7} stroke={d.isPast ? undefined : '#3b82f6'} strokeDasharray={d.isPast ? undefined : '3 3'} />
            ))}
          </Bar>
          <Line dataKey="actualsRollingAvg" name="Actuals 3mo Avg" stroke="#1d4ed8" strokeWidth={2} dot={false} />
          <Line dataKey="projectedRollingAvg" name="Projected 3mo Avg" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-ink-faint">Solid bars = actual closings · striped bars = projected · click a bar to see its loan list</p>
      {selected && <p className="mt-1 text-xs text-brand-700">Selected: {selected} (see Month Cards above for the loan list)</p>}
    </div>
  )
}
