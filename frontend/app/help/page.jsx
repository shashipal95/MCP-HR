'use client'
import { Terminal, MessageSquare, Database, Lock, Cpu } from 'lucide-react'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass-card help-section">
      <div className="flex-row gap-4" style={{ marginBottom: 24 }}>
        <div className="help-section-icon">
          <Icon size={22} color="var(--accent)" strokeWidth={2.5} />
        </div>
        <h2 className="help-section-title">{title}</h2>
      </div>
      <div className="help-section-body">
        {children}
      </div>
    </div>
  )
}

function Code({ children }) {
  return (
    <pre className="code-block">
      <code>{children}</code>
    </pre>
  )
}

function Table({ headers, rows }) {
  return (
    <div className="help-table-wrapper">
      <table className="hr-table" style={{ margin: 0 }}>
        <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 ? 'help-table-code-col' : ''}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function HelpPage() {
  return (
    <div className="page-wrapper page-enter">
      <div className="help-hero">
        <div className="help-hero-icon">
          <MessageSquare size={32} color="#fff" strokeWidth={2} />
        </div>
        <h1 className="help-hero-title">HR Assistant — Usage Guide</h1>
        <p className="help-hero-subtitle">
          Everything you need to get started and make the most of the intelligent HR system.
        </p>
      </div>

      <div className="help-content">
        <Section icon={Terminal} title="Setup & Installation">
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            Run these commands once before starting the application:
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
          <p style={{ marginBottom: 0, marginTop: 16 }}>
            Then open <span className="text-accent-bold">http://localhost:3000</span> in your browser.
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

        <Section icon={Database} title="System Architecture">
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

        <Section icon={Lock} title="Privacy & Security Protocol">
          <ul className="help-list">
            <li>All employee data queries are <strong className="text-primary-bold">automatically audited</strong> in <code className="inline-code">audit.db</code>.</li>
            <li>Employee records are <strong className="text-primary-bold">strictly read-only</strong> — no UPDATE or DELETE tools are exposed to the AI.</li>
            <li>All data stays <strong className="text-primary-bold">100% local</strong> — nothing leaves your machine or network.</li>
            <li>LLM inference is powered entirely by <strong className="text-primary-bold">Ollama</strong> locally.</li>
            <li>For production deployments, integrating an upstream Identity Provider for RBAC is recommended.</li>
          </ul>
        </Section>

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
