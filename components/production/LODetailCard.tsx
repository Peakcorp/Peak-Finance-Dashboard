import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LOProduction } from '@/hooks/useProduction'

const COLORS = ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

export function LODetailCard({ lo }: { lo: LOProduction }) {
  return (
    <tr>
      <td colSpan={9} className="bg-surface-subtle p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <h4 className="mb-2 text-xs font-medium text-ink-faint">Monthly Files (12mo)</h4>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={lo.monthlySparkline}>
                <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={1} />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium text-ink-faint">Processor Breakdown</h4>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={lo.processorBreakdown} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="processor" tick={{ fontSize: 9 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium text-ink-faint">Loan Type Mix</h4>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={lo.loanTypeMix} dataKey="count" nameKey="type" innerRadius={30} outerRadius={55}>
                  {lo.loanTypeMix.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium text-ink-faint">State Coverage</h4>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={lo.stateCoverage} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 9 }} width={30} />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <h4 className="mb-1 mt-2 text-xs font-medium text-ink-faint">Top Referral Sources</h4>
            <ul className="space-y-0.5 text-xs text-ink-muted">
              {lo.topReferrals.map((r) => (
                <li key={r.source} className="flex justify-between">
                  <span className="truncate">{r.source}</span>
                  <span className="font-medium">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </td>
    </tr>
  )
}
