'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { formatCurrency, formatDate, todayISO } from '@/lib/dataUtils'
import { exportToCsv } from '@/lib/csvExport'
import { MILESTONE_ORDER } from '@/lib/types'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { PipelineRow } from '@/hooks/usePipeline'

type SortKey = 'borrower_last_name' | 'loan_officer' | 'loan_processor' | 'loan_amount' | 'loan_type' | 'loan_program' | 'current_milestone' | 'est_closing_date' | 'daysInPipeline'

const MILESTONE_COLORS: Record<string, string> = {}
MILESTONE_ORDER.forEach((m, i) => {
  const t = i / (MILESTONE_ORDER.length - 1)
  MILESTONE_COLORS[m] = `rgb(${Math.round(203 - t * (203 - 29))}, ${Math.round(213 - t * (213 - 78))}, ${Math.round(225 - t * (225 - 216))})`
})

function MilestonePill({ milestone }: { milestone: string | null }) {
  if (!milestone) return <span className="text-ink-faint">—</span>
  const bg = MILESTONE_COLORS[milestone] ?? '#cbd5e1'
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: bg }}>
      {milestone}
    </span>
  )
}

function EstCloseIndicator({ date }: { date: string | null }) {
  if (!date) return <span className="text-ink-faint">—</span>
  const today = todayISO()
  const diffDays = (new Date(date).getTime() - new Date(today).getTime()) / 86400000
  const icon = diffDays < 0 ? '🔴' : diffDays <= 7 ? '🟡' : '🟢'
  return (
    <span className="whitespace-nowrap">
      {icon} {formatDate(date)}
    </span>
  )
}

interface PipelineTableProps {
  rows: PipelineRow[]
  loading: boolean
  activeMilestone: string | null
}

export function PipelineTable({ rows, loading, activeMilestone }: PipelineTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('daysInPipeline')
  const [desc, setDesc] = useState(true)
  const [search, setSearch] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState<string | null>(null)

  const effectiveMilestone = activeMilestone ?? milestoneFilter

  const filtered = useMemo(() => {
    let r = rows
    if (effectiveMilestone) r = r.filter((row) => row.current_milestone === effectiveMilestone)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (row) =>
          (row.borrower_last_name ?? '').toLowerCase().includes(q) ||
          (row.borrower_first_name ?? '').toLowerCase().includes(q) ||
          (row.property_address ?? '').toLowerCase().includes(q),
      )
    }
    return r
  }, [rows, effectiveMilestone, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (av < bv) return desc ? 1 : -1
      if (av > bv) return desc ? -1 : 1
      return 0
    })
  }, [filtered, sortKey, desc])

  if (loading) return <SkeletonTable rows={10} />

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d)
    else {
      setSortKey(key)
      setDesc(true)
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: 'borrower_last_name', label: 'Borrower' },
    { key: 'loan_officer', label: 'Loan Officer' },
    { key: 'loan_processor', label: 'Processor' },
    { key: 'loan_amount', label: 'Amount' },
    { key: 'loan_type', label: 'Type' },
    { key: 'loan_program', label: 'Program' },
    { key: 'current_milestone', label: 'Milestone' },
    { key: 'est_closing_date', label: 'Est Close Date' },
    { key: 'daysInPipeline', label: 'Days in Pipeline' },
  ]

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Pipeline ({filtered.length})</h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search borrower or address..."
          className="ml-2 w-56 rounded-lg border border-slate-200 px-2.5 py-1 text-sm outline-none focus:border-brand-400"
        />
        <div className="ml-1 flex flex-wrap gap-1">
          {MILESTONE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMilestoneFilter(milestoneFilter === m ? null : m)}
              className={clsx(
                'rounded-full px-2 py-0.5 text-xs font-medium transition-opacity',
                milestoneFilter === m ? 'opacity-100 ring-2 ring-brand-400' : 'opacity-70 hover:opacity-100',
              )}
              style={{ background: MILESTONE_COLORS[m], color: 'white' }}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportToCsv('pipeline', sorted)}
          className="ml-auto text-xs font-medium text-brand-700 hover:underline"
        >
          Export CSV
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-ink-faint">
                {columns.map((c) => (
                  <th key={c.key} className="cursor-pointer whitespace-nowrap py-2 pr-4 font-medium" onClick={() => toggleSort(c.key)}>
                    {c.label} {sortKey === c.key && (desc ? '▼' : '▲')}
                  </th>
                ))}
                <th className="py-2 pr-4 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-surface-subtle">
                  <td className="py-2 pr-4">
                    {row.borrower_last_name}
                    {row.borrower_first_name ? `, ${row.borrower_first_name.charAt(0)}.` : ''}
                  </td>
                  <td className="py-2 pr-4">{row.loan_officer ?? '—'}</td>
                  <td className="py-2 pr-4">{row.loan_processor ?? '—'}</td>
                  <td className="py-2 pr-4">{formatCurrency(row.loan_amount)}</td>
                  <td className="py-2 pr-4">{row.loan_type ?? '—'}</td>
                  <td className="py-2 pr-4">{row.loan_program ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <MilestonePill milestone={row.current_milestone} />
                  </td>
                  <td className="py-2 pr-4">
                    <EstCloseIndicator date={row.est_closing_date} />
                  </td>
                  <td className="py-2 pr-4">{row.daysInPipeline ?? '—'}</td>
                  <td className="py-2 pr-4 text-ink-faint">
                    {row.property_state ?? ''} {row.property_city ? `· ${row.property_city}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
