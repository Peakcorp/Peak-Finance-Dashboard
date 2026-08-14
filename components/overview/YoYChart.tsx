import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SkeletonChart } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DashboardData } from '@/hooks/useDashboard'

const YEAR_COLORS = ['#cbd5e1', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8']

export function YoYChart({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading || !data) return <SkeletonChart />
  const { years, points } = data.yoy
  if (!years.length) return <EmptyState />

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-ink">Year-over-Year</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {years.map((y, i) => (
            <Bar key={y} dataKey={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
