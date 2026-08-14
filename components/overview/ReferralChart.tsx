import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SkeletonChart } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DashboardData } from '@/hooks/useDashboard'

export function ReferralChart({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading || !data) return <SkeletonChart />
  const rows = data.topReferrals
  if (!rows.length) return <EmptyState />

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-ink">Top 10 Referral Sources</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} stroke="#94a3b8" width={130} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
