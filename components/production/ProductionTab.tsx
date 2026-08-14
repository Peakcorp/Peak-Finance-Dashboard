'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { useProduction } from '@/hooks/useProduction'
import { LOTable } from './LOTable'
import { ProcessorTable } from './ProcessorTable'
import { TeamHeatmap } from './TeamHeatmap'

const SUB_TABS = [
  { key: 'los', label: 'Loan Officers' },
  { key: 'processors', label: 'Processors' },
  { key: 'map', label: 'Team Map' },
] as const

export function ProductionTab({ refreshKey }: { refreshKey: number }) {
  const [sub, setSub] = useState<(typeof SUB_TABS)[number]['key']>('los')
  const { data, loading } = useProduction(refreshKey)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              sub === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'los' && <LOTable data={data?.loanOfficers ?? null} loading={loading} />}
      {sub === 'processors' && <ProcessorTable data={data?.processors ?? null} loading={loading} />}
      {sub === 'map' && <TeamHeatmap data={data} loading={loading} />}
    </div>
  )
}
