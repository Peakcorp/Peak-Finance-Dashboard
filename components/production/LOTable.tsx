'use client'

import React, { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { LODetailCard } from './LODetailCard'
import type { LOProduction } from '@/hooks/useProduction'

type SortKey = 'files' | 'volume' | 'avgLoan' | 'avgRate' | 'filesMTD' | 'filesYTD'
type ChartMetric = 'files' | 'volume' | 'avgLoan'

export function LOTable({ data, loading }: { data: LOProduction[] | null; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('files')
  const [desc, setDesc] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<ChartMetric>('files')

  const rows = data ?? []
  const sorted = useMemo(() => [...rows].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])), [rows, sortKey, desc])

  if (loading) return <SkeletonTable rows={8} />
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
    { key: 'avgRate', label: 'Avg Rate', fmt: (n) => formatPercent(n) },
    { key: 'filesMTD', label: 'Files MTD', fmt: formatNumber },
    { key: 'filesYTD', label: 'Files YTD', fmt: formatNumber },
  ]

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Loan Officers by {chartMetric === 'avgLoan' ? 'Avg Loan' : chartMetric === 'files' ? 'Files' : 'Volume'}</h3>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['files', 'volume', 'avgLoan'] as ChartMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={clsx(
                  'rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors',
                  chartMetric === m ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {m === 'avgLoan' ? 'Avg Loan' : m}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={[...rows].sort((a, b) => b[chartMetric] - a[chartMetric])} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-45} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => (chartMetric === 'files' ? String(v) : formatCurrencyCompact(v))} />
            <Tooltip formatter={(v: number) => (chartMetric === 'files' ? formatNumber(v) : formatCurrency(v))} />
            <Bar dataKey={chartMetric} fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Loan Officers</h3>
          <button onClick={() => exportToCsv('loan-officers', sorted)} className="text-xs font-medium text-brand-700 hover:underline">
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
                <th className="py-2 pr-4 font-medium">States</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lo) => (
                <React.Fragment key={lo.name}>
                  <tr
                    className="cursor-pointer border-b border-slate-100 hover:bg-surface-subtle"
                    onClick={() => setExpanded(expanded === lo.name ? null : lo.name)}
                  >
                    <td className="py-2 pr-4 font-medium">{lo.name}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="py-2 pr-4">
                        {c.fmt(lo[c.key])}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-ink-faint">{lo.states.join(', ')}</td>
                  </tr>
                  {expanded === lo.name && <LODetailCard lo={lo} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
