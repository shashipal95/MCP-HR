"""
HR Assistant – Streamlit Frontend
===================================
Tabs:
  💬 Chat          – conversational Q&A (MCP-backed)
  📊 Analytics     – workforce charts & department breakdown
  🗂️ Employee Directory – searchable table
  📋 Audit Log     – read-only view of query audit trail
  ℹ️  Help          – usage guide
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
import streamlit as st
import pandas as pd

# ── page config must be first ─────────────────────────────────────────────────
st.set_page_config(
    page_title="HR Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── paths ─────────────────────────────────────────────────────────────────────
DB_PATH    = Path("hr.db")
AUDIT_PATH = Path("audit.db")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


@st.cache_data(ttl=60)
def load_employees() -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame()
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM employees", conn)
    conn.close()
    return df


def load_audit() -> pd.DataFrame:
    if not AUDIT_PATH.exists():
        return pd.DataFrame(columns=["id", "ts", "tool", "query", "user_id", "result_rows", "status"])
    conn = sqlite3.connect(AUDIT_PATH)
    df = pd.read_sql(
        "SELECT id, ts, tool, query, user_id, result_rows, status "
        "FROM audit_log ORDER BY id DESC LIMIT 200",
        conn,
    )
    conn.close()
    return df


def get_agent_safe():
    """Import agent lazily so Streamlit can still render if MCP is unavailable."""
    try:
        from hr_agent import ask_sync
        return ask_sync
    except Exception as exc:
        return None, str(exc)


# ─────────────────────────────────────────────────────────────────────────────
# Sidebar – user identity & quick stats
# ─────────────────────────────────────────────────────────────────────────────

with st.sidebar:
    st.image("https://api.dicebear.com/7.x/bottts/svg?seed=hr", width=80)
    st.title("HR Assistant")
    st.caption("Powered by Ollama + MCP")

    st.divider()
    user_id = st.text_input("Your user ID (for audit log)", value="anonymous", key="user_id")

    st.divider()
    df_all = load_employees()
    if not df_all.empty:
        total = len(df_all)
        active = (df_all["Employment Status"] == "Active").sum() if "Employment Status" in df_all.columns else "?"
        st.metric("Total Employees", total)
        st.metric("Active", active)
        st.metric("Departments", df_all["Department"].nunique() if "Department" in df_all.columns else "?")

    st.divider()
    if st.button("🔄 Refresh Data"):
        st.cache_data.clear()
        st.rerun()

# ─────────────────────────────────────────────────────────────────────────────
# Tabs
# ─────────────────────────────────────────────────────────────────────────────

tab_chat, tab_analytics, tab_directory, tab_audit, tab_help = st.tabs(
    ["💬 Chat", "📊 Analytics", "🗂️ Directory", "📋 Audit Log", "ℹ️ Help"]
)

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1 – Chat
# ══════════════════════════════════════════════════════════════════════════════

with tab_chat:
    st.header("HR Chatbot")
    st.caption(
        "Ask anything: employee details, HR policies, org charts, workforce stats, and more."
    )

    # ── session state ─────────────────────────────────────────────────────────
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    # ── display history ───────────────────────────────────────────────────────
    for msg in st.session_state.chat_history:
        with st.chat_message("user"):
            st.write(msg["user"])
        with st.chat_message("assistant"):
            st.write(msg["bot"])

    # ── input ─────────────────────────────────────────────────────────────────
    question = st.chat_input("Ask about an employee, department, policy, or workforce...")

    if question:
        with st.chat_message("user"):
            st.write(question)

        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                ask_sync = get_agent_safe()
                if callable(ask_sync):
                    try:
                        answer = ask_sync(
                            question,
                            st.session_state.chat_history,
                            user_id=st.session_state.get("user_id", "anonymous"),
                        )
                    except Exception as exc:
                        answer = f"⚠️ Error: {exc}"
                else:
                    answer = (
                        "⚠️ MCP Agent is not available. "
                        "Make sure `mcp` and `langchain-ollama` are installed and "
                        "Ollama is running.\n\nError: " + str(ask_sync[1])
                    )
            st.write(answer)

        st.session_state.chat_history.append({"user": question, "bot": answer})

    # Clear chat button
    col1, col2 = st.columns([8, 1])
    with col2:
        if st.button("🗑️ Clear", help="Clear conversation history"):
            st.session_state.chat_history = []
            st.rerun()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2 – Analytics Dashboard
# ══════════════════════════════════════════════════════════════════════════════

with tab_analytics:
    st.header("Workforce Analytics")

    if df_all.empty:
        st.warning("No employee data found. Run `python ingest_employees.py` first.")
    else:
        df = df_all.copy()

        # ── KPI row ───────────────────────────────────────────────────────────
        k1, k2, k3, k4 = st.columns(4)
        active_count = (df["Employment Status"] == "Active").sum() if "Employment Status" in df.columns else 0
        avg_pay = pd.to_numeric(df["Pay Rate"], errors="coerce").mean() if "Pay Rate" in df.columns else 0
        top_perf = (df["Performance Score"] == "Exceeds").sum() if "Performance Score" in df.columns else 0
        k1.metric("Total Employees", len(df))
        k2.metric("Active", int(active_count))
        k3.metric("Avg Pay Rate", f"${avg_pay:,.2f}")
        k4.metric("Top Performers", int(top_perf))

        st.divider()

        row1_left, row1_right = st.columns(2)

        # Department headcount bar chart
        if "Department" in df.columns:
            with row1_left:
                st.subheader("Headcount by Department")
                dept_counts = df["Department"].value_counts().reset_index()
                dept_counts.columns = ["Department", "Count"]
                st.bar_chart(dept_counts.set_index("Department"))

        # Performance score donut
        if "Performance Score" in df.columns:
            with row1_right:
                st.subheader("Performance Score Distribution")
                perf_counts = df["Performance Score"].value_counts().reset_index()
                perf_counts.columns = ["Score", "Count"]
                st.bar_chart(perf_counts.set_index("Score"))

        row2_left, row2_right = st.columns(2)

        # Employment status pie
        if "Employment Status" in df.columns:
            with row2_left:
                st.subheader("Employment Status")
                status_counts = df["Employment Status"].value_counts().reset_index()
                status_counts.columns = ["Status", "Count"]
                st.bar_chart(status_counts.set_index("Status"))

        # Gender breakdown
        if "Sex" in df.columns:
            with row2_right:
                st.subheader("Gender Breakdown")
                gender_counts = df["Sex"].value_counts().reset_index()
                gender_counts.columns = ["Gender", "Count"]
                st.bar_chart(gender_counts.set_index("Gender"))

        # Pay rate by department
        if "Department" in df.columns and "Pay Rate" in df.columns:
            st.divider()
            st.subheader("Average Pay Rate by Department")
            df["Pay Rate Num"] = pd.to_numeric(df["Pay Rate"], errors="coerce")
            dept_pay = df.groupby("Department")["Pay Rate Num"].mean().dropna().sort_values(ascending=False)
            st.bar_chart(dept_pay.rename("Avg Pay Rate"))

        # Turnover by department
        if "Employment Status" in df.columns and "Department" in df.columns:
            st.divider()
            st.subheader("Termination Count by Department")
            term_df = df[df["Employment Status"] != "Active"]
            term_counts = term_df["Department"].value_counts().reset_index()
            term_counts.columns = ["Department", "Terminations"]
            st.bar_chart(term_counts.set_index("Department"))

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3 – Employee Directory
# ══════════════════════════════════════════════════════════════════════════════

with tab_directory:
    st.header("Employee Directory")

    if df_all.empty:
        st.warning("No employee data found.")
    else:
        df = df_all.copy()

        # ── filters ───────────────────────────────────────────────────────────
        f1, f2, f3 = st.columns(3)
        with f1:
            name_filter = st.text_input("🔍 Search by name", "")
        with f2:
            dept_options = ["All"] + sorted(df["Department"].dropna().unique().tolist()) if "Department" in df.columns else ["All"]
            dept_filter = st.selectbox("Department", dept_options)
        with f3:
            status_options = ["All"] + sorted(df["Employment Status"].dropna().unique().tolist()) if "Employment Status" in df.columns else ["All"]
            status_filter = st.selectbox("Status", status_options)

        # Apply filters
        filtered = df.copy()
        if name_filter:
            mask = filtered["Employee Name"].str.contains(name_filter, case=False, na=False) if "Employee Name" in filtered.columns else pd.Series([True]*len(filtered))
            filtered = filtered[mask]
        if dept_filter != "All" and "Department" in filtered.columns:
            filtered = filtered[filtered["Department"] == dept_filter]
        if status_filter != "All" and "Employment Status" in filtered.columns:
            filtered = filtered[filtered["Employment Status"] == status_filter]

        st.caption(f"Showing {len(filtered)} of {len(df)} employees")

        # Columns to display (hide raw internal IDs)
        display_cols = [
            c for c in [
                "Employee Name", "Department", "Position",
                "Employment Status", "Manager Name", "Pay Rate", "Performance Score"
            ] if c in filtered.columns
        ]
        st.dataframe(
            filtered[display_cols].reset_index(drop=True),
            width=True,
            height=500,
        )

        # CSV download
        st.download_button(
            "⬇️ Export to CSV",
            data=filtered[display_cols].to_csv(index=False),
            file_name="employees_export.csv",
            mime="text/csv",
        )

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4 – Audit Log
# ══════════════════════════════════════════════════════════════════════════════

with tab_audit:
    st.header("Query Audit Log")
    st.caption("Immutable record of all employee data queries made through the HR Assistant.")

    audit_df = load_audit()
    if audit_df.empty:
        st.info("No audit entries yet. Audit events are written automatically when employee data is accessed.")
    else:
        st.dataframe(audit_df, width=True, height=500)
        st.download_button(
            "⬇️ Export Audit Log",
            data=audit_df.to_csv(index=False),
            file_name="audit_log.csv",
            mime="text/csv",
        )

# ══════════════════════════════════════════════════════════════════════════════
# TAB 5 – Help
# ══════════════════════════════════════════════════════════════════════════════

with tab_help:
    st.header("HR Assistant – Usage Guide")

    st.markdown("""
### 🚀 Getting Started

**1. Set up your data**
```bash
# Load HR policy PDFs (place PDFs in ./data/)
python ingest.py

# Load employee CSV (place employees.csv in ./data/)
python ingest_employees.py

# Verify everything is ready
python project_setup_check.py
```

**2. Start the app**
```bash
python run_app.py
# or directly:
streamlit run streamlit_app.py
```

---

### 💬 Example Chat Questions

| Category | Example Questions |
|---|---|
| **Employee Lookup** | "Show me details for Jane Smith" |
| **Department** | "List all employees in Engineering" |
| **Performance** | "Who are the top performers?" |
| **Org Chart** | "Who reports to Michael Scott?" |
| **Analytics** | "Give me a workforce summary" |
| **HR Policy** | "What is the remote work policy?" |
| **Leave** | "How many PTO days do I get?" |
| **Benefits** | "What health insurance does the company offer?" |

---

### 🛠️ MCP Tools Available

| Tool | Description |
|---|---|
| `search_employees` | Filter employees by name, dept, position, status, manager |
| `get_employee_details` | Full profile for one employee |
| `get_department_analytics` | Headcount, pay, performance by dept |
| `get_org_chart` | Manager → direct-reports hierarchy |
| `get_workforce_summary` | Company-wide KPIs |
| `search_hr_policy` | Semantic search over policy PDFs |
| `log_audit_event` | Immutable audit trail (auto-called) |

---

### 🏗️ Architecture

```
Streamlit UI
    └── hr_agent.py  (LLM + ReAct loop)
            └── MCPClient  (stdio transport)
                    └── mcp_hr_server.py
                            ├── hr.db         (SQLite – employee data)
                            ├── hr_vectordb/  (ChromaDB – policy PDFs)
                            └── audit.db      (SQLite – audit trail)
```

---

### 🔒 Privacy & Security

- All employee data queries are **automatically audited** in `audit.db`
- Use the **Audit Log** tab to review all data access
- Employee records are served read-only (no UPDATE/DELETE tools exposed)
- Consider adding role-based access control for production deployments
    """)
