import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { searchParamsToFilters, applyCommonFilters, resolvedDateRange } from '@/lib/filterUtils'
import { daysInPipeline, todayISO } from '@/lib/dataUtils'
import { MILESTONE_ORDER } from '@/lib/types'
import type { PipelineLoan } from '@/lib/types'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const GET = withErrorHandling(async (req: NextRequest) => {
  const filters = searchParamsToFilters(req.nextUrl.searchParams)
  const range = resolvedDateRange(filters)
  if (!range) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })

  const { data: allLoans, error } = await fetchAllRows<PipelineLoan>(() => {
    let q = supabaseServer.from('pipeline_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pipeline loans don't have a closing date yet, so the date-range filter applies to
  // Est Closing Date instead — "All Time" skips this filter to also include loans with no estimate.
  const loans =
    filters.datePreset === 'ALL'
      ? allLoans
      : allLoans.filter((l) => l.est_closing_date && l.est_closing_date >= range.from && l.est_closing_date <= range.to)

  const today = todayISO()
  const thisMonth = today.slice(0, 7)

  const totalOpenLoans = loans.length
  const totalPipelineValue = loans.reduce((s, l) => s + (l.loan_amount ?? 0), 0)
  const daysArr = loans.map((l) => daysInPipeline(l.date_file_started)).filter((d): d is number => d !== null)
  const avgDaysInPipeline = daysArr.length ? daysArr.reduce((s, d) => s + d, 0) / daysArr.length : 0
  const expectedThisMonth = loans.filter((l) => l.est_closing_date && l.est_closing_date.slice(0, 7) === thisMonth).length
  const pastEstCloseDate = loans.filter((l) => l.est_closing_date && l.est_closing_date < today).length

  const funnelCounts = new Map<string, number>()
  for (const l of loans) {
    if (l.current_milestone) funnelCounts.set(l.current_milestone, (funnelCounts.get(l.current_milestone) ?? 0) + 1)
  }
  const funnel = MILESTONE_ORDER.map((m) => ({ milestone: m, count: funnelCounts.get(m) ?? 0 }))

  const rows = loans.map((l) => ({
    ...l,
    daysInPipeline: daysInPipeline(l.date_file_started),
  }))

  return NextResponse.json({
    kpis: { totalOpenLoans, totalPipelineValue, avgDaysInPipeline, expectedThisMonth, pastEstCloseDate },
    funnel,
    rows,
  })
})
