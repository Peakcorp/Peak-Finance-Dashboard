'use client'

import { useFilters } from '@/hooks/useFilters'

export function EmptyState({ message = 'No data matches the current filters.' }: { message?: string }) {
  const { clearAll } = useFilters()
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      <button
        onClick={clearAll}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Clear Filters
      </button>
    </div>
  )
}
