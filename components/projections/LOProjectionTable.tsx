import { formatCurrency, formatNumber } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { LOProjectionRow } from '@/lib/projectionUtils'

export function LOProjectionTable({ rows, loading, monthLabels }: { rows: LOProjectionRow[] | null; loading: boolean; monthLabels: string[] }) {
  if (loading || !rows) return <SkeletonTable rows={8} />
  if (rows.length === 0) return <EmptyState />

  const csvRows = rows.map((r) => ({
    'Loan Officer': r.loanOfficer,
    [monthLabels[0] ?? 'Month 1']: r.monthProjections[0] ?? 0,
    [monthLabels[1] ?? 'Month 2']: r.monthProjections[1] ?? 0,
    [monthLabels[2] ?? 'Month 3']: r.monthProjections[2] ?? 0,
    'Total Pipeline Value': r.totalPipelineValue,
  }))

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">LO Projection Breakdown</h3>
        <button onClick={() => exportToCsv('lo-projections', csvRows)} className="text-xs font-medium text-brand-700 hover:underline">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">LO Name</th>
              <th className="py-2 pr-4 font-medium">{monthLabels[0] ?? 'Current Month'} Proj</th>
              <th className="py-2 pr-4 font-medium">{monthLabels[1] ?? 'Month+1'} Proj</th>
              <th className="py-2 pr-4 font-medium">{monthLabels[2] ?? 'Month+2'} Proj</th>
              <th className="py-2 pr-4 font-medium">Total Pipeline Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.loanOfficer} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium">{r.loanOfficer}</td>
                <td className="py-2 pr-4">{formatNumber(r.monthProjections[0] ?? 0)}</td>
                <td className="py-2 pr-4">{formatNumber(r.monthProjections[1] ?? 0)}</td>
                <td className="py-2 pr-4">{formatNumber(r.monthProjections[2] ?? 0)}</td>
                <td className="py-2 pr-4">{formatCurrency(r.totalPipelineValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
