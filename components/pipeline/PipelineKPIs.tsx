import { formatCurrencyCompact, formatNumber } from '@/lib/dataUtils'
import { SkeletonKPI } from '@/components/shared/Skeleton'
import type { PipelineData } from '@/hooks/usePipeline'

export function PipelineKPIs({ data, loading }: { data: PipelineData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
    )
  }

  const { kpis } = data
  const tiles = [
    { label: 'Total Open Loans', value: formatNumber(kpis.totalOpenLoans) },
    { label: 'Total Pipeline Value', value: formatCurrencyCompact(kpis.totalPipelineValue) },
    { label: 'Avg Days in Pipeline', value: Math.round(kpis.avgDaysInPipeline).toString() },
    { label: 'Expected This Month', value: formatNumber(kpis.expectedThisMonth) },
    { label: 'Past Est Close Date', value: formatNumber(kpis.pastEstCloseDate), warn: kpis.pastEstCloseDate > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t.label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${t.warn ? 'text-warning' : 'text-ink'}`}>{t.value}</p>
        </div>
      ))}
    </div>
  )
}
