'use client'

import { useState } from 'react'
import { useProjections } from '@/hooks/useProjections'
import { getProjectionMonths, monthLabel } from '@/lib/projectionUtils'
import { MonthCard } from './MonthCard'
import { ProjectionChart } from './ProjectionChart'
import { LOProjectionTable } from './LOProjectionTable'
import { ProjectionSettingsPanel } from './ProjectionSettingsPanel'
import { RuleSetEditor } from './RuleSetEditor'
import { SkeletonChart } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { ProjectionSettings } from '@/lib/types'

export function ProjectionsTab({ refreshKey }: { refreshKey: number }) {
  const {
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
  } = useProjections(refreshKey)
  const [editing, setEditing] = useState<ProjectionSettings | null | 'new'>(null)

  const months = getProjectionMonths(4)
  const monthLabels = months.map(monthLabel)

  async function handleSave(id: string | null, payload: Partial<ProjectionSettings>) {
    if (id) await updateSetting(id, payload)
    else {
      await createSetting(payload)
    }
  }

  function handleDuplicate(setting: ProjectionSettings) {
    createSetting({ ...setting, name: `${setting.name} (copy)`, is_active: false })
  }

  if (error) return <EmptyState message={error} />

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {loading || !data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonChart key={i} height={160} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.months.map((m) => (
              <MonthCard
                key={m.month}
                projection={m}
                isAuto={data.settings.mode === 'auto_milestone'}
                note={data.monthNotes.find((n) => n.projection_month === m.month)?.notes ?? ''}
                onSaveNote={(notes) => setMonthNote(m.month, notes)}
              />
            ))}
          </div>
        )}

        <ProjectionChart points={data?.actualsVsProjected ?? null} loading={loading} />
        <LOProjectionTable rows={data?.loBreakdown ?? null} loading={loading} monthLabels={monthLabels} />
      </div>

      <div className="space-y-4">
        <ProjectionSettingsPanel
          allSettings={allSettings}
          onActivate={activateSetting}
          onEdit={(s) => setEditing(s ?? 'new')}
          onDuplicate={handleDuplicate}
          onDelete={deleteSetting}
        />
      </div>

      {editing !== null && (
        <RuleSetEditor
          setting={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          months={months}
          monthLabels={monthLabels}
          pipelineLoans={data?.pipelineLoans ?? []}
          overrides={data?.overrides ?? []}
          onSetOverride={setOverride}
          onBulkSetOverrides={bulkSetOverrides}
        />
      )}
    </div>
  )
}
