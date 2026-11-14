from indexer.indexer import analyse, index_stats, rebuild_index
from tests.conftest import add_page


def test_analyse_counts_positions_including_stop_words():
    positions, words, length = analyse("Inverted index", "The index of a book")
    assert positions["index"] == [1, 3]       # "the" at 2 still counts as a position
    assert positions["invert"] == [0]
    assert length == 4                          # inverted, index, index, book
    assert "inverted" in words


def test_rebuild_index_fills_terms_and_postings(db):
    a = add_page(db, "https://x.org/a", "Apples", "Apples and more apples")
    b = add_page(db, "https://x.org/b", "Bananas", "Bananas beat apples")
    result = rebuild_index(db)
    assert result["pages"] == 2

    apple = db.one("SELECT id, doc_freq FROM terms WHERE term = 'appl'")
    assert apple["doc_freq"] == 2
    tf = {r["page_id"]: r["term_freq"] for r in db.all("SELECT page_id, term_freq FROM postings WHERE term_id = ?", (apple["id"],))}
    assert tf == {a: 3, b: 1}
    assert db.value("SELECT length FROM pages WHERE id = ?", (b,)) == 4


def test_rebuild_twice_gives_the_same_index(db):
    add_page(db, "https://x.org/a", "Apples", "Apples and pears")
    first = rebuild_index(db)
    second = rebuild_index(db)
    assert (first["terms"], first["postings"]) == (second["terms"], second["postings"])
    assert index_stats(db)["terms"] == first["terms"]
