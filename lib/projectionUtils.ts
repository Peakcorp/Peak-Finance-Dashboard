import { format, addMonths, startOfMonth } from 'date-fns'
import type { PipelineLoan, ClosedLoan, ProjectionSettings, ProjectionOverride } from './types'
import { monthKey } from './dataUtils'

export interface QualifyingLoan {
  id: string
  borrower_last_name: string | null
  borrower_first_name: string | null
  loan_officer: string | null
  loan_amount: number | null
  current_milestone: string | null
  est_closing_date: string | null
  confidence: number | null
  notes?: string | null
  // Already funded/closed this month — guaranteed, not a projection at all. Counted at 100%
  // regardless of milestone rules or the weight-by-confidence setting.
  alreadyClosed?: boolean
}

export interface MonthProjection {
  month: string // YYYY-MM
  label: string // e.g. "Aug 2026"
  loans: QualifyingLoan[]
  projectedFiles: number
  projectedVolume: number
  weightedVolume: number
  avgConfidence: number | null
}

export function getProjectionMonths(count = 4, startDate = new Date()): string[] {
  const start = startOfMonth(startDate)
  return Array.from({ length: count }, (_, i) => format(addMonths(start, i), 'yyyy-MM'))
}

export function monthLabel(month: string): string {
  return format(new Date(month + '-01T00:00:00'), 'MMM yyyy')
}

function isPast(dateStr: string, todayISO: string): boolean {
  return dateStr < todayISO
}

// A loan that already reached Completion within one of the displayed months is guaranteed
// production for that month — not a projection, a fact. It's folded in at 100% confidence
// regardless of milestone-inclusion rules or the weight-by-confidence toggle, in both auto and
// manual mode. (In practice this only ever affects months[0], the current month in progress —
// future months can't have a completion date yet, and past months aren't shown.)
function foldInAlreadyClosedLoans(result: Record<string, MonthProjection>, closedLoans: ClosedLoan[], months: string[]) {
  for (const loan of closedLoans) {
    if (!loan.milestone_date_completion) continue
    const mk = monthKey(loan.milestone_date_completion)
    if (!months.includes(mk)) continue
    const bucket = result[mk]
    const amount = loan.loan_amount ?? 0
    bucket.loans.push({
      id: loan.id,
      borrower_last_name: loan.borrower_last_name,
      borrower_first_name: loan.borrower_first_name,
      loan_officer: loan.loan_officer,
      loan_amount: loan.loan_amount,
      current_milestone: 'Completion',
      est_closing_date: loan.milestone_date_completion,
      confidence: 100,
      alreadyClosed: true,
    })
    bucket.projectedFiles += 1
    bucket.projectedVolume += amount
    bucket.weightedVolume += amount
  }
}

export function computeAutoProjections(
  pipelineLoans: PipelineLoan[],
  closedLoans: ClosedLoan[],
  settings: ProjectionSettings,
  months: string[],
  todayISO: string,
): Record<string, MonthProjection> {
  const result: Record<string, MonthProjection> = {}
  for (const m of months) {
    result[m] = { month: m, label: monthLabel(m), loans: [], projectedFiles: 0, projectedVolume: 0, weightedVolume: 0, avgConfidence: null }
  }
  foldInAlreadyClosedLoans(result, closedLoans, months)
  const included = new Set(settings.included_milestones)
  const weightByConfidence = settings.weight_by_confidence !== false

  for (const loan of pipelineLoans) {
    if (!loan.current_milestone || !included.has(loan.current_milestone)) continue

    let targetMonth: string | null = null
    if (loan.est_closing_date) {
      if (isPast(loan.est_closing_date, todayISO)) {
        if (!settings.include_past_est_date) continue
        targetMonth = months[0]
      } else {
        const mk = monthKey(loan.est_closing_date)
        if (months.includes(mk)) targetMonth = mk
      }
    } else {
      if (!settings.include_no_est_date) continue
      targetMonth = months[0]
    }
    if (!targetMonth) continue

    const confidence = settings.confidence_by_milestone[loan.current_milestone] ?? 50
    const amount = loan.loan_amount ?? 0
    const bucket = result[targetMonth]
    bucket.loans.push({
      id: loan.id,
      borrower_last_name: loan.borrower_last_name,
      borrower_first_name: loan.borrower_first_name,
      loan_officer: loan.loan_officer,
      loan_amount: loan.loan_amount,
      current_milestone: loan.current_milestone,
      est_closing_date: loan.est_closing_date,
      confidence,
    })
    bucket.projectedFiles += 1
    bucket.projectedVolume += amount
    bucket.weightedVolume += weightByConfidence ? amount * (confidence / 100) : amount
  }

  for (const m of months) {
    const b = result[m]
    b.avgConfidence = b.loans.length
      ? b.loans.reduce((sum, l) => sum + (l.confidence ?? 0), 0) / b.loans.length
      : null
  }
  return result
}

export function computeManualProjections(
  pipelineLoans: PipelineLoan[],
  closedLoans: ClosedLoan[],
  overrides: ProjectionOverride[],
  months: string[],
): Record<string, MonthProjection> {
  const result: Record<string, MonthProjection> = {}
  for (const m of months) {
    result[m] = { month: m, label: monthLabel(m), loans: [], projectedFiles: 0, projectedVolume: 0, weightedVolume: 0, avgConfidence: null }
  }
  foldInAlreadyClosedLoans(result, closedLoans, months)
  const loanById = new Map(pipelineLoans.map((l) => [l.id, l]))
  for (const ov of overrides) {
    if (!ov.included) continue
    if (!months.includes(ov.projection_month)) continue
    const loan = loanById.get(ov.pipeline_loan_id)
    if (!loan) continue
    const amount = loan.loan_amount ?? 0
    const bucket = result[ov.projection_month]
    bucket.loans.push({
      id: loan.id,
      borrower_last_name: loan.borrower_last_name,
      borrower_first_name: loan.borrower_first_name,
      loan_officer: loan.loan_officer,
      loan_amount: loan.loan_amount,
      current_milestone: loan.current_milestone,
      est_closing_date: loan.est_closing_date,
      confidence: null,
      notes: ov.notes,
    })
    bucket.projectedFiles += 1
    bucket.projectedVolume += amount
    bucket.weightedVolume += amount
  }
  return result
}

export interface LOProjectionRow {
  loanOfficer: string
  monthProjections: number[] // aligned to `months` order (first 3 used in UI)
  totalPipelineValue: number
}

export function computeLOProjectionBreakdown(
  pipelineLoans: PipelineLoan[],
  monthlyProjections: Record<string, MonthProjection>,
  months: string[],
): LOProjectionRow[] {
  const byLO = new Map<string, LOProjectionRow>()
  for (const loan of pipelineLoans) {
    const lo = loan.loan_officer || 'Unassigned'
    if (!byLO.has(lo)) {
      byLO.set(lo, { loanOfficer: lo, monthProjections: months.map(() => 0), totalPipelineValue: 0 })
    }
    byLO.get(lo)!.totalPipelineValue += loan.loan_amount ?? 0
  }
  months.forEach((m, i) => {
    for (const loan of monthlyProjections[m]?.loans ?? []) {
      const lo = loan.loan_officer || 'Unassigned'
      const row = byLO.get(lo)
      if (row) row.monthProjections[i] += 1
    }
  })
  return Array.from(byLO.values()).sort((a, b) => b.totalPipelineValue - a.totalPipelineValue)
}

export interface ActualsVsProjectedPoint {
  month: string
  label: string
  isPast: boolean
  actualFiles: number | null
  actualVolume: number | null
  projectedFiles: number | null
  projectedVolume: number | null
  actualsRollingAvg: number | null
  projectedRollingAvg: number | null
}

export function computeActualsVsProjected(
  closedLoans: ClosedLoan[],
  projections: Record<string, MonthProjection>,
  monthsBack = 6,
  monthsForward = 4,
  refDate = new Date(),
): ActualsVsProjectedPoint[] {
  const start = addMonths(startOfMonth(refDate), -monthsBack)
  const totalMonths = monthsBack + monthsForward
  const allMonths = Array.from({ length: totalMonths }, (_, i) => format(addMonths(start, i), 'yyyy-MM'))
  const currentMonth = format(startOfMonth(refDate), 'yyyy-MM')

  const actualsByMonth = new Map<string, { files: number; volume: number }>()
  for (const loan of closedLoans) {
    if (!loan.milestone_date_completion) continue
    const mk = monthKey(loan.milestone_date_completion)
    const entry = actualsByMonth.get(mk) ?? { files: 0, volume: 0 }
    entry.files += 1
    entry.volume += loan.loan_amount ?? 0
    actualsByMonth.set(mk, entry)
  }

  const points: ActualsVsProjectedPoint[] = allMonths.map((m) => {
    const past = m < currentMonth
    const actual = actualsByMonth.get(m)
    const proj = projections[m]
    return {
      month: m,
      label: monthLabel(m),
      isPast: past,
      actualFiles: past ? actual?.files ?? 0 : null,
      actualVolume: past ? actual?.volume ?? 0 : null,
      projectedFiles: !past ? proj?.projectedFiles ?? 0 : null,
      projectedVolume: !past ? proj?.projectedVolume ?? 0 : null,
      actualsRollingAvg: null,
      projectedRollingAvg: null,
    }
  })

  // 3-month rolling average of actuals (only meaningful once 3 past points are known)
  for (let i = 0; i < points.length; i++) {
    const window = points.slice(Math.max(0, i - 2), i + 1).filter((p) => p.actualFiles !== null)
    if (window.length) {
      points[i].actualsRollingAvg = window.reduce((s, p) => s + (p.actualFiles ?? 0), 0) / window.length
    }
    const projWindow = points.slice(Math.max(0, i - 2), i + 1).filter((p) => p.projectedFiles !== null)
    if (projWindow.length) {
      points[i].projectedRollingAvg = projWindow.reduce((s, p) => s + (p.projectedFiles ?? 0), 0) / projWindow.length
    }
  }

  return points
}
