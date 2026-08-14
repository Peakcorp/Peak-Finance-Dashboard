'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/dataUtils'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ProductionData } from '@/hooks/useProduction'

export function TeamHeatmap({ data, loading }: { data: ProductionData | null; loading: boolean }) {
  const [hover, setHover] = useState<{ lo: string; processor: string } | null>(null)
  const cells = data?.heatmap.cells ?? []

  const cellMap = useMemo(() => {
    const m = new Map<string, { count: number; volume: number }>()
    for (const c of cells) m.set(`${c.lo}|||${c.processor}`, { count: c.count, volume: c.volume })
    return m
  }, [cells])

  if (loading || !data) return <SkeletonTable rows={8} />
  const { los, processors } = data.heatmap
  if (!los.length || !processors.length) return <EmptyState />

  const maxCount = Math.max(1, ...cells.map((c) => c.count))

  return (
    <div className="card overflow-x-auto">
      <h3 className="mb-3 text-sm font-semibold text-ink">LO × Processor Heatmap</h3>
      <table className="text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white py-1 pr-3 text-left font-medium text-ink-faint">Loan Officer</th>
            {processors.map((p) => (
              <th key={p} className="w-20 truncate px-1 py-1 text-center text-xs font-medium text-ink-faint" title={p}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {los.map((lo) => (
            <tr key={lo}>
              <td className="sticky left-0 bg-white py-1 pr-3 font-medium">{lo}</td>
              {processors.map((p) => {
                const cell = cellMap.get(`${lo}|||${p}`)
                const intensity = cell ? cell.count / maxCount : 0
                return (
                  <td
                    key={p}
                    className="relative w-20 cursor-default border border-white text-center text-xs"
                    style={{ background: `rgba(29,78,216,${intensity})`, color: intensity > 0.5 ? 'white' : '#0f172a' }}
                    onMouseEnter={() => setHover({ lo, processor: p })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {cell?.count ?? ''}
                    {hover?.lo === lo && hover?.processor === p && cell && (
                      <div className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-white shadow-lg">
                        {cell.count} files · {formatCurrency(cell.volume)}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
