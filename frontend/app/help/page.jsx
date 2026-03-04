'use client'
import { Terminal, MessageSquare, Database, Lock, Cpu } from 'lucide-react'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass-card" style={{ padding: '22px 26px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color="var(--accent)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Code({ children }) {
  return (
    <pre style={{
      background: 'var(--bg-base)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '14px 16px', fontSize: 12,
      color: 'var(--teal-hr, #2dd4bf)', overflowX: 'auto',
      fontFamily: 'monospace', lineHeight: 1.7, margin: '10px 0',
    }}>
      <code>{children}</code>
    </pre>
  )
}

function Table({ headers, rows }) {
  return (
    <table className="hr-table" style={{ marginTop: 8 }}>
      <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={j === 0 ? { color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 } : {}}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function HelpPage() {
  return (
    <div style={{ height: '100vh', overflowY: 'auto', padding: '24px 28px' }} className="page-enter">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontWeight: 800, fontSize: 24, margin: '0 0 6px' }}>
            HR Assistant — Usage Guide
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Everything you need to get started and make the most of the system.
          </p>
        </div>

        <Section icon={Terminal} title="Setup & Installation">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 8 }}>
            Run these once before starting the app:
          </p>
          <Code>{`# 1. Install Python dependencies
pip install fastapi uvicorn langchain-community langchain-ollama \\
            langchain-text-splitters chromadb pandas mcp pypdf

# 2. Load HR policies (place PDFs in ./data/)
python ingest.py

# 3. Load employee data (place employees.csv in ./data/)
python ingest_employees.py

# 4. Start the FastAPI backend
uvicorn api_server:app --reload --port 8000

# 5. Start the Next.js frontend (new terminal)
cd hr-frontend && npm install && npm run dev`}</Code>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 0 }}>
            Then open <span style={{ color: 'var(--accent)' }}>http://localhost:3000</span> in your browser.
          </p>
        </Section>

        <Section icon={MessageSquare} title="Example Chat Questions">
          <Table
            headers={['Category', 'Example Question']}
            rows={[
              ['Employee Lookup',   'Show me details for Clayton, Rick'],
              ['Pay Rate',          'What is the pay rate of Smith, John?'],
              ['Department',        'How many employees are in the IT department?'],
              ['Performance',       'Who are the top performers in Engineering?'],
              ['Org Chart',         'Who reports to Michael Scott?'],
              ['Analytics',         'Give me a workforce summary'],
              ['HR Policy',         'What is the remote work policy?'],
              ['Leave',             'How many PTO days do employees get?'],
              ['Marital Status',    'Is Clayton, Rick married?'],
              ['Age',               'What is the age of Clayton, Rick?'],
            ]}
          />
        </Section>

        <Section icon={Cpu} title="Available MCP Tools">
          <Table
            headers={['Tool', 'Description']}
            rows={[
              ['search_employees',         'Filter employees by name, dept, position, status, or manager'],
              ['get_employee_details',      'Full HR profile for a single employee'],
              ['get_department_analytics',  'Headcount, avg pay, and performance by department'],
              ['get_org_chart',             'Manager → direct-reports hierarchy'],
              ['get_workforce_summary',     'Company-wide KPIs (headcount, pay, gender, turnover)'],
              ['search_hr_policy',          'Semantic search over HR policy PDFs (RAG)'],
              ['log_audit_event',           'Write an immutable audit entry (called automatically)'],
            ]}
          />
        </Section>

        <Section icon={Database} title="Architecture">
          <Code>{`Browser (Next.js :3000)
    └── /api/* proxy
          └── FastAPI (api_server.py :8000)
                ├── GET /api/employees    → hr.db (SQLite)
                ├── GET /api/analytics    → hr.db (SQLite)
                ├── GET /api/workforce    → hr.db (SQLite)
                ├── GET /api/audit        → audit.db (SQLite)
                └── POST /api/chat
                        └── hr_agent.py  (LLM + ReAct loop)
                                └── MCPClient (stdio)
                                        └── mcp_hr_server.py
                                                ├── hr.db
                                                ├── hr_vectordb/ (ChromaDB)
                                                └── audit.db`}</Code>
        </Section>

        <Section icon={Lock} title="Privacy & Security">
          <ul style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>All employee data queries are <strong style={{ color: 'var(--text-primary)' }}>automatically audited</strong> in <code style={{ color: 'var(--accent)', fontSize: 12 }}>audit.db</code></li>
            <li>Employee records are <strong style={{ color: 'var(--text-primary)' }}>read-only</strong> — no UPDATE or DELETE tools are exposed</li>
            <li>All data stays <strong style={{ color: 'var(--text-primary)' }}>local</strong> — nothing leaves your machine</li>
            <li>LLM inference runs locally via <strong style={{ color: 'var(--text-primary)' }}>Ollama</strong></li>
            <li>Consider adding role-based access control for production deployments</li>
          </ul>
        </Section>

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
