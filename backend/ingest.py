"""
ingest.py
=========
Ingests HR policy PDFs from ./data/ → ChromaDB at ./hr_vectordb/

Run once before starting the app:
    python ingest.py
"""

import os
from pathlib import Path

DATA_PATH    = Path("data")
VECTOR_PATH  = "./hr_vectordb"
CHUNK_SIZE   = 500
CHUNK_OVERLAP = 60

# ── validate ──────────────────────────────────────────────────────────────────
if not DATA_PATH.exists():
    DATA_PATH.mkdir()
    print(f"Created {DATA_PATH}/  — place your HR policy PDFs here, then re-run.")
    raise SystemExit(0)

pdfs = list(DATA_PATH.glob("*.pdf"))
if not pdfs:
    print(f"No PDF files found in {DATA_PATH}/. Add policy PDFs and re-run.")
    raise SystemExit(0)

print(f"Found {len(pdfs)} PDF(s): {[p.name for p in pdfs]}")

# ── load & split ──────────────────────────────────────────────────────────────
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

docs = []
for pdf in pdfs:
    loader = PyPDFLoader(str(pdf))
    pages  = loader.load()
    # Attach source metadata
    for p in pages:
        p.metadata["source"] = pdf.name
    docs.extend(pages)
    print(f"  {pdf.name}: {len(pages)} pages")

print(f"\nTotal pages loaded: {len(docs)}")

splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
chunks   = splitter.split_documents(docs)
print(f"Created {len(chunks)} chunks (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")

# ── embed & persist ───────────────────────────────────────────────────────────
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

embeddings = OllamaEmbeddings(model="nomic-embed-text")

print("Embedding chunks (this may take a few minutes)…")
vectordb = Chroma.from_documents(chunks, embeddings, persist_directory=VECTOR_PATH)
vectordb.persist()

print(f"\n✅ HR policy knowledge base ready at {VECTOR_PATH}  ({len(chunks)} chunks)")
