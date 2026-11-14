"""Blends relevance and authority into one score between 0 and 1.

relevance = BM25 / best BM25 for this query
authority = PageRank / highest PageRank in the index
final     = weight x relevance + (1 - weight) x authority      (weight = 0.7)
"""

from app.config import BM25_WEIGHT


def blend(bm25: dict[int, float], pagerank: dict[int, float], max_pagerank: float, weight: float = BM25_WEIGHT) -> list[dict]:
    """Return pages sorted best first, each with all four scores."""
    best = max(bm25.values(), default=0.0)
    ranked = []
    for page_id, raw in bm25.items():
        relevance = raw / best if best else 0.0
        authority = pagerank.get(page_id, 0.0) / max_pagerank if max_pagerank else 0.0
        ranked.append({
            "page_id": page_id,
            "bm25": raw,
            "relevance": relevance,
            "authority": authority,
            "final": weight * relevance + (1 - weight) * authority,
        })
    ranked.sort(key=lambda r: (-r["final"], -r["relevance"], r["page_id"]))
    return ranked
