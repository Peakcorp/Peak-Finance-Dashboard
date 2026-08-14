import clsx from 'clsx'
import { formatCurrencyCompact, formatNumber, formatPercent } from '@/lib/dataUtils'
import { SkeletonKPI } from '@/components/shared/Skeleton'
import type { DashboardData } from '@/hooks/useDashboard'

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={clsx('text-xs font-medium', positive ? 'text-success' : 'text-danger')}>
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function KPITiles({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
    )
  }

  const { kpis } = data
  const tiles = [
    { label: 'Total Files Closed', value: formatNumber(kpis.totalFiles), delta: kpis.totalFilesDelta },
    { label: 'Total Volume', value: formatCurrencyCompact(kpis.totalVolume), delta: kpis.totalVolumeDelta },
    { label: 'Avg Loan Size', value: formatCurrencyCompact(kpis.avgLoanSize) },
    { label: 'Avg Interest Rate', value: formatPercent(kpis.avgInterestRate) },
    { label: 'Active Pipeline', value: formatNumber(kpis.activePipeline) },
    { label: 'Peak Month', value: kpis.peakMonth ? `${kpis.peakMonth.month}` : '—', sub: kpis.peakMonth ? `${kpis.peakMonth.count} files` : undefined },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{tile.label}</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{tile.value}</span>
            {'delta' in tile && tile.delta !== undefined && <DeltaBadge value={tile.delta} />}
          </div>
          {tile.sub && <p className="mt-0.5 text-xs text-ink-faint">{tile.sub}</p>}
        </div>
      ))}
    </div>
  )
}
