import pytest

from ranking.blend import blend
from ranking.bm25 import bm25_scores, idf, term_score
from ranking.pagerank import compute_pagerank
from tests.conftest import add_page


def test_rare_words_weigh_more():
    assert idf(1000, 5) > idf(1000, 500)


def test_repeats_add_less_and_less():
    score = [term_score(tf, 1.0, 100, 100) for tf in range(11)]
    assert score[2] - score[1] > score[10] - score[9] > 0


def test_page_with_query_word_beats_page_without():
    postings = {"crawl": {"doc_freq": 1, "pages": {1: {"tf": 2, "length": 50}}}}
    scores = bm25_scores(postings, total_pages=10, avg_length=50)
    assert scores[1] > 0 and 2 not in scores


def test_blend_uses_seventy_thirty_weights():
    ranked = blend({1: 4.0, 2: 2.0}, {1: 0.1, 2: 0.4}, max_pagerank=0.4)
    top = {r["page_id"]: r for r in ranked}
    assert top[1]["final"] == pytest.approx(0.7 * 1.0 + 0.3 * 0.25)
    assert top[2]["final"] == pytest.approx(0.7 * 0.5 + 0.3 * 1.0)
    assert [r["page_id"] for r in ranked] == [1, 2]


def test_pagerank_sums_to_one_and_rewards_incoming_links(db):
    hub = add_page(db, "https://x.org/hub", "Hub", "hub")
    others = [add_page(db, f"https://x.org/p{i}", "P", "p", links=["https://x.org/hub"]) for i in range(3)]
    compute_pagerank(db)
    scores = {r["id"]: r["pagerank"] for r in db.all("SELECT id, pagerank FROM pages")}
    assert sum(scores.values()) == pytest.approx(1.0)
    assert all(scores[hub] > scores[o] for o in others)
