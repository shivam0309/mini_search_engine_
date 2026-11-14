-- Mini Search Engine database schema.
--
-- Works on SQLite (the default) and PostgreSQL. backend/app/db.py runs this
-- file on start-up and replaces ID_PRIMARY_KEY with the right auto-increment
-- type for each database. Timestamps are stored as ISO 8601 text.

-- Where the crawler starts.
CREATE TABLE IF NOT EXISTS seeds (
    id          ID_PRIMARY_KEY,
    url         TEXT NOT NULL UNIQUE,
    added_at    TEXT NOT NULL
);

-- URLs waiting to be fetched. Keeping the queue in the database lets a
-- crawl resume after a crash (non-functional requirement: reliability).
CREATE TABLE IF NOT EXISTS crawl_queue (
    id          ID_PRIMARY_KEY,
    url         TEXT NOT NULL UNIQUE,
    depth       INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'queued'   -- queued | done | skipped
);

-- Every page that was fetched and parsed.
CREATE TABLE IF NOT EXISTS pages (
    id           ID_PRIMARY_KEY,
    url          TEXT NOT NULL UNIQUE,
    host         TEXT NOT NULL,
    title        TEXT NOT NULL DEFAULT '',
    body         TEXT NOT NULL DEFAULT '',        -- visible text after removing HTML
    content_hash TEXT,                            -- spots the same page at two URLs
    length       INTEGER NOT NULL DEFAULT 0,      -- indexed words, used by BM25
    pagerank     DOUBLE PRECISION NOT NULL DEFAULT 0,
    crawled_at   TEXT
);

-- The hyperlink graph used by PageRank. to_url may point to a page that
-- was never crawled; only links between stored pages count.
CREATE TABLE IF NOT EXISTS links (
    from_page   INTEGER NOT NULL,
    to_url      TEXT NOT NULL,
    PRIMARY KEY (from_page, to_url)
);

-- Inverted index: one row per stemmed term ...
CREATE TABLE IF NOT EXISTS terms (
    id          ID_PRIMARY_KEY,
    term        TEXT NOT NULL UNIQUE,
    doc_freq    INTEGER NOT NULL              -- number of pages containing the term
);

-- ... and one posting per (term, page) pair.
CREATE TABLE IF NOT EXISTS postings (
    term_id     INTEGER NOT NULL,
    page_id     INTEGER NOT NULL,
    term_freq   INTEGER NOT NULL,
    positions   TEXT NOT NULL,                -- word positions, for phrase search
    PRIMARY KEY (term_id, page_id)
);

-- Words as they appear on pages (not stemmed), for "did you mean".
CREATE TABLE IF NOT EXISTS words (
    word        TEXT PRIMARY KEY,
    doc_freq    INTEGER NOT NULL
);

-- What the crawler did, shown on the admin dashboard.
CREATE TABLE IF NOT EXISTS crawl_log (
    id          ID_PRIMARY_KEY,
    url         TEXT NOT NULL,
    status_code INTEGER,
    outcome     TEXT NOT NULL,
    logged_at   TEXT NOT NULL
);

-- When each step of the index build last finished.
CREATE TABLE IF NOT EXISTS pipeline_runs (
    step        TEXT PRIMARY KEY,             -- Crawl | Parse | Index | PageRank
    detail      TEXT NOT NULL,
    finished_at TEXT NOT NULL
);

-- Search speed, for the "Average query time" figure.
CREATE TABLE IF NOT EXISTS query_log (
    id          ID_PRIMARY_KEY,
    query       TEXT NOT NULL,
    results     INTEGER NOT NULL,
    took_ms     DOUBLE PRECISION NOT NULL,
    searched_at TEXT NOT NULL
);

-- Crawl limits set from the admin dashboard, plus the crawler's own state.
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);

-- Signed-in admins.
CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_postings_page ON postings (page_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON crawl_queue (status, depth, id);
CREATE INDEX IF NOT EXISTS idx_pages_host ON pages (host);
