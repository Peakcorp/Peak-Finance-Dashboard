'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Upload } from '@/lib/types'

interface HeaderProps {
  onUploadClick: () => void
  onHistoryClick: () => void
  refreshKey: number
}

export function Header({ onUploadClick, onHistoryClick, refreshKey }: HeaderProps) {
  const [latest, setLatest] = useState<Upload | null>(null)

  useEffect(() => {
    supabase
      .from('uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatest(data))
  }, [refreshKey])

  return (
    <header className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div>
        <h1 className="text-lg font-bold text-ink">Peak Finance Dashboard</h1>
        <p className="text-xs text-ink-faint">
          {latest
            ? `Data as of: ${new Date(latest.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Uploaded by ${latest.uploaded_by}`
            : 'No data uploaded yet'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-slate-50"
        >
          Print Report
        </button>
        <button
          onClick={onHistoryClick}
          aria-label="Upload history"
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-ink-muted hover:bg-slate-50"
        >
          🕐
        </button>
        <button
          onClick={onUploadClick}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          ⬆ Upload Report
        </button>
      </div>
    </header>
  )
}
