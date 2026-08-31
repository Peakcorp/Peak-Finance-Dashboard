'use client'

import { useState } from 'react'
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '@/lib/dataUtils'
import type { MonthProjection } from '@/lib/projectionUtils'

interface MonthCardProps {
  projection: MonthProjection
  isAuto: boolean
  note: string
  onSaveNote: (notes: string) => void
}

export function MonthCard({ projection, isAuto, note, onSaveNote }: MonthCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState(note)

  const closedCount = projection.loans.filter((l) => l.alreadyClosed).length
  const pipelineCount = projection.loans.length - closedCount

  return (
    <div className="card flex flex-col">
      <h3 className="text-sm font-semibold text-ink">{projection.label}</h3>
      <div className="mt-3 space-y-2">
        <Stat label="Projected Files" value={formatNumber(projection.projectedFiles)} />
        <Stat label="Projected Volume" value={formatCurrencyCompact(projection.projectedVolume)} />
        {isAuto && <Stat label="Weighted Volume" value={formatCurrencyCompact(projection.weightedVolume)} />}
        {isAuto && projection.avgConfidence !== null && <Stat label="Avg Confidence" value={formatPercent(projection.avgConfidence, 0)} />}
      </div>

      <button onClick={() => setExpanded((e) => !e)} className="mt-3 text-left text-xs font-medium text-brand-700 hover:underline">
        {expanded ? 'Hide' : 'Show'} {projection.loans.length} qualifying loan{projection.loans.length === 1 ? '' : 's'}
        {closedCount > 0 && ` (${closedCount} already closed, ${pipelineCount} still in pipeline)`}
      </button>

      {expanded && (
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-xs">
          {projection.loans.length === 0 && <p className="text-ink-faint">No qualifying loans this month.</p>}
          {projection.loans.map((l) => (
            <div key={l.id} className={`rounded border p-1.5 ${l.alreadyClosed ? 'border-success/30 bg-success/5' : 'border-slate-100'}`}>
              <div className="flex justify-between font-medium">
                <span className="truncate">
                  {l.borrower_last_name}, {l.borrower_first_name?.charAt(0)}.
                </span>
                <span>{formatCurrency(l.loan_amount)}</span>
              </div>
              <div className="flex justify-between text-ink-faint">
                <span className="truncate">
                  {l.loan_officer} · {l.alreadyClosed ? <span className="font-medium text-success">✓ Closed</span> : l.current_milestone}
                </span>
                {l.confidence !== null && !l.alreadyClosed && <span>{l.confidence}%</span>}
              </div>
              {l.notes && <p className="mt-0.5 text-ink-muted">{l.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => noteDraft !== note && onSaveNote(noteDraft)}
        placeholder="Notes for this month..."
        rows={2}
        className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}
