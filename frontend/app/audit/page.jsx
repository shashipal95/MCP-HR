'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Download, Shield } from 'lucide-react'

const TOOL_COLORS = {
  get_employee_details:    '#f0a030',
  search_employees:        '#2dd4bf',
  get_department_analytics:'#a78bfa',
  get_workforce_summary:   '#fb923c',
  get_org_chart:           '#63b3ed',
  search_hr_policy:        '#f472b6',
  log_audit_event:         '#7a8ba8',
}

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true)
    try {
      const data = await fetch('/api/audit').then(r => r.json())
      setEntries(data.entries || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  function exportCSV() {
    const cols = ['id','ts','tool','query','user_id','status']
    const header = cols.join(',')
    const rows = entries.map(e => cols.map(c => `"${e[c] ?? ''}"`).join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'audit_log.csv'; a.click()
  }

  function formatTs(ts) {
    if (!ts) return '—'
    try { return new Date(ts).toLocaleString() } catch { return ts }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 20, margin: 0 }}>Audit Log</h1>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
              background: 'rgba(45,212,155,0.1)', border: '1px solid rgba(45,212,155,0.25)',
              borderRadius: 99, fontSize: 11, color: '#2dd49b', fontWeight: 600,
            }}>
              <Shield size={10} /> IMMUTABLE
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {entries.length} recent entries — all employee data access is automatically logged
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => load(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading audit log…
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
            <Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>No audit entries yet</div>
            <div style={{ fontSize: 13 }}>Events are logged automatically when employee data is accessed via the Chat.</div>
          </div>
        ) : (
          <table className="hr-table">
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
              <tr>
                {['#','Timestamp','Tool','Query','User','Status'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const toolColor = TOOL_COLORS[e.tool] || 'var(--text-secondary)'
                return (
                  <tr key={e.id} style={{ animationDelay: `${i * 10}ms` }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{e.id}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatTs(e.ts)}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                        background: `${toolColor}18`, border: `1px solid ${toolColor}30`,
                        color: toolColor, fontSize: 11, fontWeight: 600,
                      }}>
                        {e.tool}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-primary)' }}>
                      {e.query}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.user_id || '—'}</td>
                    <td>
                      <span className={`badge ${e.status === 'ok' ? 'badge-active' : 'badge-inactive'}`}>
                        {e.status || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
