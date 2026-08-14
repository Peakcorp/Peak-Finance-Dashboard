'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { useFilters, useFilterOptions } from '@/hooks/useFilters'
import { MultiSelect } from '@/components/shared/MultiSelect'
import type { DashboardFilters } from '@/lib/types'

const PRESETS: { value: DashboardFilters['datePreset']; label: string }[] = [
  { value: 'MTD', label: 'MTD' },
  { value: 'QTD', label: 'QTD' },
  { value: 'YTD', label: 'YTD' },
  { value: 'L12M', label: 'L12M' },
  { value: 'ALL', label: 'All Time' },
]

export function FilterBar() {
  const { filters, setFilters, clearAll, activeCount } = useFilters()
  const { options, loading } = useFilterOptions()
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className="no-print border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setFilters({ datePreset: p.value, dateFrom: null, dateTo: null })}
              className={clsx(
                'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                filters.datePreset === p.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCustomOpen((v) => !v)}
            className={clsx(
              'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
              filters.datePreset === 'CUSTOM' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            Custom
          </button>
        </div>

        {customOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => setFilters({ datePreset: 'CUSTOM', dateFrom: e.target.value })}
              className="rounded border border-slate-200 px-1.5 py-1 text-sm"
            />
            <span className="text-ink-faint">–</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => setFilters({ datePreset: 'CUSTOM', dateTo: e.target.value })}
              className="rounded border border-slate-200 px-1.5 py-1 text-sm"
            />
          </div>
        )}

        <div className="h-6 w-px bg-slate-200" />

        <MultiSelect label="Loan Officers" options={options.loanOfficers} selected={filters.loanOfficers} onChange={(v) => setFilters({ loanOfficers: v })} />
        <MultiSelect label="Processors" options={options.processors} selected={filters.processors} onChange={(v) => setFilters({ processors: v })} />
        <MultiSelect label="States" options={options.states} selected={filters.states} onChange={(v) => setFilters({ states: v })} />
        <MultiSelect label="Cities" options={options.cities} selected={filters.cities} onChange={(v) => setFilters({ cities: v })} />
        <MultiSelect label="Loan Type" options={options.loanTypes} selected={filters.loanTypes} onChange={(v) => setFilters({ loanTypes: v })} />
        <MultiSelect label="Channel" options={options.channels} selected={filters.channels} onChange={(v) => setFilters({ channels: v })} />
        <MultiSelect label="Program" options={options.loanPrograms} selected={filters.loanPrograms} onChange={(v) => setFilters({ loanPrograms: v })} />
        <MultiSelect label="Referral Source" options={options.referralSources} selected={filters.referralSources} onChange={(v) => setFilters({ referralSources: v })} />

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1">
          <input
            type="number"
            placeholder="Min $"
            value={filters.amountMin ?? ''}
            onChange={(e) => setFilters({ amountMin: e.target.value ? Number(e.target.value) : null })}
            className="w-20 text-sm outline-none"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="number"
            placeholder="Max $"
            value={filters.amountMax ?? ''}
            onChange={(e) => setFilters({ amountMax: e.target.value ? Number(e.target.value) : null })}
            className="w-20 text-sm outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {loading && <span className="text-xs text-ink-faint">Loading filters…</span>}
          {activeCount > 0 && (
            <>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
                Active Filters: {activeCount}
              </span>
              <button onClick={clearAll} className="text-sm font-medium text-ink-muted hover:text-danger">
                Clear All
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
