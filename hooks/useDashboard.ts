'use client'

import { useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'
import type { Granularity } from '@/lib/dataUtils'

export interface TrendPoint {
  key: string
  label: string
  files: number
  volume: number
}

export interface DashboardData {
  kpis: {
    totalFiles: number
    totalFilesDelta: number
    totalVolume: number
    totalVolumeDelta: number
    avgLoanSize: number
    avgInterestRate: number
    activePipeline: number
    peakMonth: { month: string; count: number } | null
  }
  trend: { granularity: Granularity; points: TrendPoint[] }
  yoy: { years: number[]; points: Record<string, number | string>[] }
  dayOfWeek: { day: string; count: number }[]
  states: { state: string; files: number; volume: number; avgLoan: number; pctOfTotal: number }[]
  topReferrals: { source: string; count: number }[]
  loanTypeMix: { type: string; count: number }[]
  channelSplit: { channel: string; count: number }[]
}

export function useDashboard(refreshKey: number, granularityOverride?: Granularity) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    if (granularityOverride) params.set('granularity', granularityOverride)
    let cancelled = false
    fetch(`/api/dashboard?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) setError(json.error)
        else {
          setData(json)
          setError(null)
        }
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, hydrated, refreshKey, granularityOverride])

  return { data, loading, error }
}
