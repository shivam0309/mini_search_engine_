"""M5 Query Processor: reads a query, ranks pages and builds the results page.

Steps for one search:
1. Read the query the same way pages were read (tokenize, stop words, stem).
2. Look up each stem in the inverted index and score pages with BM25.
3. Keep only pages containing any "quoted phrase" word for word.
4. Blend BM25 with PageRank, sort, and cut out the requested page of 10.
5. If nothing matched and a word looks misspelled, search the corrected query.
"""

import re
import time

from app.config import BM25_WEIGHT, RESULTS_PER_PAGE
from app.db import Database
from ranking.blend import blend
from ranking.bm25 import bm25_scores
from text_processing.processor import is_stopword, stem, tokenize

MAX_QUERY_LENGTH = 200
SNIPPET_SOURCE_CHARS = 20_000  # look for the snippet in the first part of the page


# ---------------------------------------------------------------- reading the query

def clean_query(raw: str) -> str:
    """Trim, drop control characters and collapse spaces."""
    text = re.sub(r"[\x00-\x1f\x7f]", " ", raw or "")
    return re.sub(r"\s+", " ", text).strip()[:MAX_QUERY_LENGTH]


def parse(raw: str) -> dict:
    """Split a query into terms and "quoted phrases"."""
    phrases = [p.strip().lower() for p in re.findall(r'"([^"]+)"', raw) if p.strip()]
    terms = [{"word": w, "stem": stem(w), "stop": is_stopword(w)} for w in tokenize(raw)]
    return {"raw": raw, "phrases": phrases, "terms": terms}


def search_stems(query: dict) -> list[str]:
    return list(dict.fromkeys(t["stem"] for t in query["terms"] if not t["stop"]))


# ---------------------------------------------------------------- index lookups

def load_postings(db: Database, stems: list[str], with_positions: bool = False) -> dict:
    """Fetch the postings of every query stem, with each page's length and PageRank.
    Word positions are only read when the query has a phrase."""
    postings = {}
    positions_column = "po.positions" if with_positions else "'' AS positions"
    for s in stems:
        term = db.one("SELECT id, doc_freq FROM terms WHERE term = ?", (s,))
        if not term:
            continue
        rows = db.all(
            f"SELECT po.page_id, po.term_freq, {positions_column}, p.length, p.pagerank "
            "FROM postings po JOIN pages p ON p.id = po.page_id WHERE po.term_id = ?",
            (term["id"],),
        )
        postings[s] = {
            "doc_freq": term["doc_freq"],
            "pages": {
                r["page_id"]: {
                    "tf": r["term_freq"],
                    "length": r["length"],
                    "pagerank": r["pagerank"],
                    "positions": r["positions"],
                }
                for r in rows
            },
        }
    return postings


def index_totals(db: Database) -> tuple[int, float, float]:
    row = db.one("SELECT COUNT(*) AS n, AVG(length) AS avg_length, MAX(pagerank) AS max_pr FROM pages WHERE length > 0")
    return int(row["n"] or 0), float(row["avg_length"] or 0), float(row["max_pr"] or 0)


def has_phrase(page_id: int, phrase: str, postings: dict) -> bool:
    """True when the phrase's words appear next to each other on the page."""
    words = [(offset, stem(w)) for offset, w in enumerate(tokenize(phrase)) if not is_stopword(w)]
    if not words:
        return True
    places = []
    for offset, s in words:
        hit = postings.get(s, {}).get("pages", {}).get(page_id)
        if not hit:
            return False
        places.append((offset, {int(p) for p in hit["positions"].split(",") if p}))
    first_offset, first_positions = places[0]
    for p in first_positions:
        start = p - first_offset
        if all(start + offset in positions for offset, positions in places[1:]):
            return True
    return False


def rank_query(db: Database, query: dict, weight: float = BM25_WEIGHT) -> tuple[list[dict], dict]:
    """Every matching page, best first, plus the postings used."""
    postings = load_postings(db, search_stems(query), with_positions=bool(query["phrases"]))
    if not postings:
        return [], postings
    total, avg_length, max_pr = index_totals(db)
    scores = bm25_scores(postings, total, avg_length)
    for phrase in query["phrases"]:
        scores = {pid: s for pid, s in scores.items() if has_phrase(pid, phrase, postings)}
    pagerank = {pid: hit["pagerank"] for entry in postings.values() for pid, hit in entry["pages"].items()}
    return blend(scores, pagerank, max_pr, weight), postings


def ranked_urls(db: Database, raw: str, weight: float = BM25_WEIGHT) -> list[str]:
    """All result URLs for a query, best first (used by the evaluation)."""
    ranked, _ = rank_query(db, parse(clean_query(raw)), weight)
    if not ranked:
        return []
    ids = [r["page_id"] for r in ranked]
    urls = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i : i + 500]
        marks = ",".join("?" * len(chunk))
        urls.update({r["id"]: r["url"] for r in db.all(f"SELECT id, url FROM pages WHERE id IN ({marks})", chunk)})
    return [urls[i] for i in ids]


# ---------------------------------------------------------------- "did you mean"

_vocabulary = {"key": None, "by_letter": {}}


def vocabulary(db: Database) -> dict[str, list[tuple[str, int]]]:
    """Indexed words grouped by first letter, cached until the index is rebuilt."""
    key = (db.url, db.get_setting("index_version", 0))
    if _vocabulary["key"] != key:
        by_letter: dict[str, list[tuple[str, int]]] = {}
        for row in db.all("SELECT word, doc_freq FROM words"):
            by_letter.setdefault(row["word"][0], []).append((row["word"], row["doc_freq"]))
        _vocabulary.update(key=key, by_letter=by_letter)
    return _vocabulary["by_letter"]


def levenshtein(a: str, b: str) -> int:
    """Fewest single-letter edits that turn a into b."""
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        previous, row[0] = row[0], i
        for j, cb in enumerate(b, 1):
            previous, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, previous + (ca != cb))
    return row[-1]


def closest_word(word: str, vocab: dict) -> str | None:
    """Nearest indexed word starting with the same letter (1 edit for short words, 2 otherwise)."""
    limit = 1 if len(word) <= 4 else 2
    best, best_distance, best_freq = None, limit + 1, 0
    for candidate, freq in vocab.get(word[0], []):
        if abs(len(candidate) - len(word)) > limit:
            continue
        d = levenshtein(word, candidate)
        if d < best_distance or (d == best_distance and freq > best_freq):
            best, best_distance, best_freq = candidate, d, freq
    return best if best_distance <= limit else None


def suggest_spelling(db: Database, query: dict, known: set[str]) -> str | None:
    """A corrected query when some words are not in the index, otherwise None."""
    vocab = None
    changed = False
    words = []
    for t in query["terms"]:
        word = t["word"]
        if not t["stop"] and t["stem"] not in known and not word.isdigit() and len(word) >= 3:
            vocab = vocab if vocab is not None else vocabulary(db)
            fix = closest_word(word, vocab)
            if fix and fix != word:
                word, changed = fix, True
        words.append(word)
    return " ".join(words) if changed else None


# ---------------------------------------------------------------- snippets

def _is_hit(word: str, stems: set[str]) -> bool:
    lower = word.lower()
    return not is_stopword(lower) and stem(lower) in stems


def make_snippet(text: str, stems: set[str]) -> list[dict]:
    """The sentence with the most query words, split into marked and plain parts."""
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text[:SNIPPET_SOURCE_CHARS]) if s.strip()] or [""]
    hits = [sum(_is_hit(w, stems) for w in tokenize(s)) for s in sentences]
    best = hits.index(max(hits))
    snippet = sentences[best].strip()
    if len(snippet) < 120 and best + 1 < len(sentences):
        snippet += " " + sentences[best + 1].strip()
    if len(snippet) > 230:
        snippet = re.sub(r"\s+\S*$", "", snippet[:227]) + " …"
    if best > 0:
        snippet = "… " + snippet

    segments: list[dict] = []
    for part in re.split(r"([^\W_]+)", snippet):
        if not part:
            continue
        hit = bool(re.fullmatch(r"[^\W_]+", part)) and _is_hit(part, stems)
        if segments and segments[-1]["hit"] == hit:
            segments[-1]["text"] += part
        else:
            segments.append({"text": part, "hit": hit})
    return segments


# ---------------------------------------------------------------- the full search

def search(db: Database, raw: str, page: int = 1, weight: float = BM25_WEIGHT) -> dict:
    """Run a search and return the JSON the results page shows (docs/api-contract.md)."""
    started = time.perf_counter()
    original = clean_query(raw)
    query = parse(original)
    ranked, postings = rank_query(db, query, weight)
    suggestion = suggest_spelling(db, query, set(postings))
    corrected_from = None

    if not ranked and suggestion:
        corrected_from, query = original, parse(suggestion)
        ranked, postings = rank_query(db, query, weight)
        suggestion = None

    total = len(ranked)
    pages = max(1, -(-total // RESULTS_PER_PAGE))
    current = min(max(1, int(page or 1)), pages)
    start = (current - 1) * RESULTS_PER_PAGE
    shown = ranked[start : start + RESULTS_PER_PAGE]

    details = {}
    if shown:
        marks = ",".join("?" * len(shown))
        rows = db.all(f"SELECT id, url, title, body FROM pages WHERE id IN ({marks})", [r["page_id"] for r in shown])
        details = {r["id"]: r for r in rows}

    stems = set(postings)
    results = []
    for n, r in enumerate(shown):
        doc = details[r["page_id"]]
        found = {s for s, entry in postings.items() if r["page_id"] in entry["pages"]}
        results.append({
            "id": r["page_id"],
            "position": start + n + 1,
            "title": doc["title"] or doc["url"],
            "url": doc["url"],
            "snippet": make_snippet(doc["body"], stems),
            "matched": list(dict.fromkeys(t["word"] for t in query["terms"] if not t["stop"] and t["stem"] in found)),
            "scores": {k: round(r[k], 2) for k in ("bm25", "relevance", "authority", "final")},
        })

    return {
        "query": query["raw"],
        "correctedFrom": corrected_from,
        "suggestion": suggestion,
        "terms": [{**t, "indexed": t["stem"] in stems} for t in query["terms"]],
        "phrases": query["phrases"],
        "weight": weight,
        "total": total,
        "page": current,
        "pages": pages,
        "results": results,
        "tookMs": round((time.perf_counter() - started) * 1000, 1),
    }
