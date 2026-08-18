'use client'

import { useMemo, useState } from 'react'
import { formatCurrency, formatNumber } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { LOFinancials } from '@/hooks/useFinancials'

type SortKey = 'filesClosed' | 'revenue' | 'directExpense' | 'netLoanProfit'

export function LOFinancialsTable({ rows, loading }: { rows: LOFinancials[] | null; loading: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('netLoanProfit')
  const [desc, setDesc] = useState(true)

  const data = rows ?? []
  const sorted = useMemo(() => [...data].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])), [data, sortKey, desc])

  if (loading) return <SkeletonTable rows={8} />
  if (data.length === 0) return <EmptyState message="No matched loan financials for the current filters." />

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(true)
    }
  }

  const columns: { key: SortKey; label: string; fmt: (n: number) => string }[] = [
    { key: 'filesClosed', label: 'Files Closed', fmt: formatNumber },
    { key: 'revenue', label: 'Revenue', fmt: formatCurrency },
    { key: 'directExpense', label: 'Direct Expense', fmt: formatCurrency },
    { key: 'netLoanProfit', label: 'Net Loan Profit', fmt: formatCurrency },
  ]

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Profitability by Loan Officer</h3>
        <button onClick={() => exportToCsv('lo-financials', sorted)} className="text-xs font-medium text-brand-700 hover:underline">
          Export CSV
        </button>
      </div>
      <p className="mb-2 text-xs text-ink-faint">
        Direct Expense combines commission and all other per-loan costs (credit report, appraisal, underwriting, etc.) as reported in the
        general ledger — it is not split between loan officer and processor.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">Loan Officer</th>
              {columns.map((c) => (
                <th key={c.key} className="cursor-pointer py-2 pr-4 font-medium" onClick={() => toggleSort(c.key)}>
                  {c.label} {sortKey === c.key && (desc ? '▼' : '▲')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.loanOfficer} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium">{r.loanOfficer}</td>
                {columns.map((c) => (
                  <td key={c.key} className="py-2 pr-4">
                    {c.fmt(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
