'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import type { UnmatchedTransaction, FinancialsData } from '@/hooks/useFinancials'

export function UnmatchedPanel({ transactions, matchStats }: { transactions: UnmatchedTransaction[]; matchStats: FinancialsData['matchStats'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between text-sm font-semibold text-ink">
        <span>
          Unmatched Transactions ({matchStats.unmatchedCount} of {matchStats.totalLoanLinkableTransactions} loan-linkable rows)
        </span>
        <span className="text-ink-faint">{expanded ? '▾' : '▸'}</span>
      </button>
      <p className="mt-1 text-xs text-ink-faint">
        These general ledger entries reference a loan that couldn&apos;t be matched to a closed loan in the system — usually because the loan
        hasn&apos;t reached the Completion milestone in Encompass yet, or the borrower/address text didn&apos;t line up closely enough to match
        safely. They&apos;re excluded from the per-LO breakdown above but still counted in nothing until reviewed.
      </p>

      {expanded && (
        <div className="mt-3">
          <div className="mb-2 flex justify-end">
            <button onClick={() => exportToCsv('unmatched-financials', transactions)} className="text-xs font-medium text-brand-700 hover:underline">
              Export CSV
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Date</th>
                  <th className="py-1.5 pr-3 font-medium">Account</th>
                  <th className="py-1.5 pr-3 font-medium">Amount</th>
                  <th className="py-1.5 pr-3 font-medium">Borrower Ref</th>
                  <th className="py-1.5 pr-3 font-medium">Address Ref</th>
                  <th className="py-1.5 pr-3 font-medium">Memo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(t.postedDate)}</td>
                    <td className="py-1.5 pr-3">{t.account}</td>
                    <td className="py-1.5 pr-3">{formatCurrency(t.amount)}</td>
                    <td className="py-1.5 pr-3">{t.borrowerLastNameRef ?? '—'}</td>
                    <td className="py-1.5 pr-3">{t.propertyAddressRef ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-ink-faint">{t.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
