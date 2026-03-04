# 🤖 HR Assistant — MCP-Powered Chatbot

An intelligent HR chatbot built with the **Model Context Protocol (MCP)**, Ollama LLMs, ChromaDB, and Streamlit.  
Answers natural-language questions about employees **and** HR policies through a clean, multi-tab UI.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Streamlit UI (5 tabs)               │
│  💬 Chat │ 📊 Analytics │ 🗂️ Directory │ 📋 Audit │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│         hr_agent.py  (LLM + ReAct loop)          │
│  • Reads tool schemas from MCP server            │
│  • LLM decides which tool(s) to call             │
│  • Feeds tool results back into context          │
└──────────────────────┬───────────────────────────┘
                       │  MCP stdio transport
┌──────────────────────▼───────────────────────────┐
│         mcp_hr_server.py  (MCP Server)           │
├──────────────────────────────────────────────────┤
│  Tool                  │ Backend                 │
│  ─────────────────── │ ───────────────────────  │
│  search_employees      │ SQLite (hr.db)           │
│  get_employee_details  │ SQLite (hr.db)           │
│  get_department_analytics │ SQLite (hr.db)        │
│  get_org_chart         │ SQLite (hr.db)           │
│  get_workforce_summary │ SQLite (hr.db)           │
│  search_hr_policy      │ ChromaDB (hr_vectordb/)  │
│  log_audit_event       │ SQLite (audit.db)        │
└──────────────────────────────────────────────────┘
```

---

## Features

| Feature | Details |
|---|---|
| **MCP tool calling** | LLM selects the right tool from 7 available tools |
| **Employee search** | Filter by name, department, position, manager, performance |
| **Full employee profile** | One-shot lookup with all HR fields |
| **Department analytics** | Headcount, avg pay, performance breakdown |
| **Org chart** | Manager → direct-reports hierarchy |
| **Workforce KPIs** | Active %, gender split, turnover rate, pay range |
| **HR policy RAG** | Semantic search over your policy PDFs |
| **Automatic audit trail** | Every employee data query logged to `audit.db` |
| **Analytics dashboard** | Streamlit bar charts — headcount, pay, performance, gender |
| **Employee directory** | Filterable, exportable table |
| **Conversation memory** | Last 6 turns fed back to LLM |

---

## Quick Start

### Prerequisites

| Requirement | Install |
|---|---|
| Python 3.11+ | python.org |
| Ollama | [ollama.ai](https://ollama.ai) |
| llama3 model | `ollama pull llama3` |
| nomic-embed-text | `ollama pull nomic-embed-text` |

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Add your data

```
data/
  employees.csv       ← HR employee data (see column spec below)
  handbook.pdf        ← HR policy document(s) — any number of PDFs
  benefits.pdf
  ...
```

### 3. Build the knowledge bases

```bash
# Load employees → hr.db (SQLite)
python ingest_employees.py

# Load policy PDFs → hr_vectordb/ (ChromaDB)
python ingest.py
```

### 4. Run the app

```bash
python run_app.py
# or
streamlit run streamlit_app.py
```

Open **http://localhost:8501**

---

## Employee CSV Column Spec

The CSV must have these columns (same as the original HRDataset):

```
Employee Name, Employee Number, State, Zip, DOB, Age, Sex, MaritalDesc,
CitizenDesc, Hispanic/Latino, RaceDesc, Date of Hire, Date of Termination,
Reason For Term, Employment Status, Department, Position, Pay Rate,
Manager Name, Employee Source, Performance Score
```

---

## MCP Tools Reference

### `search_employees`
Search by any combination of filters.
```json
{ "name": "Jane Smith", "department": "Engineering", "limit": 10 }
```

### `get_employee_details`
Full profile for one employee.
```json
{ "name": "Jane Smith" }
```

### `get_department_analytics`
Headcount, pay, performance per department.
```json
{ "department": "Sales" }   // omit for all departments
```

### `get_org_chart`
Manager → reports tree.
```json
{ "manager_name": "Michael Scott" }
```

### `get_workforce_summary`
Company-wide KPIs.
```json
{}
```

### `search_hr_policy`
Semantic RAG over policy PDFs.
```json
{ "query": "How many PTO days do employees get?", "k": 4 }
```

### `log_audit_event`
Write to audit trail (called automatically).
```json
{ "tool": "get_employee_details", "query": "Jane Smith details", "user_id": "hr_manager" }
```

---

## Example Chat Questions

```
"Show me the full profile for Sarah Johnson"
"List all active employees in the IT department"
"Who reports to Janet King?"
"What's the average pay rate in Production?"
"Give me the workforce summary"
"Which employees have a Performance Score of 'Exceeds'?"
"What is our remote work policy?"
"How many sick days do employees get?"
"What are the grounds for immediate termination?"
"Who are our top performers in Sales?"
```

---

## Project Structure

```
.
├── mcp_hr_server.py        ← MCP server (all tools defined here)
├── hr_agent.py             ← LLM agent + MCP client
├── streamlit_app.py        ← Streamlit UI (5 tabs)
├── ingest.py               ← PDF → ChromaDB
├── ingest_employees.py     ← CSV → SQLite + ChromaDB
├── run_app.py              ← Smart startup script
├── project_setup_check.py  ← Health check
├── requirements.txt
├── README.md
├── data/
│   ├── employees.csv
│   └── *.pdf
├── hr.db                   ← Employee SQLite DB (auto-created)
├── audit.db                ← Audit trail (auto-created)
├── hr_vectordb/            ← HR policy ChromaDB (built by ingest.py)
└── employee_vectordb/      ← Employee ChromaDB (built by ingest_employees.py)
```

---






# 1. Install deps
pip install -r requirements.txt
pip install fastapi uvicorn

# 2. Load data (only needed once)
python ingest_employees.py     # employees.csv → hr.db
python ingest.py               # PDFs → hr_vectordb

# 3. Verify everything
python project_setup_check.py

python run_app.py

# 4. Start backend
uvicorn api_server:app --reload --port 8000