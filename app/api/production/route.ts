import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { searchParamsToFilters, resolvedDateRange, applyCommonFilters, applyClosedDateFilter } from '@/lib/filterUtils'
import { getPresetRange, bucketLabel } from '@/lib/dataUtils'
import type { ClosedLoan, PipelineLoan } from '@/lib/types'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const GET = withErrorHandling(async (req: NextRequest) => {
  const filters = searchParamsToFilters(req.nextUrl.searchParams)
  const range = resolvedDateRange(filters)
  if (!range) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })

  const { data: filtered, error } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    q = applyClosedDateFilter(q as any, range.from, range.to) as any
    return q as any
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mtd = getPresetRange('MTD')
  const ytd = getPresetRange('YTD')
  const { data: mtdRows } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('loan_officer, loan_processor, milestone_date_completion')
    q = applyCommonFilters(q as any, filters) as any
    q = applyClosedDateFilter(q as any, mtd.from, mtd.to) as any
    return q as any
  })

  const { data: ytdRows } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('loan_officer, loan_processor, milestone_date_completion')
    q = applyCommonFilters(q as any, filters) as any
    q = applyClosedDateFilter(q as any, ytd.from, ytd.to) as any
    return q as any
  })

  // Last 12 months, unfiltered by the date-range filter (for LO sparklines), but respecting categorical filters
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
  twelveMonthsAgo.setDate(1)
  const twelveMoFrom = twelveMonthsAgo.toISOString().split('T')[0]
  const { data: sparkRows } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('loan_officer, milestone_date_completion')
    q = applyCommonFilters(q as any, filters) as any
    return q.gte('milestone_date_completion', twelveMoFrom) as any
  })

  const { data: pipeline } = await fetchAllRows<PipelineLoan>(() => {
    let q = supabaseServer.from('pipeline_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })

  // ---------- Loan Officers ----------
  const loMap = new Map<
    string,
    { files: number; volume: number; rateSum: number; states: Set<string>; processors: Map<string, number>; types: Map<string, number>; statesCount: Map<string, number>; referrals: Map<string, number> }
  >()
  for (const l of filtered) {
    const lo = l.loan_officer?.trim()
    if (!lo) continue
    if (!loMap.has(lo)) loMap.set(lo, { files: 0, volume: 0, rateSum: 0, states: new Set(), processors: new Map(), types: new Map(), statesCount: new Map(), referrals: new Map() })
    const e = loMap.get(lo)!
    e.files += 1
    e.volume += l.loan_amount ?? 0
    e.rateSum += l.interest_rate ?? 0
    if (l.property_state) {
      e.states.add(l.property_state)
      e.statesCount.set(l.property_state, (e.statesCount.get(l.property_state) ?? 0) + 1)
    }
    if (l.loan_processor) e.processors.set(l.loan_processor, (e.processors.get(l.loan_processor) ?? 0) + 1)
    if (l.loan_type) e.types.set(l.loan_type, (e.types.get(l.loan_type) ?? 0) + 1)
    if (l.referral_source) e.referrals.set(l.referral_source, (e.referrals.get(l.referral_source) ?? 0) + 1)
  }

  const mtdByLO = new Map<string, number>()
  for (const r of (mtdRows ?? []) as ClosedLoan[]) {
    const lo = r.loan_officer?.trim()
    if (lo) mtdByLO.set(lo, (mtdByLO.get(lo) ?? 0) + 1)
  }
  const ytdByLO = new Map<string, number>()
  for (const r of (ytdRows ?? []) as ClosedLoan[]) {
    const lo = r.loan_officer?.trim()
    if (lo) ytdByLO.set(lo, (ytdByLO.get(lo) ?? 0) + 1)
  }

  const sparkByLO = new Map<string, Map<string, number>>()
  for (const r of (sparkRows ?? []) as ClosedLoan[]) {
    const lo = r.loan_officer?.trim()
    if (!lo || !r.milestone_date_completion) continue
    const mk = r.milestone_date_completion.slice(0, 7)
    if (!sparkByLO.has(lo)) sparkByLO.set(lo, new Map())
    const m = sparkByLO.get(lo)!
    m.set(mk, (m.get(mk) ?? 0) + 1)
  }
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(twelveMonthsAgo)
    d.setMonth(d.getMonth() + i)
    return d.toISOString().slice(0, 7)
  })

  const loanOfficers = Array.from(loMap.entries())
    .map(([name, e]) => ({
      name,
      files: e.files,
      volume: e.volume,
      avgLoan: e.files ? e.volume / e.files : 0,
      avgRate: e.files ? e.rateSum / e.files : 0,
      states: Array.from(e.states),
      filesMTD: mtdByLO.get(name) ?? 0,
      filesYTD: ytdByLO.get(name) ?? 0,
      monthlySparkline: last12Months.map((mk) => ({
        month: bucketLabel(mk, 'monthly'),
        count: sparkByLO.get(name)?.get(mk) ?? 0,
      })),
      processorBreakdown: Array.from(e.processors.entries()).map(([processor, count]) => ({ processor, count })),
      loanTypeMix: Array.from(e.types.entries()).map(([type, count]) => ({ type, count })),
      stateCoverage: Array.from(e.statesCount.entries()).map(([state, count]) => ({ state, count })),
      topReferrals: Array.from(e.referrals.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }))
    .sort((a, b) => b.files - a.files)

  // ---------- Processors ----------
  const procMap = new Map<string, { files: number; volume: number; los: Set<string>; loBreakdown: Map<string, number> }>()
  for (const l of filtered) {
    const proc = l.loan_processor?.trim()
    if (!proc) continue
    if (!procMap.has(proc)) procMap.set(proc, { files: 0, volume: 0, los: new Set(), loBreakdown: new Map() })
    const e = procMap.get(proc)!
    e.files += 1
    e.volume += l.loan_amount ?? 0
    if (l.loan_officer) {
      e.los.add(l.loan_officer)
      e.loBreakdown.set(l.loan_officer, (e.loBreakdown.get(l.loan_officer) ?? 0) + 1)
    }
  }
  const mtdByProc = new Map<string, number>()
  for (const r of (mtdRows ?? []) as ClosedLoan[]) {
    const proc = r.loan_processor?.trim()
    if (proc) mtdByProc.set(proc, (mtdByProc.get(proc) ?? 0) + 1)
  }
  const pipelineByProc = new Map<string, number>()
  for (const p of pipeline) {
    const proc = p.loan_processor?.trim()
    if (proc) pipelineByProc.set(proc, (pipelineByProc.get(proc) ?? 0) + 1)
  }

  const processors = Array.from(procMap.entries())
    .map(([name, e]) => ({
      name,
      files: e.files,
      volume: e.volume,
      avgLoan: e.files ? e.volume / e.files : 0,
      losSupported: e.los.size,
      filesMTD: mtdByProc.get(name) ?? 0,
      loBreakdown: Array.from(e.loBreakdown.entries()).map(([lo, count]) => ({ lo, count })),
      openPipelineCount: pipelineByProc.get(name) ?? 0,
    }))
    .sort((a, b) => b.files - a.files)

  // ---------- Team heatmap ----------
  const heatMap = new Map<string, { count: number; volume: number }>()
  for (const l of filtered) {
    const lo = l.loan_officer?.trim()
    const proc = l.loan_processor?.trim()
    if (!lo || !proc) continue
    const key = `${lo}|||${proc}`
    const e = heatMap.get(key) ?? { count: 0, volume: 0 }
    e.count += 1
    e.volume += l.loan_amount ?? 0
    heatMap.set(key, e)
  }
  const cells = Array.from(heatMap.entries()).map(([key, v]) => {
    const [lo, processor] = key.split('|||')
    return { lo, processor, count: v.count, volume: v.volume }
  })

  return NextResponse.json({
    loanOfficers,
    processors,
    heatmap: {
      los: loanOfficers.map((l) => l.name),
      processors: processors.map((p) => p.name),
      cells,
    },
  })
})
