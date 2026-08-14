'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
          selected.length > 0
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-slate-200 bg-white text-ink-muted hover:bg-slate-50',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">{selected.length}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60">
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {options.length > 8 && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
            />
          )}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && <div className="px-2 py-1.5 text-sm text-ink-faint">No options</div>}
            {filtered.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="accent-brand-600" />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-ink-faint hover:bg-slate-50">
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
