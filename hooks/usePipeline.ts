'use client'

import { useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'
import type { PipelineLoan } from '@/lib/types'

export interface PipelineRow extends PipelineLoan {
  daysInPipeline: number | null
}

export interface PipelineData {
  kpis: {
    totalOpenLoans: number
    totalPipelineValue: number
    avgDaysInPipeline: number
    expectedThisMonth: number
    pastEstCloseDate: number
  }
  funnel: { milestone: string; count: number }[]
  rows: PipelineRow[]
}

export function usePipeline(refreshKey: number) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    let cancelled = false
    fetch(`/api/pipeline?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setData(json))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, hydrated, refreshKey])

  return { data, loading }
}
