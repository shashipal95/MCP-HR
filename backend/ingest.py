import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATA_PATH = Path("data")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 60

# ── validate ─────────────────────────────────────────────────────
if not DATA_PATH.exists():
    DATA_PATH.mkdir()
    print(f"Created {DATA_PATH}/ — place your HR policy PDFs here, then re-run.")
    raise SystemExit(0)

pdfs = list(DATA_PATH.glob("*.pdf"))
if not pdfs:
    print(f"No PDF files found in {DATA_PATH}/. Add policy PDFs and re-run.")
    raise SystemExit(0)

print(f"Found {len(pdfs)} PDF(s): {[p.name for p in pdfs]}")

# ── load & split ─────────────────────────────────────────────────
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

docs = []
for pdf in pdfs:
    loader = PyPDFLoader(str(pdf))
    pages = loader.load()

    for p in pages:
        p.metadata["source"] = pdf.name

    docs.extend(pages)
    print(f"  {pdf.name}: {len(pages)} pages")

print(f"\nTotal pages loaded: {len(docs)}")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP
)

chunks = splitter.split_documents(docs)
print(f"Created {len(chunks)} chunks")

# ── Gemini Embeddings ────────────────────────────────────────────
from langchain_google_genai import GoogleGenerativeAIEmbeddings

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    # Force the output to match your 768-dimension index
    output_dimensionality=768 
)

# ── Pinecone Setup ───────────────────────────────────────────────
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

index_name = "hr-policy-index"

# Create index if not exists
if index_name not in [i["name"] for i in pc.list_indexes()]:
    pc.create_index(
        name=index_name,
        dimension=768,  # Gemini embedding size
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",
            region=os.getenv("PINECONE_ENV")
        )
    )

index = pc.Index(index_name)

# ── Store embeddings ─────────────────────────────────────────────
print("Embedding & uploading to Pinecone...")

vectorstore = PineconeVectorStore.from_documents(
    documents=chunks,
    embedding=embeddings,
    index_name=index_name
)

print(f"\n✅ Data uploaded to Pinecone index: {index_name}")