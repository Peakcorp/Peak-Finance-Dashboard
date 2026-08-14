'use client'

import { useState } from 'react'
import { usePipeline } from '@/hooks/usePipeline'
import { PipelineKPIs } from './PipelineKPIs'
import { MilestoneFunnel } from './MilestoneFunnel'
import { PipelineTable } from './PipelineTable'

export function PipelineTab({ refreshKey }: { refreshKey: number }) {
  const { data, loading } = usePipeline(refreshKey)
  const [activeMilestone, setActiveMilestone] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <PipelineKPIs data={data} loading={loading} />
      <MilestoneFunnel data={data} loading={loading} activeMilestone={activeMilestone} onSelect={setActiveMilestone} />
      <PipelineTable rows={data?.rows ?? []} loading={loading} activeMilestone={activeMilestone} />
    </div>
  )
}
