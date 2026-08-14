import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { searchParamsToFilters, resolvedDateRange, applyCommonFilters, applyClosedDateFilter } from '@/lib/filterUtils'
import {
  autoGranularity,
  bucketKey,
  bucketLabel,
  getPriorPeriod,
  formatDelta,
  type Granularity,
} from '@/lib/dataUtils'
import type { ClosedLoan, PipelineLoan } from '@/lib/types'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const GET = withErrorHandling(async (req: NextRequest) => {
  const filters = searchParamsToFilters(req.nextUrl.searchParams)
  const range = resolvedDateRange(filters)
  if (!range) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }
  const granularityParam = req.nextUrl.searchParams.get('granularity') as Granularity | null
  const granularity = granularityParam ?? autoGranularity(range.from, range.to)

  const { data: currentLoans, error: currentErr } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    q = applyClosedDateFilter(q as any, range.from, range.to) as any
    return q as any
  })
  if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 500 })

  const prior = getPriorPeriod(range.from, range.to)
  const { data: priorLoans } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    q = applyClosedDateFilter(q as any, prior.from, prior.to) as any
    return q as any
  })

  // All-time (categorical filters only, no date) for the YoY chart
  const { data: allTimeLoans } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })

  const { data: pipelineLoans } = await fetchAllRows<PipelineLoan>(() => {
    let q = supabaseServer.from('pipeline_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })

  const current = currentLoans
  const priorPeriod = priorLoans
  const allTime = allTimeLoans
  const pipeline = pipelineLoans

  // ---------- KPIs ----------
  const totalFiles = current.length
  const totalVolume = current.reduce((s, l) => s + (l.loan_amount ?? 0), 0)
  const priorFiles = priorPeriod.length
  const priorVolume = priorPeriod.reduce((s, l) => s + (l.loan_amount ?? 0), 0)
  const avgLoanSize = totalFiles ? totalVolume / totalFiles : 0
  const avgInterestRate = totalFiles
    ? current.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / totalFiles
    : 0

  const monthCounts = new Map<string, number>()
  for (const l of current) {
    if (!l.milestone_date_completion) continue
    const mk = l.milestone_date_completion.slice(0, 7)
    monthCounts.set(mk, (monthCounts.get(mk) ?? 0) + 1)
  }
  let peakMonth: { month: string; count: number } | null = null
  for (const [month, count] of monthCounts) {
    if (!peakMonth || count > peakMonth.count) peakMonth = { month, count }
  }

  const kpis = {
    totalFiles,
    totalFilesDelta: formatDelta(totalFiles, priorFiles),
    totalVolume,
    totalVolumeDelta: formatDelta(totalVolume, priorVolume),
    avgLoanSize,
    avgInterestRate,
    activePipeline: pipeline.length,
    peakMonth: peakMonth ? { month: bucketLabel(peakMonth.month, 'monthly'), count: peakMonth.count } : null,
  }

  // ---------- Trend (closings & volume over time) ----------
  const trendMap = new Map<string, { files: number; volume: number }>()
  for (const l of current) {
    if (!l.milestone_date_completion) continue
    const key = bucketKey(l.milestone_date_completion, granularity)
    const entry = trendMap.get(key) ?? { files: 0, volume: 0 }
    entry.files += 1
    entry.volume += l.loan_amount ?? 0
    trendMap.set(key, entry)
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({ key, label: bucketLabel(key, granularity), files: v.files, volume: v.volume }))

  // ---------- Year-over-year ----------
  const yoyMap = new Map<string, Map<number, number>>() // "01".."12" -> year -> count
  for (const l of allTime) {
    if (!l.milestone_date_completion) continue
    const [yearStr, monthStr] = l.milestone_date_completion.split('-')
    const year = Number(yearStr)
    if (!yoyMap.has(monthStr)) yoyMap.set(monthStr, new Map())
    const yearMap = yoyMap.get(monthStr)!
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1)
  }
  const allYears = new Set<number>()
  for (const yearMap of yoyMap.values()) for (const y of yearMap.keys()) allYears.add(y)
  const years = Array.from(allYears).sort((a, b) => b - a).slice(0, 5).sort()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const yoy = monthNames.map((name, i) => {
    const monthStr = String(i + 1).padStart(2, '0')
    const yearMap = yoyMap.get(monthStr) ?? new Map()
    const point: Record<string, number | string> = { month: name }
    for (const y of years) point[String(y)] = yearMap.get(y) ?? 0
    return point
  })

  // ---------- Day of week ----------
  const dowCounts = new Array(7).fill(0)
  for (const l of current) {
    if (!l.milestone_date_completion) continue
    const d = new Date(l.milestone_date_completion + 'T00:00:00')
    dowCounts[d.getDay()] += 1
  }
  const dayOfWeek = [1, 2, 3, 4, 5].map((i) => ({ day: DAY_NAMES[i], count: dowCounts[i] }))

  // ---------- State performance ----------
  const stateMap = new Map<string, { files: number; volume: number }>()
  for (const l of current) {
    const state = l.property_state?.trim()
    if (!state) continue
    const entry = stateMap.get(state) ?? { files: 0, volume: 0 }
    entry.files += 1
    entry.volume += l.loan_amount ?? 0
    stateMap.set(state, entry)
  }
  const states = Array.from(stateMap.entries())
    .map(([state, v]) => ({
      state,
      files: v.files,
      volume: v.volume,
      avgLoan: v.files ? v.volume / v.files : 0,
      pctOfTotal: totalFiles ? (v.files / totalFiles) * 100 : 0,
    }))
    .sort((a, b) => b.files - a.files)

  // ---------- Top referral sources ----------
  const referralMap = new Map<string, number>()
  for (const l of current) {
    const src = l.referral_source?.trim()
    if (!src) continue
    referralMap.set(src, (referralMap.get(src) ?? 0) + 1)
  }
  const topReferrals = Array.from(referralMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ---------- Loan type mix / channel split ----------
  const typeMap = new Map<string, number>()
  const channelMap = new Map<string, number>()
  for (const l of current) {
    const t = l.loan_type?.trim()
    if (t) typeMap.set(t, (typeMap.get(t) ?? 0) + 1)
    const c = l.loan_channel?.trim()
    if (c) channelMap.set(c, (channelMap.get(c) ?? 0) + 1)
  }
  const loanTypeMix = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }))
  const channelSplit = Array.from(channelMap.entries()).map(([channel, count]) => ({ channel, count }))

  return NextResponse.json({
    kpis,
    trend: { granularity, points: trend },
    yoy: { years, points: yoy },
    dayOfWeek,
    states,
    topReferrals,
    loanTypeMix,
    channelSplit,
  })
})
