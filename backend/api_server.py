"""
api_server.py — FastAPI backend for HR Agent
Run: uvicorn api_server:app --reload --port 8000
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="HR Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH    = Path("hr.db")
AUDIT_PATH = Path("audit.db")

_mcp_client = None
_agent = None


@app.on_event("startup")
async def startup():
    global _mcp_client, _agent
    try:
        from hr_agent import MCPClient, HRAgent
        _mcp_client = MCPClient()
        await _mcp_client.connect()
        _agent = HRAgent(_mcp_client, user_id="system")
        print("✅ HR Agent MCP client connected.")
    except Exception as exc:
        print(f"⚠️  HR Agent not available: {exc}")


@app.on_event("shutdown")
async def shutdown():
    if _mcp_client:
        try:
            await _mcp_client.disconnect()
        except Exception:
            pass


# ── DB helpers ────────────────────────────────────────────────────────────────

def _hr_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _audit_db():
    conn = sqlite3.connect(AUDIT_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    user_id: str = "anonymous"


# ── Chat (non-streaming, kept for compatibility) ──────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if _agent is None:
        raise HTTPException(status_code=503, detail="HR Agent unavailable. Check that Ollama is running.")
    try:
        _agent.user_id = req.user_id
        answer = await _agent.ask(req.message, req.history)
        return {"answer": answer}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Chat streaming (SSE) ──────────────────────────────────────────────────────

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Server-Sent Events endpoint.
    Each event is a JSON object: {"type": "token"|"status"|"done"|"error", "data": "..."}

    Event types:
      status  — "Querying HR database…"  (shown while tools run)
      token   — one LLM output token     (append to message in UI)
      done    — stream finished
      error   — something went wrong
    """
    if _agent is None:
        async def err_gen():
            yield _sse({"type": "error", "data": "HR Agent unavailable. Check that Ollama is running."})
            yield _sse({"type": "done", "data": ""})
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    async def generate():
        try:
            _agent.user_id = req.user_id

            # Send initial status so the UI knows we're working
            yield _sse({"type": "status", "data": "Querying HR database…"})

            async for token in _agent.ask_stream(req.message, req.history):
                # TOOLS_DONE sentinel → emit a status update
                if token == "\x00TOOLS_DONE\x00":
                    yield _sse({"type": "status", "data": "Generating answer…"})
                    continue
                yield _sse({"type": "token", "data": token})

            yield _sse({"type": "done", "data": ""})

        except Exception as exc:
            yield _sse({"type": "error", "data": str(exc)})
            yield _sse({"type": "done",  "data": ""})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":  "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering if proxied
        },
    )


def _sse(obj: dict) -> str:
    """Format a dict as a Server-Sent Event line."""
    return f"data: {json.dumps(obj)}\n\n"


# ── Employees ─────────────────────────────────────────────────────────────────

@app.get("/api/employees")
def get_employees(
    name: str = Query(None),
    department: str = Query(None),
    status: str = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
):
    if not DB_PATH.exists():
        return {"employees": [], "total_filtered": 0, "total_all": 0}
    
    clauses, params = [], []
    if name:
        clauses.append('"Employee Name" LIKE ?'); params.append(f"%{name}%")
    if department and department != "All":
        clauses.append("Department = ?"); params.append(department)
    if status and status != "All":
        clauses.append('"Employment Status" = ?'); params.append(status)
    
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    
    # Count total for the filtered query
    count_sql = f'SELECT COUNT(*) FROM employees {where}'
    
    # Fetch paginated rows
    data_sql = f"""
        SELECT "Employee Name", Department, Position, "Employment Status",
               "Manager Name", "Pay Rate", "Performance Score", Sex, Age, "Marital Status"
        FROM employees {where} 
        LIMIT ? OFFSET ?
    """
    
    with _hr_db() as conn:
        total_filtered = conn.execute(count_sql, params).fetchone()[0]
        rows = [dict(r) for r in conn.execute(data_sql, params + [limit, offset]).fetchall()]
        total_all = conn.execute('SELECT COUNT(*) FROM employees').fetchone()[0]
        
    return {
        "employees": rows, 
        "total_filtered": total_filtered, 
        "total_all": total_all
    }


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/api/analytics")
def get_analytics():
    if not DB_PATH.exists():
        return {"departments": [], "performance": [], "status": [], "gender": []}
    with _hr_db() as conn:
        dept  = [dict(r) for r in conn.execute("""
            SELECT Department,
                COUNT(*) AS headcount,
                ROUND(AVG(CAST("Pay Rate" AS REAL)),2) AS avg_pay,
                SUM(CASE WHEN "Employment Status"='Active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN "Employment Status"!='Active' THEN 1 ELSE 0 END) AS terminated,
                SUM(CASE WHEN "Performance Score"='Exceeds' THEN 1 ELSE 0 END) AS exceeds,
                SUM(CASE WHEN "Performance Score"='Fully Meets' THEN 1 ELSE 0 END) AS fully_meets,
                SUM(CASE WHEN "Performance Score"='Needs Improvement' THEN 1 ELSE 0 END) AS needs_improvement,
                SUM(CASE WHEN "Performance Score"='PIP' THEN 1 ELSE 0 END) AS pip
            FROM employees GROUP BY Department ORDER BY headcount DESC
        """).fetchall()]
        perf   = [dict(r) for r in conn.execute('SELECT "Performance Score" AS score, COUNT(*) AS count FROM employees GROUP BY "Performance Score"').fetchall()]
        status = [dict(r) for r in conn.execute('SELECT "Employment Status" AS status, COUNT(*) AS count FROM employees GROUP BY "Employment Status"').fetchall()]
        gender = [dict(r) for r in conn.execute('SELECT Sex AS gender, COUNT(*) AS count FROM employees GROUP BY Sex').fetchall()]
    return {"departments": dept, "performance": perf, "status": status, "gender": gender}


# ── Workforce ─────────────────────────────────────────────────────────────────

@app.get("/api/workforce")
def get_workforce():
    if not DB_PATH.exists():
        return {}
    with _hr_db() as conn:
        row = dict(conn.execute("""
            SELECT COUNT(*) AS total,
                SUM(CASE WHEN "Employment Status"='Active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN "Employment Status"!='Active' THEN 1 ELSE 0 END) AS terminated,
                ROUND(AVG(CAST("Pay Rate" AS REAL)),2) AS avg_pay,
                COUNT(DISTINCT Department) AS departments,
                COUNT(DISTINCT Position) AS positions,
                SUM(CASE WHEN "Performance Score"='Exceeds' THEN 1 ELSE 0 END) AS top_performers,
                SUM(CASE WHEN Sex='F' THEN 1 ELSE 0 END) AS female,
                SUM(CASE WHEN Sex='M' THEN 1 ELSE 0 END) AS male
            FROM employees
        """).fetchone())
    return row


# ── Audit ─────────────────────────────────────────────────────────────────────

@app.get("/api/audit")
def get_audit(limit: int = Query(50), offset: int = Query(0)):
    if not AUDIT_PATH.exists():
        return {"entries": [], "total": 0}
    try:
        with _audit_db() as conn:
            # Count total
            total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
            # Fetch latest first, paginated
            rows = [dict(r) for r in conn.execute(
                "SELECT id, ts, tool, query, user_id, result_rows, status "
                "FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset]
            ).fetchall()]
        return {"entries": rows, "total": total}
    except Exception:
        return {"entries": [], "total": 0}


# ── Departments ───────────────────────────────────────────────────────────────

@app.get("/api/departments")
def get_departments():
    if not DB_PATH.exists():
        return {"departments": []}
    with _hr_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT Department FROM employees WHERE Department IS NOT NULL ORDER BY Department"
        ).fetchall()
    return {"departments": [r[0] for r in rows]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True)