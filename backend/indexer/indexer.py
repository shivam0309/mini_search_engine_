"""M3 Indexer: maps every stemmed word to the pages it appears on.

The inverted index is two tables:
  terms    - one row per stem, with how many pages contain it (doc_freq)
  postings - one row per (stem, page) with how often it appears and where
It also fills `words`, the unstemmed vocabulary used for "did you mean".
"""

import time
from collections import Counter, defaultdict

from app.config import MAX_INDEXED_WORDS, MAX_POSITIONS
from app.db import Database, now
from text_processing.processor import STOPWORDS, stem, tokenize

BATCH = 20_000


def record_step(db: Database, step: str, detail: str) -> None:
    """Remember when a pipeline step last finished (shown on the dashboard)."""
    db.execute(
        "INSERT INTO pipeline_runs (step, detail, finished_at) VALUES (?, ?, ?) "
        "ON CONFLICT (step) DO UPDATE SET detail = excluded.detail, finished_at = excluded.finished_at",
        (step, detail, now()),
    )


def analyse(title: str, body: str) -> tuple[dict[str, list[int]], set[str], int]:
    """Split a page into stems with their word positions.

    Returns (positions by stem, plain words seen, number of indexed words).
    Positions count every word, stop words included, so phrase search can
    check that words stand next to each other.
    """
    positions: dict[str, list[int]] = defaultdict(list)
    words: set[str] = set()
    length = 0
    for pos, word in enumerate(tokenize(f"{title} {body}")[:MAX_INDEXED_WORDS]):
        if word in STOPWORDS:
            continue
        length += 1
        positions[stem(word)].append(pos)
        if len(word) >= 3 and word.isalpha():
            words.add(word)
    return positions, words, length


def rebuild_index(db: Database) -> dict:
    """Clear the index and build it again from every stored page."""
    started = time.perf_counter()
    db.execute("DELETE FROM postings")
    db.execute("DELETE FROM terms")
    db.execute("DELETE FROM words")

    term_ids: dict[str, int] = {}
    doc_freq: Counter = Counter()
    word_freq: Counter = Counter()
    lengths: list[tuple[int, int]] = []
    batch: list[tuple] = []
    total_postings = 0
    pages = db.all("SELECT id, title, body FROM pages ORDER BY id")

    for page in pages:
        positions, words, length = analyse(page["title"], page["body"])
        lengths.append((length, page["id"]))
        word_freq.update(words)
        for term, places in positions.items():
            term_id = term_ids.setdefault(term, len(term_ids) + 1)
            doc_freq[term] += 1
            batch.append((term_id, page["id"], len(places), ",".join(map(str, places[:MAX_POSITIONS]))))
        if len(batch) >= BATCH:
            total_postings += len(batch)
            db.executemany("INSERT INTO postings (term_id, page_id, term_freq, positions) VALUES (?, ?, ?, ?)", batch)
            batch.clear()
    total_postings += len(batch)
    db.executemany("INSERT INTO postings (term_id, page_id, term_freq, positions) VALUES (?, ?, ?, ?)", batch)

    db.executemany(
        "INSERT INTO terms (id, term, doc_freq) VALUES (?, ?, ?)",
        [(term_id, term, doc_freq[term]) for term, term_id in term_ids.items()],
    )
    db.executemany("INSERT INTO words (word, doc_freq) VALUES (?, ?)", list(word_freq.items()))
    db.executemany("UPDATE pages SET length = ? WHERE id = ?", lengths)

    indexed_words = sum(length for length, _ in lengths)
    record_step(db, "Parse", f"{len(pages):,} pages cleaned, tokenized and stemmed ({indexed_words:,} words)")
    record_step(db, "Index", f"{len(term_ids):,} terms and {total_postings:,} postings")
    db.set_setting("index_version", (db.get_setting("index_version", 0) or 0) + 1)
    db.commit()
    return {
        "pages": len(pages),
        "terms": len(term_ids),
        "postings": total_postings,
        "tookMs": round((time.perf_counter() - started) * 1000),
    }


def index_stats(db: Database) -> dict:
    """Sizes shown on the admin overview."""
    pages = db.value("SELECT COUNT(*) FROM pages") or 0
    avg_length = db.value("SELECT AVG(length) FROM pages WHERE length > 0") or 0
    return {
        "pages": pages,
        "terms": db.value("SELECT COUNT(*) FROM terms") or 0,
        "postings": db.value("SELECT COUNT(*) FROM postings") or 0,
        "links": db.value("SELECT COUNT(*) FROM links l JOIN pages p ON p.url = l.to_url") or 0,
        "avgPageLength": round(float(avg_length)),
    }
