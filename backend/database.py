from __future__ import annotations
import os
from sqlmodel import SQLModel, create_engine, Session

# Choose a writable location for the SQLite file.
#   - DATABASE_URL env var wins if set (e.g. an external Postgres on a paid host).
#   - On Vercel the filesystem is read-only EXCEPT /tmp, and Vercel sets VERCEL=1
#     automatically — so fall back to /tmp there (ephemeral: state resets across
#     cold starts, which is the documented free-tier limitation).
#   - Locally, keep the project-relative ./data/synapse.db.
if os.environ.get("DATABASE_URL"):
    DATABASE_URL = os.environ["DATABASE_URL"]
elif os.environ.get("VERCEL"):
    DATABASE_URL = "sqlite:////tmp/synapse.db"
else:
    DATABASE_URL = "sqlite:///./data/synapse.db"

# Ensure the parent directory exists for file-based SQLite. Guarded so a
# read-only filesystem (serverless) can never crash the import.
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    parent = os.path.dirname(db_path)
    if parent:
        try:
            os.makedirs(parent, exist_ok=True)
        except OSError:
            pass

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
