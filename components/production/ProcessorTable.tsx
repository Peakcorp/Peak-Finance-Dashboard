'use client'

import React, { useMemo, useState } from 'react'
import { formatCurrency, formatNumber } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ProcessorProduction } from '@/hooks/useProduction'

type SortKey = 'files' | 'volume' | 'avgLoan' | 'losSupported' | 'filesMTD'

export function ProcessorTable({ data, loading }: { data: ProcessorProduction[] | null; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('files')
  const [desc, setDesc] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = data ?? []
  const sorted = useMemo(() => [...rows].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])), [rows, sortKey, desc])

  if (loading) return <SkeletonTable rows={6} />
  if (rows.length === 0) return <EmptyState />

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(true)
    }
  }

  const columns: { key: SortKey; label: string; fmt: (n: number) => string }[] = [
    { key: 'files', label: 'Files', fmt: formatNumber },
    { key: 'volume', label: 'Volume', fmt: formatCurrency },
    { key: 'avgLoan', label: 'Avg Loan', fmt: formatCurrency },
    { key: 'losSupported', label: 'LOs Supported', fmt: formatNumber },
    { key: 'filesMTD', label: 'Files MTD', fmt: formatNumber },
  ]

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Processors</h3>
        <button onClick={() => exportToCsv('processors', sorted)} className="text-xs font-medium text-brand-700 hover:underline">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">Name</th>
              {columns.map((c) => (
                <th key={c.key} className="cursor-pointer py-2 pr-4 font-medium" onClick={() => toggleSort(c.key)}>
                  {c.label} {sortKey === c.key && (desc ? '▼' : '▲')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <React.Fragment key={p.name}>
                <tr
                  className="cursor-pointer border-b border-slate-100 hover:bg-surface-subtle"
                  onClick={() => setExpanded(expanded === p.name ? null : p.name)}
                >
                  <td className="py-2 pr-4 font-medium">{p.name}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 pr-4">
                      {c.fmt(p[c.key])}
                    </td>
                  ))}
                </tr>
                {expanded === p.name && (
                  <tr>
                    <td colSpan={columns.length + 1} className="bg-surface-subtle p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-xs font-medium text-ink-faint">LO Breakdown</h4>
                          <ul className="space-y-1 text-xs">
                            {p.loBreakdown
                              .sort((a, b) => b.count - a.count)
                              .map((r) => (
                                <li key={r.lo} className="flex justify-between text-ink-muted">
                                  <span className="truncate">{r.lo}</span>
                                  <span className="font-medium text-ink">{r.count}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs font-medium text-ink-faint">Open Pipeline</h4>
                          <p className="text-2xl font-bold text-ink">{formatNumber(p.openPipelineCount)}</p>
                          <p className="text-xs text-ink-faint">files currently in progress</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
