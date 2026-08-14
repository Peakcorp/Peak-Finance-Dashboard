'use client'

import { useDashboard } from '@/hooks/useDashboard'
import { KPITiles } from './KPITiles'
import { TrendChart } from './TrendChart'
import { YoYChart } from './YoYChart'
import { DayOfWeekChart } from './DayOfWeekChart'
import { StateTable } from './StateTable'
import { ReferralChart } from './ReferralChart'
import { LoanMixDonuts } from './LoanMixDonuts'

export function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const { data, loading } = useDashboard(refreshKey)

  return (
    <div className="space-y-4">
      <KPITiles data={data} loading={loading} />
      <TrendChart refreshKey={refreshKey} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <YoYChart data={data} loading={loading} />
        <DayOfWeekChart data={data} loading={loading} />
      </div>
      <StateTable data={data} loading={loading} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReferralChart data={data} loading={loading} />
        <LoanMixDonuts data={data} loading={loading} />
      </div>
    </div>
  )
}
