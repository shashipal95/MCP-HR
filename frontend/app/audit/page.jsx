'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, Download, Shield } from 'lucide-react'

const TOOL_COLORS = {
  get_employee_details:    '#f59e0b',
  search_employees:        '#10b981',
  get_department_analytics:'#8b5cf6',
  get_workforce_summary:   '#f43f5e',
  get_org_chart:           '#3b82f6',
  search_hr_policy:        '#ec4899',
  log_audit_event:         '#94a3b8',
}

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const pageSize = 20

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true)
    try {
      const offset = (page - 1) * pageSize
      const data = await fetch(`/api/audit?limit=${pageSize}&offset=${offset}`).then(r => r.json())
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [page])

  function exportCSV() {
    // Exporting current page view
    const cols = ['id','ts','tool','query','user_id','status']
    const header = cols.join(',')
    const rows = entries.map(e => cols.map(c => `"${e[c] ?? ''}"`).join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `audit_log_page_${page}.csv`; a.click()
  }

  function formatTs(ts) {
    if (!ts) return '—'
    try { return new Date(ts).toLocaleString() } catch { return ts }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex-column" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="toolbar-container flex-between">
        <div>
          <div className="flex-row gap-3" style={{ marginBottom: 6 }}>
            <h1 className="page-title">Audit Log</h1>
            <span className="badge badge-active flex-row gap-2">
              <Shield size={12} strokeWidth={2.5} /> IMMUTABLE
            </span>
          </div>
          <p className="page-subtitle">
            {total} total entries — all employee data access is automatically logged
          </p>
        </div>
        <div className="flex-row gap-3">
          <button onClick={() => load(true)} className="btn-ghost flex-row gap-2">
            <RefreshCw size={16} strokeWidth={2} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button onClick={exportCSV} className="btn-primary">
            <Download size={16} strokeWidth={2.5} /> Export Page
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-content" style={{ padding: 80, textAlign: 'center' }}>
            <div className="loading-spinner" />
            <div className="loading-text">Loading audit log...</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Shield size={40} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">No audit entries yet</div>
            <div className="empty-state-subtitle">Events are logged automatically when employee data is accessed via chat.</div>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ marginTop: 24, overflow: 'hidden' }}>
              <table className="hr-table">
                <thead>
                  <tr>
                    {['#','Timestamp','Tool','Query','User','Status'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => {
                    const toolColor = TOOL_COLORS[e.tool] || 'var(--text-secondary)'
                    return (
                      <tr key={e.id} className="page-enter" style={{ animationDelay: `${Math.min(i * 10, 300)}ms` }}>
                        <td className="table-mono-col">{e.id}</td>
                        <td className="table-secondary-col table-nowrap">{formatTs(e.ts)}</td>
                        <td>
                          <span className="tool-badge" style={{
                            background: `${toolColor}15`,
                            border: `1px solid ${toolColor}30`,
                            color: toolColor,
                          }}>
                            {e.tool}
                          </span>
                        </td>
                        <td className="table-query-col">{e.query}</td>
                        <td className="table-mono-col table-secondary-col">{e.user_id || '—'}</td>
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
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <button 
                  className="pagination-btn" 
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  «
                </button>
                <button 
                  className="pagination-btn" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ‹
                </button>
                
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>

                <button 
                  className="pagination-btn" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  ›
                </button>
                <button 
                  className="pagination-btn" 
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  »
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
