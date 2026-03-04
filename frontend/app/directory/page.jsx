'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, Download, ChevronUp, ChevronDown, Filter } from 'lucide-react'

const PERF_BADGE = {
  'Exceeds':           'badge-exceeds',
  'Fully Meets':       'badge-meets',
  'Needs Improvement': 'badge-needs',
  'PIP':               'badge-pip',
}

function useDebouncedValue(value, delay = 300) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

export default function DirectoryPage() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nameSearch, setNameSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState({ col: 'Employee Name', dir: 'asc' })

  const debouncedName = useDebouncedValue(nameSearch)

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: 500 })
    if (debouncedName) params.set('name', debouncedName)
    if (deptFilter !== 'All') params.set('department', deptFilter)
    if (statusFilter !== 'All') params.set('status', statusFilter)

    fetch(`/api/employees?${params}`)
      .then(r => r.json())
      .then(d => {
        setEmployees(d.employees || [])
        setTotal(d.total || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debouncedName, deptFilter, statusFilter])

  const COLS = ['Employee Name', 'Department', 'Position', 'Employment Status', 'Manager Name', 'Pay Rate', 'Performance Score']

  const sorted = [...employees].sort((a, b) => {
    const av = a[sort.col] ?? ''
    const bv = b[sort.col] ?? ''
    return sort.dir === 'asc' ? av.localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  function exportCSV() {
    const header = COLS.join(',')
    const rows = sorted.map(e => COLS.map(c => `"${e[c] ?? ''}"`).join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'employees.csv'
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 20, margin: 0 }}>Employee Directory</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : `Showing ${sorted.length} of ${total} employees`}
            </p>
          </div>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              className="hr-input"
              placeholder="Search by name…"
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>

          <select
            className="hr-input"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{ flex: '0 0 180px' }}
          >
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            className="hr-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ flex: '0 0 160px' }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Terminated for Cause">Terminated for Cause</option>
            <option value="Voluntarily Terminated">Voluntarily Terminated</option>
          </select>

          {(nameSearch || deptFilter !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={() => { setNameSearch(''); setDeptFilter('All'); setStatusFilter('All') }}
              style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading employees…
          </div>
        ) : (
          <table className="hr-table">
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
              <tr>
                {COLS.map(col => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col}
                      {sort.col === col
                        ? sort.dir === 'asc' ? <ChevronUp size={12} color="var(--accent)" /> : <ChevronDown size={12} color="var(--accent)" />
                        : <ChevronUp size={12} color="var(--text-muted)" />
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((emp, i) => (
                <tr key={i} className="page-enter" style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp['Employee Name']}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.Department}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emp.Position}</td>
                  <td>
                    <span className={`badge ${emp['Employment Status'] === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                      {emp['Employment Status']}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{emp['Manager Name']}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {emp['Pay Rate'] ? `$${parseFloat(emp['Pay Rate']).toFixed(2)}` : '—'}
                  </td>
                  <td>
                    {emp['Performance Score'] && (
                      <span className={`badge ${PERF_BADGE[emp['Performance Score']] || 'badge-meets'}`}>
                        {emp['Performance Score']}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No employees match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
