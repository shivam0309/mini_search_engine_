from text_processing.processor import extract, process, remove_stopwords, stem, tokenize


def test_tokenize_lowercases_and_splits_on_punctuation():
    assert tokenize("Web-Crawlers, robots.txt & BM25!") == ["web", "crawlers", "robots", "txt", "bm25"]


def test_stop_words_are_removed():
    assert remove_stopwords(["how", "does", "the", "crawler", "work"]) == ["crawler", "work"]


def test_porter_stemming_joins_word_forms():
    assert stem("crawling") == stem("crawled") == stem("crawls") == "crawl"
    assert stem("ranking") == "rank"


def test_process_runs_all_three_steps():
    assert process("The crawlers are crawling") == ["crawler", "crawl"]


def test_extract_reads_title_text_and_links_but_not_menus():
    page = extract(
        "<html><head><title>T - Site</title><script>var x</script></head><body>"
        "<nav>Home Menu</nav><main><h1>Web crawler</h1><p>Visits pages.</p>"
        '<a href="/next">next</a><a href="#top">top</a><a href="mailto:a@b.c">mail</a></main></body></html>',
        "https://example.org/start",
    )
    assert page["title"] == "Web crawler"
    assert "Visits pages." in page["text"]
    assert "Menu" not in page["text"] and "var x" not in page["text"]
    assert page["links"] == ["https://example.org/next"]
