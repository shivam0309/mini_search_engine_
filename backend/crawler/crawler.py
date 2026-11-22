"""M1 Web Crawler: fetches pages and follows their links, politely.

How one crawl works
1. Start from the seed URLs. Only pages on the seed sites are followed.
2. Take the next URL from crawl_queue. The queue lives in the database,
   so a crawl that stops or crashes carries on where it left off.
3. Skip URLs that robots.txt disallows.
4. Wait until `delaySeconds` (at least 1 s) have passed since the last
   request to that site, then fetch the page with httpx.
5. Store the page's text and links, and queue its links one level deeper.
   A redirect is queued like a link, so it also waits its turn.
6. Stop at `maxPages` pages or when the queue is empty.
"""

import hashlib
import re
import time
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

from app.db import Database, now
from text_processing.processor import extract

MAX_PAGE_BYTES = 5_000_000
MAX_BODY_CHARS = 100_000
SKIP_EXTENSIONS = {
    ".7z", ".avi", ".css", ".csv", ".doc", ".docx", ".exe", ".gif", ".gz", ".ico", ".jpeg", ".jpg", ".js",
    ".json", ".mov", ".mp3", ".mp4", ".pdf", ".png", ".ppt", ".pptx", ".rar", ".svg", ".tar", ".tgz",
    ".webm", ".webp", ".woff", ".woff2", ".xls", ".xlsx", ".xml", ".zip",
}


# ---------------------------------------------------------------- URLs

def normalize_url(url: str, base: str | None = None) -> str | None:
    """Make a link absolute and tidy so the same page always has the same URL.
    Returns None for links the crawler can't fetch (mailto:, ftp:, broken)."""
    try:
        parts = urlsplit(urljoin(base, url) if base else url)
        port = parts.port
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    default_port = 80 if parts.scheme == "http" else 443
    netloc = parts.hostname.lower() + (f":{port}" if port and port != default_port else "")
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    return urlunsplit((parts.scheme, netloc, path, parts.query, ""))  # drop the #fragment


def site_of(url: str) -> str:
    return urlsplit(url).netloc


def is_crawlable(url: str) -> bool:
    """Skip files that aren't web pages, and wiki pages like Talk:, File: or Special:."""
    path = urlsplit(url).path.lower()
    last = path.rsplit("/", 1)[-1]
    if any(last.endswith(ext) for ext in SKIP_EXTENSIONS):
        return False
    return ":" not in last


# ---------------------------------------------------------------- robots.txt

class RobotsRules:
    """Downloads and remembers each site's robots.txt."""

    def __init__(self, client: httpx.Client, user_agent: str):
        self.client = client
        self.user_agent = user_agent
        self.rules: dict[str, RobotFileParser] = {}
        self.refused: dict[str, int] = {}  # site -> status code, when the site refused to send robots.txt

    def known(self, url: str) -> bool:
        return site_of(url) in self.rules

    def fetch(self, url: str) -> None:
        parts = urlsplit(url)
        parser = RobotFileParser()
        try:
            res = self.client.get(f"{parts.scheme}://{parts.netloc}/robots.txt")
            if res.status_code in (401, 403):
                parser.disallow_all = True  # the site turned the crawler away, so stay out
                self.refused[parts.netloc] = res.status_code
            elif res.status_code == 200:
                parser.parse(res.text.splitlines())
            else:
                parser.allow_all = True  # no robots.txt: everything allowed
        except httpx.HTTPError:
            parser.allow_all = True
        self.rules[parts.netloc] = parser

    def allowed(self, url: str) -> bool:
        return self.rules[site_of(url)].can_fetch(self.user_agent, url)

    def delay(self, url: str) -> float:
        value = self.rules[site_of(url)].crawl_delay(self.user_agent)
        return float(value) if value else 0.0


# ---------------------------------------------------------------- the crawler

class Crawler:
    def __init__(self, db: Database, settings: dict, client: httpx.Client | None = None,
                 should_stop=lambda: False, sleep=time.sleep):
        self.db = db
        self.max_pages = int(settings["maxPages"])
        self.max_depth = int(settings["maxDepth"])
        self.delay = float(settings["delaySeconds"])
        self.obey_robots = bool(settings["obeyRobots"])
        self.user_agent = settings["userAgent"]
        self.client = client or httpx.Client(
            headers={"User-Agent": self.user_agent}, follow_redirects=False, timeout=10.0
        )
        self.robots = RobotsRules(self.client, self.user_agent)
        self.should_stop = should_stop
        self.sleep = sleep
        self.next_request: dict[str, float] = {}  # site -> earliest time for its next request
        self.sites = {site_of(r["url"]) for r in db.all("SELECT url FROM seeds")}

    # ---- queue ----

    def enqueue(self, url: str, depth: int) -> None:
        self.db.execute(
            "INSERT INTO crawl_queue (url, depth, status) VALUES (?, ?, 'queued') ON CONFLICT (url) DO NOTHING",
            (url, depth),
        )

    def finish(self, item: dict, status: str, outcome: str, code: int | None = None) -> None:
        self.db.execute("UPDATE crawl_queue SET status = ? WHERE id = ?", (status, item["id"]))
        self.db.execute(
            "INSERT INTO crawl_log (url, status_code, outcome, logged_at) VALUES (?, ?, ?, ?)",
            (item["url"], code, outcome, now()),
        )
        self.db.commit()

    def crawled_count(self) -> int:
        return self.db.value("SELECT COUNT(*) FROM crawl_queue WHERE status = 'done'") or 0

    # ---- politeness ----

    def wait_time(self, url: str) -> float:
        return max(0.0, self.next_request.get(site_of(url), 0.0) - time.monotonic())

    def mark_request(self, url: str) -> None:
        gap = max(self.delay, self.robots.delay(url) if self.robots.known(url) else 0.0)
        self.next_request[site_of(url)] = time.monotonic() + gap

    def next_item(self) -> dict | None:
        """The first queued URL whose site may be contacted now, waiting if every site is busy."""
        while not self.should_stop():
            batch = self.db.all(
                "SELECT id, url, depth FROM crawl_queue WHERE status = 'queued' ORDER BY depth, id LIMIT 200"
            )
            if not batch:
                return None
            ready = [item for item in batch if self.wait_time(item["url"]) == 0]
            if ready:
                return ready[0]
            self.sleep(min(0.25, min(self.wait_time(item["url"]) for item in batch)))
        return None

    # ---- one page ----

    def visit(self, item: dict) -> bool:
        """Fetch one queued URL. Returns True when a page was stored."""
        url = item["url"]
        if self.obey_robots:
            if not self.robots.known(url):
                self.robots.fetch(url)  # counts as a request to that site
                self.mark_request(url)
                return False             # the page itself is fetched once the site is free again
            if site_of(url) in self.robots.refused:   # e.g. 403: the site blocks this crawler
                self.finish(item, "skipped", "Site refused the crawler", self.robots.refused[site_of(url)])
                return False
            if not self.robots.allowed(url):
                self.finish(item, "skipped", "Blocked by robots.txt")
                return False

        self.mark_request(url)
        try:
            res = self.client.get(url)
        except httpx.HTTPError as error:
            self.finish(item, "skipped", f"Failed: {type(error).__name__}")
            return False

        if res.is_redirect:
            target = normalize_url(res.headers.get("location", ""), url)
            if target and site_of(target) in self.sites and is_crawlable(target):
                self.enqueue(target, item["depth"])
            self.finish(item, "skipped", "Redirected", res.status_code)
            return False
        if res.status_code in (404, 410):
            self.finish(item, "skipped", "Not found", res.status_code)
            return False
        if res.status_code >= 400:
            self.finish(item, "skipped", "HTTP error", res.status_code)
            return False
        if "html" not in res.headers.get("content-type", ""):
            self.finish(item, "skipped", "Not a web page", res.status_code)
            return False
        if len(res.content) > MAX_PAGE_BYTES:
            self.finish(item, "skipped", "Too large", res.status_code)
            return False

        page = extract(res.text, url)
        content_hash = hashlib.sha1(page["text"].encode("utf-8")).hexdigest()
        if self.db.one("SELECT id FROM pages WHERE content_hash = ? AND url <> ?", (content_hash, url)):
            self.finish(item, "skipped", "Already seen", res.status_code)  # same text as a stored page
            return False

        page_id = self.save_page(url, page, content_hash)
        links = self.save_links(page_id, url, page["links"])
        if item["depth"] < self.max_depth:
            for link in links:
                self.enqueue(link, item["depth"] + 1)
        self.finish(item, "done", "Indexed", res.status_code)
        return True

    def save_page(self, url: str, page: dict, content_hash: str) -> int:
        return self.db.value(
            "INSERT INTO pages (url, host, title, body, content_hash, crawled_at) VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT (url) DO UPDATE SET title = excluded.title, body = excluded.body, "
            "content_hash = excluded.content_hash, crawled_at = excluded.crawled_at RETURNING id",
            (url, site_of(url), page["title"][:300], page["text"][:MAX_BODY_CHARS], content_hash, now()),
        )

    def save_links(self, page_id: int, url: str, hrefs: list[str]) -> list[str]:
        """Store the page's links to the seed sites and return them."""
        links = []
        for href in hrefs:
            link = normalize_url(href, url)
            if link and link != url and site_of(link) in self.sites and is_crawlable(link):
                links.append(link)
        links = list(dict.fromkeys(links))
        self.db.execute("DELETE FROM links WHERE from_page = ?", (page_id,))
        self.db.executemany("INSERT INTO links (from_page, to_url) VALUES (?, ?)", [(page_id, link) for link in links])
        return links

    # ---- the loop ----

    def run(self) -> dict:
        """Crawl until the page limit, an empty queue or a stop request."""
        crawled = self.crawled_count()
        while crawled < self.max_pages and not self.should_stop():
            item = self.next_item()
            if item is None:
                break
            if self.visit(item):
                crawled += 1
        skipped = self.db.value("SELECT COUNT(*) FROM crawl_queue WHERE status = 'skipped'") or 0
        return {"crawled": crawled, "skipped": skipped, "stopped": self.should_stop()}


def start_queue(db: Database) -> int:
    """Begin a fresh crawl: empty the queue and add every seed URL at depth 0."""
    db.execute("DELETE FROM crawl_queue")
    seeds = [normalize_url(r["url"]) for r in db.all("SELECT url FROM seeds ORDER BY id")]
    for url in filter(None, seeds):
        db.execute(
            "INSERT INTO crawl_queue (url, depth, status) VALUES (?, 0, 'queued') ON CONFLICT (url) DO NOTHING", (url,)
        )
    db.commit()
    return len(seeds)
