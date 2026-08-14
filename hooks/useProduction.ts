'use client'

import { useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'

export interface LOProduction {
  name: string
  files: number
  volume: number
  avgLoan: number
  avgRate: number
  states: string[]
  filesMTD: number
  filesYTD: number
  monthlySparkline: { month: string; count: number }[]
  processorBreakdown: { processor: string; count: number }[]
  loanTypeMix: { type: string; count: number }[]
  stateCoverage: { state: string; count: number }[]
  topReferrals: { source: string; count: number }[]
}

export interface ProcessorProduction {
  name: string
  files: number
  volume: number
  avgLoan: number
  losSupported: number
  filesMTD: number
  loBreakdown: { lo: string; count: number }[]
  openPipelineCount: number
}

export interface ProductionData {
  loanOfficers: LOProduction[]
  processors: ProcessorProduction[]
  heatmap: { los: string[]; processors: string[]; cells: { lo: string; processor: string; count: number; volume: number }[] }
}

export function useProduction(refreshKey: number) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [data, setData] = useState<ProductionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    let cancelled = false
    fetch(`/api/production?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setData(json))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, hydrated, refreshKey])

  return { data, loading }
}
