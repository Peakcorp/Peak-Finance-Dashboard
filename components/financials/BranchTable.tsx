import { formatCurrency } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { BranchFinancials } from '@/hooks/useFinancials'

export function BranchTable({ rows, loading }: { rows: BranchFinancials[] | null; loading: boolean }) {
  if (loading || !rows) return <SkeletonTable rows={3} />
  if (rows.length === 0) return <EmptyState message="No branch financials for the current filters." />

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Profitability by Branch</h3>
        <button onClick={() => exportToCsv('branch-financials', rows)} className="text-xs font-medium text-brand-700 hover:underline">
          Export CSV
        </button>
      </div>
      <p className="mb-2 text-xs text-ink-faint">
        Based on each transaction's Location in the general ledger. Corporate (Bridgelock Capital, Location 102) is an unallocated
        company-level cost — it is never split between Woodland Hills and Las Vegas.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-2 pr-4 font-medium">Branch</th>
              <th className="py-2 pr-4 font-medium">Revenue</th>
              <th className="py-2 pr-4 font-medium">Direct Expense</th>
              <th className="py-2 pr-4 font-medium">Overhead</th>
              <th className="py-2 pr-4 font-medium">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branch} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium">
                  {r.branch}
                  {r.branch === 'Corporate' && <span className="ml-1.5 text-xs font-normal text-ink-faint">(unallocated)</span>}
                </td>
                <td className="py-2 pr-4">{formatCurrency(r.revenue)}</td>
                <td className="py-2 pr-4">{formatCurrency(r.directExpense)}</td>
                <td className="py-2 pr-4">{formatCurrency(r.overhead)}</td>
                <td className={`py-2 pr-4 font-medium ${r.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(r.netProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
