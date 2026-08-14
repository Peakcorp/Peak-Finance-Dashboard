'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { filtersToSearchParams } from '@/lib/filterUtils'
import type { PipelineLoan, ProjectionOverride, ProjectionMonthNote, ProjectionSettings } from '@/lib/types'
import type { MonthProjection, LOProjectionRow, ActualsVsProjectedPoint } from '@/lib/projectionUtils'

export interface ProjectionsData {
  settings: ProjectionSettings
  months: MonthProjection[]
  loBreakdown: LOProjectionRow[]
  actualsVsProjected: ActualsVsProjectedPoint[]
  monthNotes: ProjectionMonthNote[]
  pipelineLoans: PipelineLoan[]
  overrides: ProjectionOverride[]
}

export function useProjections(refreshKey: number) {
  const filters = useFilterStore((s) => s.filters)
  const hydrated = useFilterStore((s) => s.hydrated)
  const [data, setData] = useState<ProjectionsData | null>(null)
  const [allSettings, setAllSettings] = useState<ProjectionSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localTick, setLocalTick] = useState(0)

  const refetch = useCallback(() => setLocalTick((t) => t + 1), [])

  useEffect(() => {
    if (!hydrated) return
    setLoading(true)
    const params = filtersToSearchParams(filters)
    Promise.all([
      fetch(`/api/projections?${params.toString()}`).then((r) => r.json()),
      fetch('/api/projection-settings').then((r) => r.json()),
    ])
      .then(([proj, settingsRes]) => {
        if (proj.error) setError(proj.error)
        else {
          setData(proj)
          setError(null)
        }
        setAllSettings(settingsRes.settings ?? [])
      })
      .finally(() => setLoading(false))
  }, [filters, hydrated, refreshKey, localTick])

  async function createSetting(payload: Partial<ProjectionSettings>) {
    await fetch('/api/projection-settings', { method: 'POST', body: JSON.stringify(payload) })
    refetch()
  }

  async function updateSetting(id: string, payload: Partial<ProjectionSettings>) {
    await fetch('/api/projection-settings', { method: 'PATCH', body: JSON.stringify({ id, ...payload }) })
    refetch()
  }

  async function deleteSetting(id: string) {
    await fetch(`/api/projection-settings?id=${id}`, { method: 'DELETE' })
    refetch()
  }

  async function activateSetting(id: string) {
    await updateSetting(id, { is_active: true })
  }

  async function setOverride(pipelineLoanId: string, projectionMonth: string, included: boolean, notes?: string) {
    await fetch('/api/projection-overrides', { method: 'POST', body: JSON.stringify({ pipelineLoanId, projectionMonth, included, notes }) })
    refetch()
  }

  async function bulkSetOverrides(pipelineLoanIds: string[], projectionMonth: string, included: boolean) {
    await fetch('/api/projection-overrides', { method: 'PUT', body: JSON.stringify({ pipelineLoanIds, projectionMonth, included }) })
    refetch()
  }

  async function setMonthNote(month: string, notes: string) {
    await fetch('/api/projection-month-notes', { method: 'PUT', body: JSON.stringify({ month, notes }) })
  }

  return {
    data,
    allSettings,
    loading,
    error,
    createSetting,
    updateSetting,
    deleteSetting,
    activateSetting,
    setOverride,
    bulkSetOverrides,
    setMonthNote,
    refetch,
  }
}
