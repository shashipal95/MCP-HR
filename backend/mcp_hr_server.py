"""
MCP HR Server
=============
Exposes HR data tools via the Model Context Protocol (MCP).
Run this as a subprocess; the HR Agent communicates via stdio.

Tools exposed:
  - search_employees         : Flexible employee search (SQL-backed)
  - get_employee_details     : Full profile for one employee
  - get_department_analytics : Headcount, avg pay, performance by dept
  - get_org_chart            : Manager → direct-reports tree
  - get_workforce_summary    : Company-wide KPIs
  - search_hr_policy         : RAG over policy PDF knowledge base
  - log_audit_event          : Write to immutable audit trail
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# ── optional: ChromaDB for policy RAG ────────────────────────────────────────
try:
    from langchain_community.vectorstores import Chroma
    from langchain_ollama import OllamaEmbeddings

    _embeddings = OllamaEmbeddings(model="nomic-embed-text")
    _vectordb = Chroma(
        persist_directory="./hr_vectordb", embedding_function=_embeddings
    )
    RAG_AVAILABLE = True
except Exception:
    RAG_AVAILABLE = False
    logging.warning("ChromaDB / Ollama not available – policy RAG disabled.")

# ── paths & constants ─────────────────────────────────────────────────────────
DB_PATH = Path("hr.db")
AUDIT_DB_PATH = Path("audit.db")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mcp_hr_server")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _audit_db() -> sqlite3.Connection:
    conn = sqlite3.connect(AUDIT_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          TEXT    NOT NULL,
            tool        TEXT    NOT NULL,
            query       TEXT,
            user_id     TEXT,
            result_rows INTEGER,
            status      TEXT
        )
        """
    )
    conn.commit()
    return conn


def _rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]


def _fmt(rows: list[dict]) -> str:
    if not rows:
        return "No records found."
    if len(rows) == 1:
        return "\n".join(f"  {k}: {v}" for k, v in rows[0].items())
    header = " | ".join(rows[0].keys())
    lines = [header, "-" * len(header)]
    for r in rows:
        lines.append(" | ".join(str(v) for v in r.values()))
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Tool implementations
# ─────────────────────────────────────────────────────────────────────────────


def search_employees(
    name: str | None = None,
    department: str | None = None,
    position: str | None = None,
    employment_status: str | None = None,
    manager: str | None = None,
    performance_score: str | None = None,
    limit: int = 20,
) -> str:
    """Search the employee table with optional filters."""
    clauses, params = [], []

    if name:
        # Handle: "Last, First" (DB format), "First Last", or partial
        name = name.strip()
        if "," in name:
            pattern = f"%{name}%"
        else:
            parts = name.split()
            if len(parts) == 2:
                pattern = f"%{parts[1]}, {parts[0]}%"
            else:
                pattern = f"%{name}%"
        clauses.append('"Employee Name" LIKE ?')
        params.append(pattern)

    if department:
        clauses.append("Department LIKE ?")
        params.append(f"%{department}%")

    if position:
        clauses.append("Position LIKE ?")
        params.append(f"%{position}%")

    if employment_status:
        clauses.append('"Employment Status" LIKE ?')
        params.append(f"%{employment_status}%")

    if manager:
        clauses.append('"Manager Name" LIKE ?')
        params.append(f"%{manager}%")

    if performance_score:
        clauses.append('"Performance Score" = ?')
        params.append(performance_score)

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT "Employee Name", Department, Position, "Employment Status",
               "Manager Name", "Pay Rate", "Performance Score"
        FROM employees
        {where}
        LIMIT {int(limit)}
    """
    with _db() as conn:
        rows = _rows_to_list(conn.execute(sql, params).fetchall())

    count = len(rows)
    result = f"Found {count} employee(s).\n\n{_fmt(rows)}"
    return result


def get_employee_details(name: str) -> str:
    """Return the full profile of a single employee by name."""
    name = name.strip()
    if "," in name:
        # Already "Last, First" DB format
        pattern = f"%{name}%"
    else:
        parts = name.split()
        if len(parts) == 2:
            pattern = f"%{parts[1]}, {parts[0]}%"
        else:
            pattern = f"%{name}%"

    sql = 'SELECT * FROM employees WHERE "Employee Name" LIKE ?'
    with _db() as conn:
        rows = _rows_to_list(conn.execute(sql, [pattern]).fetchall())

    if not rows:
        return f"No employee found matching '{name}'."
    if len(rows) > 1:
        names = ", ".join(r["Employee Name"] for r in rows)
        return f"Multiple matches found: {names}. Please be more specific."

    record = rows[0]
    lines = [f"  {k}: {v}" for k, v in record.items() if v not in (None, "", "N/A")]
    return "Employee Profile\n" + "=" * 40 + "\n" + "\n".join(lines)


def get_department_analytics(department: str | None = None) -> str:
    """Headcount, average pay rate, performance breakdown per department."""
    dept_filter = "WHERE Department LIKE ?" if department else ""
    params = [f"%{department}%"] if department else []

    sql = f"""
        SELECT
            Department,
            COUNT(*)                                       AS headcount,
            ROUND(AVG(CAST("Pay Rate" AS REAL)), 2)        AS avg_pay_rate,
            SUM(CASE WHEN "Employment Status" = 'Active'   THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN "Employment Status" != 'Active'  THEN 1 ELSE 0 END) AS terminated,
            SUM(CASE WHEN "Performance Score" = 'Exceeds'  THEN 1 ELSE 0 END) AS exceeds,
            SUM(CASE WHEN "Performance Score" = 'Fully Meets' THEN 1 ELSE 0 END) AS fully_meets,
            SUM(CASE WHEN "Performance Score" = 'Needs Improvement' THEN 1 ELSE 0 END) AS needs_improvement,
            SUM(CASE WHEN "Performance Score" = 'PIP'      THEN 1 ELSE 0 END) AS pip
        FROM employees
        {dept_filter}
        GROUP BY Department
        ORDER BY headcount DESC
    """
    with _db() as conn:
        rows = _rows_to_list(conn.execute(sql, params).fetchall())

    return f"Department Analytics\n{'='*40}\n{_fmt(rows)}"


def get_org_chart(manager_name: str | None = None, depth: int = 2) -> str:
    """
    Return a manager → direct-reports tree.
    If manager_name is omitted, returns top-level managers.
    """
    with _db() as conn:
        if manager_name:
            rows = _rows_to_list(
                conn.execute(
                    'SELECT "Employee Name", Position, Department '
                    'FROM employees WHERE "Manager Name" LIKE ?',
                    [f"%{manager_name}%"],
                ).fetchall()
            )
            if not rows:
                return f"No direct reports found for '{manager_name}'."
            lines = [f"Direct reports of {manager_name}:", "=" * 40]
            for r in rows:
                lines.append(
                    f"  • {r['Employee Name']} — {r['Position']} ({r['Department']})"
                )
            return "\n".join(lines)
        else:
            # Top-level: employees whose manager is not themselves
            rows = _rows_to_list(
                conn.execute(
                    'SELECT DISTINCT "Manager Name" FROM employees '
                    'WHERE "Manager Name" IS NOT NULL AND "Manager Name" != "" '
                    "ORDER BY \"Manager Name\""
                ).fetchall()
            )
            managers = [r["Manager Name"] for r in rows]
            return "All Managers:\n" + "\n".join(f"  • {m}" for m in managers)


def get_workforce_summary() -> str:
    """Company-wide KPIs: headcount, active %, avg pay, turnover rate."""
    sql = """
        SELECT
            COUNT(*)                                                AS total_employees,
            SUM(CASE WHEN "Employment Status" = 'Active' THEN 1 ELSE 0 END) AS active_employees,
            SUM(CASE WHEN "Employment Status" != 'Active' THEN 1 ELSE 0 END) AS terminated_employees,
            ROUND(AVG(CAST("Pay Rate" AS REAL)), 2)                 AS avg_pay_rate,
            ROUND(MIN(CAST("Pay Rate" AS REAL)), 2)                 AS min_pay_rate,
            ROUND(MAX(CAST("Pay Rate" AS REAL)), 2)                 AS max_pay_rate,
            COUNT(DISTINCT Department)                              AS departments,
            COUNT(DISTINCT Position)                                AS unique_positions,
            SUM(CASE WHEN Sex = 'F' THEN 1 ELSE 0 END)             AS female_count,
            SUM(CASE WHEN Sex = 'M' THEN 1 ELSE 0 END)             AS male_count,
            SUM(CASE WHEN "Performance Score" = 'Exceeds' THEN 1 ELSE 0 END) AS top_performers
        FROM employees
    """
    with _db() as conn:
        row = dict(conn.execute(sql).fetchone())

    total = row["total_employees"] or 1
    row["active_pct"] = f"{round(row['active_employees']/total*100, 1)}%"
    row["turnover_pct"] = f"{round(row['terminated_employees']/total*100, 1)}%"
    row["gender_ratio_F_M"] = f"{row['female_count']} F / {row['male_count']} M"

    lines = ["Workforce Summary", "=" * 40]
    for k, v in row.items():
        lines.append(f"  {k.replace('_',' ').title()}: {v}")
    return "\n".join(lines)


def search_hr_policy(query: str, k: int = 4) -> str:
    """Semantic search over ingested HR policy documents."""
    if not RAG_AVAILABLE:
        return (
            "HR policy knowledge base is not available. "
            "Please run `python ingest.py` to build it."
        )
    docs = _vectordb.similarity_search(query, k=k)
    if not docs:
        return "No relevant policy sections found."
    sections = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "Policy Document")
        sections.append(f"[{i}] Source: {source}\n{doc.page_content.strip()}")
    return "\n\n---\n\n".join(sections)


def log_audit_event(
    tool: str,
    query: str,
    user_id: str = "anonymous",
    result_rows: int = 0,
    status: str = "ok",
) -> str:
    """Write an immutable audit entry. Returns the new log ID."""
    with _audit_db() as conn:
        cur = conn.execute(
            "INSERT INTO audit_log (ts, tool, query, user_id, result_rows, status) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [datetime.utcnow().isoformat(), tool, query, user_id, result_rows, status],
        )
        conn.commit()
        return f"Audit event logged (id={cur.lastrowid})"


# ─────────────────────────────────────────────────────────────────────────────
# MCP Server definition
# ─────────────────────────────────────────────────────────────────────────────

server = Server("hr-assistant")

TOOLS: list[Tool] = [
    Tool(
        name="search_employees",
        description=(
            "Search employees by any combination of name, department, position, "
            "employment status, manager, or performance score. "
            "Use this for listing, filtering, or finding employees."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "name":              {"type": "string", "description": "Employee full name (First Last)"},
                "department":        {"type": "string", "description": "Department name (partial match)"},
                "position":          {"type": "string", "description": "Job title (partial match)"},
                "employment_status": {"type": "string", "description": "e.g. Active, Terminated"},
                "manager":           {"type": "string", "description": "Manager name (partial match)"},
                "performance_score": {"type": "string", "description": "Exceeds | Fully Meets | Needs Improvement | PIP"},
                "limit":             {"type": "integer", "default": 20},
            },
        },
    ),
    Tool(
        name="get_employee_details",
        description=(
            "Return the complete HR profile for a single employee by name. "
            "Use this when the user asks for full details about one person."
        ),
        inputSchema={
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {"type": "string", "description": "Employee full name"},
            },
        },
    ),
    Tool(
        name="get_department_analytics",
        description=(
            "Return headcount, average pay, active vs terminated count, and "
            "performance score breakdown for one or all departments."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "department": {"type": "string", "description": "Leave blank for all departments"},
            },
        },
    ),
    Tool(
        name="get_org_chart",
        description=(
            "Show the reporting structure. "
            "Given a manager name, returns their direct reports. "
            "If no manager is specified, lists all managers."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "manager_name": {"type": "string"},
                "depth":        {"type": "integer", "default": 2},
            },
        },
    ),
    Tool(
        name="get_workforce_summary",
        description=(
            "Return company-wide KPIs: total headcount, active %, avg pay, "
            "gender breakdown, turnover rate, top performers count."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="search_hr_policy",
        description=(
            "Semantic search over HR policy documents. "
            "Use this for questions about leave, benefits, PTO, conduct, "
            "remote work, onboarding, compliance, or any policy topic."
        ),
        inputSchema={
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string", "description": "Natural-language policy question"},
                "k":     {"type": "integer", "default": 4, "description": "Number of context chunks"},
            },
        },
    ),
    Tool(
        name="log_audit_event",
        description="Log a query to the immutable HR audit trail.",
        inputSchema={
            "type": "object",
            "required": ["tool", "query"],
            "properties": {
                "tool":        {"type": "string"},
                "query":       {"type": "string"},
                "user_id":     {"type": "string"},
                "result_rows": {"type": "integer"},
                "status":      {"type": "string"},
            },
        },
    ),
]

TOOL_MAP = {
    "search_employees":       search_employees,
    "get_employee_details":   get_employee_details,
    "get_department_analytics": get_department_analytics,
    "get_org_chart":          get_org_chart,
    "get_workforce_summary":  get_workforce_summary,
    "search_hr_policy":       search_hr_policy,
    "log_audit_event":        log_audit_event,
}


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    log.info("tool=%s args=%s", name, arguments)
    fn = TOOL_MAP.get(name)
    if fn is None:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]
    try:
        result = fn(**arguments)
    except Exception as exc:
        log.exception("Tool %s raised", name)
        result = f"Error executing {name}: {exc}"
    return [TextContent(type="text", text=str(result))]


# ─────────────────────────────────────────────────────────────────────────────
async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())