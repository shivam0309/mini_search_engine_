"""Settings shared by the API and the pipeline.

Everything can be changed with an environment variable, so nothing secret
has to be written into the code.
"""

import os
import re
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent


def clean_database_url(value: str) -> str:
    """Tidy a pasted connection string: spaces, quotes, or Neon's whole `psql '...'` command."""
    value = value.strip().strip("'\"")
    if value.startswith("psql "):
        value = value[5:].strip().strip("'\"")
    return value


def clean_origin(value: str) -> str:
    """A website address as browsers send it: https://name.vercel.app with no slash at the end."""
    value = value.strip().rstrip("/")
    return value if value.startswith(("http://", "https://")) else f"https://{value}"


# SQLite file by default. For PostgreSQL use for example
# DATABASE_URL=postgresql://postgres:password@localhost:5432/minisearch
DATABASE_URL = clean_database_url(os.environ.get("DATABASE_URL", "")) or f"sqlite:///{BACKEND_DIR / 'search.db'}"

# Front-end addresses allowed to call the API from the browser (comma-separated).
FRONTEND_ORIGINS = [
    clean_origin(o) for o in os.environ.get("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]



def vercel_preview_pattern(origins: list[str]) -> str | None:
    """Vercel also serves each project at preview addresses such as
    https://name-abc123-team.vercel.app. Allow those for every name.vercel.app listed."""
    names = [
        re.escape(o[len("https://"):-len(".vercel.app")])
        for o in origins
        if o.startswith("https://") and o.endswith(".vercel.app")
    ]
    return rf"https://({'|'.join(names)})(-[a-z0-9-]+)?\.vercel\.app" if names else None


FRONTEND_PREVIEWS = vercel_preview_pattern(FRONTEND_ORIGINS)

# On a new server, load the 41 sample pages the first time it starts with an empty database.
LOAD_SAMPLE_IF_EMPTY = os.environ.get("LOAD_SAMPLE_IF_EMPTY", "").strip().lower() in ("1", "true", "yes")

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
SESSION_HOURS = 12

RESULTS_PER_PAGE = 10
BM25_WEIGHT = 0.7          # final score = 0.7 x relevance + 0.3 x authority
BM25_K1 = 1.5              # how quickly repeated words stop adding score
BM25_B = 0.75              # how much long pages are penalised
PAGERANK_DAMPING = 0.85    # chance the "random surfer" follows a link

MAX_INDEXED_WORDS = 5000   # only the first 5,000 words of a page are indexed
MAX_POSITIONS = 32         # positions kept per word per page, for phrase search

SEARCH_RATE_LIMIT = 60     # searches per minute from one address
LOGIN_RATE_LIMIT = 10      # sign-in attempts per minute from one address

def default_user_agent(origins: list[str]) -> str:
    """Name the crawler and give sites a way to find out who runs it. Some sites, such as
    Wikipedia, turn away crawlers whose user agent has no website or email address."""
    site = next((o for o in origins if o.startswith("https://")), None)
    return f"MiniSearchBot/0.1 (+{site}; MCA-I college project)" if site else "MiniSearchBot/0.1 (MCA-I college project)"


DEFAULT_SETTINGS = {
    "maxPages": 10_000,
    "maxDepth": 3,
    "delaySeconds": 1.0,
    "obeyRobots": True,
    "userAgent": default_user_agent(FRONTEND_ORIGINS),
}
