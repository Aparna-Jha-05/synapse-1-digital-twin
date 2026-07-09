"""
Vercel Python entrypoint for the SYNAPSE-1 backend.

Vercel's Python runtime treats any ASGI `app` object exported from a file
under /api as a serverless function. All sibling modules (main.py, models.py,
etc.) live one directory up, so we add the backend root to sys.path before
importing — this keeps main.py's existing absolute imports (`from database
import ...`) working unchanged, without duplicating any application code here.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app  # noqa: E402
