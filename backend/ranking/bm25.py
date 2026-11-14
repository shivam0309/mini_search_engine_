"""BM25 relevance: how well a page's words match the query.

For each query term t found on a page:
    idf(t)   = ln(1 + (N - df + 0.5) / (df + 0.5))
    score   += idf(t) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / avg_length))
N = pages in the index, df = pages containing t, tf = times t appears on the page.
Rare words count for more (idf), repeats add less and less (k1), and long
pages don't win just by being long (b).
"""

import math

from app.config import BM25_B, BM25_K1


def idf(total_pages: int, doc_freq: int) -> float:
    return math.log(1 + (total_pages - doc_freq + 0.5) / (doc_freq + 0.5))


def term_score(tf: int, idf_value: float, length: int, avg_length: float, k1: float = BM25_K1, b: float = BM25_B) -> float:
    norm = 1 - b + b * (length / avg_length if avg_length else 1)
    return idf_value * tf * (k1 + 1) / (tf + k1 * norm)


def bm25_scores(postings: dict, total_pages: int, avg_length: float) -> dict[int, float]:
    """Add up BM25 for every page that contains at least one query term.

    postings = {stem: {"doc_freq": int, "pages": {page_id: {"tf": int, "length": int}}}}
    Returns {page_id: score}.
    """
    scores: dict[int, float] = {}
    for entry in postings.values():
        weight = idf(total_pages, entry["doc_freq"])
        for page_id, hit in entry["pages"].items():
            scores[page_id] = scores.get(page_id, 0.0) + term_score(hit["tf"], weight, hit["length"], avg_length)
    return scores
