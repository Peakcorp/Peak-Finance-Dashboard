import { create } from 'zustand'
import type { DashboardFilters } from '@/lib/types'
import { DEFAULT_FILTERS } from '@/lib/filterUtils'

interface FilterStore {
  filters: DashboardFilters
  hydrated: boolean
  setFilters: (partial: Partial<DashboardFilters>) => void
  hydrateFromFilters: (filters: DashboardFilters) => void
  clearAll: () => void
  toggleArrayValue: (key: keyof DashboardFilters, value: string) => void
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  filters: DEFAULT_FILTERS,
  hydrated: false,
  setFilters: (partial) => set((state) => ({ filters: { ...state.filters, ...partial } })),
  hydrateFromFilters: (filters) => set({ filters, hydrated: true }),
  clearAll: () => set({ filters: DEFAULT_FILTERS }),
  toggleArrayValue: (key, value) => {
    const current = get().filters[key]
    if (!Array.isArray(current)) return
    const exists = current.includes(value)
    const next = exists ? current.filter((v) => v !== value) : [...current, value]
    set((state) => ({ filters: { ...state.filters, [key]: next } }))
  },
}))
