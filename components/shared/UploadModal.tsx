'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import type { UploadApiResponse } from '@/lib/types'

interface SheetPreview {
  dataRows: number | null
  tableRows: number | null
  unrecognized: boolean
}

interface UploadModalProps {
  onClose: () => void
  onUploaded: () => void
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [uploadedBy, setUploadedBy] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SheetPreview | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    setError(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const dataSheet = wb.Sheets['Data']
      const tableSheet = wb.Sheets['Table']
      const dataRows = dataSheet ? XLSX.utils.sheet_to_json(dataSheet).length : null
      const tableRows = tableSheet ? XLSX.utils.sheet_to_json(tableSheet).length : null
      setPreview({ dataRows, tableRows, unrecognized: !dataSheet && !tableSheet })
    } catch {
      setError('Could not read this file. Please upload a valid .xlsx or .xls export.')
      setPreview(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function upload() {
    if (!file) return
    setUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploadedBy', uploadedBy)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setResult(json)
      onUploaded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload Report</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">✕</button>
        </div>

        {!result && (
          <>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-ink-muted">Uploader name (optional)</span>
              <input
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-surface-subtle'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <p className="text-sm text-ink-muted">Drag and drop your Encompass export here, or click to browse</p>
              <p className="mt-1 text-xs text-ink-faint">.xlsx or .xls</p>
              {file && <p className="mt-3 text-sm font-medium text-ink">{file.name}</p>}
            </div>

            {preview && (
              <div className="mt-4 space-y-1.5 rounded-lg bg-surface-subtle p-3 text-sm">
                {preview.unrecognized && (
                  <p className="text-warning">⚠️ No "Data" or "Table" sheet found — check this is the right export.</p>
                )}
                {preview.dataRows !== null && (
                  <p className="text-success">✅ Data sheet found → {preview.dataRows.toLocaleString()} rows (Closed Loans — additive)</p>
                )}
                {preview.tableRows !== null && (
                  <p className="text-success">✅ Table sheet found → {preview.tableRows.toLocaleString()} rows (Pipeline — will replace existing)</p>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <button
              disabled={!file || uploading || preview?.unrecognized}
              onClick={upload}
              className="mt-5 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-success">✅ Upload complete</p>
            <div className="rounded-lg bg-surface-subtle p-3 text-sm">
              <p>
                Closed Loans: <strong>{result.closedNew.toLocaleString()}</strong> new records added
                {result.closedSkipped > 0 && ` (${result.closedSkipped.toLocaleString()} duplicates skipped)`}
              </p>
              <p className="mt-1">
                Pipeline: <strong>{result.pipelineCount.toLocaleString()}</strong> loans loaded (replaced previous snapshot)
              </p>
            </div>
            <button onClick={onClose} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
