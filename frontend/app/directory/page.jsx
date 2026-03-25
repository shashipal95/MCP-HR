'use client'
import { useEffect, useState } from 'react'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'

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
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [totalAll, setTotalAll] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nameSearch, setNameSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sort, setSort] = useState({ col: 'Employee Name', dir: 'asc' })
  
  // Pagination state
  const [page, setPage] = useState(1)
  const pageSize = 15

  const debouncedName = useDebouncedValue(nameSearch)

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const offset = (page - 1) * pageSize
    const params = new URLSearchParams({ limit: pageSize, offset })
    if (debouncedName) params.set('name', debouncedName)
    if (deptFilter !== 'All') params.set('department', deptFilter)
    if (statusFilter !== 'All') params.set('status', statusFilter)

    fetch(`/api/employees?${params}`)
      .then(r => r.json())
      .then(d => {
        setEmployees(d.employees || [])
        setTotalFiltered(d.total_filtered || 0)
        setTotalAll(d.total_all || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debouncedName, deptFilter, statusFilter, page])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedName, deptFilter, statusFilter])

  const COLS = ['Employee Name', 'Department', 'Position', 'Employment Status', 'Manager Name', 'Pay Rate', 'Performance Score']

  // Multi-column sort helper
  const sorted = [...employees].sort((a, b) => {
    const av = a[sort.col] ?? ''
    const bv = b[sort.col] ?? ''
    const cmp = typeof av === 'string' 
      ? av.localeCompare(String(bv)) 
      : (av < bv ? -1 : (av > bv ? 1 : 0))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  function exportCSV() {
    // Exporting only currently visible page – or we could fetch all. 
    // To keep it simple for now, we export current view.
    const header = COLS.join(',')
    const rows = sorted.map(e => COLS.map(c => `"${e[c] ?? ''}"`).join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'employees.csv'
    a.click()
  }

  const totalPages = Math.ceil(totalFiltered / pageSize)

  return (
    <div className="flex-column" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header / Toolbar */}
      <div className="toolbar-container">
        <div className="page-header-flex">
          <div>
            <h1 className="page-title">Employee Directory</h1>
            <p className="page-subtitle">
              {loading ? 'Loading...' : `Showing ${(page-1)*pageSize + 1} to ${Math.min(page*pageSize, totalFiltered)} of ${totalFiltered} matching employees`}
            </p>
          </div>
          <button onClick={exportCSV} className="btn-primary">
            <Download size={16} strokeWidth={2.5} /> Export Page
          </button>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="filter-input-wrapper large">
            <Search size={16} className="filter-icon left" />
            <input
              className="input-glass"
              placeholder="Search by name..."
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              style={{ paddingLeft: 42 }}
            />
          </div>

          <div className="filter-input-wrapper">
            <select
              className="input-glass select-glass"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown size={14} className="filter-icon right" />
          </div>

          <div className="filter-input-wrapper">
            <select
              className="input-glass select-glass"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Terminated for Cause">Terminated for Cause</option>
              <option value="Voluntarily Terminated">Voluntarily Terminated</option>
            </select>
            <ChevronDown size={14} className="filter-icon right" />
          </div>

          {(nameSearch || deptFilter !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={() => { setNameSearch(''); setDeptFilter('All'); setStatusFilter('All') }}
              className="btn-ghost"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-content" style={{ padding: 80, textAlign: 'center' }}>
            <div className="loading-spinner" />
            <div className="loading-text">Loading employees...</div>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ marginTop: 24, overflow: 'hidden' }}>
              <table className="hr-table">
                <thead>
                  <tr>
                    {COLS.map(col => (
                      <th
                        key={col}
                        onClick={() => toggleSort(col)}
                        style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                      >
                        <span className="flex-row gap-2">
                          {col}
                          {sort.col === col
                            ? sort.dir === 'asc' ? <ChevronUp size={14} color="var(--accent)" /> : <ChevronDown size={14} color="var(--accent)" />
                            : <ChevronUp size={14} color="transparent" style={{ opacity: 0.5 }} />
                          }
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((emp, i) => (
                    <tr key={i} className="page-enter" style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}>
                      <td className="table-name-col">{emp['Employee Name']}</td>
                      <td className="table-secondary-col">{emp.Department}</td>
                      <td className="table-secondary-col">{emp.Position}</td>
                      <td>
                        <span className={`badge ${emp['Employment Status'] === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                          {emp['Employment Status']}
                        </span>
                      </td>
                      <td className="table-secondary-col">{emp['Manager Name']}</td>
                      <td className="table-accent-col">
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
                      <td colSpan={COLS.length} className="table-empty-cell">
                        No employees match your filters.
                      </td>
                    </tr>
                  )}
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
