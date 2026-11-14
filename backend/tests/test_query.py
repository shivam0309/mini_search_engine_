from app.sample_data import load_sample
from query.query_processor import clean_query, closest_word, levenshtein, make_snippet, search


def test_clean_query_trims_and_limits_length():
    assert clean_query("  web\x00  crawler\n ") == "web crawler"
    assert len(clean_query("a" * 500)) == 200


def test_levenshtein_and_closest_word():
    assert levenshtein("crawlr", "crawler") == 1
    vocab = {"c": [("crawler", 5), ("cherry", 1)], "p": [("pages", 2), ("paper", 7)]}
    assert closest_word("crawlr", vocab) == "crawler"
    assert closest_word("papes", vocab) == "paper"   # both 1 edit away: the more common word wins
    assert closest_word("zzzz", vocab) is None


def test_snippet_marks_query_words():
    parts = make_snippet("Intro text. A crawler follows links to new pages. The end.", {"crawler", "link"})
    marked = [p["text"] for p in parts if p["hit"]]
    assert marked == ["crawler", "links"]
    assert "".join(p["text"] for p in parts).startswith("… A crawler")


def test_search_on_sample_pages(db):
    load_sample(db)
    result = search(db, "web crawler")
    assert result["results"][0]["title"] == "Web crawler"
    assert result["total"] > 10 and result["pages"] == 2
    first = result["results"][0]
    assert set(first["scores"]) == {"bm25", "relevance", "authority", "final"}
    assert first["scores"]["relevance"] == 1.0
    assert first["matched"] == ["web", "crawler"]


def test_paging(db):
    load_sample(db)
    page2 = search(db, "web crawler", page=2)
    assert page2["page"] == 2 and page2["results"][0]["position"] == 11
    assert search(db, "web crawler", page=99)["page"] == 2


def test_phrase_search_needs_words_side_by_side(db):
    load_sample(db)
    loose = search(db, "inverted index")["total"]
    exact = search(db, '"inverted index"')
    assert 0 < exact["total"] < loose
    assert exact["phrases"] == ["inverted index"]


def test_did_you_mean_and_auto_correct(db):
    load_sample(db)
    assert search(db, "pagerank algoritm")["suggestion"] == "pagerank algorithm"
    fixed = search(db, "crawlr")
    assert fixed["correctedFrom"] == "crawlr" and fixed["query"] == "crawler" and fixed["total"] > 0


def test_only_common_words_finds_nothing(db):
    load_sample(db)
    result = search(db, "the of and")
    assert result["total"] == 0 and all(t["stop"] for t in result["terms"])
