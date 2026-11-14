"""PageRank: how important a page is, judged by the links pointing to it.

A page scores high when many pages link to it, and higher still when
those pages are themselves well linked. Worked out once after each crawl.
"""

import time

import networkx as nx

from app.config import PAGERANK_DAMPING
from app.db import Database
from indexer.indexer import record_step


def build_graph(db: Database) -> nx.DiGraph:
    """Pages are nodes; a link from one stored page to another is an edge."""
    graph = nx.DiGraph()
    graph.add_nodes_from(row["id"] for row in db.all("SELECT id FROM pages"))
    edges = db.all("SELECT l.from_page, p.id AS to_page FROM links l JOIN pages p ON p.url = l.to_url")
    graph.add_edges_from((e["from_page"], e["to_page"]) for e in edges if e["from_page"] != e["to_page"])
    return graph


def compute_pagerank(db: Database, damping: float = PAGERANK_DAMPING) -> dict:
    """Run PageRank over the link graph and save each page's score."""
    started = time.perf_counter()
    graph = build_graph(db)
    scores = nx.pagerank(graph, alpha=damping) if graph.number_of_nodes() else {}
    db.executemany("UPDATE pages SET pagerank = ? WHERE id = ?", [(score, page) for page, score in scores.items()])
    record_step(db, "PageRank", f"{graph.number_of_edges():,} links between {graph.number_of_nodes():,} pages, damping {damping}")
    db.commit()
    return {
        "pages": graph.number_of_nodes(),
        "links": graph.number_of_edges(),
        "tookMs": round((time.perf_counter() - started) * 1000),
    }
