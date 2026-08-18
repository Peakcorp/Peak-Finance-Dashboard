import { formatCurrencyCompact } from '@/lib/dataUtils'
import { SkeletonKPI } from '@/components/shared/Skeleton'
import type { FinancialsData } from '@/hooks/useFinancials'

export function FinancialsKPIs({ data, loading }: { data: FinancialsData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
    )
  }

  const { totals, matchStats } = data
  const matchRate = matchStats.totalLoanLinkableTransactions
    ? (matchStats.matchedCount / matchStats.totalLoanLinkableTransactions) * 100
    : 0
  const grossLoanProfit = totals.matchedRevenue - totals.matchedDirectExpense

  const tiles = [
    { label: 'Revenue (Matched Loans)', value: formatCurrencyCompact(totals.matchedRevenue) },
    { label: 'Direct Expense (Matched Loans)', value: formatCurrencyCompact(totals.matchedDirectExpense) },
    { label: 'Gross Loan Profit', value: formatCurrencyCompact(grossLoanProfit) },
    { label: 'Company Overhead', value: formatCurrencyCompact(totals.overhead) },
    {
      label: 'Net Company Profit',
      value: formatCurrencyCompact(totals.netCompanyProfit),
      warn: totals.netCompanyProfit < 0,
    },
    { label: 'Loan Match Rate', value: `${matchRate.toFixed(0)}%` },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{tile.label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${tile.warn ? 'text-danger' : 'text-ink'}`}>{tile.value}</p>
        </div>
      ))}
    </div>
  )
}
