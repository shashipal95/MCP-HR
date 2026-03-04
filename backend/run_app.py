"""
run_app.py
==========
Smart startup script.

1. Checks Python package requirements.
2. Verifies HR data (hr.db + hr_vectordb) and offers to build if missing.
3. Launches the Streamlit app.

Usage:
    python run_app.py
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
REQUIRED_PACKAGES = [
    "mcp",
    "streamlit",
    "langchain_community",
    "langchain_ollama",
    "langchain_text_splitters",
    "chromadb",
    "pandas",
]
# ─────────────────────────────────────────────────────────────────────────────


def banner(text: str):
    print(f"\n{'='*50}\n  {text}\n{'='*50}")


def check_packages():
    banner("Checking Python packages")
    missing = []
    for pkg in REQUIRED_PACKAGES:
        try:
            __import__(pkg)
            print(f"  ✅  {pkg}")
        except ImportError:
            print(f"  ❌  {pkg}  ← MISSING")
            missing.append(pkg)

    if missing:
        print("\nInstall missing packages:")
        install_names = {
            "mcp":                     "mcp",
            "langchain_community":     "langchain-community",
            "langchain_ollama":        "langchain-ollama",
            "langchain_text_splitters":"langchain-text-splitters",
            "chromadb":                "chromadb",
        }
        pkgs = " ".join(install_names.get(p, p) for p in missing)
        print(f"  pip install {pkgs} pypdf")
        sys.exit(1)


def check_data():
    banner("Checking data & vector stores")

    db_ok = Path("hr.db").exists()
    hr_vdb_ok = Path("hr_vectordb/chroma.sqlite3").exists()

    print(f"  {'✅' if db_ok else '❌'}  hr.db (employee SQLite database)")
    print(f"  {'✅' if hr_vdb_ok else '❌'}  hr_vectordb/ (HR policy ChromaDB)")

    if not db_ok:
        if not Path("data/employees.csv").exists():
            print("\n  ⚠️  data/employees.csv not found.")
            print("     Place your employee CSV there and re-run.")
            sys.exit(1)
        ans = input("\n  Build hr.db now? [Y/n] ").strip().lower()
        if ans in ("", "y"):
            subprocess.run([sys.executable, "ingest_employees.py"], check=True)

    if not hr_vdb_ok:
        pdfs = list(Path("data").glob("*.pdf")) if Path("data").exists() else []
        if not pdfs:
            print("\n  ℹ️  No PDFs in data/ – policy RAG will be unavailable.")
            print("     Add PDFs and run:  python ingest.py")
        else:
            ans = input(f"\n  Found {len(pdfs)} PDF(s). Build hr_vectordb now? [Y/n] ").strip().lower()
            if ans in ("", "y"):
                subprocess.run([sys.executable, "ingest.py"], check=True)


def launch():
    banner("Launching HR Assistant")
    print("  URL: http://localhost:8501\n")
    subprocess.run(
        [sys.executable, "-m", "streamlit", "run", "streamlit_app.py",
         "--server.headless", "true"],
    )


if __name__ == "__main__":
    check_packages()
    check_data()
    launch()
