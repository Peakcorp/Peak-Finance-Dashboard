import { formatCurrency, formatDate } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import type { LoanFinancials } from '@/hooks/useFinancials'

export function LoanFinancialsDetail({ loanOfficer, loans, colSpan }: { loanOfficer: string; loans: LoanFinancials[]; colSpan: number }) {
  const totals = loans.reduce(
    (acc, l) => ({
      loanAmount: acc.loanAmount + (l.loanAmount ?? 0),
      revenue: acc.revenue + l.revenue,
      directExpense: acc.directExpense + l.directExpense,
      netLoanProfit: acc.netLoanProfit + l.netLoanProfit,
    }),
    { loanAmount: 0, revenue: 0, directExpense: 0, netLoanProfit: 0 },
  )

  return (
    <tr>
      <td colSpan={colSpan} className="bg-surface-subtle p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-ink-faint">{loanOfficer} — {loans.length} loan{loans.length === 1 ? '' : 's'}</h4>
          <button
            onClick={() => exportToCsv(`${loanOfficer}-loans`, loans)}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Export CSV
          </button>
        </div>
        {loans.length === 0 ? (
          <p className="text-xs text-ink-faint">No matched loans for this loan officer in the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-ink-faint">
                  <th className="py-1.5 pr-4 font-medium">Borrower</th>
                  <th className="py-1.5 pr-4 font-medium">Property</th>
                  <th className="py-1.5 pr-4 font-medium">Closed</th>
                  <th className="py-1.5 pr-4 font-medium">Loan Amount</th>
                  <th className="py-1.5 pr-4 font-medium">Revenue</th>
                  <th className="py-1.5 pr-4 font-medium">Direct Expense</th>
                  <th className="py-1.5 pr-4 font-medium">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.loanId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 font-medium">
                      {l.borrowerLastName}
                      {l.borrowerFirstName ? `, ${l.borrowerFirstName.charAt(0)}.` : ''}
                    </td>
                    <td className="py-1.5 pr-4 text-ink-faint">
                      {l.propertyAddress ?? '—'}
                      {l.propertyCity ? `, ${l.propertyCity}` : ''} {l.propertyState ?? ''}
                    </td>
                    <td className="py-1.5 pr-4">{formatDate(l.closedDate)}</td>
                    <td className="py-1.5 pr-4">{formatCurrency(l.loanAmount)}</td>
                    <td className="py-1.5 pr-4">{formatCurrency(l.revenue)}</td>
                    <td className="py-1.5 pr-4">{formatCurrency(l.directExpense)}</td>
                    <td className={`py-1.5 pr-4 font-medium ${l.netLoanProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(l.netLoanProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-1.5 pr-4">Total</td>
                  <td className="py-1.5 pr-4" />
                  <td className="py-1.5 pr-4" />
                  <td className="py-1.5 pr-4">{formatCurrency(totals.loanAmount)}</td>
                  <td className="py-1.5 pr-4">{formatCurrency(totals.revenue)}</td>
                  <td className="py-1.5 pr-4">{formatCurrency(totals.directExpense)}</td>
                  <td className={`py-1.5 pr-4 ${totals.netLoanProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(totals.netLoanProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </td>
    </tr>
  )
}
