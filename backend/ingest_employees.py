"""
ingest_employees.py
===================
Loads employees.csv → SQLite hr.db  (for structured SQL queries via MCP)
                     → ChromaDB     (for semantic/natural-language fallback)

Run once before starting the app:
    python ingest_employees.py
"""

import sqlite3
from pathlib import Path

import pandas as pd

CSV_PATH = Path("data/employees.csv")
DB_PATH  = Path("hr.db")

# ── 1. Load CSV ───────────────────────────────────────────────────────────────

if not CSV_PATH.exists():
    raise FileNotFoundError(
        f"Expected employee CSV at {CSV_PATH}. "
        "Create ./data/ and place employees.csv there."
    )

df = pd.read_csv(CSV_PATH)
print(f"Loaded {len(df)} rows from {CSV_PATH}")

# Normalise column names (strip whitespace)
df.columns = [c.strip() for c in df.columns]

# ── 2. Write to SQLite ────────────────────────────────────────────────────────

conn = sqlite3.connect(DB_PATH)
df.to_sql("employees", conn, if_exists="replace", index=False)
conn.execute("CREATE INDEX IF NOT EXISTS idx_name ON employees (\"Employee Name\")")
conn.execute("CREATE INDEX IF NOT EXISTS idx_dept ON employees (Department)")
conn.execute("CREATE INDEX IF NOT EXISTS idx_mgr  ON employees (\"Manager Name\")")
conn.commit()
conn.close()
print(f"✅ SQLite DB written to {DB_PATH}  ({len(df)} rows, table: employees)")

# ── 3. Optionally embed into ChromaDB for semantic search ─────────────────────

try:
    from langchain_community.vectorstores import Chroma
    from langchain_core.documents import Document
    from langchain_ollama import OllamaEmbeddings

    documents = []
    for _, row in df.iterrows():
        text = "\n".join(f"{k}: {v}" for k, v in row.items() if pd.notna(v))
        documents.append(Document(page_content=text, metadata={"name": row.get("Employee Name", "")}))

    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    vectordb = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory="./employee_vectordb",
    )
    vectordb.persist()
    print(f"✅ ChromaDB embeddings written to ./employee_vectordb  ({len(documents)} docs)")
except Exception as exc:
    print(f"⚠️  ChromaDB embedding skipped ({exc}). SQLite will be used for all queries.")
