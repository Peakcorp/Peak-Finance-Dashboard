'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { MILESTONE_ORDER } from '@/lib/types'
import { formatCurrency } from '@/lib/dataUtils'
import type { ProjectionSettings, PipelineLoan, ProjectionOverride, ProjectionMode } from '@/lib/types'

interface RuleSetEditorProps {
  setting: ProjectionSettings | null
  onClose: () => void
  onSave: (id: string | null, payload: Partial<ProjectionSettings>) => Promise<void>
  months: string[]
  monthLabels: string[]
  pipelineLoans: PipelineLoan[]
  overrides: ProjectionOverride[]
  onSetOverride: (loanId: string, month: string, included: boolean, notes?: string) => Promise<void>
  onBulkSetOverrides: (loanIds: string[], month: string, included: boolean) => Promise<void>
}

export function RuleSetEditor({
  setting,
  onClose,
  onSave,
  months,
  monthLabels,
  pipelineLoans,
  overrides,
  onSetOverride,
  onBulkSetOverrides,
}: RuleSetEditorProps) {
  const [name, setName] = useState(setting?.name ?? 'New Rule Set')
  const [description, setDescription] = useState(setting?.description ?? '')
  const [mode, setMode] = useState<ProjectionMode>(setting?.mode ?? 'auto_milestone')
  const [includedMilestones, setIncludedMilestones] = useState<string[]>(setting?.included_milestones ?? [])
  const [confidence, setConfidence] = useState<Record<string, number>>(setting?.confidence_by_milestone ?? {})
  const [includePastEst, setIncludePastEst] = useState(setting?.include_past_est_date ?? true)
  const [includeNoEst, setIncludeNoEst] = useState(setting?.include_no_est_date ?? false)
  const [weightByConfidence, setWeightByConfidence] = useState(setting?.weight_by_confidence ?? true)
  const [activeMonth, setActiveMonth] = useState(months[0])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleMilestone(m: string) {
    setIncludedMilestones((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(setting?.id ?? null, {
      name,
      description,
      mode,
      included_milestones: includedMilestones,
      confidence_by_milestone: confidence,
      include_past_est_date: includePastEst,
      include_no_est_date: includeNoEst,
      weight_by_confidence: weightByConfidence,
    })
    setSaving(false)
    onClose()
  }

  const overrideMap = new Map(overrides.map((o) => [`${o.pipeline_loan_id}|||${o.projection_month}`, o]))
  const filteredLoans = pipelineLoans.filter((l) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (l.borrower_last_name ?? '').toLowerCase().includes(q) || (l.borrower_first_name ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{setting ? 'Edit Rule Set' : 'Create Rule Set'}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">✕</button>
        </div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-ink-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-ink-muted">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>

        <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {(['auto_milestone', 'manual'] as ProjectionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted')}
            >
              {m === 'auto_milestone' ? 'Auto (by Milestone)' : 'Manual (hand-pick loans)'}
            </button>
          ))}
        </div>

        {mode === 'auto_milestone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {MILESTONE_ORDER.slice()
                .reverse()
                .map((m) => (
                  <div key={m} className="flex items-center gap-3">
                    <input type="checkbox" checked={includedMilestones.includes(m)} onChange={() => toggleMilestone(m)} className="accent-brand-600" />
                    <span className="w-32 text-sm">{m}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={confidence[m] ?? 50}
                      onChange={(e) => setConfidence((c) => ({ ...c, [m]: Number(e.target.value) }))}
                      disabled={!includedMilestones.includes(m)}
                      className="flex-1 accent-brand-600"
                    />
                    <span className="w-10 text-right text-xs text-ink-muted">{confidence[m] ?? 50}%</span>
                  </div>
                ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includePastEst} onChange={(e) => setIncludePastEst(e.target.checked)} className="accent-brand-600" />
              Include loans where Est Close Date is past
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeNoEst} onChange={(e) => setIncludeNoEst(e.target.checked)} className="accent-brand-600" />
              Include loans with no Est Close Date
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={weightByConfidence} onChange={(e) => setWeightByConfidence(e.target.checked)} className="accent-brand-600" />
              Weight projected volume by confidence %
            </label>
          </div>
        )}

        {mode === 'manual' && (
          <div>
            <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
              {months.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setActiveMonth(m)}
                  className={clsx('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', activeMonth === m ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted')}
                >
                  {monthLabels[i]}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search loans..."
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
              <button
                onClick={() => onBulkSetOverrides(filteredLoans.map((l) => l.id), activeMonth, true)}
                className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Include All
              </button>
              <button
                onClick={() => onBulkSetOverrides(filteredLoans.map((l) => l.id), activeMonth, false)}
                className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Clear Month
              </button>
            </div>

            <div className="max-h-96 space-y-1 overflow-y-auto">
              {filteredLoans.map((l) => {
                const ov = overrideMap.get(`${l.id}|||${activeMonth}`)
                const included = ov?.included ?? false
                return (
                  <div key={l.id} className="flex items-center gap-2 rounded border border-slate-100 p-2 text-xs">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => onSetOverride(l.id, activeMonth, e.target.checked, ov?.notes ?? undefined)}
                      className="accent-brand-600"
                    />
                    <span className="w-28 truncate font-medium">{l.borrower_last_name}</span>
                    <span className="w-32 truncate text-ink-faint">{l.loan_officer}</span>
                    <span className="w-20">{formatCurrency(l.loan_amount)}</span>
                    <span className="w-24 truncate text-ink-faint">{l.current_milestone}</span>
                    <input
                      defaultValue={ov?.notes ?? ''}
                      onBlur={(e) => onSetOverride(l.id, activeMonth, included, e.target.value)}
                      placeholder="Notes"
                      className="flex-1 rounded border border-slate-200 px-1.5 py-1"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Rule Set'}
          </button>
        </div>
      </div>
    </div>
  )
}
