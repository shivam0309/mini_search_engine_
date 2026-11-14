import time

from crawler.crawler import Crawler, is_crawlable, normalize_url, start_queue
from crawler.runner import CrawlRunner
from tests.conftest import TEST_URL

FAST = {"maxPages": 100, "maxDepth": 3, "delaySeconds": 0.05, "obeyRobots": True, "userAgent": "TestBot/1.0"}


def seed(db, url):
    db.execute("INSERT INTO seeds (url, added_at) VALUES (?, 'now')", (url,))
    start_queue(db)


def outcomes(db):
    return {r["url"]: r["outcome"] for r in db.all("SELECT url, outcome FROM crawl_log")}


def test_normalize_url():
    assert normalize_url("/a/../b#frag", "HTTPS://Example.ORG:443/x/") == "https://example.org/b"
    assert normalize_url("mailto:me@example.org") is None
    assert normalize_url("http://a.org//x//y?q=1") == "http://a.org/x/y?q=1"
    assert not is_crawlable("https://a.org/report.PDF")
    assert not is_crawlable("https://en.wikipedia.org/wiki/Talk:Web_crawler")
    assert is_crawlable("https://en.wikipedia.org/wiki/Web_crawler")


def test_crawl_follows_rules(db, site):
    seed(db, site.url + "/")
    result = Crawler(db, FAST).run()
    stored = {r["url"].removeprefix(site.url) for r in db.all("SELECT url FROM pages")}
    log = {url.removeprefix(site.url): outcome for url, outcome in outcomes(db).items()}

    assert stored == {"/", "/a", "/b", "/c", "/d"}               # /e is 4 links deep
    assert log["/private/secret"] == "Blocked by robots.txt"
    assert "/private/secret" not in site.paths()                 # never even requested
    assert log["/missing"] == "Not found"
    assert log["/dup"] == "Already seen"                         # same text as /a
    assert log["/old"] == "Redirected" and site.paths().count("/b") == 1
    assert "/report.pdf" not in site.paths() and "/Talk:Home" not in site.paths()
    assert site.paths().count("/a") == 1                         # /a#top is the same page
    assert result["crawled"] == 5


def test_one_request_at_a_time_per_site(db, site):
    seed(db, site.url + "/")
    Crawler(db, {**FAST, "delaySeconds": 0.2}).run()
    times = [t for _, t in site.requests]
    gaps = [b - a for a, b in zip(times, times[1:])]
    assert min(gaps) >= 0.19


def test_page_limit(db, site):
    seed(db, site.url + "/")
    Crawler(db, {**FAST, "maxPages": 2}).run()
    assert db.value("SELECT COUNT(*) FROM pages") == 2


def test_crawl_resumes_where_it_stopped(db, site):
    seed(db, site.url + "/")
    visits = {"n": 0}

    def stop_after_three():
        visits["n"] += 1
        return visits["n"] > 6

    Crawler(db, FAST, should_stop=stop_after_three).run()
    first = db.value("SELECT COUNT(*) FROM pages")
    assert 0 < first < 5
    Crawler(db, FAST).run()                                      # a new crawler, as after a restart
    assert db.value("SELECT COUNT(*) FROM pages") == 5
    fetched = [p for p in site.paths() if p != "/robots.txt"]
    assert len(fetched) == len(set(fetched))                     # no page fetched twice


def test_runner_crawls_in_background_then_builds_the_index(db, site):
    db.execute("INSERT INTO seeds (url, added_at) VALUES (?, 'now')", (site.url + "/",))
    for key, value in FAST.items():
        db.set_setting(key, value)
    db.commit()
    runner = CrawlRunner(TEST_URL)
    runner.start()
    deadline = time.time() + 20
    while runner.busy() and time.time() < deadline:
        time.sleep(0.1)
    status = runner.status(db)
    assert status["state"] == "idle" and status["crawled"] == 5 and not status["resumable"]
    assert db.value("SELECT COUNT(*) FROM terms") > 0
    assert db.value("SELECT MAX(pagerank) FROM pages") > 0
    assert {r["step"] for r in db.all("SELECT step FROM pipeline_runs")} == {"Crawl", "Parse", "Index", "PageRank"}
