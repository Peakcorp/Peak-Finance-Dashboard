'use client'

import { Suspense, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Header } from '@/components/layout/Header'
import { FilterBar } from '@/components/layout/FilterBar'
import { UploadModal } from '@/components/shared/UploadModal'
import { UploadHistory } from '@/components/shared/UploadHistory'
import { ToastHost, pushToast } from '@/components/shared/Toast'
import { supabase } from '@/lib/supabase'
import { useRefreshStore } from '@/store/refreshStore'
import { OverviewTab } from '@/components/overview/OverviewTab'
import { ProductionTab } from '@/components/production/ProductionTab'
import { PipelineTab } from '@/components/pipeline/PipelineTab'
import { ProjectionsTab } from '@/components/projections/ProjectionsTab'
import { FinancialsTab } from '@/components/financials/FinancialsTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'production', label: 'Production' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'projections', label: 'Projections' },
  { key: 'financials', label: 'Financials' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function Page() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { refreshKey, bump } = useRefreshStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab') as TabKey | null
    if (t && TABS.some((tb) => tb.key === t)) setTab(t)
  }, [])

  function changeTab(next: TabKey) {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url.toString())
  }

  useEffect(() => {
    const channel = supabase
      .channel('uploads-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uploads' }, (payload) => {
        const uploadedBy = (payload.new as { uploaded_by?: string }).uploaded_by ?? 'Someone'
        pushToast(`📊 New data uploaded by ${uploadedBy} — refreshing dashboard...`)
        bump()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-surface-subtle">
      <Header onUploadClick={() => setUploadOpen(true)} onHistoryClick={() => setHistoryOpen(true)} refreshKey={refreshKey} />

      <Suspense fallback={<div className="h-14 border-b border-slate-200 bg-white" />}>
        <FilterBar />
      </Suspense>

      <nav className="no-print flex gap-1 border-b border-slate-200 bg-white px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={clsx(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {tab === 'overview' && <OverviewTab refreshKey={refreshKey} />}
        {tab === 'production' && <ProductionTab refreshKey={refreshKey} />}
        {tab === 'pipeline' && <PipelineTab refreshKey={refreshKey} />}
        {tab === 'projections' && <ProjectionsTab refreshKey={refreshKey} />}
        {tab === 'financials' && <FinancialsTab refreshKey={refreshKey} />}
      </main>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            bump()
          }}
        />
      )}
      {historyOpen && <UploadHistory onClose={() => setHistoryOpen(false)} />}
      <ToastHost />
    </div>
  )
}
