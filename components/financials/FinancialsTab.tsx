'use client'

import { useFinancials } from '@/hooks/useFinancials'
import { FinancialsKPIs } from './FinancialsKPIs'
import { LOFinancialsTable } from './LOFinancialsTable'
import { BranchTable } from './BranchTable'
import { UnmatchedPanel } from './UnmatchedPanel'

export function FinancialsTab({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error } = useFinancials(refreshKey)

  return (
    <div className="space-y-4">
      <div className="card border-brand-200 bg-brand-50">
        <p className="text-xs text-ink-muted">
          <strong>Experimental.</strong> Figures are matched from an imported General Ledger export against closed loans by borrower name
          and property address. Commission Expense is shown as a single combined figure (loan officer + processor, not split). Company
          overhead (salaries, rent, insurance, etc.) is never allocated to individual loans or loan officers.
        </p>
      </div>

      {error && (
        <div className="card">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <FinancialsKPIs data={data} loading={loading} />
      <BranchTable rows={data?.byBranch ?? null} loading={loading} />
      <LOFinancialsTable rows={data?.byLoanOfficer ?? null} loading={loading} />
      {data && <UnmatchedPanel transactions={data.unmatchedTransactions} matchStats={data.matchStats} />}
    </div>
  )
}
