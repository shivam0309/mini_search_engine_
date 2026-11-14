"""Loads the 41 sample pages (the same ones the front-end shows in sample
mode), so the search engine can be tried without crawling the web."""

import hashlib
import json

from app.config import BACKEND_DIR
from app.db import Database, now
from crawler.crawler import normalize_url, site_of
from indexer.indexer import rebuild_index, record_step
from ranking.pagerank import compute_pagerank

DATA_DIR = BACKEND_DIR / "data"
TABLES = ["postings", "terms", "words", "links", "pages", "crawl_queue", "crawl_log", "pipeline_runs", "seeds", "query_log"]


def load_sample(db: Database) -> int:
    """Replace everything in the database with the sample pages, then build the index."""
    pages = json.loads((DATA_DIR / "sample_pages.json").read_text(encoding="utf-8"))
    seeds = json.loads((DATA_DIR / "sample_seeds.json").read_text(encoding="utf-8"))
    for table in TABLES:
        db.execute(f"DELETE FROM {table}")

    for url in seeds:
        db.execute("INSERT INTO seeds (url, added_at) VALUES (?, ?)", (normalize_url(url), now()))
    for page in pages:
        url = normalize_url(page["url"])
        page_id = db.value(
            "INSERT INTO pages (url, host, title, body, content_hash, crawled_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (url, site_of(url), page["title"], page["text"], hashlib.sha1(page["text"].encode()).hexdigest(), now()),
        )
        db.executemany(
            "INSERT INTO links (from_page, to_url) VALUES (?, ?)", [(page_id, normalize_url(link)) for link in page["links"]]
        )
        db.execute(
            "INSERT INTO crawl_log (url, status_code, outcome, logged_at) VALUES (?, 200, 'Indexed', ?)", (url, now())
        )
    record_step(db, "Crawl", f"{len(pages)} sample pages loaded")
    db.set_setting("crawl_run", {"state": "finished", "startedAt": now(), "finishedAt": now()})
    db.commit()
    rebuild_index(db)
    compute_pagerank(db)
    return len(pages)


def load_sample_if_empty(db: Database) -> int:
    """Load the sample pages only when there are no pages and no seed URLs yet,
    so a new deployment has something to search. Returns how many were loaded."""
    if db.value("SELECT COUNT(*) FROM pages") or db.value("SELECT COUNT(*) FROM seeds"):
        return 0
    return load_sample(db)
