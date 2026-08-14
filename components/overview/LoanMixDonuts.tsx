import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SkeletonChart } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DashboardData } from '@/hooks/useDashboard'

const COLORS = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

function Donut({ title, rows, dataKey }: { title: string; rows: { count: number }[] & Record<string, unknown>[]; dataKey: string }) {
  if (!rows.length) return <EmptyState />
  return (
    <div>
      <h4 className="mb-2 text-center text-xs font-medium text-ink-faint">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey={dataKey} innerRadius={50} outerRadius={80} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LoanMixDonuts({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading || !data) return <SkeletonChart />

  return (
    <div className="card">
      <div className="grid grid-cols-2 gap-4">
        <Donut title="Loan Type Mix" rows={data.loanTypeMix as any} dataKey="type" />
        <Donut title="Channel Split" rows={data.channelSplit as any} dataKey="channel" />
      </div>
    </div>
  )
}
