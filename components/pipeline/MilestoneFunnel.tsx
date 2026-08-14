import clsx from 'clsx'
import { formatNumber } from '@/lib/dataUtils'
import { SkeletonChart } from '@/components/shared/Skeleton'
import type { PipelineData } from '@/hooks/usePipeline'

interface MilestoneFunnelProps {
  data: PipelineData | null
  loading: boolean
  activeMilestone: string | null
  onSelect: (milestone: string | null) => void
}

export function MilestoneFunnel({ data, loading, activeMilestone, onSelect }: MilestoneFunnelProps) {
  if (loading || !data) return <SkeletonChart height={100} />
  const { funnel } = data
  const max = Math.max(1, ...funnel.map((f) => f.count))

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-ink">Milestone Funnel</h3>
      <div className="space-y-1.5">
        {funnel.map((f, i) => {
          const pct = (f.count / max) * 100
          const t = i / (funnel.length - 1)
          const bg = `rgb(${Math.round(203 - t * (203 - 29))}, ${Math.round(213 - t * (213 - 78))}, ${Math.round(225 - t * (225 - 216))})`
          const active = activeMilestone === f.milestone
          return (
            <button
              key={f.milestone}
              onClick={() => onSelect(active ? null : f.milestone)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-md px-2 py-1 text-left transition-colors',
                active ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-surface-subtle',
              )}
            >
              <span className="w-32 shrink-0 truncate text-xs text-ink-muted">{f.milestone}</span>
              <div className="h-5 flex-1 rounded bg-slate-100">
                <div
                  className="h-5 rounded text-right text-xs leading-5 text-white"
                  style={{ width: `${Math.max(pct, 4)}%`, background: bg }}
                >
                  <span className="pr-2" style={{ color: t > 0.4 ? 'white' : '#0f172a' }}>
                    {formatNumber(f.count)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
