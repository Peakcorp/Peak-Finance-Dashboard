'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { ProjectionSettings } from '@/lib/types'

interface ProjectionSettingsPanelProps {
  allSettings: ProjectionSettings[]
  onActivate: (id: string) => void
  onEdit: (setting: ProjectionSettings | null) => void
  onDuplicate: (setting: ProjectionSettings) => void
  onDelete: (id: string) => void
}

export function ProjectionSettingsPanel({ allSettings, onActivate, onEdit, onDuplicate, onDelete }: ProjectionSettingsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="card">
      <button onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center justify-between text-sm font-semibold text-ink">
        Rule Set Settings
        <span className="text-ink-faint">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          {allSettings.map((s) => (
            <div
              key={s.id}
              className={clsx('rounded-lg border p-3', s.is_active ? 'border-brand-300 bg-brand-50' : 'border-slate-200')}
            >
              <div className="flex items-center justify-between">
                <button onClick={() => onActivate(s.id)} className="text-left text-sm font-medium">
                  {s.is_active && <span className="mr-1 text-brand-600">●</span>}
                  {s.name}
                </button>
                <span className="text-xs uppercase text-ink-faint">{s.mode === 'auto_milestone' ? 'Auto' : 'Manual'}</span>
              </div>
              {s.description && <p className="mt-1 text-xs text-ink-faint">{s.description}</p>}
              <div className="mt-2 flex gap-2 text-xs">
                <button onClick={() => onEdit(s)} className="font-medium text-brand-700 hover:underline">
                  Edit
                </button>
                <button onClick={() => onDuplicate(s)} className="font-medium text-ink-muted hover:underline">
                  Duplicate
                </button>
                <button onClick={() => onDelete(s.id)} className="font-medium text-danger hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => onEdit(null)}
            className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-ink-muted hover:bg-slate-50"
          >
            + Create New Rule Set
          </button>
        </div>
      )}
    </div>
  )
}
