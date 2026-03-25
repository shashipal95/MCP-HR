'use client'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, TrendingUp, DollarSign, Award, Briefcase, UserCheck } from 'lucide-react'

const PERF_COLORS = {
  'Exceeds':           '#f59e0b',
  'Fully Meets':       '#10b981',
  'Needs Improvement': '#8b5cf6',
  'PIP':               '#e11d48',
  'N/A - too early':   '#94a3b8',
}

const STATUS_COLORS = {
  'Active': '#10b981',
  'Terminated for Cause': '#e11d48',
  'Voluntarily Terminated': '#f43f5e',
  'default': '#94a3b8'
}

function StatCard({ icon: Icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="glass-card glass-card-hover stat-card">
      <div className="flex-between">
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value" style={{ color }}>{value}</div>
          {sub && <div className="stat-card-sub">{sub}</div>}
        </div>
        <div className="stat-card-icon" style={{
          background: `${color}15`,
          border: `1px solid ${color}30`,
          boxShadow: `0 4px 12px ${color}15`
        }}>
          <Icon size={22} color={color} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="glass-card chart-card">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip-value" style={{ color: p.color || 'var(--accent)' }}>
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('pay') ? `$${p.value.toFixed(2)}` : p.value}
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [workforce, setWorkforce] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/workforce').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
    ]).then(([w, a]) => {
      setWorkforce(w)
      setAnalytics(a)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="loading-wrapper">
      <div className="loading-content">
        <div className="loading-spinner" />
        <div className="loading-text">Loading analytics...</div>
      </div>
    </div>
  )

  const activeRate = workforce?.total ? ((workforce.active / workforce.total) * 100).toFixed(0) : 0

  return (
    <div className="page-wrapper page-enter">
      <div className="page-header">
        <h1 className="page-title">Workforce Analytics</h1>
        <p className="page-subtitle">Live insights from your HR data</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <StatCard icon={Users}     label="Total Employees"  value={workforce?.total ?? '—'} sub={`${activeRate}% active`} />
        <StatCard icon={UserCheck} label="Active"           value={workforce?.active ?? '—'} color="var(--teal)" />
        <StatCard icon={DollarSign} label="Avg Pay Rate"   value={workforce?.avg_pay ? `$${workforce.avg_pay}` : '—'} />
        <StatCard icon={Award}     label="Top Performers"   value={workforce?.top_performers ?? '—'} color="var(--teal)" />
        <StatCard icon={Briefcase} label="Departments"      value={workforce?.departments ?? '—'} color="var(--purple)" />
        <StatCard icon={TrendingUp} label="Unique Roles"   value={workforce?.positions ?? '—'} color="var(--amber)" />
      </div>

      {/* Charts row 1 */}
      <div className="chart-grid">
        <ChartCard title="Headcount by Department">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics?.departments} margin={{ top: 0, right: 8, left: -20, bottom: 40 }}>
              <XAxis dataKey="Department" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)' }} />
              <Bar dataKey="headcount" fill="var(--accent)" radius={[6,6,0,0]} name="Headcount" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Performance Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={analytics?.performance?.filter(p => p.score)}
                dataKey="count"
                nameKey="score"
                cx="50%" cy="45%"
                outerRadius={95}
                innerRadius={55}
                paddingAngle={4}
                stroke="none"
              >
                {analytics?.performance?.map((p, i) => (
                  <Cell key={i} fill={PERF_COLORS[p.score] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="chart-grid">
        <ChartCard title="Average Pay Rate by Department">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics?.departments} margin={{ top: 0, right: 8, left: -10, bottom: 40 }}>
              <XAxis dataKey="Department" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)' }} />
              <Bar dataKey="avg_pay" fill="var(--teal)" radius={[6,6,0,0]} name="Avg Pay" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment Status Breakdown">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={analytics?.status}
                dataKey="count"
                nameKey="status"
                cx="50%" cy="45%"
                outerRadius={95}
                innerRadius={55}
                paddingAngle={4}
                stroke="none"
              >
                {analytics?.status?.map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.status] || STATUS_COLORS.default} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Department detail table */}
      <div className="glass-card chart-card" style={{ overflowX: 'auto' }}>
        <h3 className="card-title">Department Breakdown — Full Detail</h3>
        <table className="hr-table">
          <thead>
            <tr>
              {['Department','Headcount','Avg Pay','Active','Terminated','Exceeds','Fully Meets','Needs Impr.','PIP'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analytics?.departments?.map((d, i) => (
              <tr key={i}>
                <td className="table-accent-col">{d.Department}</td>
                <td className="table-bold-col">{d.headcount}</td>
                <td className="table-bold-col">${d.avg_pay?.toFixed(2) ?? '—'}</td>
                <td><span className="badge badge-active">{d.active}</span></td>
                <td><span className="badge badge-inactive">{d.terminated}</span></td>
                <td><span className="badge badge-exceeds">{d.exceeds}</span></td>
                <td><span className="badge badge-meets">{d.fully_meets}</span></td>
                <td><span className="badge badge-needs">{d.needs_improvement}</span></td>
                <td><span className="badge badge-pip">{d.pip}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ height: 32 }} />
    </div>
  )
}
