import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { searchParamsToFilters, resolvedDateRange } from '@/lib/filterUtils'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

interface JoinedClosedLoan {
  id: string
  loan_officer: string | null
  loan_processor: string | null
  property_state: string | null
  property_city: string | null
  loan_type: string | null
  loan_channel: string | null
  milestone_date_completion: string | null
}

interface GLRow {
  id: string
  posted_date: string | null
  memo: string | null
  gl_account_name: string
  gl_category: 'revenue' | 'direct_expense' | 'overhead'
  amount: number
  loan_number_ref: string | null
  borrower_last_name_ref: string | null
  property_address_ref: string | null
  matched_closed_loan_id: string | null
  match_confidence: string | null
  closed_loans: JoinedClosedLoan | null
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  const filters = searchParamsToFilters(req.nextUrl.searchParams)
  const range = resolvedDateRange(filters)
  if (!range) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })

  const { data: rows, error } = await fetchAllRows<GLRow>(() =>
    supabaseServer
      .from('gl_transactions')
      .select(
        '*, closed_loans(id, loan_officer, loan_processor, property_state, property_city, loan_type, loan_channel, milestone_date_completion)',
      ) as any,
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasCategoryFilters =
    filters.loanOfficers.length > 0 || filters.processors.length > 0 || filters.states.length > 0

  const matchesCategoryFilters = (loan: JoinedClosedLoan | null): boolean => {
    if (!loan) return false
    if (filters.loanOfficers.length && !(loan.loan_officer && filters.loanOfficers.includes(loan.loan_officer))) return false
    if (filters.processors.length && !(loan.loan_processor && filters.processors.includes(loan.loan_processor))) return false
    if (filters.states.length && !(loan.property_state && filters.states.includes(loan.property_state))) return false
    return true
  }

  const inDateRange = (dateStr: string | null): boolean => {
    if (filters.datePreset === 'ALL') return true
    if (!dateStr) return false
    return dateStr >= range.from && dateStr <= range.to
  }

  // Matched rows: date is driven by the linked loan's completion date.
  // Unmatched/overhead rows: no linked loan, so fall back to the GL's own posting date.
  const dated = rows.filter((r) => {
    const effectiveDate = r.closed_loans?.milestone_date_completion ?? r.posted_date
    return inDateRange(effectiveDate)
  })

  const matchedInScope = dated.filter((r) => r.matched_closed_loan_id && r.closed_loans && matchesCategoryFilters(r.closed_loans))
  const unmatchedInScope = dated.filter((r) => !r.matched_closed_loan_id && r.gl_category !== 'overhead')
  const overheadInScope = dated.filter((r) => r.gl_category === 'overhead')

  // ---------- Per-LO rollup ----------
  const byLO = new Map<string, { loanIds: Set<string>; revenue: number; directExpense: number }>()
  for (const r of matchedInScope) {
    const lo = r.closed_loans!.loan_officer ?? 'Unassigned'
    if (!byLO.has(lo)) byLO.set(lo, { loanIds: new Set(), revenue: 0, directExpense: 0 })
    const entry = byLO.get(lo)!
    entry.loanIds.add(r.matched_closed_loan_id!)
    if (r.gl_category === 'revenue') entry.revenue += r.amount
    else if (r.gl_category === 'direct_expense') entry.directExpense += r.amount
  }
  const byLoanOfficer = Array.from(byLO.entries())
    .map(([loanOfficer, v]) => ({
      loanOfficer,
      filesClosed: v.loanIds.size,
      revenue: v.revenue,
      directExpense: v.directExpense,
      netLoanProfit: v.revenue - v.directExpense,
    }))
    .sort((a, b) => b.netLoanProfit - a.netLoanProfit)

  const matchedRevenue = matchedInScope.filter((r) => r.gl_category === 'revenue').reduce((s, r) => s + r.amount, 0)
  const matchedDirectExpense = matchedInScope.filter((r) => r.gl_category === 'direct_expense').reduce((s, r) => s + r.amount, 0)
  const unmatchedRevenue = unmatchedInScope.filter((r) => r.gl_category === 'revenue').reduce((s, r) => s + r.amount, 0)
  const unmatchedDirectExpense = unmatchedInScope.filter((r) => r.gl_category === 'direct_expense').reduce((s, r) => s + r.amount, 0)
  const overhead = overheadInScope.reduce((s, r) => s + r.amount, 0)

  const totals = {
    matchedRevenue,
    matchedDirectExpense,
    matchedNetLoanProfit: matchedRevenue - matchedDirectExpense,
    unmatchedRevenue,
    unmatchedDirectExpense,
    overhead,
    netCompanyProfit: matchedRevenue - matchedDirectExpense + unmatchedRevenue - unmatchedDirectExpense - overhead,
  }

  const loanLinkable = dated.filter((r) => r.gl_category !== 'overhead')
  const matchStats = {
    totalLoanLinkableTransactions: loanLinkable.length,
    matchedCount: loanLinkable.filter((r) => r.matched_closed_loan_id).length,
    unmatchedCount: loanLinkable.filter((r) => !r.matched_closed_loan_id).length,
  }

  const unmatchedTransactions = hasCategoryFilters
    ? [] // unmatched rows have no loan to filter by, so hide them when an LO/processor/state filter is active
    : unmatchedInScope
        .slice()
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 100)
        .map((r) => ({
          postedDate: r.posted_date,
          account: r.gl_account_name,
          amount: r.amount,
          memo: r.memo,
          loanNumberRef: r.loan_number_ref,
          borrowerLastNameRef: r.borrower_last_name_ref,
          propertyAddressRef: r.property_address_ref,
        }))

  return NextResponse.json({
    period: range,
    byLoanOfficer,
    totals,
    matchStats,
    unmatchedTransactions,
  })
})
