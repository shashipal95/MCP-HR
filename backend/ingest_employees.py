"""
ingest_employees.py (FINAL - Pinecone + Gemini + Namespace)
==========================================================
Loads employees.csv → SQLite (structured queries)
                     → Pinecone (semantic search via namespace)

Run:
    python ingest_employees.py
"""

import os
import sqlite3
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────
# 🔥 Load ENV
# ─────────────────────────────────────────────────────────────
load_dotenv()

CSV_PATH = Path("data/employees.csv")
DB_PATH  = Path("hr.db")

# ─────────────────────────────────────────────────────────────
# 1. Load CSV
# ─────────────────────────────────────────────────────────────
if not CSV_PATH.exists():
    raise FileNotFoundError(f"Missing {CSV_PATH}")

df = pd.read_csv(CSV_PATH)
df.columns = [c.strip() for c in df.columns]

print(f"Loaded {len(df)} rows")

# ─────────────────────────────────────────────────────────────
# 2. Save to SQLite
# ─────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)

df.to_sql("employees", conn, if_exists="replace", index=False)

conn.execute('CREATE INDEX IF NOT EXISTS idx_name ON employees ("Employee Name")')
conn.execute('CREATE INDEX IF NOT EXISTS idx_dept ON employees (Department)')
conn.execute('CREATE INDEX IF NOT EXISTS idx_mgr  ON employees ("Manager Name")')

conn.commit()
conn.close()

print(f"✅ SQLite ready ({len(df)} rows)")

# ─────────────────────────────────────────────────────────────
# 3. Pinecone + Gemini Embedding
# ─────────────────────────────────────────────────────────────
try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    from pinecone import Pinecone, ServerlessSpec

    # ✅ Gemini embeddings (768 dim)
    embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    # Force the output to match your 768-dimension index
    output_dimensionality=768 
)

    # ✅ Pinecone init
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

    index_name = "hr-index"

    # ✅ Create ONE index (if not exists)
    existing_indexes = [i["name"] for i in pc.list_indexes()]

    if index_name not in existing_indexes:
        print("Creating Pinecone index...")
        pc.create_index(
            name=index_name,
            dimension=768,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region=os.getenv("PINECONE_ENV", "us-east-1")
            )
        )

    index = pc.Index(index_name)

    print("Embedding employees and uploading to Pinecone...")

    vectors = []

    for i, row in df.iterrows():
        # Convert row to text
        text = "\n".join(
            f"{k}: {v}" for k, v in row.items() if pd.notna(v)
        )

        # Generate embedding
        embedding = embeddings.embed_query(text)

        vectors.append({
            "id": f"emp-{i}",
            "values": embedding,
            "metadata": {
                "text": text,
                "name": str(row.get("Employee Name", "")),
                "department": str(row.get("Department", ""))
            }
        })

    # Upload in batches
    batch_size = 100

    for i in range(0, len(vectors), batch_size):
        index.upsert(
            vectors=vectors[i:i + batch_size],
            namespace="employees"   # 🔥 IMPORTANT
        )

    print(f"✅ Pinecone upload complete ({len(vectors)} records)")

except Exception as e:
    print(f"⚠️ Pinecone embedding skipped: {e}")