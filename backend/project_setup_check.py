"""
project_setup_check.py
======================
Quick health check for the MCP HR Assistant project.
Run at any time:
    python project_setup_check.py
"""

import importlib
import os
import sqlite3
import sys
from pathlib import Path


def section(title: str):
    print(f"\n{'─'*45}")
    print(f"  {title}")
    print(f"{'─'*45}")


def check(label: str, ok: bool, fix: str = ""):
    icon = "✅" if ok else "❌"
    line = f"  {icon}  {label}"
    if not ok and fix:
        line += f"\n       → {fix}"
    print(line)
    return ok


# ── Python packages ───────────────────────────────────────────────────────────
section("Python Packages")
packages = {
    "mcp":                     "pip install mcp",
    "streamlit":               "pip install streamlit",
    "langchain_community":     "pip install langchain-community",
    "langchain_groq":          "pip install langchain-groq",
    "langchain_huggingface":   "pip install langchain-huggingface",
    "sentence_transformers":   "pip install sentence-transformers",
    "chromadb":                "pip install chromadb",
    "pandas":                  "pip install pandas",
    "langchain_text_splitters":"pip install langchain-text-splitters",
}
all_pkgs_ok = True
for pkg, install_cmd in packages.items():
    try:
        importlib.import_module(pkg)
        check(pkg, True)
    except ImportError:
        check(pkg, False, install_cmd)
        all_pkgs_ok = False

# ── Core files ────────────────────────────────────────────────────────────────
section("Core Files")
required_files = [
    "mcp_hr_server.py",
    "hr_agent.py",
    "streamlit_app.py",
    "ingest.py",
    "ingest_employees.py",
    "run_app.py",
]
for f in required_files:
    check(f, Path(f).exists(), f"Missing! Check your project directory.")

# ── Data ──────────────────────────────────────────────────────────────────────
section("Data")
check("data/ folder",          Path("data").exists(),           "mkdir data")
check("data/employees.csv",    Path("data/employees.csv").exists(), "Place employee CSV here")
check("HR policy PDFs in data/", bool(list(Path("data").glob("*.pdf"))) if Path("data").exists() else False,
      "Add PDF files → run python ingest.py")

# ── Databases ─────────────────────────────────────────────────────────────────
section("Databases")
db_ok = Path("hr.db").exists()
check("hr.db (employee SQLite)", db_ok, "Run: python ingest_employees.py")

if db_ok:
    try:
        conn = sqlite3.connect("hr.db")
        count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
        conn.close()
        check(f"  employees table ({count} rows)", True)
    except Exception as e:
        check(f"  employees table", False, str(e))

check("hr_vectordb/ (policy ChromaDB)",
      Path("hr_vectordb/chroma.sqlite3").exists(),
      "Run: python ingest.py")
check("audit.db (audit trail)",
      Path("audit.db").exists(),
      "Will be created automatically on first query.")

# ── Groq API Key ──────────────────────────────────────────────────────────────
section("Groq API Key")
groq_key = os.environ.get("GROQ_API_KEY", "")
check(
    "GROQ_API_KEY set",
    bool(groq_key),
    "export GROQ_API_KEY=gsk_...   (get a free key at https://console.groq.com)",
)

# ── Summary ───────────────────────────────────────────────────────────────────
section("Summary")
print("  Run the app:  python run_app.py")
print("  Or directly:  streamlit run streamlit_app.py\n")