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

import os
import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# ─────────────────────────────────────────────────────────────
# 🔥 Load ENV
# ─────────────────────────────────────────────────────────────
load_dotenv()

# ─────────────────────────────────────────────────────────────
# 🔥 Pinecone + Gemini Setup
# ─────────────────────────────────────────────────────────────
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    from pinecone import Pinecone

    embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    # Force the output to match your 768-dimension index
    output_dimensionality=768 
)

    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index = pc.Index("hr-policy-index")

    RAG_AVAILABLE = True

except Exception as e:
    RAG_AVAILABLE = False
    print("❌ RAG init failed:", e)

# ─────────────────────────────────────────────────────────────
# DB Paths
# ─────────────────────────────────────────────────────────────
DB_PATH = Path("hr.db")
AUDIT_DB_PATH = Path("audit.db")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mcp_hr_server")

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _audit_db():
    conn = sqlite3.connect(AUDIT_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            tool TEXT,
            query TEXT,
            user_id TEXT,
            result_rows INTEGER,
            status TEXT
        )
    """)
    conn.commit()
    return conn

def _rows_to_list(rows):
    return [dict(r) for r in rows]

def _fmt(rows):
    if not rows:
        return "No records found."
    return "\n".join(str(r) for r in rows)

# ─────────────────────────────────────────────────────────────
# 🔍 Pinecone RAG Function
# ─────────────────────────────────────────────────────────────

def search_hr_policy(query: str, k: int = 4) -> str:
    if not RAG_AVAILABLE:
        return "RAG system not available."

    try:
        query_embedding = embeddings.embed_query(query)

        results = index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True
        )

        matches = results.get("matches", [])

        if not matches:
            return "No relevant policy sections found."

        sections = []
        for i, m in enumerate(matches, 1):
            meta = m.get("metadata", {})
            text = meta.get("text", "")
            source = meta.get("source", "Policy")

            sections.append(f"[{i}] {source}\n{text}")

        return "\n\n---\n\n".join(sections)

    except Exception as e:
        return f"Error: {e}"

# ─────────────────────────────────────────────────────────────
# SQL Tools (unchanged)
# ─────────────────────────────────────────────────────────────

def search_employees(name: str | None = None, limit: int = 10):
    sql = 'SELECT * FROM employees LIMIT ?'
    with _db() as conn:
        rows = _rows_to_list(conn.execute(sql, [limit]).fetchall())
    return _fmt(rows)

def get_employee_details(name: str):
    sql = 'SELECT * FROM employees WHERE "Employee Name" LIKE ?'
    with _db() as conn:
        rows = _rows_to_list(conn.execute(sql, [f"%{name}%"]).fetchall())
    return _fmt(rows)

def get_workforce_summary():
    sql = "SELECT COUNT(*) as total FROM employees"
    with _db() as conn:
        row = dict(conn.execute(sql).fetchone())
    return str(row)

def log_audit_event(tool: str, query: str):
    with _audit_db() as conn:
        cur = conn.execute(
            "INSERT INTO audit_log (ts, tool, query) VALUES (?, ?, ?)",
            [datetime.utcnow().isoformat(), tool, query],
        )
        conn.commit()
        return f"Logged {cur.lastrowid}"

# ─────────────────────────────────────────────────────────────
# MCP Server
# ─────────────────────────────────────────────────────────────

server = Server("hr-assistant")

TOOLS = [
    Tool(
        name="search_hr_policy",
        description="Search HR policy documents",
        inputSchema={
            "type": "object",
            "properties": {"query": {"type": "string"}}
        }
    ),
    Tool(
        name="search_employees",
        description="Search employees",
        inputSchema={"type": "object", "properties": {}}
    ),
]

TOOL_MAP = {
    "search_hr_policy": search_hr_policy,
    "search_employees": search_employees,
}

@server.list_tools()
async def list_tools():
    return TOOLS

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]):
    fn = TOOL_MAP.get(name)
    if not fn:
        return [TextContent(type="text", text="Unknown tool")]
    result = fn(**arguments)
    return [TextContent(type="text", text=str(result))]

# ─────────────────────────────────────────────────────────────
# Run Server
# ─────────────────────────────────────────────────────────────

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())