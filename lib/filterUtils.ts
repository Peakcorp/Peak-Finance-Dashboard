import type { DashboardFilters } from './types'
import { getPresetRange } from './dataUtils'

export const DEFAULT_FILTERS: DashboardFilters = {
  dateFrom: null,
  dateTo: null,
  datePreset: 'YTD',
  loanOfficers: [],
  processors: [],
  states: [],
  cities: [],
  loanTypes: [],
  channels: [],
  amountMin: null,
  amountMax: null,
  loanPrograms: [],
  referralSources: [],
}

export function resolvedDateRange(filters: DashboardFilters): { from: string; to: string } | null {
  if (filters.datePreset === 'CUSTOM') {
    if (!filters.dateFrom || !filters.dateTo) return null
    return { from: filters.dateFrom, to: filters.dateTo }
  }
  return getPresetRange(filters.datePreset)
}

// Minimal shape covering the subset of the Supabase query builder we use for filtering.
interface FilterableQuery {
  gte(column: string, value: unknown): FilterableQuery
  lte(column: string, value: unknown): FilterableQuery
  in(column: string, values: unknown[]): FilterableQuery
}

export function applyCommonFilters<T extends FilterableQuery>(query: T, filters: DashboardFilters): T {
  let q = query
  if (filters.loanOfficers.length) q = q.in('loan_officer', filters.loanOfficers) as T
  if (filters.processors.length) q = q.in('loan_processor', filters.processors) as T
  if (filters.states.length) q = q.in('property_state', filters.states) as T
  if (filters.cities.length) q = q.in('property_city', filters.cities) as T
  if (filters.loanTypes.length) q = q.in('loan_type', filters.loanTypes) as T
  if (filters.channels.length) q = q.in('loan_channel', filters.channels) as T
  if (filters.loanPrograms.length) q = q.in('loan_program', filters.loanPrograms) as T
  if (filters.referralSources.length) q = q.in('referral_source', filters.referralSources) as T
  if (filters.amountMin !== null) q = q.gte('loan_amount', filters.amountMin) as T
  if (filters.amountMax !== null) q = q.lte('loan_amount', filters.amountMax) as T
  return q
}

// "Closed" date is driven by the Completion milestone, not FUNDING CLOSE DATE (see lib/dataUtils.ts isClosedLoanRow).
export function applyClosedDateFilter<T extends FilterableQuery>(
  query: T,
  from: string,
  to: string,
): T {
  return query.gte('milestone_date_completion', from).lte('milestone_date_completion', to) as T
}

// ---------- URL <-> filters ----------

const ARRAY_KEYS: (keyof DashboardFilters)[] = [
  'loanOfficers',
  'processors',
  'states',
  'cities',
  'loanTypes',
  'channels',
  'loanPrograms',
  'referralSources',
]

export function filtersToSearchParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.datePreset) params.set('datePreset', filters.datePreset)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.amountMin !== null) params.set('amountMin', String(filters.amountMin))
  if (filters.amountMax !== null) params.set('amountMax', String(filters.amountMax))
  for (const key of ARRAY_KEYS) {
    const val = filters[key] as string[]
    if (val.length) params.set(key, val.join(','))
  }
  return params
}

export function searchParamsToFilters(params: URLSearchParams): DashboardFilters {
  const filters: DashboardFilters = { ...DEFAULT_FILTERS }
  if (params.has('datePreset')) filters.datePreset = params.get('datePreset') as DashboardFilters['datePreset']
  if (params.has('dateFrom')) filters.dateFrom = params.get('dateFrom')
  if (params.has('dateTo')) filters.dateTo = params.get('dateTo')
  if (params.has('amountMin')) filters.amountMin = Number(params.get('amountMin'))
  if (params.has('amountMax')) filters.amountMax = Number(params.get('amountMax'))
  for (const key of ARRAY_KEYS) {
    const raw = params.get(key)
    if (raw) (filters[key] as string[]) = raw.split(',').filter(Boolean)
  }
  return filters
}

export function countActiveFilters(filters: DashboardFilters): number {
  let count = 0
  if (filters.datePreset !== DEFAULT_FILTERS.datePreset) count++
  for (const key of ARRAY_KEYS) {
    if ((filters[key] as string[]).length) count++
  }
  if (filters.amountMin !== null) count++
  if (filters.amountMax !== null) count++
  return count
}
