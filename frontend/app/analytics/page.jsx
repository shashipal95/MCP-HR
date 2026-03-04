'use client'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, TrendingUp, DollarSign, Award, Briefcase, UserCheck } from 'lucide-react'

const PERF_COLORS = {
  'Exceeds':           '#f0a030',
  'Fully Meets':       '#2dd4bf',
  'Needs Improvement': '#fbbf24',
  'PIP':               '#f87171',
  'N/A - too early':   '#7a8ba8',
}

const STATUS_COLORS = { 'Active': '#2dd49b', 'Terminated for Cause': '#f87171', 'Voluntarily Terminated': '#fb923c', 'default': '#7a8ba8' }

function StatCard({ icon: Icon, label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="glass-card glass-card-hover" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-syne)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: '1.9rem', color, lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="glass-card" style={{ padding: '20px 22px' }}>
      <h3 style={{ fontFamily: 'var(--font-syne)', fontWeight: 600, fontSize: 14, margin: '0 0 20px', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)', fontWeight: 600 }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        Loading analytics…
      </div>
    </div>
  )

  const activeRate = workforce?.total ? ((workforce.active / workforce.total) * 100).toFixed(0) : 0

  return (
    <div style={{ height: '100vh', overflowY: 'auto', padding: '24px 28px' }} className="page-enter">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 22, margin: 0 }}>
          Workforce Analytics
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          Live insights from your HR data
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={Users}     label="Total Employees"  value={workforce?.total ?? '—'} sub={`${activeRate}% active`} />
        <StatCard icon={UserCheck} label="Active"           value={workforce?.active ?? '—'} color="#2dd49b" />
        <StatCard icon={DollarSign} label="Avg Pay Rate"    value={workforce?.avg_pay ? `$${workforce.avg_pay}` : '—'} />
        <StatCard icon={Award}     label="Top Performers"   value={workforce?.top_performers ?? '—'} color="#2dd4bf" />
        <StatCard icon={Briefcase} label="Departments"      value={workforce?.departments ?? '—'} color="#a78bfa" />
        <StatCard icon={TrendingUp} label="Unique Roles"    value={workforce?.positions ?? '—'} color="#fb923c" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        <ChartCard title="Headcount by Department">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.departments} margin={{ top: 0, right: 8, left: -20, bottom: 40 }}>
              <XAxis dataKey="Department" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="headcount" fill="var(--accent)" radius={[4,4,0,0]} name="Headcount" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Performance Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={analytics?.performance?.filter(p => p.score)}
                dataKey="count"
                nameKey="score"
                cx="50%" cy="45%"
                outerRadius={80}
                innerRadius={44}
                paddingAngle={3}
              >
                {analytics?.performance?.map((p, i) => (
                  <Cell key={i} fill={PERF_COLORS[p.score] || '#7a8ba8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        <ChartCard title="Average Pay Rate by Department">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.departments} margin={{ top: 0, right: 8, left: -10, bottom: 40 }}>
              <XAxis dataKey="Department" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_pay" fill="var(--teal-hr, #2dd4bf)" radius={[4,4,0,0]} name="Avg Pay" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment Status Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={analytics?.status}
                dataKey="count"
                nameKey="status"
                cx="50%" cy="45%"
                outerRadius={80}
                innerRadius={44}
                paddingAngle={3}
              >
                {analytics?.status?.map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.status] || STATUS_COLORS.default} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Department detail table */}
      <ChartCard title="Department Breakdown — Full Detail">
        <div style={{ overflowX: 'auto' }}>
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
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.Department}</td>
                  <td>{d.headcount}</td>
                  <td>${d.avg_pay?.toFixed(2) ?? '—'}</td>
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
      </ChartCard>

      <div style={{ height: 24 }} />
    </div>
  )
}
