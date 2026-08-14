'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DashboardData } from '@/hooks/useDashboard'

type SortKey = 'files' | 'volume' | 'avgLoan' | 'pctOfTotal'

export function StateTable({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('files')
  const [desc, setDesc] = useState(true)

  const rows = data?.states ?? []
  const maxFiles = useMemo(() => Math.max(1, ...rows.map((r) => r.files)), [rows])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]))
  }, [rows, sortKey, desc])

  if (loading || !data) return <SkeletonTable />
  if (rows.length === 0) return <EmptyState />

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(true)
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: 'files', label: 'Files' },
    { key: 'volume', label: 'Volume' },
    { key: 'avgLoan', label: 'Avg Loan' },
    { key: 'pctOfTotal', label: '% of Total' },
  ]

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">State Performance</h3>
        <button
          onClick={() => exportToCsv('state-performance', sorted)}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">State</th>
              {columns.map((c) => (
                <th key={c.key} className="cursor-pointer py-2 pr-4 font-medium" onClick={() => toggleSort(c.key)}>
                  {c.label} {sortKey === c.key && (desc ? '▼' : '▲')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const intensity = row.files / maxFiles
              return (
                <tr key={row.state} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{row.state}</td>
                  <td className="py-2 pr-4" style={{ background: `rgba(59,130,246,${intensity * 0.25})` }}>
                    {formatNumber(row.files)}
                  </td>
                  <td className="py-2 pr-4">{formatCurrency(row.volume)}</td>
                  <td className="py-2 pr-4">{formatCurrency(row.avgLoan)}</td>
                  <td className="py-2 pr-4">{formatPercent(row.pctOfTotal, 1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
