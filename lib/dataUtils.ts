import crypto from 'crypto'
import * as XLSX from 'xlsx'
import {
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subYears,
  differenceInCalendarDays,
} from 'date-fns'

// ---------- Excel parsing ----------

export function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (d && d.y > 1900) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
    return null
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/,/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function normalizeName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function normalizeLOName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ')
}

interface UniqueKeyInput {
  closed_date: string | null
  loan_officer: string | null
  borrower_last_name: string | null
  loan_amount: number | null
}

// "Closed" is defined by reaching the Completion milestone, not by FUNDING CLOSE DATE
// (that column is unreliable/sparse in the source export) — see milestone_date_completion.
export function makeUniqueKey(row: UniqueKeyInput): string {
  const parts = [
    row.closed_date ?? 'null',
    normalizeName(row.loan_officer),
    normalizeName(row.borrower_last_name),
    String(row.loan_amount ?? 0),
  ]
  return crypto.createHash('md5').update(parts.join('|')).digest('hex')
}

// Raw row shape as read out of either sheet via XLSX.utils.sheet_to_json with defval:null
export interface RawEncompassRow {
  'FUNDING CLOSE DATE'?: unknown
  'Loan Officer'?: unknown
  'Loan Processor'?: unknown
  'Loan Amount'?: unknown
  'Interest Rate'?: unknown
  'Date File Started'?: unknown
  'Lock Date'?: unknown
  'Milestone Date - Submittal'?: unknown
  'Milestone Date - Completion'?: unknown
  'Current Milestone'?: unknown
  'Borrower First/Middle Name'?: unknown
  'Borrower Last Name'?: unknown
  'Subject Property Address'?: unknown
  'Subject Property City'?: unknown
  'Subject Property State'?: unknown
  'Subject Property Zip'?: unknown
  'Loan Info Channel'?: unknown
  'Loan Type'?: unknown
  'Loan Program'?: unknown
  'Referral Source Name'?: unknown
  'Est Closing Date'?: unknown
}

function str(v: unknown): string | null {
  const s = (v ?? '').toString().trim()
  return s.length ? s : null
}

export interface ParsedLoanFields {
  loan_officer: string | null
  loan_processor: string | null
  loan_amount: number | null
  interest_rate: number | null
  date_file_started: string | null
  lock_date: string | null
  milestone_date_submittal: string | null
  milestone_date_completion: string | null
  current_milestone: string | null
  borrower_first_name: string | null
  borrower_last_name: string | null
  property_address: string | null
  property_city: string | null
  property_state: string | null
  property_zip: string | null
  loan_channel: string | null
  loan_type: string | null
  loan_program: string | null
  referral_source: string | null
  est_closing_date: string | null
}

export function parseLoanRow(row: RawEncompassRow): ParsedLoanFields {
  return {
    loan_officer: normalizeLOName(str(row['Loan Officer'])) || null,
    loan_processor: normalizeLOName(str(row['Loan Processor'])) || null,
    loan_amount: parseNumber(row['Loan Amount']),
    interest_rate: parseNumber(row['Interest Rate']),
    date_file_started: parseExcelDate(row['Date File Started']),
    lock_date: parseExcelDate(row['Lock Date']),
    milestone_date_submittal: parseExcelDate(row['Milestone Date - Submittal']),
    milestone_date_completion: parseExcelDate(row['Milestone Date - Completion']),
    current_milestone: str(row['Current Milestone']),
    borrower_first_name: str(row['Borrower First/Middle Name']),
    borrower_last_name: str(row['Borrower Last Name']),
    property_address: str(row['Subject Property Address']),
    property_city: str(row['Subject Property City']),
    property_state: str(row['Subject Property State']),
    property_zip: str(row['Subject Property Zip']),
    loan_channel: str(row['Loan Info Channel']),
    loan_type: str(row['Loan Type']),
    loan_program: str(row['Loan Program']),
    referral_source: str(row['Referral Source Name']),
    est_closing_date: parseExcelDate(row['Est Closing Date']),
  }
}

// A row counts as a real closed loan only once it has reached the Completion milestone
// with a completion date — FUNDING CLOSE DATE is stored for reference but not used to decide this.
export function isClosedLoanRow(fields: Pick<ParsedLoanFields, 'current_milestone' | 'milestone_date_completion'>): boolean {
  return fields.current_milestone === 'Completion' && fields.milestone_date_completion !== null
}

export function parseClosedLoanRow(row: RawEncompassRow) {
  const fields = parseLoanRow(row)
  const funding_close_date = parseExcelDate(row['FUNDING CLOSE DATE'])
  const unique_key = makeUniqueKey({
    closed_date: fields.milestone_date_completion,
    loan_officer: fields.loan_officer,
    borrower_last_name: fields.borrower_last_name,
    loan_amount: fields.loan_amount,
  })
  return { ...fields, funding_close_date, unique_key, isClosed: isClosedLoanRow(fields) }
}

// Pipeline loans stuck in a non-Completion milestone since before this cutoff are treated as
// abandoned/stalled files, not real active pipeline — excluded on every seed/upload.
export const STALE_PIPELINE_CUTOFF_DATE = '2026-01-01'

export function isStalePipelineRow(fields: Pick<ParsedLoanFields, 'current_milestone' | 'date_file_started'>): boolean {
  return (
    fields.current_milestone !== 'Completion' &&
    fields.date_file_started !== null &&
    fields.date_file_started < STALE_PIPELINE_CUTOFF_DATE
  )
}

// A pipeline row already at Completion has, in effect, closed — it isn't "active pipeline"
// anymore and would double-count against the real closed-loan figures. Excluded on every
// seed/upload; see also isStalePipelineRow above for the separate abandoned-file rule.
export function isCompletionMilestone(fields: Pick<ParsedLoanFields, 'current_milestone'>): boolean {
  return fields.current_milestone === 'Completion'
}

export function shouldExcludeFromPipeline(fields: Pick<ParsedLoanFields, 'current_milestone' | 'date_file_started'>): boolean {
  return isCompletionMilestone(fields) || isStalePipelineRow(fields)
}

// ---------- Formatting ----------

const numberFmt = new Intl.NumberFormat('en-US')
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return numberFmt.format(n)
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return currencyFmt.format(n)
}

export function formatCurrencyCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return currencyFmt.format(n)
}

export function formatPercent(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return `${n.toFixed(decimals)}%`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatDelta(current: number, prior: number): number {
  if (!prior) return current > 0 ? 100 : 0
  return ((current - prior) / prior) * 100
}

// ---------- Date range helpers ----------

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const to = format(now, 'yyyy-MM-dd')
  let from: Date
  switch (preset) {
    case 'MTD':
      from = startOfMonth(now)
      break
    case 'QTD':
      from = startOfQuarter(now)
      break
    case 'YTD':
      from = startOfYear(now)
      break
    case 'L12M':
      from = subDays(startOfDay(now), 365)
      break
    case 'ALL':
      from = new Date('2000-01-01')
      break
    default:
      from = startOfYear(now)
  }
  return { from: format(from, 'yyyy-MM-dd'), to }
}

// Given a date range, return the equivalent prior period of the same length
// (kept for reference; KPI deltas use getPriorYearPeriod below instead)
export function getPriorPeriod(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  const lengthDays = differenceInCalendarDays(t, f) + 1
  const priorTo = subDays(f, 1)
  const priorFrom = subDays(priorTo, lengthDays - 1)
  return { from: format(priorFrom, 'yyyy-MM-dd'), to: format(priorTo, 'yyyy-MM-dd') }
}

// Same calendar period, one year earlier — e.g. YTD (Jan 1-today) compares against
// Jan 1-today of last year, not an arbitrary trailing window. Used for KPI deltas.
export function getPriorYearPeriod(from: string, to: string): { from: string; to: string } {
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  return { from: format(subYears(f, 1), 'yyyy-MM-dd'), to: format(subYears(t, 1), 'yyyy-MM-dd') }
}

export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function autoGranularity(from: string, to: string): Granularity {
  const days = differenceInCalendarDays(new Date(to), new Date(from))
  if (days <= 45) return 'daily'
  if (days <= 180) return 'weekly'
  if (days <= 900) return 'monthly'
  return 'yearly'
}

export function bucketKey(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr + 'T00:00:00')
  switch (granularity) {
    case 'daily':
      return format(d, 'yyyy-MM-dd')
    case 'weekly':
      return format(startOfWeek(d), 'yyyy-MM-dd')
    case 'monthly':
      return format(d, 'yyyy-MM')
    case 'yearly':
      return format(d, 'yyyy')
  }
}

export function bucketLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case 'daily':
    case 'weekly':
      return format(new Date(key + 'T00:00:00'), 'MMM d')
    case 'monthly':
      return format(new Date(key + '-01T00:00:00'), 'MMM yyyy')
    case 'yearly':
      return key
  }
}

export function daysInPipeline(dateFileStarted: string | null): number | null {
  if (!dateFileStarted) return null
  return differenceInCalendarDays(new Date(), new Date(dateFileStarted + 'T00:00:00'))
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}
