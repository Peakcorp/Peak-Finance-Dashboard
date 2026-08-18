'use client'

import { useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'

export interface LOFinancials {
  loanOfficer: string
  filesClosed: number
  revenue: number
  directExpense: number
  netLoanProfit: number
}

export interface UnmatchedTransaction {
  postedDate: string | null
  account: string
  amount: number
  memo: string | null
  loanNumberRef: string | null
  borrowerLastNameRef: string | null
  propertyAddressRef: string | null
}

export interface FinancialsData {
  period: { from: string; to: string }
  byLoanOfficer: LOFinancials[]
  totals: {
    matchedRevenue: number
    matchedDirectExpense: number
    matchedNetLoanProfit: number
    unmatchedRevenue: number
    unmatchedDirectExpense: number
    overhead: number
    netCompanyProfit: number
  }
  matchStats: { totalLoanLinkableTransactions: number; matchedCount: number; unmatchedCount: number }
  unmatchedTransactions: UnmatchedTransaction[]
}

export function useFinancials(refreshKey: number) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [data, setData] = useState<FinancialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    let cancelled = false
    fetch(`/api/financials?${params.toString()}`)
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
  }, [filters, hydrated, refreshKey])

  return { data, loading, error }
}
