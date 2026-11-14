"""M8 Evaluation: Precision@10 and Mean Reciprocal Rank on test queries.

test_queries.json lists queries with the pages a person judged relevant.
  Precision@10    = relevant pages in the top 10 / 10
  Reciprocal rank = 1 / position of the first relevant page (0 if none)
  MRR             = average reciprocal rank over all test queries
"""

import json
from pathlib import Path

from app.config import BM25_WEIGHT
from app.db import Database
from query.query_processor import ranked_urls

TEST_QUERIES_FILE = Path(__file__).with_name("test_queries.json")


def load_test_queries() -> list[dict]:
    return json.loads(TEST_QUERIES_FILE.read_text(encoding="utf-8"))


def precision_at_k(ranked: list[str], relevant: set[str], k: int = 10) -> float:
    return sum(1 for url in ranked[:k] if url in relevant) / k


def reciprocal_rank(ranked: list[str], relevant: set[str]) -> float:
    for position, url in enumerate(ranked, 1):
        if url in relevant:
            return 1 / position
    return 0.0


def evaluate(db: Database, weight: float = BM25_WEIGHT, queries: list[dict] | None = None) -> dict:
    """Score every test query with the given BM25 weight (1.0 = BM25 only)."""
    rows = []
    for item in queries or load_test_queries():
        relevant = set(item["relevant"])
        ranked = ranked_urls(db, item["query"], weight)
        rr = reciprocal_rank(ranked, relevant)
        rows.append({
            "query": item["query"],
            "relevant": len(relevant),
            "found": sum(1 for url in ranked[:10] if url in relevant),
            "precisionAt10": precision_at_k(ranked, relevant),
            "firstRelevantRank": round(1 / rr) if rr else None,
            "reciprocalRank": rr,
        })
    count = len(rows) or 1
    return {
        "weight": weight,
        "rows": rows,
        "meanPrecisionAt10": sum(r["precisionAt10"] for r in rows) / count,
        "mrr": sum(r["reciprocalRank"] for r in rows) / count,
    }


def compare(db: Database) -> dict:
    """BM25 + PageRank against BM25 alone, as shown on the evaluation page."""
    return {"blended": evaluate(db, BM25_WEIGHT), "bm25Only": evaluate(db, 1.0)}
