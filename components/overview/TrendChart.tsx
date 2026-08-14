'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'
import { formatCurrencyCompact, formatNumber, type Granularity } from '@/lib/dataUtils'
import { SkeletonChart } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TrendPoint } from '@/hooks/useDashboard'

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function TrendChart({ refreshKey }: { refreshKey: number }) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [granularity, setGranularity] = useState<Granularity | null>(null)
  const [points, setPoints] = useState<TrendPoint[] | null>(null)
  const [autoGranularity, setAutoGranularity] = useState<Granularity>('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    if (granularity) params.set('granularity', granularity)
    fetch(`/api/dashboard?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.trend) {
          setPoints(json.trend.points)
          setAutoGranularity(json.trend.granularity)
        }
      })
      .finally(() => setLoading(false))
  }, [filters, hydrated, refreshKey, granularity])

  const activeGranularity = granularity ?? autoGranularity

  if (loading || points === null) return <SkeletonChart height={300} />
  if (points.length === 0) return <EmptyState />

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Closings &amp; Volume Over Time</h3>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className={clsx(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                activeGranularity === g.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatNumber(v)} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrencyCompact(v)} />
          <Tooltip
            formatter={(value: number, name: string) => (name === 'Volume' ? formatCurrencyCompact(value) : formatNumber(value))}
          />
          <Bar yAxisId="left" dataKey="files" name="Files" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" dataKey="volume" name="Volume" stroke="#1d4ed8" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
