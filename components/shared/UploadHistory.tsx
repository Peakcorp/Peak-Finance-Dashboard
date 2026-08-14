'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Upload } from '@/lib/types'
import { formatNumber } from '@/lib/dataUtils'

export function UploadHistory({ onClose }: { onClose: () => void }) {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('uploads')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setUploads(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload History</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">✕</button>
        </div>

        {loading && <p className="text-sm text-ink-faint">Loading…</p>}
        {!loading && uploads.length === 0 && <p className="text-sm text-ink-faint">No uploads yet.</p>}

        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="truncate font-medium">{u.filename}</p>
              <p className="text-ink-faint">
                {u.uploaded_by} · {new Date(u.uploaded_at).toLocaleString()}
              </p>
              <p className="mt-1 text-ink-muted">
                {formatNumber(u.closed_count)} closed · {formatNumber(u.pipeline_count)} pipeline
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
