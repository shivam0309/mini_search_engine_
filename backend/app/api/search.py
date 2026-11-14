"""Visitor endpoints used by the search page (M6)."""

from fastapi import APIRouter, Depends, Query

from app.config import SEARCH_RATE_LIMIT
from app.db import Database, now
from app.deps import RateLimiter, get_db
from query import query_processor

router = APIRouter(tags=["search"])
search_limit = RateLimiter(SEARCH_RATE_LIMIT, "Too many searches from this address. Wait a minute and try again.")


@router.get("/search", dependencies=[Depends(search_limit)])
def search(
    q: str = Query(..., min_length=1, max_length=200),
    page: int = Query(1, ge=1, le=1000),
    db: Database = Depends(get_db),
):
    """One page of ranked results (10 per page)."""
    result = query_processor.search(db, q, page)
    db.execute(
        "INSERT INTO query_log (query, results, took_ms, searched_at) VALUES (?, ?, ?, ?)",
        (result["query"], result["total"], result["tookMs"], now()),
    )
    return result


@router.get("/stats")
def stats(db: Database = Depends(get_db)):
    """How many pages and sites are searchable, for the home page."""
    return {
        "pages": db.value("SELECT COUNT(*) FROM pages WHERE length > 0") or 0,
        "sites": db.value("SELECT COUNT(DISTINCT host) FROM pages WHERE length > 0") or 0,
    }
