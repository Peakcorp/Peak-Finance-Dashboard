'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams, searchParamsToFilters, countActiveFilters } from '@/lib/filterUtils'

// Hydrates the Zustand filter store from the URL on first mount, then keeps the
// URL in sync (via history.replace, not push) whenever filters change afterward.
export function useFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { filters, hydrated, setFilters, hydrateFromFilters, clearAll, toggleArrayValue } = useFilterStore()
  const didHydrate = useRef(false)

  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    hydrateFromFilters(searchParamsToFilters(searchParams))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const params = filtersToSearchParams(filters)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, hydrated])

  return {
    filters,
    setFilters,
    clearAll,
    toggleArrayValue,
    activeCount: countActiveFilters(filters),
  }
}

export interface FilterOptions {
  loanOfficers: string[]
  processors: string[]
  states: string[]
  cities: string[]
  loanTypes: string[]
  channels: string[]
  loanPrograms: string[]
  referralSources: string[]
}

const EMPTY_OPTIONS: FilterOptions = {
  loanOfficers: [],
  processors: [],
  states: [],
  cities: [],
  loanTypes: [],
  channels: [],
  loanPrograms: [],
  referralSources: [],
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/filter-options')
      .then((res) => res.json())
      .then((data: FilterOptions) => {
        if (!cancelled) setOptions(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { options, loading }
}
